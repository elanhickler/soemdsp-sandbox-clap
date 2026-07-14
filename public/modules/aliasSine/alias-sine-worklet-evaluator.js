NodeLiveAudioProcessor.prototype.createAliasSineState = function createAliasSineState() {
    return { phase: 0, nativeHandle: 0 };
  };

NodeLiveAudioProcessor.prototype.aliasSineSampleJs = function aliasSineSampleJs(state, normFreq, level, rate) {
    const safeNormFreq = this.safeFilterNumber(normFreq, state);
    const safeLevel = this.safeFilterNumber(level, state);

    state.phase += safeNormFreq;
    state.phase -= Math.floor(state.phase);

    const out = Math.sin(state.phase * Math.PI * 2) * safeLevel;
    return this.safeFilterNumber(Math.max(-1, Math.min(1, out)), state);
  };

NodeLiveAudioProcessor.prototype.aliasSineSample = function aliasSineSample(state, normFreq, level, rate = sampleRate) {
    if (this.nativeAliasSineReady) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativeAliasSine.soemdsp_alias_sine_create();
        }
        if (state.nativeHandle) {
          return this.safeFilterNumber(
            this.nativeAliasSine.soemdsp_alias_sine_sample(
              state.nativeHandle,
              this.safeFilterNumber(normFreq, state),
              this.safeFilterNumber(level, state),
              Math.max(1, Number(rate) || sampleRate || 44100),
            ),
            state,
          );
        }
      } catch (error) {
        this.nativeAliasSineReady = false;
        state.nativeHandle = 0;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "alias_sine",
          status: "disabled",
          message: String(error?.message || error || "native Alias Sine Generator failed"),
        });
      }
    }
    return this.aliasSineSampleJs(state, normFreq, level, rate);
  };
