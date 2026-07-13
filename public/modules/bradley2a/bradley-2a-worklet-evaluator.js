// Realtime worklet evaluator methods for bradley2a, split out of
// node-live-audio-worklet-core.js onto NodeLiveAudioProcessor's prototype.
// Loaded as part of the Blob-assembled AudioWorklet module (see
// nodeGraphLiveWorkletSourceFiles in node-graph-live-runtime.js) after
// core.js defines the class and before register.js calls
// registerProcessor -- no call-site changes needed since the dispatch
// registry calls this.bradley2ASample(...) directly.
NodeLiveAudioProcessor.prototype.createBradley2AState = function createBradley2AState() {
  return {
    nativeHandle: 0,
    carrierPhase: 0,
    jitterLfoPhase: 0,
    ampLfoPhase: 0,
    shiftPhase: 0,
    interfPhase: 0,
    hitClock: 0,
    hitSamplesLeft: 0,
    noiseSeed: 0x2a2a2a2a,
  };
};

NodeLiveAudioProcessor.prototype.bradley2ANextNoise = function bradley2ANextNoise(state) {
  state.noiseSeed = (Math.imul(1664525, state.noiseSeed) + 1013904223) >>> 0;
  return (state.noiseSeed / 4294967295) * 2 - 1;
};

// JS mirror of bradley_2a.cpp's soemdsp_bradley_2a_sample -- used only
// when the wasm module hasn't loaded yet or fails. Same math, same
// parameter order/meaning; Math.sin replaces the .cpp's hand-rolled
// dsp_sin since JS has a native one.
NodeLiveAudioProcessor.prototype.bradley2ASampleJs = function bradley2ASampleJs(state, params, rate = sampleRate) {
  const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
  const num = (v) => this.safeFilterNumber(v, null);
  const carrierFreq = num(params.carrierFreq);
  const freqOffset = num(params.freqOffset);
  const jitterDepth = num(params.jitterDepth);
  const jitterRate = num(params.jitterRate);
  const ampDepth = num(params.ampDepth);
  const ampRate = num(params.ampRate);
  const interfLevel = num(params.interfLevel);
  const interfFreq = num(params.interfFreq);
  const harm2 = num(params.harm2);
  const harm3 = num(params.harm3);
  const hitRate = num(params.hitRate);
  const hitDuration = num(params.hitDuration);
  const hitGain = num(params.hitGain);
  const hitPhase = num(params.hitPhase);
  const impulseLevel = num(params.impulseLevel);
  const level = num(params.level);
  const twoPi = Math.PI * 2;

  state.hitClock += Math.max(0, hitRate) / safeRate;
  if (state.hitClock >= 1) {
    state.hitClock -= 1;
    state.hitSamplesLeft = Math.max(0, Math.round(hitDuration * safeRate));
  }
  const hitActive = state.hitSamplesLeft > 0;
  if (hitActive) state.hitSamplesLeft--;

  state.jitterLfoPhase = (state.jitterLfoPhase + twoPi * jitterRate / safeRate) % twoPi;
  const phaseJitter = jitterDepth * Math.sin(state.jitterLfoPhase);

  state.ampLfoPhase = (state.ampLfoPhase + twoPi * ampRate / safeRate) % twoPi;
  const ampMod = 1 + ampDepth * Math.sin(state.ampLfoPhase);

  state.shiftPhase = (state.shiftPhase + twoPi * freqOffset / safeRate) % twoPi;

  const phaseHit = hitActive ? hitPhase : 0;
  state.carrierPhase = (state.carrierPhase + twoPi * carrierFreq / safeRate) % twoPi;
  let sig = Math.sin(state.carrierPhase + phaseJitter + state.shiftPhase + phaseHit) * ampMod;

  state.interfPhase = (state.interfPhase + twoPi * interfFreq / safeRate) % twoPi;
  sig += interfLevel * Math.sin(state.interfPhase);

  sig = sig + harm2 * sig * sig + harm3 * sig * sig * sig;

  if (hitActive) {
    sig *= hitGain;
    sig += this.bradley2ANextNoise(state) * impulseLevel;
  }

  return this.clampValue(sig * level, -1, 1);
};

NodeLiveAudioProcessor.prototype.bradley2ASample = function bradley2ASample(state, params, rate = sampleRate) {
  if (
    this.nativeBradley2AReady &&
    this.nativeBradley2A?.soemdsp_bradley_2a_create &&
    this.nativeBradley2A?.soemdsp_bradley_2a_sample
  ) {
    try {
      if (!state.nativeHandle) {
        state.nativeHandle = this.nativeBradley2A.soemdsp_bradley_2a_create();
      }
      if (state.nativeHandle) {
        const safeRate = Number(rate) > 1 ? Number(rate) : sampleRate;
        const out = this.nativeBradley2A.soemdsp_bradley_2a_sample(
          state.nativeHandle,
          Number(params.carrierFreq) || 0,
          Number(params.freqOffset) || 0,
          Number(params.jitterDepth) || 0,
          Number(params.jitterRate) || 0,
          Number(params.ampDepth) || 0,
          Number(params.ampRate) || 0,
          Number(params.interfLevel) || 0,
          Number(params.interfFreq) || 0,
          Number(params.harm2) || 0,
          Number(params.harm3) || 0,
          Number(params.hitRate) || 0,
          Number(params.hitDuration) || 0,
          Number(params.hitGain) || 0,
          Number(params.hitPhase) || 0,
          Number(params.impulseLevel) || 0,
          Number(params.level) || 0,
          safeRate,
        );
        return this.safeFilterNumber(out, null);
      }
    } catch (error) {
      this.nativeBradley2AReady = false;
      this.port.postMessage({
        type: "nativeModuleStatus",
        name: "bradley_2a",
        status: "disabled",
        message: String(error?.message || error || "native Bradley 2A failed"),
      });
    }
  }
  return this.bradley2ASampleJs(state, params, rate);
};
