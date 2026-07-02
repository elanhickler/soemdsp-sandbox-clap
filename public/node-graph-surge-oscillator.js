// Shared offline JS mirror of native_modules/surge_oscillator. Owns its
// own phase accumulator (unlike the built-in polyBlep oscillators, which are
// phase-driven from outside) so it can force a phase reset on a hard sync
// trigger. Reuses nodeGraphPolyBlep/nodeGraphPolyBlepSquare from
// node-graph-oscillator-runtime.js -- the same PolyBLEP correction that
// smooths an ordinary cycle wrap also smooths a sync-forced reset, since both
// are just "phaseCycle lands near 0" from the waveform function's point of view.

function createNodeGraphSurgeOscillatorState() {
  return {
    phase: 0,
    prevSyncIn: 0,
    hasPrevSyncIn: false,
    syncedThisSample: false,
    triangleIntegrator: 0,
  };
}

function nodeGraphSurgeOscillatorWaveformSample(state, phaseCycle, phaseIncrement, waveform) {
  switch (waveform) {
    case 1:
      return nodeGraphPolyBlepSquare(phaseCycle, phaseIncrement);
    case 2: {
      const next = clampNodeSliderValue(
        (state.triangleIntegrator + nodeGraphPolyBlepSquare(phaseCycle, phaseIncrement) * phaseIncrement * 4) * 0.995,
        -1,
        1,
      );
      state.triangleIntegrator = next;
      return next;
    }
    case 3:
      return Math.sin(phaseCycle * Math.PI * 2);
    default:
      return -1 + phaseCycle * 2 - nodeGraphPolyBlep(phaseCycle, phaseIncrement);
  }
}

// options: { frequencyHz, sampleRate, syncIn, waveform (0=saw,1=square,2=tri,3=sine), level }
function nodeGraphSurgeOscillatorSample(state, options = {}) {
  const sampleRate = Number(options.sampleRate) > 1 ? Number(options.sampleRate) : 48000;
  const increment = clampNodeSliderValue((Number(options.frequencyHz) || 0) / sampleRate, -0.5, 0.5);
  const syncIn = Number(options.syncIn) || 0;
  const level = Number(options.level) || 0;

  state.phase = wrapNodeSliderValue(state.phase + increment, 0, 1);
  state.syncedThisSample = false;

  if (state.hasPrevSyncIn && state.prevSyncIn <= 0 && syncIn > 0) {
    const denom = syncIn - state.prevSyncIn;
    const frac = denom > 1e-9 ? clampNodeSliderValue(-state.prevSyncIn / denom, 0, 1) : 0;
    state.phase = wrapNodeSliderValue((1 - frac) * increment, 0, 1);
    state.syncedThisSample = true;
  }
  state.prevSyncIn = syncIn;
  state.hasPrevSyncIn = true;

  const phaseCycle = state.phase;
  const saw = nodeGraphSurgeOscillatorWaveformSample(state, phaseCycle, increment, 0) * level;
  const square = nodeGraphSurgeOscillatorWaveformSample(state, phaseCycle, increment, 1) * level;
  const tri = nodeGraphSurgeOscillatorWaveformSample(state, phaseCycle, increment, 2) * level;
  const sine = nodeGraphSurgeOscillatorWaveformSample(state, phaseCycle, increment, 3) * level;

  const waveform = Math.max(0, Math.min(3, Math.round(Number(options.waveform) || 0)));
  const out = [saw, square, tri, sine][waveform];

  return {
    Out: out,
    Saw: saw,
    Square: square,
    Tri: tri,
    Sine: sine,
    Synced: state.syncedThisSample ? 1 : 0,
  };
}
