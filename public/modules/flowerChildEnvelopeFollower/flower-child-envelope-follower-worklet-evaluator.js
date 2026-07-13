NodeLiveAudioProcessor.prototype.createFlowerChildEnvelopeFollowerState = function createFlowerChildEnvelopeFollowerState() {
    return {
      currentSlewedValue: 0,
      holdCounter: 0,
      out: 0,
    };
  };

NodeLiveAudioProcessor.prototype.flowerChildSecondsToSamples = function flowerChildSecondsToSamples(seconds, rate = sampleRate) {
    const time = Number(seconds);
    if (!Number.isFinite(time) || time <= 0) {
      return 1;
    }
    return Math.max(1, time * Math.max(1, rate || sampleRate || 44100));
  };

NodeLiveAudioProcessor.prototype.flowerChildEnvelopeFollowerSample = function flowerChildEnvelopeFollowerSample(state, input, params, rate = sampleRate) {
    const target = this.clampValue(Math.abs(this.safeFilterNumber(input, null)), 0, 1);
    const attackSamples = this.flowerChildSecondsToSamples(this.safeFilterNumber(params.attack, null), rate);
    const holdSamples = this.flowerChildSecondsToSamples(this.safeFilterNumber(params.hold, null), rate);
    const decaySamples = this.flowerChildSecondsToSamples(this.safeFilterNumber(params.decay, null), rate);
    const attackStep = 1 / attackSamples;
    const decayStep = 1 / decaySamples;
    const current = this.clampValue(Number(state.currentSlewedValue) || 0, 0, 1);
    if (target >= current) {
      state.currentSlewedValue = Math.min(target, current + attackStep);
      state.holdCounter = holdSamples;
    } else if ((Number(state.holdCounter) || 0) > 0) {
      state.holdCounter = Math.max(0, (Number(state.holdCounter) || 0) - 1);
      state.currentSlewedValue = current;
    } else {
      state.currentSlewedValue = Math.max(target, current - decayStep);
    }
    state.out = this.safeFilterNumber(this.clampValue(state.currentSlewedValue, 0, 1), null);
    return state.out;
  };

