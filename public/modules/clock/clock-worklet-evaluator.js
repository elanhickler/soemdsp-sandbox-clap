NodeLiveAudioProcessor.prototype.createClockState = function createClockState() {
    return {
      hasStarted: false,
      phase: 0,
    };
  };

NodeLiveAudioProcessor.prototype.clockAnalogWhipSample = function clockAnalogWhipSample(phase, level) {
    const p = this.clampValue(Number(phase) || 0, 0, 1);
    const attack = 1 - Math.pow(1 - Math.min(1, p / 0.035), 4);
    const release = Math.pow(Math.max(0, 1 - p), 1.85);
    const snapEnvelope = attack * release;
    const sweepTurns = (3.15 * (1 - Math.exp(-4.2 * p)) / (1 - Math.exp(-4.2))) + (0.18 * Math.sin(Math.PI * p));
    const liquidBend = 0.075 * Math.sin(Math.PI * 2 * p) * Math.pow(Math.max(0, 1 - p), 1.2);
    const body = Math.sin((sweepTurns + liquidBend) * Math.PI * 2);
    const sheen = Math.sin((sweepTurns * 2.02 + 0.17) * Math.PI * 2) * 0.16 * Math.pow(Math.max(0, 1 - p), 2.8);
    return (body + sheen) * snapEnvelope * level;
  };

NodeLiveAudioProcessor.prototype.clockSample = function clockSample(state, reset, phaseOffset, rate, duty, level, rateHz = sampleRate) {
    const safeReset = this.safeFilterNumber(reset, null);
    const safePhaseOffset = this.wrapValue(this.safeFilterNumber(phaseOffset, null), 0, 1);
    const safeRate = Math.max(0, this.safeFilterNumber(rate, null));
    const safeDuty = this.clampValue(this.safeFilterNumber(duty, null), 0, 1);
    const safeLevel = this.safeFilterNumber(level, null);
    const resetActive = safeReset > 0;
    const rawPhase = resetActive ? 0 : this.wrapValue(Number(state.phase) || 0, 0, 1);
    const phase = this.wrapValue(rawPhase + safePhaseOffset, 0, 1);
    const digital = phase < safeDuty ? safeLevel : 0;
    const analog = this.clockAnalogWhipSample(phase, safeLevel);
    const nextRawPhase = this.wrapValue(rawPhase + safeRate / Math.max(1, rateHz), 0, 1);
    const pulse = safeRate > 0 && !resetActive && (!state.hasStarted || nextRawPhase < rawPhase) ? safeLevel : 0;
    state.hasStarted = !resetActive;
    state.phase = resetActive ? 0 : nextRawPhase;
    return {
      "Analog Out": analog,
      "Digital Out": digital,
      Out: digital,
      Pulse: pulse,
    };
  };

