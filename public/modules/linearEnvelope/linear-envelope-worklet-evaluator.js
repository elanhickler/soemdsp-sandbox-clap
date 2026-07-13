NodeLiveAudioProcessor.prototype.createLinearEnvelopeState = function createLinearEnvelopeState() {
    return {
      lastGate: 0,
      out: 0,
      releaseDecrement: 0,
      secondsPassed: 0,
      state: "off",
      nativeHandle: 0,
    };
  };

NodeLiveAudioProcessor.prototype.linearEnvelopeTriggerAttack = function linearEnvelopeTriggerAttack(state, delay, attack, rate = sampleRate) {
    const period = 1 / Math.max(1, rate);
    if (delay < period) {
      if (attack <= period) {
        state.state = "decay";
        state.out = 1;
      } else {
        state.state = "attack";
      }
      return;
    }
    if (state.out <= 0.000001) {
      state.out = 0;
      state.secondsPassed = 0;
    }
    state.state = "delay";
  };

NodeLiveAudioProcessor.prototype.linearEnvelopeSample = function linearEnvelopeSample(state, gate, params, rate = sampleRate) {
    if (
      this.nativeLinearEnvelopeReady &&
      this.nativeLinearEnvelope?.soemdsp_linear_envelope_create &&
      this.nativeLinearEnvelope?.soemdsp_linear_envelope_sample
    ) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativeLinearEnvelope.soemdsp_linear_envelope_create();
        }
        if (state.nativeHandle) {
          const safeRate = Number(rate) > 1 ? Number(rate) : sampleRate;
          const out = this.nativeLinearEnvelope.soemdsp_linear_envelope_sample(
            state.nativeHandle,
            Number(gate) || 0,
            Math.max(0, Number(params.delay) || 0),
            Math.max(0, Number(params.attack) || 0),
            Math.max(0, Number(params.decay) || 0),
            this.clampValue(Number(params.sustain) || 0, 0, 1),
            Math.max(0, Number(params.release) || 0),
            Number(params.loop) || 0,
            Number(params.level) || 0,
            safeRate,
          );
          return this.safeFilterNumber(out, null);
        }
      } catch (error) {
        this.nativeLinearEnvelopeReady = false;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "linear_envelope",
          status: "disabled",
          message: String(error?.message || error || "native Linear Envelope failed"),
        });
      }
    }
    return this.linearEnvelopeSampleJs(state, gate, params, rate);
  };

NodeLiveAudioProcessor.prototype.linearEnvelopeSampleJs = function linearEnvelopeSampleJs(state, gate, params, rate = sampleRate) {
    const safeGate = this.safeFilterNumber(gate, null);
    const delay = Math.max(0, this.safeFilterNumber(params.delay, null));
    const attack = Math.max(0, this.safeFilterNumber(params.attack, null));
    const decay = Math.max(0, this.safeFilterNumber(params.decay, null));
    const sustain = this.clampValue(this.safeFilterNumber(params.sustain, null), 0, 1);
    const release = Math.max(0, this.safeFilterNumber(params.release, null));
    const level = this.safeFilterNumber(params.level, null);
    const looping = this.safeFilterNumber(params.loop, null) >= 0.5;
    const safeRate = Math.max(1, rate || sampleRate || 44100);
    const period = 1 / safeRate;

    if (state.lastGate <= 0 && safeGate > 0) {
      this.linearEnvelopeTriggerAttack(state, delay, attack, safeRate);
    } else if (state.lastGate > 0 && safeGate <= 0) {
      state.state = "release";
      state.releaseDecrement = state.out * period / Math.max(release, period);
    }
    state.lastGate = safeGate;

    const attackIncrement = Math.min(period / Math.max(attack, period), 1);
    const decayDecrement = (1 - sustain) * period / Math.max(decay, period);

    switch (state.state) {
      case "delay":
        state.secondsPassed += period;
        if (state.secondsPassed >= delay) {
          state.state = attack <= period ? "decay" : "attack";
          state.secondsPassed = 0;
          if (attack <= period) {
            state.out = 1;
          }
        }
        break;
      case "attack":
        state.out += attackIncrement;
        if (state.out >= 1) {
          state.out = 1;
          state.state = "decay";
        }
        break;
      case "decay":
        state.out -= decayDecrement;
        if (state.out <= sustain) {
          state.out = sustain;
          state.state = "sustain";
        }
        break;
      case "sustain":
        if (looping) {
          state.state = "attack";
        }
        state.out = sustain;
        break;
      case "release":
        state.out -= state.releaseDecrement;
        if (state.out <= 0) {
          state.out = 0;
          state.state = "off";
          state.secondsPassed = 0;
        }
        break;
      case "off":
      default:
        break;
    }

    return this.safeFilterNumber(this.clampValue(state.out, 0, 1) * level, null);
  };

