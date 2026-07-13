NodeLiveAudioProcessor.prototype.createSurgeOscillatorState = function createSurgeOscillatorState() {
    return {
      phase: 0,
      prevSyncIn: 0,
      hasPrevSyncIn: false,
      syncedThisSample: false,
      triangleIntegrator: 0,
      masterPhase: 0,
      internalSyncOut: 0,
      nativeHandle: 0,
    };
  };

NodeLiveAudioProcessor.prototype.surgeOscillatorWaveformSampleJs = function surgeOscillatorWaveformSampleJs(state, phaseCycle, phaseIncrement, waveform) {
    switch (waveform) {
      case 1:
        return this.polyBlepSquare(phaseCycle, phaseIncrement);
      case 2: {
        const next = this.clampValue(
          (state.triangleIntegrator + this.polyBlepSquare(phaseCycle, phaseIncrement) * phaseIncrement * 4) * 0.995,
          -1,
          1,
        );
        state.triangleIntegrator = next;
        return next;
      }
      case 3:
        return Math.sin(phaseCycle * Math.PI * 2);
      default:
        return -1 + phaseCycle * 2 - this.polyBlep(phaseCycle, phaseIncrement);
    }
  };

NodeLiveAudioProcessor.prototype.surgeOscillatorSampleJs = function surgeOscillatorSampleJs(state, options = {}) {
    const sampleRate = Number(options.sampleRate) > 1 ? Number(options.sampleRate) : 48000;
    const increment = this.clampValue((Number(options.frequencyHz) || 0) / sampleRate, -0.5, 0.5);
    const level = Number(options.level) || 0;

    state.phase = this.wrapValue(state.phase + increment, 0, 1);
    state.syncedThisSample = false;

    const masterIncrement = this.clampValue((Number(options.syncFrequencyHz) || 0) / sampleRate, -0.5, 0.5);
    state.masterPhase = this.wrapValue(state.masterPhase + masterIncrement, 0, 1);
    state.internalSyncOut = Math.sin(state.masterPhase * Math.PI * 2);

    const effectiveSyncIn = options.hasExternalSync ? (Number(options.syncIn) || 0) : state.internalSyncOut;

    if (state.hasPrevSyncIn && state.prevSyncIn <= 0 && effectiveSyncIn > 0) {
      const denom = effectiveSyncIn - state.prevSyncIn;
      const frac = denom > 1e-9 ? this.clampValue(-state.prevSyncIn / denom, 0, 1) : 0;
      state.phase = this.wrapValue((1 - frac) * increment, 0, 1);
      state.syncedThisSample = true;
    }
    state.prevSyncIn = effectiveSyncIn;
    state.hasPrevSyncIn = true;

    const phaseCycle = state.phase;
    const saw = this.surgeOscillatorWaveformSampleJs(state, phaseCycle, increment, 0) * level;
    const square = this.surgeOscillatorWaveformSampleJs(state, phaseCycle, increment, 1) * level;
    const tri = this.surgeOscillatorWaveformSampleJs(state, phaseCycle, increment, 2) * level;
    const sine = this.surgeOscillatorWaveformSampleJs(state, phaseCycle, increment, 3) * level;

    const waveform = Math.max(0, Math.min(3, Math.round(Number(options.waveform) || 0)));
    const out = [saw, square, tri, sine][waveform];

    return {
      Out: out,
      Saw: saw,
      Square: square,
      Tri: tri,
      Sine: sine,
      Synced: state.syncedThisSample ? 1 : 0,
      "Internal Sync": state.internalSyncOut,
    };
  };

NodeLiveAudioProcessor.prototype.surgeOscillatorSample = function surgeOscillatorSample(state, options = {}) {
    if (
      this.nativeSurgeOscillatorReady &&
      this.nativeSurgeOscillator?.soemdsp_surge_oscillator_create &&
      this.nativeSurgeOscillator?.soemdsp_surge_oscillator_sample
    ) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativeSurgeOscillator.soemdsp_surge_oscillator_create();
        }
        if (state.nativeHandle) {
          const sampleRate = Number(options.sampleRate) > 1 ? Number(options.sampleRate) : 48000;
          const frequencyHz = Number(options.frequencyHz) || 0;
          const syncIn = Number(options.syncIn) || 0;
          const hasExternalSync = options.hasExternalSync ? 1 : 0;
          const syncFrequencyHz = Number(options.syncFrequencyHz) || 0;
          const waveform = Math.max(0, Math.min(3, Math.round(Number(options.waveform) || 0)));
          const level = Number(options.level) || 0;
          this.nativeSurgeOscillator.soemdsp_surge_oscillator_sample(
            state.nativeHandle,
            frequencyHz,
            sampleRate,
            syncIn,
            hasExternalSync,
            syncFrequencyHz,
            waveform,
            level,
          );
          return {
            Out: Number(this.nativeSurgeOscillator.soemdsp_surge_oscillator_out(state.nativeHandle)) || 0,
            Saw: Number(this.nativeSurgeOscillator.soemdsp_surge_oscillator_saw(state.nativeHandle)) || 0,
            Square: Number(this.nativeSurgeOscillator.soemdsp_surge_oscillator_square(state.nativeHandle)) || 0,
            Tri: Number(this.nativeSurgeOscillator.soemdsp_surge_oscillator_tri(state.nativeHandle)) || 0,
            Sine: Number(this.nativeSurgeOscillator.soemdsp_surge_oscillator_sine(state.nativeHandle)) || 0,
            Synced: Number(this.nativeSurgeOscillator.soemdsp_surge_oscillator_synced(state.nativeHandle)) || 0,
            "Internal Sync": Number(this.nativeSurgeOscillator.soemdsp_surge_oscillator_internal_sync(state.nativeHandle)) || 0,
          };
        }
      } catch (error) {
        this.nativeSurgeOscillatorReady = false;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "surge_oscillator",
          status: "disabled",
          message: String(error?.message || error || "native Surge Oscillator failed"),
        });
      }
    }
    return this.surgeOscillatorSampleJs(state, options);
  };

