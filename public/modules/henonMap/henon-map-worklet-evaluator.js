NodeLiveAudioProcessor.prototype.createHenonMapState = function createHenonMapState() {
    return { hasStarted: false, phase: 0, x: 0, y: 0, nativeHandle: 0 };
  };

NodeLiveAudioProcessor.prototype.resetHenonMapState = function resetHenonMapState(state, seedX, seedY) {
    state.x = this.clampValue(Number(seedX) || 0, -1, 1);
    state.y = this.clampValue(Number(seedY) || 0, -1, 1);
    state.phase = 0;
    state.hasStarted = true;
  };

NodeLiveAudioProcessor.prototype.henonMapSampleJs = function henonMapSampleJs(state, options = {}) {
    const resetActive = Number(options.reset) > 0;
    const sampleRateValue = Math.max(1, Number(options.sampleRate) || sampleRate || 44100);
    const rate = Math.max(0, Number(options.rate) || 0);
    const a = this.clampValue(Number(options.a) || 0, 0, 2);
    const b = this.clampValue(Number(options.b) || 0, -1, 1);
    if (resetActive || !state.hasStarted) {
      this.resetHenonMapState(state, options.seedX, options.seedY);
    }
    if (!resetActive && rate > 0) {
      state.phase += rate / sampleRateValue;
      let iterations = 0;
      while (state.phase >= 1 && iterations < 4096) {
        state.phase -= 1;
        const nextX = 1 - a * state.x * state.x + state.y;
        const nextY = b * state.x;
        state.x = this.clampValue(nextX, -4, 4);
        state.y = this.clampValue(nextY, -4, 4);
        iterations++;
      }
      if (state.phase >= 1) {
        state.phase = 0;
      }
    }
    return {
      x: this.clampValue(state.x / 1.5, -1, 1),
      y: this.clampValue(state.y / 0.45, -1, 1),
    };
  };

NodeLiveAudioProcessor.prototype.henonMapSample = function henonMapSample(state, options = {}) {
    if (
      this.nativeHenonMapReady &&
      this.nativeHenonMap?.soemdsp_henon_map_create &&
      this.nativeHenonMap?.soemdsp_henon_map_sample
    ) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativeHenonMap.soemdsp_henon_map_create();
        }
        if (state.nativeHandle) {
          const resetActive = Number(options.reset) > 0 ? 1 : 0;
          const rate = Math.max(0, Number(options.rate) || 0);
          const a = this.clampValue(Number(options.a) || 0, 0, 2);
          const b = this.clampValue(Number(options.b) || 0, -1, 1);
          const seedX = Number(options.seedX) || 0;
          const seedY = Number(options.seedY) || 0;
          const sampleRateValue = Math.max(1, Number(options.sampleRate) || sampleRate || 44100);
          this.nativeHenonMap.soemdsp_henon_map_sample(
            state.nativeHandle,
            resetActive,
            rate,
            a,
            b,
            seedX,
            seedY,
            sampleRateValue,
          );
          return {
            x: this.safeFilterNumber(this.nativeHenonMap.soemdsp_henon_map_x(state.nativeHandle), null),
            y: this.safeFilterNumber(this.nativeHenonMap.soemdsp_henon_map_y(state.nativeHandle), null),
          };
        }
      } catch (error) {
        this.nativeHenonMapReady = false;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "henon_map",
          status: "disabled",
          message: String(error?.message || error || "native Henon Map failed"),
        });
      }
    }
    return this.henonMapSampleJs(state, options);
  };

