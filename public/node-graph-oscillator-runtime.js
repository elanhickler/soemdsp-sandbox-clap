function nodeGraphPhaseRadians(value) {
  return wrapNodeSliderValue(Number(value) || 0, 0, 1) * Math.PI * 2;
}

function nextNodeGraphNoiseSample(runtime, nodeId) {
  const seed = (Math.imul(1664525, runtime.noiseSeeds.get(nodeId) || 0x12345678) + 1013904223) >>> 0;
  runtime.noiseSeeds.set(nodeId, seed);
  return (seed / 0xffffffff) * 2 - 1;
}

function nodeGraphNoiseSeedKey(nodeId, seedValue, channel = "") {
  const seed = Math.max(0, Math.min(99999, Math.floor(Number(seedValue) || 0)));
  return `${nodeId}${channel ? `:${channel}` : ""}:seed:${seed}`;
}

function nextNodeGraphSeededNoiseSample(runtime, nodeId, seedValue, channel = "") {
  runtime.noiseSeedKeys ||= new Map();
  const noiseId = channel ? `${nodeId}:${channel}` : nodeId;
  const seedKey = nodeGraphNoiseSeedKey(nodeId, seedValue, channel);
  if (runtime.noiseSeedKeys.get(noiseId) !== seedKey) {
    runtime.noiseSeedKeys.set(noiseId, seedKey);
    runtime.noiseSeeds.set(noiseId, nodeGraphStableSeed(seedKey));
  }
  return nextNodeGraphNoiseSample(runtime, noiseId);
}

function nodeGraphNoiseSampleHoldSample(runtime, state, nodeId, seedValue, speed, sampleRate) {
  const rate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);
  const safeSpeed = clampNodeSliderValue(Number(speed) || 0, 0, 1);
  const seedKey = nodeGraphNoiseSeedKey(nodeId, seedValue);
  if (state.seedKey !== seedKey) {
    state.seedKey = seedKey;
    state.initialized = false;
    state.phase = 0;
  }
  if (!state.initialized) {
    state.held = nextNodeGraphSeededNoiseSample(runtime, nodeId, seedValue);
    state.initialized = true;
  }
  const clockRate = safeSpeed * rate * 0.5;
  if (clockRate <= 0) {
    return state.held;
  }
  state.phase += clockRate / rate;
  while (state.phase >= 1) {
    state.phase -= 1;
    state.held = nextNodeGraphSeededNoiseSample(runtime, nodeId, seedValue);
  }
  return state.held;
}

