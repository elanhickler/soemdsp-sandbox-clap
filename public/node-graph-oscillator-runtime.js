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
