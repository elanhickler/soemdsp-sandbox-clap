NodeLiveAudioProcessor.prototype.createBlubbState = function createBlubbState() {
    return { phase: 0, resetWasHigh: false, nativeHandle: 0 };
  };

NodeLiveAudioProcessor.prototype.blubbBipolarTriangle = function blubbBipolarTriangle(phase) {
    const p = phase - Math.floor(phase);
    return p < 0.5 ? (4 * p - 1) : (3 - 4 * p);
  };

NodeLiveAudioProcessor.prototype.blubbSampleJs = function blubbSampleJs(state, options = {}) {
    const safeRate = Math.max(1, Number(options.sampleRate) || sampleRate || 44100);
    const frequency = Number(options.frequency) || 0;
    const shape = Number(options.shape) || 0;
    const rotX = Number(options.rotX) || 0;
    const rotY = Number(options.rotY) || 0;
    const zDepth = Number(options.zDepth) || 0;

    const phase = state.phase;
    let chX, chY;
    if (shape >= 0.5) {
      chX = this.blubbBipolarTriangle(phase + 0.125);
      chY = this.blubbBipolarTriangle(phase + 0.375);
    } else {
      chX = Math.sin(phase * Math.PI * 2);
      chY = Math.cos(phase * Math.PI * 2);
    }

    const sinRotX = Math.sin(rotX * Math.PI * 2);
    const cosRotX = Math.cos(rotX * Math.PI * 2);
    const help11 = chX * cosRotX - chY * sinRotX;
    const help12 = chX * sinRotX + chY * cosRotX;
    const sinRotY = Math.sin(rotY * Math.PI * 2);
    const cosRotY = Math.cos(rotY * Math.PI * 2);
    const help21 = help11 * cosRotY;
    const z = help11 * sinRotY;

    const formula = zDepth * 1.25 * (z * 0.05 + 0.5);
    const m = 1 + zDepth;
    const x = (help21 - formula * help21) * m;
    const y = (help12 - formula * help12) * m;

    const nextPhase = state.phase + frequency / safeRate;
    state.phase = nextPhase - Math.floor(nextPhase);

    return { x, y };
  };

NodeLiveAudioProcessor.prototype.blubbSample = function blubbSample(state, options = {}) {
    const resetHigh = Number(options.reset) > 0.5;
    if (resetHigh && !state.resetWasHigh) {
      state.phase = 0;
      if (state.nativeHandle && this.nativeBlubb?.soemdsp_jbblubb_reset) {
        this.nativeBlubb.soemdsp_jbblubb_reset(state.nativeHandle);
      }
    }
    state.resetWasHigh = resetHigh;
    if (
      this.nativeBlubbReady &&
      this.nativeBlubb?.soemdsp_jbblubb_create &&
      this.nativeBlubb?.soemdsp_jbblubb_sample
    ) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativeBlubb.soemdsp_jbblubb_create();
        }
        if (state.nativeHandle) {
          const sampleRateValue = Math.max(1, Number(options.sampleRate) || sampleRate || 44100);
          this.nativeBlubb.soemdsp_jbblubb_sample(
            state.nativeHandle,
            Number(options.frequency) || 0,
            Number(options.shape) || 0,
            Number(options.rotX) || 0,
            Number(options.rotY) || 0,
            Number(options.zDepth) || 0,
            sampleRateValue,
          );
          return {
            x: this.safeFilterNumber(this.nativeBlubb.soemdsp_jbblubb_x(state.nativeHandle), null),
            y: this.safeFilterNumber(this.nativeBlubb.soemdsp_jbblubb_y(state.nativeHandle), null),
          };
        }
      } catch (error) {
        this.nativeBlubbReady = false;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "jerobeam_blubb",
          status: "disabled",
          message: String(error?.message || error || "native Jerobeam Blubb failed"),
        });
      }
    }
    return this.blubbSampleJs(state, options);
  };