function nodeGraphPolyBlep(phaseCycle, phaseIncrement) {
  const dt = clampNodeSliderValue(Math.abs(Number(phaseIncrement) || 0), 1e-6, 0.5);
  if (phaseCycle < dt) {
    const t = phaseCycle / dt;
    return t + t - t * t - 1;
  }
  if (phaseCycle > 1 - dt) {
    const t = (phaseCycle - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

function nodeGraphPolyBlepSquare(phaseCycle, phaseIncrement) {
  let value = phaseCycle < 0.5 ? 1 : -1;
  value += nodeGraphPolyBlep(phaseCycle, phaseIncrement);
  value -= nodeGraphPolyBlep(wrapNodeSliderValue(phaseCycle + 0.5, 0, 1), phaseIncrement);
  return value;
}

function nodeGraphOscillatorWaveformSample(runtime, nodeId, phase, phaseIncrement, waveform) {
  const phaseCycle = wrapNodeSliderValue(phase / (Math.PI * 2), 0, 1);
  switch (Math.round(Number(waveform) || 0)) {
    case 1:
      return nodeGraphPolyBlepSquare(phaseCycle, phaseIncrement);
    case 2:
      {
        const triangle = runtime.triangleStates?.get(nodeId) || 0;
        const nextTriangle = (triangle + nodeGraphPolyBlepSquare(phaseCycle, phaseIncrement) * phaseIncrement * 4) * 0.995;
        runtime.triangleStates?.set(nodeId, clampNodeSliderValue(nextTriangle, -1, 1));
        return clampNodeSliderValue(nextTriangle, -1, 1);
      }
    case 3:
      return Math.sin(phase);
    case 4:
      return nextNodeGraphNoiseSample(runtime, nodeId);
    case 0:
    default:
      return 1 - phaseCycle * 2 + nodeGraphPolyBlep(phaseCycle, phaseIncrement);
  }
}

const nodeGraphAdditiveWaveformChoices = Object.freeze([
  "Sine",
  "Sawtooth",
  "Square",
  "Triangle",
  "SawSquare",
  "DoubleSaw",
  "TriSaw",
  "Organ",
]);

const nodeGraphAdditiveHardMaxHarmonics = 1024;

function nodeGraphAdditiveDampingCurveValue(value = 0) {
  return clampNodeSliderValue(Number(value) || 0, -1, 1);
}

function nodeGraphAdditiveHarmonicDamping(harmonic, frequency, sampleRate, curveValue = 0) {
  const safeRate = Math.max(1, Number(sampleRate) || nodeGraphMvp?.sampleRate || 44100);
  const safeFrequency = Math.max(0, Number(frequency) || 0);
  const nyquist = safeRate * 0.5;
  if (nyquist <= 0 || safeFrequency <= 0) {
    return 1;
  }
  const ratio = clampNodeSliderValue((Math.max(1, Number(harmonic) || 1) * safeFrequency) / nyquist, 0, 1);
  const logShape = 1 - (Math.log1p(ratio * 15) / Math.log1p(15));
  const expShape = (1 - ratio) ** 4;
  const linShape = 1 - ratio;
  const curve = nodeGraphAdditiveDampingCurveValue(curveValue);
  if (curve < 0) {
    return clampNodeSliderValue(logShape + (expShape - logShape) * (curve + 1), 0, 1);
  }
  return clampNodeSliderValue(expShape + (linShape - expShape) * curve, 0, 1);
}

function nodeGraphAdditiveWaveformHarmonic(waveform, harmonic, modA = 0.5) {
  const n = Math.max(1, Math.floor(Number(harmonic) || 1));
  const h = n;
  const mod = clampNodeSliderValue(Number(modA) || 0, 0, 1);
  switch (Math.round(Number(waveform) || 0)) {
    case 0:
      return { amplitude: n === Math.max(1, Math.floor(99 * mod + 1)) ? 1 : 0, phase: 0 };
    case 2:
      return { amplitude: n % 2 === 1 ? 1 / h : 0, phase: mod * 0.5 };
    case 3:
      return { amplitude: n % 2 === 1 ? 1 / (h * h) : 0, phase: n % 4 === 1 ? 0 : 0.5 };
    case 4:
      return { amplitude: n % 2 === 1 ? 1 / h : (1 / h) * (1 - mod), phase: 0 };
    case 5:
      return { amplitude: Math.cos(h * mod * 0.5) / h, phase: 0 };
    case 6:
      {
        const peak = clampNodeSliderValue(mod, 0.001, 0.999);
        return { amplitude: (Math.sin(0.5 * h * peak) / (peak * (1 - peak) * h * h)) * 0.2, phase: 0 };
      }
    case 7:
      {
        const octaves = Math.max(2, Math.floor(2 + mod * 11));
        let target = 1;
        while (target < n) {
          target *= octaves;
        }
        return { amplitude: target === n ? 1 / h : 0, phase: 0 };
      }
    case 1:
    default:
      return { amplitude: 1 / h, phase: n % 2 === 1 ? 0.5 : 0 };
  }
}

function nodeGraphAdditiveOscillatorSample(runtime, nodeId, phase, params = {}, sampleRate = nodeGraphMvp?.sampleRate || 44100) {
  const safeRate = Math.max(1, Number(sampleRate) || nodeGraphMvp?.sampleRate || 44100);
  const frequency = Math.max(0, Number(params.frequency) || 0);
  const maxHarmonics = Math.max(
    1,
    Math.min(nodeGraphAdditiveHardMaxHarmonics, Math.round(Number(params.harmonics) || 32)),
  );
  const waveform = Math.round(Number(params.waveform) || 0);
  const modA = clampNodeSliderValue(Number(params.modA) || 0, 0, 1);
  const level = clampNodeSliderValue(Number(params.level) || 0, 0, 1);
  const dampingCurve = nodeGraphAdditiveDampingCurveValue(params.dampingCurve);
  const harmonicLimit = Math.max(1, Math.min(maxHarmonics, Math.floor(Math.min(20000, safeRate * 0.45) / Math.max(1, frequency))));
  let total = 0;
  let norm = 0;
  for (let harmonic = 1; harmonic <= harmonicLimit; harmonic += 1) {
    const partial = nodeGraphAdditiveWaveformHarmonic(waveform, harmonic, modA);
    const amplitude = (Number(partial.amplitude) || 0) *
      nodeGraphAdditiveHarmonicDamping(harmonic, frequency, safeRate, dampingCurve);
    if (amplitude === 0) {
      continue;
    }
    total += Math.sin(phase * harmonic + (Number(partial.phase) || 0) * Math.PI * 2) * amplitude;
    norm += Math.abs(amplitude);
  }
  if (norm <= 0) {
    return 0;
  }
  return clampNodeSliderValue((total / Math.max(1, norm * 0.72)) * level, -1, 1);
}
