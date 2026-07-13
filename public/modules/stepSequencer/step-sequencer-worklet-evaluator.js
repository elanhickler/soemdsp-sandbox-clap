NodeLiveAudioProcessor.prototype.createStepSequencerState = function createStepSequencerState() {
    return {
      gate: 0,
      index: 0,
      lastReset: 0,
      lastTrigger: 0,
      out: 0,
    };
  };

NodeLiveAudioProcessor.prototype.stepSequencerSample = function stepSequencerSample(state, trigger, reset, params) {
    const safeTrigger = this.safeFilterNumber(trigger, null);
    const safeReset = this.safeFilterNumber(reset, null);
    const threshold = this.safeFilterNumber(params.threshold, null);
    const stepCount = Math.max(1, Math.min(8, Math.round(this.safeFilterNumber(params.steps, null))));
    const level = this.safeFilterNumber(params.level, null);
    const values = params.values.map((value) => this.safeFilterNumber(value, null));
    if (state.index >= stepCount) {
      state.index %= stepCount;
    }
    if (state.lastReset <= threshold && safeReset > threshold) {
      state.index = 0;
      state.out = values[0] || 0;
    }
    if (state.lastTrigger <= threshold && safeTrigger > threshold) {
      state.out = values[state.index] || 0;
      state.index = (state.index + 1) % stepCount;
    }
    state.gate = safeTrigger > threshold ? 1 : 0;
    state.lastTrigger = safeTrigger;
    state.lastReset = safeReset;
    return {
      Gate: state.gate,
      Out: this.safeFilterNumber(state.out * level, null),
    };
  };

