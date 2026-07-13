NodeLiveAudioProcessor.prototype.createExpAdsrState = function createExpAdsrState() {
    return {
      lastGate: 0,
      out: 0,
      secondsPassed: 0,
      state: "off",
      nativeHandle: 0,
    };
  };

NodeLiveAudioProcessor.prototype.expAdsrCalcCoef = function expAdsrCalcCoef(rate, targetRatio) {
    const safeRate = Math.max(0, Number(rate) || 0);
    const safeRatio = Math.max(0.000000001, Number(targetRatio) || 0.000000001);
    return safeRate <= 0 ? 0 : Math.exp(-Math.log((1 + safeRatio) / safeRatio) / safeRate);
  };

NodeLiveAudioProcessor.prototype.expAdsrTriggerAttack = function expAdsrTriggerAttack(state, delay, attack, rate = sampleRate) {
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

NodeLiveAudioProcessor.prototype.expAdsrSample = function expAdsrSample(state, gate, params, rate = sampleRate) {
    if (
      this.nativeExpAdsrReady &&
      this.nativeExpAdsr?.soemdsp_exp_adsr_create &&
      this.nativeExpAdsr?.soemdsp_exp_adsr_sample
    ) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativeExpAdsr.soemdsp_exp_adsr_create();
        }
        if (state.nativeHandle) {
          const safeRate = Number(rate) > 1 ? Number(rate) : sampleRate;
          const out = this.nativeExpAdsr.soemdsp_exp_adsr_sample(
            state.nativeHandle,
            Number(gate) || 0,
            Math.max(0, Number(params.delay) || 0),
            Math.max(0, Number(params.attack) || 0),
            Math.max(0.000000001, Number(params.attackShape) || 0),
            Math.max(0, Number(params.decay) || 0),
            this.clampValue(Number(params.sustain) || 0, 0, 1),
            Math.max(0, Number(params.release) || 0),
            Math.max(0.000000001, Number(params.releaseShape) || 0),
            Number(params.loop) || 0,
            Number(params.level) || 0,
            safeRate,
          );
          return this.safeFilterNumber(out, null);
        }
      } catch (error) {
        this.nativeExpAdsrReady = false;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "exp_adsr",
          status: "disabled",
          message: String(error?.message || error || "native Exp ADSR failed"),
        });
      }
    }
    return this.expAdsrSampleJs(state, gate, params, rate);
  };

NodeLiveAudioProcessor.prototype.expAdsrSampleJs = function expAdsrSampleJs(state, gate, params, rate = sampleRate) {
    const safeGate = this.safeFilterNumber(gate, null);
    const delay = Math.max(0, this.safeFilterNumber(params.delay, null));
    const attack = Math.max(0, this.safeFilterNumber(params.attack, null));
    const decay = Math.max(0, this.safeFilterNumber(params.decay, null));
    const sustain = this.clampValue(this.safeFilterNumber(params.sustain, null), 0, 1);
    const release = Math.max(0, this.safeFilterNumber(params.release, null));
    const attackShape = Math.max(0.000000001, this.safeFilterNumber(params.attackShape, null));
    const releaseShape = Math.max(0.000000001, this.safeFilterNumber(params.releaseShape, null));
    const level = this.safeFilterNumber(params.level, null);
    const looping = this.safeFilterNumber(params.loop, null) >= 0.5;
    const safeRate = Math.max(1, rate || sampleRate || 44100);
    const period = 1 / safeRate;

    if (state.lastGate <= 0 && safeGate > 0) {
      this.expAdsrTriggerAttack(state, delay, attack, safeRate);
    } else if (state.lastGate > 0 && safeGate <= 0) {
      state.state = "release";
    }
    state.lastGate = safeGate;

    const attackCoef = this.expAdsrCalcCoef(attack * safeRate, attackShape);
    const decayCoef = this.expAdsrCalcCoef(decay * safeRate, releaseShape);
    const releaseCoef = this.expAdsrCalcCoef(release * safeRate, releaseShape);
    const attackBase = (1 + attackShape) * (1 - attackCoef);
    const decayBase = (sustain - releaseShape) * (1 - decayCoef);
    const releaseBase = -releaseShape * (1 - releaseCoef);

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
        state.out = attackBase + state.out * attackCoef;
        if (state.out >= 1) {
          state.out = 1;
          state.state = "decay";
        }
        break;
      case "decay":
        state.out = decayBase + state.out * decayCoef;
        if (state.out <= sustain) {
          state.out = sustain;
          state.state = "sustain";
        }
        break;
      case "sustain":
        state.out = sustain;
        if (looping) {
          this.expAdsrTriggerAttack(state, delay, attack, safeRate);
        }
        break;
      case "release":
        state.out = releaseBase + state.out * releaseCoef;
        if (state.out <= 0) {
          state.out = 0;
          state.state = "off";
        }
        break;
      case "off":
      default:
        state.out = 0;
        break;
    }

    return this.safeFilterNumber(state.out * level, null);
  };

