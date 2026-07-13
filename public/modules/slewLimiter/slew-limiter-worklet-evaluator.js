NodeLiveAudioProcessor.prototype.createSlewLimiterState = function createSlewLimiterState() {
    return {
      initialized: false,
      out: 0,
    };
  };

NodeLiveAudioProcessor.prototype.createStereoSlewLimiterState = function createStereoSlewLimiterState() {
    return {
      left: this.createSlewLimiterState(),
      mono: this.createSlewLimiterState(),
      right: this.createSlewLimiterState(),
    };
  };

NodeLiveAudioProcessor.prototype.slewLimiterSample = function slewLimiterSample(state, input, upTime, downTime, rate = sampleRate) {
    const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
    const target = this.safeFilterNumber(input, state);
    if (!state.initialized) {
      state.initialized = true;
      state.out = target;
      return target;
    }
    const upSeconds = Math.max(0, this.safeFilterNumber(upTime, state));
    const downSeconds = Math.max(0, this.safeFilterNumber(downTime, state));
    const delta = target - state.out;
    const maxRise = upSeconds <= 0 ? Infinity : 1 / Math.max(1, upSeconds * safeRate);
    const maxFall = downSeconds <= 0 ? Infinity : 1 / Math.max(1, downSeconds * safeRate);
    state.out = this.safeFilterNumber(
      state.out + Math.max(-maxFall, Math.min(maxRise, delta)),
      state,
    );
    return state.out;
  };

