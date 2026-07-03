// Shared offline JS mirror of native_modules/dsf_oscillator -- the DSF
// starter kit. See dsf_oscillator.cpp for the full derivation and design
// notes. FOURTH REWRITE: the third rewrite transcribed
// DSFOscillatorSineSaw's closed form correctly but missed the leaky-
// integrator architecture around it (DSF() is a rate of change that gets
// accumulated, not a direct per-sample waveform), and guessed at Square's
// formula from a partial header excerpt instead of using the real one.
// This version faithfully reproduces DSFOscillatorBase::run()'s leaky
// integrator plus both DSFOscillatorSineSaw and DSFOscillatorSineSquare's
// real, distinct closed forms and morphChanged() coefficients. A DC
// blocker and adaptive peak-follower are added on top of the real
// architecture -- verified numerically (Python) that without them, the
// real formula's own accumulator drifts to a flat, fully-clipped DC value
// at high Morph (a documented bug in the original: "morph_ not consistent
// in volume"), which sounds like silence, not a working oscillator.

function createNodeGraphDsfGeneratorState() {
  return { leak: 1, preAmpAdjustOut: 0, peak: 1, dcLastInput: 0, dcLastOutput: 0 };
}

function createNodeGraphDsfOscillatorState() {
  return {
    phase: 0,
    saw: createNodeGraphDsfGeneratorState(),
    square: createNodeGraphDsfGeneratorState(),
  };
}

function nodeGraphDsfMap01(t, a, b) {
  return a + t * (b - a);
}

// DSFOscillatorSineSaw::morphChanged(), transcribed.
function nodeGraphDsfSawMorphCoeffs(morph) {
  const m = clampNodeSliderValue(Number(morph) || 0, 0, 1);
  const k = (1 - Math.pow(m, 0.14)) * 4;
  const k2 = k * k;
  const k42 = Math.pow(4, k2);
  return { k2, k42, ampAdjust: nodeGraphDsfMap01(m, 3.15, 2.7) };
}

// DSFOscillatorSineSaw::DSF(), transcribed. dsfState is phase in radians
// [0, 2*pi).
function nodeGraphDsfSawDsf(dsfState, numPartials, c) {
  const x = dsfState;
  const xn = dsfState * numPartials;
  const cosx = Math.cos(x);
  const cosxn = Math.cos(xn);
  const sinx = Math.sin(x);
  const sinxn = Math.sin(xn);
  const den = 1 - Math.pow(2, 1 + c.k2) * cosx + c.k42;
  if (den > -1e-9 && den < 1e-9) return 0;
  const num = (c.k42 * cosxn - Math.pow(8, c.k2) * (cosxn * cosx - sinxn * sinx)) *
                  Math.pow(2, -c.k2 * (numPartials + 1)) +
              cosx * c.k42 - Math.pow(2, c.k2);
  return num / den;
}

// DSFOscillatorSineSquare::morphChanged(), transcribed.
function nodeGraphDsfSquareMorphCoeffs(morph) {
  const m = clampNodeSliderValue(Number(morph) || 0, 0, 1);
  const k = 1 - (1 / (Math.pow(m / 2 + 0.25, 14) * 10000 + 1)) + 1e-12;
  return { k, ampAdjust: nodeGraphDsfMap01(m, 0.34, 0.81) };
}

// DSFOscillatorSineSquare::DSF(), transcribed. Guarded against k -> 0 and
// the denominator's own zero -- both real edge cases of this formula, not
// artifacts (verified against exact math in Python before shipping).
function nodeGraphDsfSquareDsf(dsfState, numPartials, c) {
  const x = dsfState;
  const k = c.k;
  if (k > -1e-9 && k < 1e-9) return 0;
  const powKNP1 = Math.pow(k, numPartials + 1);
  const den = k * (1 + k * k - 2 * k * Math.cos(2 * x));
  if (den > -1e-12 && den < 1e-12) return 0;
  const num = powKNP1 * k * Math.cos(x * (2 * numPartials - 1)) -
              powKNP1 * Math.cos(x * (2 * numPartials + 1)) -
              k * Math.cos(x) * (k - 1);
  return 8 * (num / den);
}

