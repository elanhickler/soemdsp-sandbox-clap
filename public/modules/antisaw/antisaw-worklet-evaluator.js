// Realtime worklet evaluator methods for antisaw, split out of
// node-live-audio-worklet-core.js onto NodeLiveAudioProcessor's prototype.
// Loaded as part of the Blob-assembled AudioWorklet module (see
// nodeGraphLiveWorkletSourceFiles in node-graph-live-runtime.js) after
// core.js defines the class and before register.js calls
// registerProcessor -- no call-site changes needed since the dispatch
// registry calls this.antisawSample(...) directly.
NodeLiveAudioProcessor.prototype.createAntisawState = function createAntisawState() {
  return {
    nativeHandle: 0,
    phase: new Float64Array(256),
  };
};

// JS mirror of antisaw.cpp's soemdsp_antisaw_sample -- used only when
// the wasm module hasn't loaded yet or fails. Same math/parameter
// meaning; JS's % is equivalent to the .cpp's hand-rolled dsp_fmod for
// the positive-only operands this module ever uses.
NodeLiveAudioProcessor.prototype.antisawSampleJs = function antisawSampleJs(state, params, rate = sampleRate) {
  const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
  const nyquist = safeRate * 0.5;
  const twoPi = Math.PI * 2;
  const f0 = Math.max(0, this.safeFilterNumber(params.fundamental, null));
  const N = this.clampValue(Math.round(this.safeFilterNumber(params.reflections, null)), 1, 256);
  const tilt = this.clampValue(this.safeFilterNumber(params.tilt, null), -1, 1);
  const level = this.safeFilterNumber(params.level, null);

  let out = 0;
  for (let n = 1; n <= N; n++) {
    const raw = n * f0;
    if (raw > nyquist) {
      let folded = raw % safeRate;
      if (folded > nyquist) folded = safeRate - folded;

      const idx = n - 1;
      state.phase[idx] = (state.phase[idx] + twoPi * folded / safeRate) % twoPi;

      const nNorm = N > 1 ? (n - 1) / (N - 1) : 0.5;
      const bias = nNorm * 2 - 1;
      const weight = (1 / n) * (1 + tilt * bias);

      out += Math.sin(state.phase[idx]) * weight;
    }
  }

  return this.clampValue(out * level, -1, 1);
};

NodeLiveAudioProcessor.prototype.antisawSample = function antisawSample(state, params, rate = sampleRate) {
  if (
    this.nativeAntisawReady &&
    this.nativeAntisaw?.soemdsp_antisaw_create &&
    this.nativeAntisaw?.soemdsp_antisaw_sample
  ) {
    try {
      if (!state.nativeHandle) {
        state.nativeHandle = this.nativeAntisaw.soemdsp_antisaw_create();
      }
      if (state.nativeHandle) {
        const safeRate = Number(rate) > 1 ? Number(rate) : sampleRate;
        const out = this.nativeAntisaw.soemdsp_antisaw_sample(
          state.nativeHandle,
          Number(params.fundamental) || 0,
          Number(params.reflections) || 0,
          Number(params.tilt) || 0,
          Number(params.level) || 0,
          safeRate,
        );
        return this.safeFilterNumber(out, null);
      }
    } catch (error) {
      this.nativeAntisawReady = false;
      this.port.postMessage({
        type: "nativeModuleStatus",
        name: "antisaw",
        status: "disabled",
        message: String(error?.message || error || "native Antisaw failed"),
      });
    }
  }
  return this.antisawSampleJs(state, params, rate);
};
