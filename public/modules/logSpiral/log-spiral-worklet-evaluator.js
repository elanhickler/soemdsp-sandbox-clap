NodeLiveAudioProcessor.prototype.createLogSpiralState = function createLogSpiralState() {
    return {
      phase: 0,
      spinPhase: 0,
      nativeHandle: 0,
    };
  };

NodeLiveAudioProcessor.prototype.logSpiralWrap01 = function logSpiralWrap01(value) {
    return value - Math.floor(value);
  };

NodeLiveAudioProcessor.prototype.logSpiralSample = function logSpiralSample(state, options = {}) {
    if (
      this.nativeLogSpiralReady &&
      this.nativeLogSpiral?.soemdsp_log_spiral_create &&
      this.nativeLogSpiral?.soemdsp_log_spiral_sample
    ) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativeLogSpiral.soemdsp_log_spiral_create();
        }
        if (state.nativeHandle) {
          const sampleRateValue = Math.max(1, Number(options.sampleRate) || sampleRate || 44100);
          this.nativeLogSpiral.soemdsp_log_spiral_sample(
            state.nativeHandle,
            Number(options.frequency) || 0,
            Number(options.spin) || 0,
            Math.max(0, Number(options.size) || 0),
            Number(options.growth) || 0,
            Math.max(0.1, Number(options.turns) || 1),
            sampleRateValue,
          );
          return {
            x: this.nativeLogSpiral.soemdsp_log_spiral_x(state.nativeHandle),
            y: this.nativeLogSpiral.soemdsp_log_spiral_y(state.nativeHandle),
            z: this.nativeLogSpiral.soemdsp_log_spiral_z(state.nativeHandle),
          };
        }
      } catch (error) {
        this.nativeLogSpiralReady = false;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "log_spiral",
          status: "disabled",
          message: String(error?.message || error || "native Logarithmic Spiral failed"),
        });
      }
    }
    return this.logSpiralSampleJs(state, options);
  };

NodeLiveAudioProcessor.prototype.logSpiralSampleJs = function logSpiralSampleJs(state, options = {}) {
    const sampleRateValue = Math.max(1, Number(options.sampleRate) || sampleRate || 44100);
    const frequency = Number(options.frequency) || 0;
    const spin = Number(options.spin) || 0;
    const size = Math.max(0, Number(options.size) || 0);
    const growth = Number(options.growth) || 0;
    const turns = Math.max(0.1, Number(options.turns) || 1);

    const mainPhase = this.logSpiralWrap01(state.phase);
    state.phase = this.logSpiralWrap01(state.phase + frequency / sampleRateValue);
    const spinPhaseValue = this.logSpiralWrap01(state.spinPhase);
    state.spinPhase = this.logSpiralWrap01(state.spinPhase + spin / sampleRateValue);

    const theta = turns * Math.PI * 2 * mainPhase;
    const envelope = Math.exp(growth * (mainPhase - 0.5));
    const radius = size * envelope;

    const rawX = radius * Math.cos(theta);
    const rawY = radius * Math.sin(theta);

    const spinAngle = spinPhaseValue * Math.PI * 2;
    const cosSpin = Math.cos(spinAngle);
    const sinSpin = Math.sin(spinAngle);
    const x = rawX * cosSpin - rawY * sinSpin;
    const y = rawX * sinSpin + rawY * cosSpin;
    const z = envelope - 1;

    return { x, y, z };
  };

