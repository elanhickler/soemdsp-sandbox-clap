NodeLiveAudioProcessor.prototype.createPluckEnvelopeState = function createPluckEnvelopeState() {
    return {
      autoReleasePhasor: 0,
      currentValue: 0,
      decayIncrement: 0,
      lastRelease: 0,
      lastTrigger: 0,
      phasor: 0,
      releaseIncrement: 0,
      secondsPassed: 0,
      state: "off",
      nativeHandle: 0,
    };
  };

NodeLiveAudioProcessor.prototype.exponentialCurve = function exponentialCurve(value, skew) {
    const safeValue = this.clampValue(Number(value) || 0, 0, 1);
    const safeSkew = this.clampValue(Number(skew) || 0, -0.99, 0.99);
    if (safeSkew === 0) {
      return safeValue;
    }
    const c = 0.5 * (safeSkew + 1);
    const a = 2 * Math.log10((1 - c) / c);
    const denom = 1 - Math.exp(a);
    return denom === 0 ? safeValue : (1 - Math.exp(safeValue * a)) / denom;
  };

NodeLiveAudioProcessor.prototype.pluckPrepareForDecay = function pluckPrepareForDecay(state, rate, peak) {
    state.phasor = 0;
    state.autoReleasePhasor = 0;
    state.currentValue = peak;
    state.decayIncrement = (state.currentValue - 1) / Math.max(1, rate) / 50;
  };

NodeLiveAudioProcessor.prototype.pluckTriggerAttack = function pluckTriggerAttack(state, params, rate) {
    const period = 1 / Math.max(1, rate);
    const velocity = this.clampValue(params.velocity, 0, 1);
    const sensitivity = this.clampValue(params.velocitySensitivity, 0, 1);
    const peak = (1 - sensitivity) + velocity * sensitivity;
    state.secondsPassed = 0;
    state.state = "delay";
    if (params.delayTime < period) {
      if (params.attackFeedback <= 1e-8) {
        state.state = "decay";
        this.pluckPrepareForDecay(state, rate, peak);
      } else {
        state.state = "attack";
      }
    }
    state.peak = peak;
  };

NodeLiveAudioProcessor.prototype.pluckTriggerRelease = function pluckTriggerRelease(state, rate) {
    if (state.state !== "release") {
      state.state = "release";
      state.releaseIncrement = state.currentValue / Math.max(1, rate) / 50;
    }
  };

NodeLiveAudioProcessor.prototype.pluckDecayFeedback = function pluckDecayFeedback(state, params) {
    let finalDecayMod = params.endingDecay;
    if (state.phasor < 1) {
      const shaped = this.exponentialCurve(state.phasor, params.decayModCurve || -1e-8);
      finalDecayMod = params.decay + params.decayModStart + shaped * (params.decayModEnd - params.decayModStart);
    }
    return Math.min(1 - 1e-6, Math.exp(-finalDecayMod * 10));
  };

NodeLiveAudioProcessor.prototype.pluckEnvelopeSample = function pluckEnvelopeSample(state, trigger, release, params, rate = sampleRate) {
    if (
      this.nativePluckEnvelopeReady &&
      this.nativePluckEnvelope?.soemdsp_pluck_envelope_create &&
      this.nativePluckEnvelope?.soemdsp_pluck_envelope_sample
    ) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativePluckEnvelope.soemdsp_pluck_envelope_create();
        }
        if (state.nativeHandle) {
          const safeRate = Number(rate) > 1 ? Number(rate) : sampleRate;
          const out = this.nativePluckEnvelope.soemdsp_pluck_envelope_sample(
            state.nativeHandle,
            Number(trigger) || 0,
            Number(release) || 0,
            Math.max(0, Number(params.delayTime) || 0),
            Math.max(0, Number(params.attackFeedback) || 0),
            this.clampValue(Number(params.decay) || 0, 0.1, 1),
            this.clampValue(Number(params.decayModStart) || 0, 0.001, 1.8),
            this.clampValue(Number(params.decayModEnd) || 0, 0.01, 3),
            this.clampValue(Number(params.endingDecay) || 0, 0, 1.4),
            this.clampValue(Number(params.decayModCurve) || 0, -1, 1),
            this.clampValue(Number(params.decayModFrequency) || 0, 0, 100),
            Math.max(0, Number(params.autoReleaseTime) || 0),
            this.clampValue(Number(params.releaseFeedback) || 0, 0, 1),
            this.clampValue(Number(params.velocity) || 0, 0, 1),
            this.clampValue(Number(params.velocitySensitivity) || 0, 0, 1),
            this.clampValue(Number(params.level) || 0, 0, 1),
            safeRate,
          );
          return this.safeFilterNumber(out, null);
        }
      } catch (error) {
        this.nativePluckEnvelopeReady = false;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "pluck_envelope",
          status: "disabled",
          message: String(error?.message || error || "native Pluck Envelope failed"),
        });
      }
    }
    return this.pluckEnvelopeSampleJs(state, trigger, release, params, rate);
  };

