NodeLiveAudioProcessor.prototype.createTriggerCounterState = function createTriggerCounterState() {
    return {
      count: 0,
      lastReset: 0,
      lastTrigger: 0,
      remainingSamples: 0,
    };
  };

NodeLiveAudioProcessor.prototype.triggerCounterSample = function triggerCounterSample(state, trigger, reset, params, rate = sampleRate) {
    const safeTrigger = this.safeFilterNumber(trigger, null);
    const safeReset = this.safeFilterNumber(reset, null);
    const threshold = this.safeFilterNumber(params.threshold, null);
    const countMax = Math.max(1, this.safeFilterNumber(params.countMax, null));
    const increment = Math.max(0, this.safeFilterNumber(params.increment, null));
    const pulseTime = Math.max(0, this.safeFilterNumber(params.pulseTime, null));
    const level = this.safeFilterNumber(params.level, null);
    if (state.lastReset <= threshold && safeReset > threshold) {
      state.count = 0;
      state.remainingSamples = 0;
    }
    if (state.lastTrigger <= threshold && safeTrigger > threshold) {
      state.count += increment;
      if (state.count >= countMax) {
        state.count = countMax > 0 ? state.count % countMax : 0;
        state.remainingSamples = Math.max(1, Math.round(pulseTime * Math.max(1, rate)));
      }
    }
    state.lastTrigger = safeTrigger;
    state.lastReset = safeReset;
    const pulse = state.remainingSamples > 0 ? level : 0;
    state.remainingSamples = Math.max(0, state.remainingSamples - 1);
    return {
      Count: this.safeFilterNumber(this.clampValue(state.count / countMax, 0, 1) * level, null),
      Pulse: this.safeFilterNumber(pulse, null),
    };
  };

