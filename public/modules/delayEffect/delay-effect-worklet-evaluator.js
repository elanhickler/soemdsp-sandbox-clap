NodeLiveAudioProcessor.prototype.createDelayEffectState = function createDelayEffectState() {
    return {
      buffer: new Float32Array(1),
      bufferSize: 1,
      lfoPhase: 0,
      lfoVariationState: 0,
      position: 0,
      wet: 0,
      nativeHandle: 0,
      nativeSeed: 0,
      nativeSeedKey: "",
    };
  };

NodeLiveAudioProcessor.prototype.createStereoDelayEffectState = function createStereoDelayEffectState() {
    return {
      left: this.createDelayEffectState(),
      mono: this.createDelayEffectState(),
      right: this.createDelayEffectState(),
    };
  };

NodeLiveAudioProcessor.prototype.delayParabolSample = function delayParabolSample(phase) {
    const wrapped = phase - Math.floor(phase);
    return wrapped < 0.5 ? wrapped * 4 - 1 : 3 - wrapped * 4;
  };

NodeLiveAudioProcessor.prototype.delayEffectSample = function delayEffectSample(state, input, params, rateHz = sampleRate, nodeId = "") {
    if (
      this.nativeDelayEffectReady &&
      this.nativeDelayEffect?.soemdsp_delay_effect_create &&
      this.nativeDelayEffect?.soemdsp_delay_effect_sample
    ) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativeDelayEffect.soemdsp_delay_effect_create();
        }
        if (state.nativeHandle) {
          const seedKey = `${nodeId}:delayVariation`;
          if (state.nativeSeedKey !== seedKey) {
            state.nativeSeedKey = seedKey;
            state.nativeSeed = this.stableSeed(seedKey);
          }
          const safeRateValue = Math.max(1, Number(rateHz) || 44100);
          const modeValue = Math.round(this.safeFilterNumber(params.mode, null)) >= 1 ? 1 : 0;
          this.nativeDelayEffect.soemdsp_delay_effect_sample(
            state.nativeHandle,
            Number(input) || 0,
            this.clampValue(Number(params.time) || 0, 0.001, 4.25),
            this.clampValue(Number(params.feedback) || 0, 0, 0.95),
            this.clampValue(Number(params.mix) || 0, 0, 1),
            this.clampValue(Number(params.level) || 0, 0, 2),
            this.clampValue(Number(params.modAmount) || 0, 0, 0.5),
            this.clampValue(Number(params.modRate) || 0, 0, 90),
            this.clampValue(Number(params.modVariation) || 0, 0, 1),
            modeValue,
            state.nativeSeed >>> 0,
            safeRateValue,
          );
          return {
            Out: this.nativeDelayEffect.soemdsp_delay_effect_out(state.nativeHandle),
            Wet: this.nativeDelayEffect.soemdsp_delay_effect_wet(state.nativeHandle),
          };
        }
      } catch (error) {
        this.nativeDelayEffectReady = false;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "delay_effect",
          status: "disabled",
          message: String(error?.message || error || "native Delay Effect failed"),
        });
      }
    }
    return this.delayEffectSampleJs(state, input, params, rateHz, nodeId);
  };

NodeLiveAudioProcessor.prototype.delayEffectSampleJs = function delayEffectSampleJs(state, input, params, rateHz = sampleRate, nodeId = "") {
    const safeRate = Math.max(1, Number(rateHz) || 44100);
    const maxDelaySeconds = 4.25;
    const requiredSize = Math.max(2, Math.ceil(safeRate * maxDelaySeconds) + 2);
    if (!state.buffer || state.bufferSize !== requiredSize) {
      state.buffer = new Float32Array(requiredSize);
      state.bufferSize = requiredSize;
      state.position = 0;
      state.lfoPhase = 0;
      state.lfoVariationState = 0;
      state.wet = 0;
    }
    const dry = this.safeFilterNumber(input, null);
    const time = this.clampValue(this.safeFilterNumber(params.time, null), 0.001, maxDelaySeconds);
    const feedback = this.clampValue(this.safeFilterNumber(params.feedback, null), 0, 0.95);
    const mix = this.clampValue(this.safeFilterNumber(params.mix, null), 0, 1);
    const level = this.clampValue(this.safeFilterNumber(params.level, null), 0, 2);
    const modAmount = this.clampValue(this.safeFilterNumber(params.modAmount, null), 0, 0.5);
    const modRate = this.clampValue(this.safeFilterNumber(params.modRate, null), 0, 90);
    const modVariation = this.clampValue(this.safeFilterNumber(params.modVariation, null), 0, 1);
    const mode = Math.round(this.safeFilterNumber(params.mode, null)) >= 1 ? 1 : 0;

    const variationTarget = this.hashBipolar(
      Math.floor(state.lfoPhase * 997) + state.position,
      this.stableSeed(`${nodeId}:delayVariation`),
    );
    state.lfoVariationState += (variationTarget - state.lfoVariationState) * Math.min(1, modRate / safeRate);
    const variedRate = Math.max(0, modRate * (1 + state.lfoVariationState * modVariation));
    state.lfoPhase = (state.lfoPhase + variedRate / safeRate) % 1;
    const lfo = (this.delayParabolSample(state.lfoPhase) + 1) * 0.5;

    const delaySamples = this.clampValue(time * safeRate, 1, state.bufferSize - 2);
    const bufferOffset = delaySamples - delaySamples * lfo * modAmount + 1;
    state.position = (state.position + 1) % state.bufferSize;
    const readPosition = (state.position + state.bufferSize - bufferOffset) % state.bufferSize;
    const wet = this.delayInterpolateLinear(state.buffer, readPosition);
    const write = mode ? ((0 - dry) - wet * feedback) : (dry + wet * feedback);
    state.buffer[state.position] = this.clampValue(write, -8, 8);
    state.wet = mode ? (dry * feedback - wet * (1 - feedback * feedback)) : wet;
    return {
      Out: (dry * (1 - mix) + state.wet * mix) * level,
      Wet: state.wet * level,
    };
  };