// One sample of DSFOscillatorBase::run(): leaky-integrate DSF() (scaled by
// increment, i.e. treated as a rate of change), then a DC blocker and
// adaptive peak-follower on top -- see file header for why.
function nodeGraphDsfRunGenerator(g, dsf, increment, ampAdjust) {
  g.leak = g.leak * 0.99 + 0.000005;
  g.preAmpAdjustOut = g.preAmpAdjustOut * (1 - g.leak) + dsf * increment;
  const raw = g.preAmpAdjustOut * ampAdjust;

  const r = 0.995;
  const dcOut = raw - g.dcLastInput + r * g.dcLastOutput;
  g.dcLastInput = raw;
  g.dcLastOutput = dcOut;

  g.peak = Math.max(1, g.peak * 0.999 + Math.abs(dcOut) * 0.001);
  return dcOut / g.peak;
}

// options: { frequencyHz, sampleRate, waveform (0=Sine,1=Saw,2=Square,
//            3=Saw+Square mix), morph (0-1), mix (0-1), level }
function nodeGraphDsfOscillatorSample(state, options = {}) {
  const sampleRate = Number(options.sampleRate) > 1 ? Number(options.sampleRate) : 48000;
  const safeFrequency = Number(options.frequencyHz) > 1 ? Number(options.frequencyHz) : 1;
  const increment = clampNodeSliderValue((Number(options.frequencyHz) || 0) / sampleRate, -0.5, 0.5);
  // calculateState(): phase_ += increment_ * 0.9999; dsfState_ = wrap(phase_) * TAU.
  state.phase = wrapNodeSliderValue(state.phase + increment * 0.9999, 0, 1);
  const dsfState = state.phase * Math.PI * 2;

  const nyquist = sampleRate * 0.5;
  const numPartialsSaw = Math.max(1, nyquist / safeFrequency);
  const numPartialsSquare = Math.max(1, numPartialsSaw * 0.5);

  const waveform = Math.round(Number(options.waveform) || 0);
  const level = Number(options.level) || 0;

  let sample;
  switch (waveform) {
    case 1: {
      const c = nodeGraphDsfSawMorphCoeffs(options.morph);
      const dsf = nodeGraphDsfSawDsf(dsfState, numPartialsSaw, c);
      sample = nodeGraphDsfRunGenerator(state.saw, dsf, increment, c.ampAdjust);
      break;
    }
    case 2: {
      const c = nodeGraphDsfSquareMorphCoeffs(options.morph);
      const dsf = nodeGraphDsfSquareDsf(dsfState, numPartialsSquare, c);
      sample = nodeGraphDsfRunGenerator(state.square, dsf, increment, c.ampAdjust);
      break;
    }
    case 3: {
      const sc = nodeGraphDsfSawMorphCoeffs(options.morph);
      const sawDsf = nodeGraphDsfSawDsf(dsfState, numPartialsSaw, sc);
      const sawOut = nodeGraphDsfRunGenerator(state.saw, sawDsf, increment, sc.ampAdjust);
      const qc = nodeGraphDsfSquareMorphCoeffs(options.morph);
      const squareDsf = nodeGraphDsfSquareDsf(dsfState, numPartialsSquare, qc);
      const squareOut = nodeGraphDsfRunGenerator(state.square, squareDsf, increment, qc.ampAdjust);
      const blend = clampNodeSliderValue(Number(options.mix) || 0, 0, 1);
      sample = sawOut * (1 - blend) + squareOut * blend;
      break;
    }
    default:
      sample = Math.sin(dsfState);
      break;
  }

  if (!Number.isFinite(sample)) sample = 0;
  const out = clampNodeSliderValue(sample, -1.5, 1.5) * level;
  return { Out: out };
}
