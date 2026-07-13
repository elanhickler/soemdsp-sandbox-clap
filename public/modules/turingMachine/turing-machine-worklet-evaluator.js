NodeLiveAudioProcessor.prototype.createTuringMachineState = function createTuringMachineState() {
    return { clockWasHigh: false, resetWasHigh: false, register: 0 };
  };

NodeLiveAudioProcessor.prototype.turingMachineSample = function turingMachineSample(state, options = {}) {
    const clockHigh = Number(options.clock) > 0;
    const resetHigh = Number(options.reset) > 0;
    const length = Math.max(1, Math.min(16, Math.round(Number(options.length) || 8)));
    const probability = this.clampValue(Number(options.probability) || 0, 0, 1);
    const level = Number(options.level) || 0;
    if (resetHigh && !state.resetWasHigh) {
      state.register = 0;
    }
    state.resetWasHigh = resetHigh;
    if (clockHigh && !state.clockWasHigh) {
      const mask = (1 << length) - 1;
      const topBit = (state.register >> (length - 1)) & 1;
      const newBit = Math.random() < probability ? 1 - topBit : topBit;
      state.register = ((state.register << 1) | newBit) & mask;
    }
    state.clockWasHigh = clockHigh;
    const mask = (1 << length) - 1;
    const maxValue = mask > 0 ? mask : 1;
    const cv = (state.register / maxValue) * 2 - 1;
    const scaleMask = state.register & 0xFFF;
    const gate = state.register & 1;
    return {
      CV: cv * level,
      Scale: scaleMask,
      Gate: gate * level,
    };
  };