NodeLiveAudioProcessor.prototype.pluckEnvelopeSampleJs = function pluckEnvelopeSampleJs(state, trigger, release, params, rate = sampleRate) {
    const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
    const period = 1 / safeRate;
    const safeTrigger = this.safeFilterNumber(trigger, null);
    const safeRelease = this.safeFilterNumber(release, null);
    const read = (key, fallback, min = -Infinity, max = Infinity) => this.clampValue(
      this.safeFilterNumber(params[key] ?? fallback, null),
      min,
      max,
    );
    const values = {
      attackFeedback: read("attackFeedback", 0.002, 0),
      autoReleaseTime: read("autoReleaseTime", 0.08, 0),
      decay: read("decay", 0.35, 0.1, 1),
      decayModCurve: read("decayModCurve", 0, -1, 1),
      decayModEnd: read("decayModEnd", 0.55, 0.01, 3),
      decayModFrequency: read("decayModFrequency", 1.5, 0, 100),
      decayModStart: read("decayModStart", 0.08, 0.001, 1.8),
      delayTime: read("delayTime", 0, 0),
      endingDecay: read("endingDecay", 0.8, 0, 1.4),
      level: read("level", 1, 0, 1),
      releaseFeedback: read("releaseFeedback", 0.35, 0, 1),
      velocity: read("velocity", 1, 0, 1),
      velocitySensitivity: read("velocitySensitivity", 0, 0, 1),
    };

    if (state.lastTrigger <= 0 && safeTrigger > 0) {
      this.pluckTriggerAttack(state, values, safeRate);
    }
    if (state.lastRelease <= 0 && safeRelease > 0) {
      this.pluckTriggerRelease(state, safeRate);
    }
    state.lastTrigger = safeTrigger;
    state.lastRelease = safeRelease;

    const attackFeedbackAmp = 1 / (Math.max(values.attackFeedback, 1e-8) * safeRate);
    const releaseFeedbackAmp = Math.min(1 - 1e-6, Math.exp(-values.releaseFeedback * 10));
    const autoReleaseIncrement = values.autoReleaseTime <= 1e-8
      ? 0
      : 1 / (Math.max(values.autoReleaseTime, 1e-8) * safeRate);
    const phasorIncrement = values.decayModFrequency / safeRate;

    switch (state.state) {
      case "delay":
        state.secondsPassed += period;
        if (state.secondsPassed >= values.delayTime) {
          state.state = "attack";
        }
        break;
      case "attack":
        state.currentValue += period + state.currentValue * attackFeedbackAmp;
        if (state.currentValue >= state.peak) {
          state.state = "decay";
          this.pluckPrepareForDecay(state, safeRate, state.peak);
        }
        break;
      case "decay":
        state.currentValue -= state.decayIncrement + state.currentValue * state.currentValue * this.pluckDecayFeedback(state, values);
        state.phasor += phasorIncrement;
        state.autoReleasePhasor += autoReleaseIncrement;
        if (autoReleaseIncrement > 0 && state.autoReleasePhasor >= 1) {
          this.pluckTriggerRelease(state, safeRate);
        }
        if (state.currentValue < 0) {
          state.currentValue = 0;
          state.secondsPassed = 0;
          state.phasor = 0;
          state.autoReleasePhasor = 0;
          state.state = "off";
        }
        break;
      case "release":
        state.currentValue -= state.releaseIncrement + state.currentValue * state.currentValue * releaseFeedbackAmp;
        if (state.currentValue <= 0) {
          state.currentValue = 0;
          state.secondsPassed = 0;
          state.phasor = 0;
          state.autoReleasePhasor = 0;
          state.state = "off";
        }
        break;
      case "off":
      default:
        break;
    }
    return this.safeFilterNumber(state.currentValue * values.level, null);
  };

