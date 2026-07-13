NodeLiveAudioProcessor.prototype.createLorenzAttractorState = function createLorenzAttractorState() {
    return {
      resetWasHigh: false,
      x: 0.1,
      y: 0,
      z: 0,
      nativeHandle: 0,
    };
  };

NodeLiveAudioProcessor.prototype.resetLorenzAttractorState = function resetLorenzAttractorState(state) {
    state.x = 0.1;
    state.y = 0;
    state.z = 0;
  };

NodeLiveAudioProcessor.prototype.lorenzAttractorSample = function lorenzAttractorSample(options = {}) {
    const state = options.state || this.createLorenzAttractorState();
    if (
      this.nativeLorenzAttractorReady &&
      this.nativeLorenzAttractor?.soemdsp_lorenz_attractor_create &&
      this.nativeLorenzAttractor?.soemdsp_lorenz_attractor_sample
    ) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativeLorenzAttractor.soemdsp_lorenz_attractor_create();
        }
        if (state.nativeHandle) {
          const sampleRateValue = Math.max(1, Number(options.sampleRate) || sampleRate || 44100);
          this.nativeLorenzAttractor.soemdsp_lorenz_attractor_sample(
            state.nativeHandle,
            Number(options.reset) || 0,
            Math.max(0, Number(options.speed) || 0),
            Math.max(0, Number(options.sigma) || 10),
            Number.isFinite(Number(options.rho)) ? Number(options.rho) : 28,
            Math.max(0, Number(options.beta) || 8 / 3),
            Number(options.rotate) || 0,
            Math.max(0, Number(options.scale) || 1),
            this.clampValue(Number(options.zDepth) || 0, 0, 1),
            sampleRateValue,
          );
          return {
            x: this.nativeLorenzAttractor.soemdsp_lorenz_attractor_x(state.nativeHandle),
            y: this.nativeLorenzAttractor.soemdsp_lorenz_attractor_y(state.nativeHandle),
            z: this.nativeLorenzAttractor.soemdsp_lorenz_attractor_z(state.nativeHandle),
          };
        }
      } catch (error) {
        this.nativeLorenzAttractorReady = false;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "lorenz_attractor",
          status: "disabled",
          message: String(error?.message || error || "native Lorenz Attractor failed"),
        });
      }
    }
    return this.lorenzAttractorSampleJs(options);
  };

NodeLiveAudioProcessor.prototype.lorenzAttractorSampleJs = function lorenzAttractorSampleJs(options = {}) {
    const state = options.state || this.createLorenzAttractorState();
    const resetHigh = Number(options.reset) > 0.5;
    if (resetHigh && !state.resetWasHigh) {
      this.resetLorenzAttractorState(state);
    }
    state.resetWasHigh = resetHigh;
    const sampleRateValue = Math.max(1, Number(options.sampleRate) || sampleRate || 44100);
    const speed = Math.max(0, Number(options.speed) || 0);
    const sigma = Math.max(0, Number(options.sigma) || 10);
    const rho = Number.isFinite(Number(options.rho)) ? Number(options.rho) : 28;
    const beta = Math.max(0, Number(options.beta) || 8 / 3);
    const dt = (0.75 * speed) / sampleRateValue;
    const steps = Math.max(1, Math.ceil(dt / 0.0007));
    const stepDt = steps > 0 ? dt / steps : 0;
    for (let index = 0; index < steps; index += 1) {
      const dx = sigma * (state.y - state.x);
      const dy = state.x * (rho - state.z) - state.y;
      const dz = state.x * state.y - beta * state.z;
      state.x += dx * stepDt;
      state.y += dy * stepDt;
      state.z += dz * stepDt;
      if (!Number.isFinite(state.x) || !Number.isFinite(state.y) || !Number.isFinite(state.z)) {
        this.resetLorenzAttractorState(state);
        break;
      }
    }
    const rotate = (Number(options.rotate) || 0) * Math.PI * 2;
    const cosRotate = Math.cos(rotate);
    const sinRotate = Math.sin(rotate);
    const normalizedX = state.x / 24;
    const normalizedY = state.y / 32;
    const normalizedZ = (state.z - 25) / 30;
    const depth = this.clampValue(Number(options.zDepth) || 0, 0, 1);
    const depthScale = 1 + normalizedZ * depth * 0.35;
    const scale = Math.max(0, Number(options.scale) || 1) * depthScale;
    const x = (normalizedX * cosRotate - normalizedY * sinRotate) * scale;
    const y = (normalizedX * sinRotate + normalizedY * cosRotate) * scale;
    const z = normalizedZ * scale;
    return {
      x: this.clampValue(x, -1, 1),
      y: this.clampValue(y, -1, 1),
      z: this.clampValue(z, -1, 1),
    };
  };

