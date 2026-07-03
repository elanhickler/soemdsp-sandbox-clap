// Shared offline JS mirror of native_modules/dsf_oscillator -- the DSF
// starter kit. See dsf_oscillator.cpp for the full derivation, the bug this
// rewrite fixed (Harmonics=1 wasn't a plain sine under the original
// geometric-decay formula), and design notes.
//
// Uses an equal-weighted harmonic sum (Dirichlet-kernel-style), sourced from
// Walter H. Hackett's own reference implementations, instead of the original
// geometric-ratio DSF formula. Verified: Harmonics=1 gives a single clean
// spectral peak at the fundamental for every waveform.

function createNodeGraphDsfOscillatorState() {
  return {
    phase: 0,
    phase2: 0,
    phase3: 0,
    triangleIntegrator: 0,
    dcBlockLastInput: 0,
    dcBlockLastOutput: 0,
  };
}

// Equal-weighted harmonic sum, harmonics 1..n. Verified: N=1 gives a single
// clean spectral peak at the fundamental; peak amplitude is always exactly
// 2N, at the t=0 singularity (handled via its L'Hopital limit).
function nodeGraphDsfPureSaw(t, n) {
  const nSafe = n < 1 ? 1 : n;
  const denom = Math.sin(Math.PI * t);
  let ratio;
  if (denom > -1e-9 && denom < 1e-9) {
    ratio = 2 * nSafe + 1;
  } else {
    ratio = Math.sin(Math.PI * t * (2 * nSafe + 1)) / denom;
  }
  const raw = ratio - 1;
  const peak = 2 * nSafe;
  return raw / peak;
}

// Equal-weighted ODD harmonic sum. m = n/2 harmonic pairs; m=0 is silence.
// Peak amplitude is always exactly 4m, at t=0 (+4m) and t=0.5 (-4m).
function nodeGraphDsfPureSquare(t, n) {
  const m = Math.floor(n / 2);
  if (m < 1) return 0;
  const denom = Math.sin(2 * Math.PI * t);
  let raw;
  if (denom > -1e-9 && denom < 1e-9) {
    const tw = wrapNodeSliderValue(t, 0, 1);
    raw = (tw < 0.25 || tw > 0.75) ? (4 * m) : (-4 * m);
  } else {
    raw = 2 * Math.sin(4 * Math.PI * t * m) / denom;
  }
  const peak = 4 * m;
  return raw / peak;
}

// Smooth crossfade between harmonic count 1 (a plain sine) and n, so Morph
// sweeps continuously instead of stepping between integer harmonic counts.
function nodeGraphDsfMorphedHarmonicWaveform(t, n, morph, square) {
  const target = 1 + clampNodeSliderValue(Number(morph) || 0, 0, 1) * (n - 1);
  const lowN = Math.floor(target);
  const highN = Math.min(lowN + 1, n);
  const frac = target - lowN;
  const lowVal = square ? nodeGraphDsfPureSquare(t, Math.max(lowN, 2)) : nodeGraphDsfPureSaw(t, Math.max(lowN, 1));
  const highVal = square ? nodeGraphDsfPureSquare(t, Math.max(highN, 2)) : nodeGraphDsfPureSaw(t, Math.max(highN, 1));
  return lowVal * (1 - frac) + highVal * frac;
}

// Kept as a defensive safety net -- see dsf_oscillator.cpp. r=0.995 (~38Hz
// cutoff), tightened from an initial 0.9995 that left a measurable residual
// near-DC component from Triangle mode's leaky integrator at high harmonic
// counts, caught by FFT, not assumed clean.
function nodeGraphDsfDcBlock(state, input) {
  const r = 0.995;
  const output = input - state.dcBlockLastInput + r * state.dcBlockLastOutput;
  state.dcBlockLastInput = input;
  state.dcBlockLastOutput = output;
  return output;
}

// options: { frequencyHz, sampleRate, waveform (0=Sine,1=Saw/Buzz,2=Square,
//            3=Formant [Saw/Square blend],4=Triangle,5=Fractal Stack),
//            harmonics, morph (0-1), pulseWidth (0-1), level }
function nodeGraphDsfOscillatorSample(state, options = {}) {
  const sampleRate = Number(options.sampleRate) > 1 ? Number(options.sampleRate) : 48000;
  const increment = clampNodeSliderValue((Number(options.frequencyHz) || 0) / sampleRate, -0.5, 0.5);
  state.phase = wrapNodeSliderValue(state.phase + increment, 0, 1);

  // The Harmonics slider is a ceiling, not a fixed count: if N*frequency were
  // allowed above Nyquist, that excess content would alias back down.
  const nyquist = sampleRate * 0.5;
  const safeFrequency = Number(options.frequencyHz) > 1 ? Number(options.frequencyHz) : 1;
  const nyquistCappedHarmonics = Math.floor(nyquist / safeFrequency);
  const requestedHarmonics = Math.max(1, Math.min(64, Math.round(Number(options.harmonics) || 16)));
  const n = Math.max(1, Math.min(requestedHarmonics, nyquistCappedHarmonics));
  const t = state.phase;
  const waveform = Math.round(Number(options.waveform) || 0);
  const morph = Number(options.morph) || 0;
  const level = Number(options.level) || 0;

  let sample = 0;
  switch (waveform) {
    case 1: {
      sample = nodeGraphDsfMorphedHarmonicWaveform(t, n, morph, false);
      break;
    }
    case 2: {
      sample = nodeGraphDsfMorphedHarmonicWaveform(t, n, morph, true);
      break;
    }
    case 3: {
      // Formant: a verified Saw/Square blend, not the original geometric-DSF
      // phase-offset approach (which caused the earlier DC-bias bug).
      const blend = clampNodeSliderValue(Number(options.pulseWidth) || 0.5, 0, 1);
      const sawPart = nodeGraphDsfMorphedHarmonicWaveform(t, n, morph, false);
      const squarePart = nodeGraphDsfMorphedHarmonicWaveform(t, n, morph, true);
      sample = sawPart * (1 - blend) + squarePart * blend;
      break;
    }
    case 4: {
      const squareLike = nodeGraphDsfMorphedHarmonicWaveform(t, n, morph, true);
      const next = clampNodeSliderValue((state.triangleIntegrator + squareLike * increment * 4) * 0.995, -1, 1);
      state.triangleIntegrator = next;
      sample = next;
      break;
    }
    case 5: {
      state.phase2 = wrapNodeSliderValue(state.phase2 + increment * 2, 0, 1);
      state.phase3 = wrapNodeSliderValue(state.phase3 + increment * 4, 0, 1);
      const n2 = Math.max(1, Math.min(requestedHarmonics, Math.floor(nyquist / (safeFrequency * 2))));
      const n3 = Math.max(1, Math.min(requestedHarmonics, Math.floor(nyquist / (safeFrequency * 4))));
      const layer1 = nodeGraphDsfMorphedHarmonicWaveform(t, n, morph, false);
      const layer2 = nodeGraphDsfMorphedHarmonicWaveform(state.phase2, n2, morph, false) * 0.5;
      const layer3 = nodeGraphDsfMorphedHarmonicWaveform(state.phase3, n3, morph, false) * 0.25;
      sample = (layer1 + layer2 + layer3) / 1.75;
      break;
    }
    default:
      sample = Math.sin(t * Math.PI * 2);
      break;
  }

  const dcFreeSample = nodeGraphDsfDcBlock(state, sample);
  const out = clampNodeSliderValue(dcFreeSample, -1.5, 1.5) * level;
  return { Out: out };
}
