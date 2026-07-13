NodeLiveAudioProcessor.prototype.createLogisticMapState = function createLogisticMapState() {
    return {
      hasStarted: false,
      phase: 0,
      x: 0.5,
      nativeHandle: 0,
    };
  };

NodeLiveAudioProcessor.prototype.resetLogisticMapState = function resetLogisticMapState(state, seed) {
    state.x = this.clampValue(Number(seed) || 0.5, 0.0001, 0.9999);
    state.phase = 0;
    state.hasStarted = true;
  };

NodeLiveAudioProcessor.prototype.logisticMapSampleJs = function logisticMapSampleJs(state, options = {}) {
    const resetActive = Number(options.reset) > 0;
    const sampleRateValue = Math.max(1, Number(options.sampleRate) || sampleRate || 44100);
    const rate = Math.max(0, Number(options.rate) || 0);
    const r = this.clampValue(Number(options.r) || 0, 0, 4);
    const seed = this.clampValue(Number(options.seed) || 0.5, 0.0001, 0.9999);
    if (resetActive || !state.hasStarted) {
      this.resetLogisticMapState(state, seed);
    }
    if (!resetActive && rate > 0) {
      state.phase += rate / sampleRateValue;
      let iterations = 0;
      while (state.phase >= 1 && iterations < 4096) {
        state.phase -= 1;
        state.x = this.clampValue(r * state.x * (1 - state.x), 0, 1);
        iterations++;
      }
      if (state.phase >= 1) {
        state.phase = 0;
      }
    }
    return state.x * 2 - 1;
  };

NodeLiveAudioProcessor.prototype.logisticMapSample = function logisticMapSample(state, options = {}) {
    const level = Number(options.level) || 0;
    if (
      this.nativeLogisticMapReady &&
      this.nativeLogisticMap?.soemdsp_logistic_map_create &&
      this.nativeLogisticMap?.soemdsp_logistic_map_sample
    ) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativeLogisticMap.soemdsp_logistic_map_create();
        }
        if (state.nativeHandle) {
          const resetActive = Number(options.reset) > 0 ? 1 : 0;
          const rate = Math.max(0, Number(options.rate) || 0);
          const r = this.clampValue(Number(options.r) || 0, 0, 4);
          const seed = this.clampValue(Number(options.seed) || 0.5, 0.0001, 0.9999);
          const sampleRateValue = Math.max(1, Number(options.sampleRate) || sampleRate || 44100);
          const scaled = this.nativeLogisticMap.soemdsp_logistic_map_sample(
            state.nativeHandle,
            resetActive,
            rate,
            r,
            seed,
            level,
            sampleRateValue,
          );
          return this.safeFilterNumber(scaled, null);
        }
      } catch (error) {
        this.nativeLogisticMapReady = false;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "logistic_map",
          status: "disabled",
          message: String(error?.message || error || "native Logistic Map failed"),
        });
      }
    }
    return this.logisticMapSampleJs(state, options) * level;
  };

