NodeLiveAudioProcessor.prototype.createChuaAttractorState = function createChuaAttractorState() {
    return { resetWasHigh: false, x: 0.1, y: 0, z: 0, nativeHandle: 0 };
  };

NodeLiveAudioProcessor.prototype.resetChuaAttractorState = function resetChuaAttractorState(state) {
    state.x = 0.1;
    state.y = 0;
    state.z = 0;
  };

NodeLiveAudioProcessor.prototype.chuaDiode = function chuaDiode(x, m0, m1) {
    return m1 * x + 0.5 * (m0 - m1) * (Math.abs(x + 1) - Math.abs(x - 1));
  };

NodeLiveAudioProcessor.prototype.chuaAttractorSampleJs = function chuaAttractorSampleJs(state, options = {}) {
    const resetHigh = Number(options.reset) > 0.5;
    if (resetHigh && !state.resetWasHigh) {
      this.resetChuaAttractorState(state);
    }
    state.resetWasHigh = resetHigh;
    const sampleRateValue = Math.max(1, Number(options.sampleRate) || sampleRate || 44100);
    const speed = Math.max(0, Number(options.speed) || 0);
    const alpha = Number(options.alpha) || 0;
    const beta = Number(options.beta) || 0;
    const m0 = Number(options.m0) || 0;
    const m1 = Number(options.m1) || 0;
    const dt = (0.6 * speed) / sampleRateValue;
    const steps = Math.max(1, Math.ceil(dt / 0.0004));
    const stepDt = steps > 0 ? dt / steps : 0;
    for (let i = 0; i < steps; i += 1) {
      const fx = this.chuaDiode(state.x, m0, m1);
      const dx = alpha * (state.y - state.x - fx);
      const dy = state.x - state.y + state.z;
      const dz = -beta * state.y;
      state.x += dx * stepDt;
      state.y += dy * stepDt;
      state.z += dz * stepDt;
      if (!Number.isFinite(state.x) || !Number.isFinite(state.y) || !Number.isFinite(state.z)) {
        this.resetChuaAttractorState(state);
        break;
      }
    }
    state.x = this.clampValue(state.x, -20, 20);
    state.y = this.clampValue(state.y, -20, 20);
    state.z = this.clampValue(state.z, -20, 20);
    return {
      x: this.clampValue(state.x / 2.0, -1, 1),
      y: this.clampValue(state.y / 0.5, -1, 1),
      z: this.clampValue(state.z / 3.5, -1, 1),
    };
  };

NodeLiveAudioProcessor.prototype.chuaAttractorSample = function chuaAttractorSample(state, options = {}) {
    if (
      this.nativeChuaAttractorReady &&
      this.nativeChuaAttractor?.soemdsp_chua_attractor_create &&
      this.nativeChuaAttractor?.soemdsp_chua_attractor_sample
    ) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativeChuaAttractor.soemdsp_chua_attractor_create();
        }
        if (state.nativeHandle) {
          const resetActive = Number(options.reset) > 0.5 ? 1 : 0;
          const speed = Math.max(0, Number(options.speed) || 0);
          const alpha = Number(options.alpha) || 0;
          const beta = Number(options.beta) || 0;
          const m0 = Number(options.m0) || 0;
          const m1 = Number(options.m1) || 0;
          const sampleRateValue = Math.max(1, Number(options.sampleRate) || sampleRate || 44100);
          this.nativeChuaAttractor.soemdsp_chua_attractor_sample(
            state.nativeHandle,
            resetActive,
            speed,
            alpha,
            beta,
            m0,
            m1,
            sampleRateValue,
          );
          return {
            x: this.safeFilterNumber(this.nativeChuaAttractor.soemdsp_chua_attractor_x(state.nativeHandle), null),
            y: this.safeFilterNumber(this.nativeChuaAttractor.soemdsp_chua_attractor_y(state.nativeHandle), null),
            z: this.safeFilterNumber(this.nativeChuaAttractor.soemdsp_chua_attractor_z(state.nativeHandle), null),
          };
        }
      } catch (error) {
        this.nativeChuaAttractorReady = false;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "chua_attractor",
          status: "disabled",
          message: String(error?.message || error || "native Chua Attractor failed"),
        });
      }
    }
    return this.chuaAttractorSampleJs(state, options);
  };

