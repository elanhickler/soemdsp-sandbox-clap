// Shared offline JS mirror of native_modules/dsf_oscillator -- the DSF
// starter kit. See dsf_oscillator.cpp and README.md for the derivation and
// design notes; this file mirrors the same closed-form math.

function createNodeGraphDsfOscillatorState() {
  return {
    phase: 0,
    phase2: 0,
    phase3: 0,
    triangleIntegrator: 0,
  };
}

function nodeGraphDsfPow(base, exponent) {
  let result = 1;
  let b = base;
  let e = exponent;
  while (e > 0) {
    if (e & 1) result *= b;
    b *= b;
    e >>= 1;
  }
  return result;
}

// The one closed-form equation everything else is built from.
function nodeGraphDsf(x, a, n, fi) {
  const s3 = a * Math.sin(x + fi);
  const s2 = nodeGraphDsfPow(a, n) * Math.sin(n * x + fi);
  const s1 = nodeGraphDsfPow(a, n - 1) * Math.sin((n - 1) * x + fi);
  const s4 = 1 - 2 * a * Math.cos(x) + a * a;
  if (s4 > -1e-9 && s4 < 1e-9) return 0;
  // (1 - a) tames peak amplitude, which otherwise grows toward 1/(1-a) as a
  // approaches 1 (worse with a nonzero fi, as in Formant mode) -- measured
  // raw peak ~2.44 at a=0.59, fi=pi/2 without this factor.
  return (1 - a) * (Math.sin(fi) - s3 - s2 + s1) / s4;
}

// options: { frequencyHz, sampleRate, waveform (0=Sine,1=Saw/Buzz,2=Square,
//            3=Formant,4=Triangle,5=Fractal Stack), harmonics, morph (0-1),
//            pulseWidth (0-1), level }
function nodeGraphDsfOscillatorSample(state, options = {}) {
  const sampleRate = Number(options.sampleRate) > 1 ? Number(options.sampleRate) : 48000;
  const increment = clampNodeSliderValue((Number(options.frequencyHz) || 0) / sampleRate, -0.5, 0.5);
  state.phase = wrapNodeSliderValue(state.phase + increment, 0, 1);

  const n = Math.max(1, Math.min(64, Math.round(Number(options.harmonics) || 16)));
  const a = clampNodeSliderValue(0.02 + clampNodeSliderValue(Number(options.morph) || 0, 0, 1) * 0.95, 0.02, 0.97);
  const x = state.phase * Math.PI * 2;
  const waveform = Math.round(Number(options.waveform) || 0);
  const level = Number(options.level) || 0;

  let sample = 0;
  switch (waveform) {
    case 1: {
      sample = nodeGraphDsf(x, a, n, 0);
      break;
    }
    case 2: {
      const offset = clampNodeSliderValue(Number(options.pulseWidth) || 0.5, 0.001, 0.999) * Math.PI * 2;
      sample = nodeGraphDsf(x, a, n, 0) - nodeGraphDsf(x + offset, a, n, 0);
      break;
    }
    case 3: {
      const fi = clampNodeSliderValue(Number(options.pulseWidth) || 0.5, 0, 1) * Math.PI;
      sample = nodeGraphDsf(x, a, n, fi);
      break;
    }
    case 4: {
      const offset = clampNodeSliderValue(Number(options.pulseWidth) || 0.5, 0.001, 0.999) * Math.PI * 2;
      const squareLike = nodeGraphDsf(x, a, n, 0) - nodeGraphDsf(x + offset, a, n, 0);
      const next = clampNodeSliderValue((state.triangleIntegrator + squareLike * increment * 4) * 0.995, -1, 1);
      state.triangleIntegrator = next;
      sample = next;
      break;
    }
    case 5: {
      state.phase2 = wrapNodeSliderValue(state.phase2 + increment * 2, 0, 1);
      state.phase3 = wrapNodeSliderValue(state.phase3 + increment * 4, 0, 1);
      const layer1 = nodeGraphDsf(state.phase * Math.PI * 2, a, n, 0);
      const layer2 = nodeGraphDsf(state.phase2 * Math.PI * 2, a, n, 0) * 0.5;
      const layer3 = nodeGraphDsf(state.phase3 * Math.PI * 2, a, n, 0) * 0.25;
      sample = (layer1 + layer2 + layer3) / 1.75;
      break;
    }
    default:
      sample = Math.sin(x);
      break;
  }

  const out = clampNodeSliderValue(sample, -1.5, 1.5) * level;
  return { Out: out };
}
