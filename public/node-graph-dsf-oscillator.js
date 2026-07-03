// Shared offline JS mirror of native_modules/dsf_oscillator -- the DSF
// starter kit. See dsf_oscillator.cpp for the full derivation and design
// notes. THIRD REWRITE: a faithful port of DSFOscillatorSineSaw /
// DSFOscillatorSineSquare from soemdsp/include/soemdsp/oscillator/
// DSFOscillator.hpp -- the classes a real, shipped Soundemote VST2 plugin
// (SoEmSawSquareSine) uses in production. No user-facing "Harmonics"
// slider (the two earlier rewrites both invented one, and both got real
// feedback that they didn't sound right): numPartials_ is always
// Nyquist/frequency, auto-derived, never user-set. Morph (0-1) is the only
// timbre knob: 0 is an exact sine, 1 opens up into the full
// numPartials_-harmonic saw/square.

function createNodeGraphDsfOscillatorState() {
  return {
    phase: 0,
    sawPeak: 1,
    squarePeak: 1,
  };
}

// Same log2/exp2-based pow as dsf_oscillator.cpp uses on the wasm side --
// JS has Math.pow natively, so just use it directly here; no bit-trick
// approximation needed off the native path.
function nodeGraphDsfMorphCoeffs(morph) {
  const m = clampNodeSliderValue(Number(morph) || 0, 0, 1);
  const k = (1 - Math.pow(m, 0.14)) * 4;
  const k2 = k * k;
  const k42 = Math.pow(4, k2);
  return { k, k2, k42 };
}

// Raw DSF closed form (DSFOscillatorSineSaw::DSF(), transcribed) -- shared
// between Saw and Square, which differ only in what phase/partial count
// they're evaluated at.
function nodeGraphDsfRaw(x, numPartials, c) {
  const xn = x * numPartials;
  const cosx = Math.cos(x);
  const cosxn = Math.cos(xn);
  const sinx = Math.sin(x);
  const sinxn = Math.sin(xn);
  const num = (c.k42 * cosxn - Math.pow(8, c.k2) * (cosxn * cosx - sinxn * sinx)) *
                  Math.pow(2, -c.k2 * (numPartials + 1)) +
              cosx * c.k42 - Math.pow(2, c.k2);
  const den = 1 - Math.pow(2, 1 + c.k2) * cosx + c.k42;
  return num / den;
}

// den has a removable singularity whose location on the cycle moves with
// morph (not fixed at x=0 -- verified numerically before shipping).
// Detect any resulting spike by magnitude and replace it with the average
// of two neighboring, non-singular evaluations.
function nodeGraphDsfCore(x, numPartials, c) {
  let result = nodeGraphDsfRaw(x, numPartials, c);
  if (!Number.isFinite(result) || result > 40 || result < -40) {
    const a = nodeGraphDsfRaw(x - 0.02, numPartials, c);
    const b = nodeGraphDsfRaw(x + 0.02, numPartials, c);
    const aOk = Number.isFinite(a) && a <= 40 && a >= -40;
    const bOk = Number.isFinite(b) && b <= 40 && b >= -40;
    if (aOk && bOk) result = (a + b) * 0.5;
    else if (aOk) result = a;
    else if (bOk) result = b;
    else result = 0;
  }
  return result;
}

function nodeGraphDsfSaw(phase, numPartials, c) {
  return nodeGraphDsfCore(phase, numPartials, c);
}

// Square: derived from Saw at a half-period offset (saw(t) - saw(t+pi)),
// rather than an independently-guessed second closed form -- see
// dsf_oscillator.cpp's dsfSquare() comment for why. Cancels even
// harmonics, doubles odd ones; at morph=0 reduces to an exact sine, same
// as every other mode in this module.
function nodeGraphDsfSquare(phase, numPartials, c) {
  const a = nodeGraphDsfCore(phase, numPartials, c);
  const b = nodeGraphDsfCore(phase + Math.PI, numPartials, c);
  return (a - b) * 0.5;
}

// options: { frequencyHz, sampleRate, waveform (0=Sine,1=Saw,2=Square,
//            3=Saw+Square mix), morph (0-1), mix (0-1), level }
function nodeGraphDsfOscillatorSample(state, options = {}) {
  const sampleRate = Number(options.sampleRate) > 1 ? Number(options.sampleRate) : 48000;
  const safeFrequency = Number(options.frequencyHz) > 1 ? Number(options.frequencyHz) : 1;
  const increment = clampNodeSliderValue((Number(options.frequencyHz) || 0) / sampleRate, -0.5, 0.5) * Math.PI * 2;
  state.phase = wrapNodeGraphDsfRadians(state.phase + increment);

  const nyquist = sampleRate * 0.5;
  const numPartialsSaw = Math.max(1, nyquist / safeFrequency);
  const numPartialsSquare = numPartialsSaw;

  const coeffs = nodeGraphDsfMorphCoeffs(options.morph);
  const waveform = Math.round(Number(options.waveform) || 0);
  const level = Number(options.level) || 0;

  let sample;
  switch (waveform) {
    case 1: {
      const raw = nodeGraphDsfSaw(state.phase, numPartialsSaw, coeffs);
      state.sawPeak = Math.max(1, state.sawPeak * 0.999 + Math.abs(raw) * 0.001);
      sample = raw / state.sawPeak;
      break;
    }
    case 2: {
      const raw = nodeGraphDsfSquare(state.phase, numPartialsSquare, coeffs);
      state.squarePeak = Math.max(1, state.squarePeak * 0.999 + Math.abs(raw) * 0.001);
      sample = raw / state.squarePeak;
      break;
    }
    case 3: {
      const rawSaw = nodeGraphDsfSaw(state.phase, numPartialsSaw, coeffs);
      state.sawPeak = Math.max(1, state.sawPeak * 0.999 + Math.abs(rawSaw) * 0.001);
      const rawSquare = nodeGraphDsfSquare(state.phase, numPartialsSquare, coeffs);
      state.squarePeak = Math.max(1, state.squarePeak * 0.999 + Math.abs(rawSquare) * 0.001);
      const sawOut = rawSaw / state.sawPeak;
      const squareOut = rawSquare / state.squarePeak;
      const blend = clampNodeSliderValue(Number(options.mix) || 0, 0, 1);
      sample = sawOut * (1 - blend) + squareOut * blend;
      break;
    }
    default:
      sample = Math.sin(state.phase);
      break;
  }

  if (!Number.isFinite(sample)) sample = 0;
  const out = clampNodeSliderValue(sample, -1.5, 1.5) * level;
  return { Out: out };
}

function wrapNodeGraphDsfRadians(value) {
  const twoPi = Math.PI * 2;
  let v = value;
  while (v > Math.PI) v -= twoPi;
  while (v < -Math.PI) v += twoPi;
  return v;
}
