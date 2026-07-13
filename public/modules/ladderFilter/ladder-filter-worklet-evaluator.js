NodeLiveAudioProcessor.prototype.createLadderFilterState = function createLadderFilterState() {
    return { y: [0, 0, 0, 0, 0], nativeHandle: 0 };
  };

NodeLiveAudioProcessor.prototype.ladderFilterStageCount = function ladderFilterStageCount(stages) {
    const value = Math.round(Number(stages));
    return Number.isFinite(value) ? this.clampValue(value, 1, 4) : 4;
  };

NodeLiveAudioProcessor.prototype.ladderFilterMix = function ladderFilterMix(mode, stages) {
    const safeMode = Math.round(this.clampValue(Number(mode) || 0, 0, 3));
    const stageCount = this.ladderFilterStageCount(stages);
    const c = [0, 0, 0, 0, 0];
    let s = 1;
    if (safeMode === 0) {
      c[0] = 1;
      s = 0.125;
    } else if (safeMode === 1) {
      c[stageCount] = 1;
      s = stageCount * 0.25;
    } else if (safeMode === 2) {
      const coefficients = [
        [1, -1],
        [1, -2, 1],
        [1, -3, 3, -1],
        [1, -4, 6, -4, 1],
      ][stageCount - 1];
      for (let index = 0; index < coefficients.length; index += 1) {
        c[index] = coefficients[index];
      }
      s = stageCount * 0.25;
    } else {
      const coefficients = stageCount <= 2
        ? [0, 2, -2, 0, 0]
        : stageCount === 3
          ? [0, 0, 3, -3, 0]
          : [0, 0, 4, -8, 4];
      for (let index = 0; index < coefficients.length; index += 1) {
        c[index] = coefficients[index];
      }
      s = 0.125;
    }
    return { c, mode: safeMode, s, stageCount };
  };

NodeLiveAudioProcessor.prototype.ladderFilterFeedbackFactor = function ladderFilterFeedbackFactor(feedback, cosWc, a) {
    const b = 1 + a;
    const denominator = Math.max(1e-12, 1 + a * a + 2 * a * cosWc);
    const g2 = (b * b) / denominator;
    return feedback / Math.max(1e-12, g2 * g2);
  };

NodeLiveAudioProcessor.prototype.ladderFilterCoefficients = function ladderFilterCoefficients(frequency, resonance, mode, stages, rate = sampleRate, state = null) {
    const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
    const frequencyValue = Math.max(0, this.safeFilterNumber(frequency, state));
    const safeFrequency = this.clampValue(frequencyValue, 0.000001, Math.min(20000, safeRate * 0.49));
    const feedback = this.clampValue(this.safeFilterNumber(resonance, state), 0, 0.999);
    const wc = this.clampValue((2 * Math.PI * safeFrequency) / safeRate, 1e-9, Math.PI * 0.98);
    const sine = Math.sin(wc);
    const cosine = Math.cos(wc);
    const tangent = Math.tan(0.25 * (wc - Math.PI));
    let a = tangent / Math.max(1e-12, sine - cosine * tangent);
    if (!Number.isFinite(a)) {
      a = -1;
    }
    const mix = this.ladderFilterMix(mode, stages);
    const k = this.ladderFilterFeedbackFactor(feedback, cosine, a);
    const g = 1 + mix.s * k;
    return { ...mix, a, g, k };
  };

NodeLiveAudioProcessor.prototype.ladderFilterSample = function ladderFilterSample(state, input, params, rate = sampleRate) {
    if (this.nativeLadderFilterReady) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativeLadderFilter.soemdsp_ladder_filter_create();
        }
        if (state.nativeHandle) {
          return this.safeFilterNumber(
            this.nativeLadderFilter.soemdsp_ladder_filter_sample(
              state.nativeHandle,
              this.safeFilterNumber(input, state),
              Math.max(0, this.safeFilterNumber(params.frequency, state)),
              this.clampValue(this.safeFilterNumber(params.resonance, state), 0, 0.999),
              Math.max(0, Math.min(3, Math.round(Number(params.mode) || 0))),
              Math.max(1, Math.min(4, Math.round(Number(params.stages) || 4))),
              Math.max(1, Number(rate) || sampleRate || 44100),
            ),
            state,
          );
        }
      } catch (error) {
        this.nativeLadderFilterReady = false;
        state.nativeHandle = 0;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "ladder_filter",
          status: "disabled",
          message: String(error?.message || error || "native Ladder Filter failed"),
        });
      }
    }
    const safeInput = this.safeFilterNumber(input, state);
    const coeff = this.ladderFilterCoefficients(
      params.frequency,
      params.resonance,
      params.mode,
      params.stages,
      rate,
      state,
    );
    const y = Array.isArray(state.y) && state.y.length >= 5 ? state.y : [0, 0, 0, 0, 0];
    state.y = y;
    y[0] = coeff.g * safeInput - coeff.k * y[4];
    y[0] = y[0] / (1 + y[0] * y[0]);
    y[1] = y[0] + coeff.a * (y[0] - y[1]);
    y[2] = y[1] + coeff.a * (y[1] - y[2]);
    y[3] = y[2] + coeff.a * (y[2] - y[3]);
    y[4] = y[3] + coeff.a * (y[3] - y[4]);
    for (let index = 0; index < y.length; index += 1) {
      y[index] = this.safeFilterNumber(y[index], state);
    }
    const output = coeff.c[0] * y[0] + coeff.c[1] * y[1] + coeff.c[2] * y[2] + coeff.c[3] * y[3] + coeff.c[4] * y[4];
    return this.safeFilterNumber(output, state);
  };

