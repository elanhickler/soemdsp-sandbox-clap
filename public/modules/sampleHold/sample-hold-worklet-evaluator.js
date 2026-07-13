NodeLiveAudioProcessor.prototype.createSampleHoldState = function createSampleHoldState() {
    return {
      clockPhase: 0,
      held: 0,
      lastTrigger: 0,
      noise: this.createNoiseGeneratorChannelState(),
    };
  };

NodeLiveAudioProcessor.prototype.createStereoSampleHoldState = function createStereoSampleHoldState() {
    return {
      left: this.createSampleHoldState(),
      mono: this.createSampleHoldState(),
      right: this.createSampleHoldState(),
    };
  };

NodeLiveAudioProcessor.prototype.sampleHoldSample = function sampleHoldSample(state, input, trigger, threshold, sampleFrequency, sampleRate, hasInConnected, nodeId) {
    this.resetSeededState(state.noise, nodeId, 0, "sampleHoldNoise");
    const safeInput = hasInConnected
      ? this.safeFilterNumber(input, null)
      : this.nextSeededBipolar(state.noise);
    const safeTrigger = this.safeFilterNumber(trigger, null);
    const safeThreshold = this.safeFilterNumber(threshold, null);
    const safeFreq = Math.max(0, Number(sampleFrequency) || 0);
    const safeRate = Math.max(1, Number(sampleRate) || 44100);
    let internalFire = false;
    if (safeFreq > 0) {
      state.clockPhase += safeFreq / safeRate;
      if (state.clockPhase >= 1) {
        state.clockPhase -= Math.floor(state.clockPhase);
        internalFire = true;
      }
    }
    if ((state.lastTrigger <= safeThreshold && safeTrigger > safeThreshold) || internalFire) {
      state.held = safeInput;
    }
    state.lastTrigger = safeTrigger;
    return this.safeFilterNumber(state.held, null);
  };

