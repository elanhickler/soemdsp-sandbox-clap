// Realtime worklet evaluator methods for randomWalk, split out of
// node-live-audio-worklet-core.js onto NodeLiveAudioProcessor's prototype.
// Loaded as part of the Blob-assembled AudioWorklet module (see
// nodeGraphLiveWorkletSourceFiles in node-graph-live-runtime.js) after
// core.js defines the class and before register.js calls
// registerProcessor -- no call-site changes needed since the dispatch
// registry calls this.randomWalkSample(...) directly.
//
// onePoleLowpassSample/createLowpassState stay in core.js: confirmed
// shared with other modules' filter paths. nextSeededBipolar/
// resetSeededState/seededKey/stableSeed stay in core.js too: shared
// seeded-PRNG infrastructure backing multiple unrelated modules.
NodeLiveAudioProcessor.prototype.rationalCurve = function rationalCurve(value, skew) {
  const t = this.clampValue(Number(value) || 0, 0, 1);
  const safeSkew = this.clampValue(Number(skew) || 0, -0.999, 0.999);
  return ((1 + safeSkew) * t) / (1 - safeSkew + 2 * safeSkew * t);
};

NodeLiveAudioProcessor.prototype.randomWalkSample = function randomWalkSample(state, params, rate = sampleRate, nodeId = "") {
  if (
    this.nativeRandomWalkReady &&
    this.nativeRandomWalk?.soemdsp_random_walk_create &&
    this.nativeRandomWalk?.soemdsp_random_walk_sample
  ) {
    try {
      if (!state.nativeHandle) {
        state.nativeHandle = this.nativeRandomWalk.soemdsp_random_walk_create();
      }
      if (state.nativeHandle) {
        const key = this.seededKey(nodeId, params.seed, "randomWalk");
        if (state.nativeSeedKey !== key) {
          state.nativeSeedKey = key;
          this.nativeRandomWalk.soemdsp_random_walk_reset_seed(state.nativeHandle, this.stableSeed(key));
        }
        const safeRate = Number(rate) > 1 ? Number(rate) : sampleRate;
        const method = Math.max(0, Math.min(3, Math.round(Number(params.method) || 0)));
        const out = this.nativeRandomWalk.soemdsp_random_walk_sample(
          state.nativeHandle,
          method,
          Math.max(0, Number(params.frequency) || 0),
          Math.max(0, Number(params.jitter) || 0),
          Number(params.level) || 0,
          safeRate,
        );
        return this.safeFilterNumber(out, null);
      }
    } catch (error) {
      this.nativeRandomWalkReady = false;
      this.port.postMessage({
        type: "nativeModuleStatus",
        name: "random_walk",
        status: "disabled",
        message: String(error?.message || error || "native Random Walk failed"),
      });
    }
  }
  return this.randomWalkSampleJs(state, params, rate, nodeId);
};

NodeLiveAudioProcessor.prototype.randomWalkSampleJs = function randomWalkSampleJs(state, params, rate = sampleRate, nodeId = "") {
  this.resetSeededState(state, nodeId, params.seed, "randomWalk");
  const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
  const method = Math.max(0, Math.min(3, Math.round(this.safeFilterNumber(params.method, null))));
  const frequency = Math.max(0, this.safeFilterNumber(params.frequency, null));
  const jitter = Math.max(0, this.safeFilterNumber(params.jitter, null));
  const level = this.safeFilterNumber(params.level, null);
  const noise = this.nextSeededBipolar(state);
  const increment = this.clampValue(frequency / safeRate, 0, 1);
  const jitterInc = this.clampValue(jitter / safeRate, 0, 1);
  const stepSize = this.clampValue(increment + this.rationalCurve(jitterInc, 0.99), 0, 1);
  const averageIncrement = (jitterInc + increment) * 0.5;
  const whiteNoiseMix = averageIncrement >= 0.9
    ? this.rationalCurve((averageIncrement - 0.9) / 0.1, -0.7)
    : 0;
  const randomMix = 1 - whiteNoiseMix;

  if (method === 0) {
    return this.safeFilterNumber(noise * level, null);
  }
  if (method === 1) {
    return this.onePoleLowpassSample(state.lowpass, noise, frequency, safeRate) * level;
  }
  const step = method === 3 ? (noise > 0 ? stepSize : -stepSize) : noise * stepSize;
  state.out = this.clampValue(state.out + step, -1, 1);
  const mixed = state.out * randomMix + noise * whiteNoiseMix;
  return this.safeFilterNumber(this.onePoleLowpassSample(state.lowpass, mixed, frequency, safeRate) * level, null);
};

NodeLiveAudioProcessor.prototype.createRandomWalkState = function createRandomWalkState() {
  return {
    lowpass: this.createLowpassState(),
    out: 0,
    seed: 0,
    seedKey: "",
    nativeHandle: 0,
    nativeSeedKey: "",
  };
};
