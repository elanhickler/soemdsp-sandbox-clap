function createNodeGraphHighpassState() {
  return {
    inputBuffer: 0,
    outputBuffer: 0,
  };
}

function nodeGraphExternalButtonEventPulse(runtime, name) {
  const events = runtime?.externalButtonEvents;
  if (!(events instanceof Map)) {
    return 0;
  }
  const remaining = Number(events.get(name)) || 0;
  if (remaining <= 0) {
    events.delete(name);
    return 0;
  }
  events.set(name, remaining - 1);
  return 1;
}

function nodeGraphWireBreakEventSample(runtime) {
  const event = runtime?.wireBreakEvent;
  if (!event || typeof event !== "object") {
    return { Pulse: 0, Gate: 0 };
  }
  const pulseSamples = Math.max(0, Number(event.pulseSamples) || 0);
  const gateSamples = Math.max(0, Number(event.gateSamples) || 0);
  const output = {
    Pulse: pulseSamples > 0 ? 1 : 0,
    Gate: gateSamples > 0 ? 1 : 0,
  };
  event.pulseSamples = Math.max(0, pulseSamples - 1);
  event.gateSamples = Math.max(0, gateSamples - 1);
  return output;
}

function nodeGraphWireDisconnectEventSample(runtime) {
  const event = runtime?.wireDisconnectEvent;
  if (!event || typeof event !== "object") {
    return { Pulse: 0 };
  }
  const pulseSamples = Math.max(0, Number(event.pulseSamples) || 0);
  event.pulseSamples = Math.max(0, pulseSamples - 1);
  return { Pulse: pulseSamples > 0 ? 1 : 0 };
}

function nodeGraphWireConnectEventSample(runtime) {
  const event = runtime?.wireConnectEvent;
  if (!event || typeof event !== "object") {
    return { Pulse: 0 };
  }
  const pulseSamples = Math.max(0, Number(event.pulseSamples) || 0);
  event.pulseSamples = Math.max(0, pulseSamples - 1);
  return { Pulse: pulseSamples > 0 ? 1 : 0 };
}

function nodeGraphShootingStarExplosionEventSample(runtime, lowRange, highRange) {
  const event = runtime?.shootingStarExplosionEvent;
  if (!event || typeof event !== "object") {
    return { Pulse: 0 };
  }
  const pulseSamples = Math.max(0, Number(event.pulseSamples) || 0);
  const speed = Number(event.speed);
  const low = Number(lowRange) || 0;
  const high = Number(highRange) || 0;
  const lo = Math.min(low, high);
  const hi = Math.max(low, high);
  // speed is expected 0-1 (the site's trigger intensity), interpolated
  // linearly into [lowRange, highRange] to get the actual pulse amplitude.
  // No speed data (not finite) keeps the pulse at max amplitude.
  let power = hi;
  if (Number.isFinite(speed)) {
    const normalizedSpeed = Math.max(0, Math.min(1, speed));
    power = lo + normalizedSpeed * (hi - lo);
  }
  event.pulseSamples = Math.max(0, pulseSamples - 1);
  return { Pulse: pulseSamples > 0 ? power : 0 };
}

function nodeGraphWindowReopenEventSample(runtime) {
  const event = runtime?.windowReopenEvent;
  if (!event || typeof event !== "object") {
    return { Pulse: 0, Gate: 0, Sine: 0 };
  }
  const pulseSamples = Math.max(0, Number(event.pulseSamples) || 0);
  const gateSamples = Math.max(0, Number(event.gateSamples) || 0);
  const totalSamples = Math.max(1, Number(event.totalSamples) || gateSamples || 1);
  const progress = gateSamples > 0 ? 1 - gateSamples / totalSamples : 1;
  const sine = gateSamples > 0 ? Math.sin(Math.PI * Math.max(0, Math.min(1, progress))) : 0;
  event.pulseSamples = Math.max(0, pulseSamples - 1);
  event.gateSamples = Math.max(0, gateSamples - 1);
  return {
    Pulse: pulseSamples > 0 ? 1 : 0,
    Gate: gateSamples > 0 ? 1 : 0,
    Sine: sine,
  };
}

function createNodeGraphPatchCommandState() {
  return {
    lastTrigger: 0,
  };
}

function nodeGraphPatchCommandTriggerSample(state, trigger, threshold, command, nodeId) {
  const safeTrigger = Number.isFinite(Number(trigger)) ? Number(trigger) : 0;
  const safeThreshold = Number.isFinite(Number(threshold)) ? Number(threshold) : 0;
  if (state.lastTrigger <= safeThreshold && safeTrigger > safeThreshold) {
    if (typeof queueNodeGraphLivePatchCommand === "function") {
      queueNodeGraphLivePatchCommand(command, nodeId);
    }
  }
  state.lastTrigger = safeTrigger;
  return 0;
}

function createNodeGraphLowpassState() {
  return {
    outputBuffer: 0,
  };
}

function createNodeGraphPassiveFilterState() {
  return {
    highpass: createNodeGraphHighpassState(),
    lowpass: createNodeGraphLowpassState(),
  };
}

function nodeGraphPassiveFilterSample(state, input, mode, lowFrequency, highFrequency, sampleRate, runtime, nodeId) {
  const safeMode = Math.round(Number(mode)) || 0;
  if (safeMode === 1) {
    const lowCut  = Math.max(0, Number(lowFrequency)  || 0);
    const highCut = Math.max(0, Number(highFrequency) || 0);
    const low  = Math.min(lowCut, highCut);
    const high = Math.max(lowCut, highCut);
    const hp = nodeGraphOnePoleHighpassSample(state.highpass, input, low, sampleRate, runtime, nodeId);
    return nodeGraphOnePoleLowpassSample(state.lowpass, hp, high, sampleRate, runtime, nodeId);
  }
  if (safeMode === 2) {
    return nodeGraphOnePoleHighpassSample(state.highpass, input, lowFrequency, sampleRate, runtime, nodeId);
  }
  return nodeGraphOnePoleLowpassSample(state.lowpass, input, highFrequency, sampleRate, runtime, nodeId);
}

function createNodeGraphLadderFilterState() {
  return {
    y: [0, 0, 0, 0, 0],
  };
}

// Bundles three independent per-channel filter states (mono/left/right) so a
// stereo signal gets genuinely independent filter histories per channel
// instead of one shared (mono-summed) instance. createFn is one of this
// file's existing createNodeGraphXState functions.
function createNodeGraphStereoFilterState(createFn) {
  return { left: createFn(), mono: createFn(), right: createFn() };
}

function createNodeGraphOscResetState() {
  return {
    lastReset: 0,
  };
}

function nodeGraphIsPolyBlepOscillatorType(type) {
  return nodeGraphModuleIsRealtimeOscillatorType(type);
}

function createNodeGraphGraphLfoState() {
  return {
    lastReset: 0,
    resetFrame: 0,
  };
}

function createNodeGraphSlewLimiterState() {
  return {
    initialized: false,
    out: 0,
  };
}

function createNodeGraphStereoSlewLimiterState() {
  return {
    left: createNodeGraphSlewLimiterState(),
    mono: createNodeGraphSlewLimiterState(),
    right: createNodeGraphSlewLimiterState(),
  };
}

function createNodeGraphClockState() {
  return {
    hasStarted: false,
    phase: 0,
  };
}

function createNodeGraphRandomClockState() {
  return {
    intervalSamples: 0,
    lastReset: 0,
    phaseSamples: 0,
    randomState: 0,
    remainingTriggerSamples: 0,
    seedKey: "",
  };
}

function createNodeGraphDelayedTriggerState() {
  return {
    hasTriggered: true,
    lastReset: 0,
    lastTrigger: 0,
    remainingSamples: 0,
    running: false,
    waitSamples: 0,
  };
}

function createNodeGraphDelayEffectState() {
  return {
    buffer: new Float32Array(1),
    bufferSize: 1,
    lfoPhase: 0,
    lfoVariationState: 0,
    position: 0,
    wet: 0,
  };
}

function createNodeGraphStereoDelayEffectState() {
  return {
    left: createNodeGraphDelayEffectState(),
    mono: createNodeGraphDelayEffectState(),
    right: createNodeGraphDelayEffectState(),
  };
}

function createNodeGraphPingPongDelayState() {
  return {
    bufferL: new Float32Array(1),
    bufferR: new Float32Array(1),
    bufferSize: 1,
    position: 0,
    wetL: 0,
    wetR: 0,
  };
}

function createNodeGraphSabrinaReverbState() {
  return {
    nativeHandle: 0,
    nativeParamKey: "",
    nativeSampleRate: 0,
  };
}

function createNodeGraphPllState() {
  return { nativeHandle: 0, nativeParamKey: "", nativeSampleRate: 0 };
}

function createNodeGraphHelmholtzState() {
  return { nativeHandle: 0, nativeParamKey: "", nativeSampleRate: 0 };
}

function createNodeGraphSampleHoldState() {
  return {
    clockPhase: 0,
    held: 0,
    lastTrigger: 0,
    noise: createNodeGraphNoiseGeneratorChannelState(),
  };
}

function createNodeGraphStereoSampleHoldState() {
  return {
    left: createNodeGraphSampleHoldState(),
    mono: createNodeGraphSampleHoldState(),
    right: createNodeGraphSampleHoldState(),
  };
}

function createNodeGraphSamplePlaybackState() {
  return {
    lastReset: 0,
    phase: 0,
    playing: false,
    rangeKey: "",
    sampleId: "",
  };
}

function createNodeGraphStepSequencerState() {
  return {
    gate: 0,
    index: 0,
    lastReset: 0,
    lastTrigger: 0,
    out: 0,
  };
}

function createNodeGraphTriggerCounterState() {
  return {
    count: 0,
    lastReset: 0,
    lastTrigger: 0,
    remainingSamples: 0,
  };
}

function createNodeGraphTriggerDividerState() {
  return {
    count: 0,
    lastReset: 0,
    lastTrigger: 0,
    remainingSamples: 0,
  };
}

function createNodeGraphExpAdsrState() {
  return {
    lastGate: 0,
    out: 0,
    secondsPassed: 0,
    state: "off",
  };
}

function createNodeGraphLinearEnvelopeState() {
  return {
    lastGate: 0,
    out: 0,
    releaseDecrement: 0,
    secondsPassed: 0,
    state: "off",
  };
}

function createNodeGraphPluckEnvelopeState() {
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
  };
}

function createNodeGraphVactrolEnvelopeState() {
  return {
    out: 0,
    raw: 0,
  };
}

function createNodeGraphImpulseButtonState() {
  return {
    amplitude: 1,
    pulseSamples: 0,
  };
}

function createNodeGraphFlowerChildEnvelopeFollowerState() {
  return {
    currentSlewedValue: 0,
    holdCounter: 0,
    out: 0,
  };
}

function createNodeGraphNoiseGeneratorChannelState() {
  return { brown: 0, gaussianSpare: null, pink: [0, 0, 0, 0, 0, 0, 0], seed: 0, seedKey: "" };
}

function createNodeGraphNoiseGeneratorState() {
  return { left: createNodeGraphNoiseGeneratorChannelState(), right: createNodeGraphNoiseGeneratorChannelState() };
}

function createNodeGraphRandomWalkState() {
  return {
    lowpass: createNodeGraphLowpassState(),
    out: 0,
    seed: 0,
    seedKey: "",
  };
}

function createNodeGraphPiSpigotNoiseChannelState() {
  return {
    cache: null,
    readIndex: 0,
    cacheStart: null,
    pink: [0, 0, 0, 0, 0, 0, 0],
    brown: 0,
    prevWhite1: 0,
    prevWhite2: 0,
    smoothLp: [0, 0, 0, 0],
  };
}

// JS mirror of pi_spigot_noise.cpp's applySmoothing -- see that file for
// why a 4-stage one-pole cascade with an exponential g curve.
function applyNodeGraphPiSpigotSmoothing(channel, x, smoothing) {
  const safeSmoothing = clampNodeSliderValue(Number(smoothing) || 0, 0, 1);
  if (safeSmoothing <= 0) return x;
  const lnSmoothMinG = -3.912023005428146; // ln(0.02)
  const g = Math.exp(safeSmoothing * lnSmoothMinG);
  let y = x;
  for (let i = 0; i < 4; i++) {
    channel.smoothLp[i] += g * (y - channel.smoothLp[i]);
    y = channel.smoothLp[i];
  }
  return y;
}

function createNodeGraphPiSpigotNoiseState() {
  return {
    left: createNodeGraphPiSpigotNoiseChannelState(),
    right: createNodeGraphPiSpigotNoiseChannelState(),
    wasmHandle: 0,
    wasmSeedLeft: null,
    wasmSeedRight: null,
  };
}

// JS mirror of pi_spigot_noise.cpp's applyColor -- used only when the
// fallback BBP cache is active (wasm not yet loaded or failed).
function applyNodeGraphPiSpigotColor(state, white, color) {
  if (color === 1) {
    state.pink[0] = 0.99886 * state.pink[0] + white * 0.0555179;
    state.pink[1] = 0.99332 * state.pink[1] + white * 0.0750759;
    state.pink[2] = 0.969 * state.pink[2] + white * 0.153852;
    state.pink[3] = 0.8665 * state.pink[3] + white * 0.3104856;
    state.pink[4] = 0.55 * state.pink[4] + white * 0.5329522;
    state.pink[5] = -0.7616 * state.pink[5] - white * 0.016898;
    const out = (state.pink[0] + state.pink[1] + state.pink[2] +
      state.pink[3] + state.pink[4] + state.pink[5] + state.pink[6] + white * 0.5362) * 0.11;
    state.pink[6] = white * 0.115926;
    return out;
  }
  if (color === 2) {
    state.brown = clampNodeSliderValue(state.brown + white * 0.05, -1, 1);
    return state.brown;
  }
  if (color === 3) {
    const out = (white - state.prevWhite1) * 0.5;
    state.prevWhite1 = white;
    return out;
  }
  if (color === 4) {
    const out = (white - 2 * state.prevWhite1 + state.prevWhite2) * 0.25;
    state.prevWhite2 = state.prevWhite1;
    state.prevWhite1 = white;
    return out;
  }
  return white;
}

function resetNodeGraphPiSpigotColorFilters(state) {
  state.pink[0] = 0; state.pink[1] = 0; state.pink[2] = 0; state.pink[3] = 0;
  state.pink[4] = 0; state.pink[5] = 0; state.pink[6] = 0;
  state.brown = 0;
  state.prevWhite1 = 0;
  state.prevWhite2 = 0;
  state.smoothLp[0] = 0; state.smoothLp[1] = 0; state.smoothLp[2] = 0; state.smoothLp[3] = 0;
}

// Unlike node-live-audio-worklet-core.js, this evaluator runs on the main
// thread (module groups / offline render), which does have fetch -- so
// rather than duplicate the 333,333-sample pi-digit dataset in JS, it
// just loads the same pi_spigot_noise.wasm the worklet uses and calls
// its exports directly. See pi_spigot_noise.cpp for what that dataset is
// and why it replaced computing every sample live.
const nodeGraphPiSpigotNoiseWasm = { promise: null, exports: null, failed: false };

function nodeGraphPiSpigotNoiseLoadWasm() {
  if (nodeGraphPiSpigotNoiseWasm.promise || typeof fetch !== "function" || typeof WebAssembly === "undefined") {
    return;
  }
  nodeGraphPiSpigotNoiseWasm.promise = fetch("/native_modules/pi_spigot_noise/pi_spigot_noise.wasm")
    .then((response) => response.arrayBuffer())
    .then((bytes) => WebAssembly.instantiate(bytes, {}))
    .then((result) => {
      nodeGraphPiSpigotNoiseWasm.exports = result.instance.exports;
    })
    .catch(() => {
      nodeGraphPiSpigotNoiseWasm.failed = true;
    });
}

// Pure-JS mirror of pi_spigot_noise.cpp's BBP digit extraction -- used
// only as a fallback while the wasm dataset above is still loading (or if
// it fails to load). See the .cpp file for the math writeup and the
// cost/precision reasoning behind these constants.
function nodeGraphPiSpigotPowMod(a, b, m) {
  let result = 1;
  let base = a % m;
  while (b > 0.5) {
    if (b % 2 >= 1) {
      result = (result * base) % m;
    }
    b = Math.floor(b / 2);
    base = (base * base) % m;
  }
  return result;
}

function nodeGraphPiSpigotSeries(m, n) {
  let s = 0;
  for (let k = 0; k <= n; k++) {
    const ak = 8 * k + m;
    const t = nodeGraphPiSpigotPowMod(16, n - k, ak);
    s += t / ak;
    s -= Math.floor(s);
  }
  for (let k = n + 1; k < n + 100; k++) {
    const ak = 8 * k + m;
    const t = Math.pow(16, n - k);
    if (t < 1e-17) break;
    s += t / ak;
  }
  const frac = s - Math.floor(s);
  return frac < 0 ? frac + 1 : frac;
}

function nodeGraphPiSpigotBipolar(n) {
  let x = 4 * nodeGraphPiSpigotSeries(1, n) - 2 * nodeGraphPiSpigotSeries(4, n)
    - nodeGraphPiSpigotSeries(5, n) - nodeGraphPiSpigotSeries(6, n);
  x -= Math.floor(x);
  if (x < 0) x += 1;
  return x * 2 - 1;
}

function fillNodeGraphPiSpigotNoiseCacheFallback(state, start) {
  const cacheSize = 1024;
  const maxStart = 256;
  const safeStart = clampNodeSliderValue(Math.floor(Number(start) || 0), 0, maxStart);
  const cache = new Float64Array(cacheSize);
  for (let i = 0; i < cacheSize; i++) {
    cache[i] = nodeGraphPiSpigotBipolar(safeStart + i);
  }
  state.cache = cache;
  state.readIndex = 0;
  state.cacheStart = safeStart;
}

function nodeGraphPiSpigotNoiseChannelSampleFallback(channel, seedFraction, color, smoothing, level) {
  // Fallback range is the small BBP-computed cache, not the full
  // 1-second buffer the wasm path reads from -- the normalized seed
  // still spreads across it.
  const fallbackStart = clampNodeSliderValue(Math.round(seedFraction * 256), 0, 256);
  if (!channel.cache || channel.cacheStart !== fallbackStart) {
    fillNodeGraphPiSpigotNoiseCacheFallback(channel, fallbackStart);
    resetNodeGraphPiSpigotColorFilters(channel);
  }
  const white = channel.cache[channel.readIndex];
  channel.readIndex = (channel.readIndex + 1) % channel.cache.length;
  const colored = applyNodeGraphPiSpigotColor(channel, white, color);
  return applyNodeGraphPiSpigotSmoothing(channel, colored, smoothing);
}

function nodeGraphPiSpigotNoiseSample(state, params, runtime = null, nodeId = "") {
  const seedLeft = clampNodeSliderValue(nodeGraphSafeFilterNumber(params.seedLeft, runtime, nodeId, null, "pi spigot noise seed L"), 0, 1);
  const seedRight = clampNodeSliderValue(nodeGraphSafeFilterNumber(params.seedRight, runtime, nodeId, null, "pi spigot noise seed R"), 0, 1);
  const color = clampNodeSliderValue(Math.round(nodeGraphSafeFilterNumber(params.color, runtime, nodeId, null, "pi spigot noise color")), 0, 4);
  const smoothing = clampNodeSliderValue(nodeGraphSafeFilterNumber(params.smoothing, runtime, nodeId, null, "pi spigot noise smoothing"), 0, 1);
  const level = nodeGraphSafeFilterNumber(params.level, runtime, nodeId, null, "pi spigot noise level");

  nodeGraphPiSpigotNoiseLoadWasm();
  const wasm = nodeGraphPiSpigotNoiseWasm.exports;
  if (wasm?.soemdsp_pi_spigot_noise_create && wasm?.soemdsp_pi_spigot_noise_sample) {
    if (!state.wasmHandle) {
      state.wasmHandle = wasm.soemdsp_pi_spigot_noise_create();
    }
    if (state.wasmHandle) {
      if (state.wasmSeedLeft !== seedLeft || state.wasmSeedRight !== seedRight) {
        state.wasmSeedLeft = seedLeft;
        state.wasmSeedRight = seedRight;
        wasm.soemdsp_pi_spigot_noise_reset_seed(state.wasmHandle, seedLeft, seedRight);
      }
      wasm.soemdsp_pi_spigot_noise_sample(state.wasmHandle, color, smoothing, level);
      return {
        "Left Out": nodeGraphSafeFilterNumber(wasm.soemdsp_pi_spigot_noise_left(state.wasmHandle), runtime, nodeId, null, "pi spigot noise left"),
        "Right Out": nodeGraphSafeFilterNumber(wasm.soemdsp_pi_spigot_noise_right(state.wasmHandle), runtime, nodeId, null, "pi spigot noise right"),
      };
    }
  }

  return {
    "Left Out": nodeGraphSafeFilterNumber(
      nodeGraphPiSpigotNoiseChannelSampleFallback(state.left, seedLeft, color, smoothing, level) * level,
      runtime, nodeId, null, "pi spigot noise left",
    ),
    "Right Out": nodeGraphSafeFilterNumber(
      nodeGraphPiSpigotNoiseChannelSampleFallback(state.right, seedRight, color, smoothing, level) * level,
      runtime, nodeId, null, "pi spigot noise right",
    ),
  };
}

function createNodeGraphFractalBrownianNoiseState() {
  return {
    axes: {},
    resetWasHigh: false,
  };
}

const nodeGraphBadValueExplosionLimit = 999999999;
const nodeGraphBadValueDenormalLimit = 1.1754943508222875e-38;

function nodeGraphBadValueReason(value) {
  const number = Number(value);
  if (Number.isNaN(number)) {
    return "NaN";
  }
  if (!Number.isFinite(number)) {
    return "inf";
  }
  if (Math.abs(number) > nodeGraphBadValueExplosionLimit) {
    return "exploded";
  }
  if (number !== 0 && Math.abs(number) < nodeGraphBadValueDenormalLimit) {
    return "denormal";
  }
  return "";
}

function nodeGraphMarkRuntimeBadNumber(runtime, nodeId, source = "dsp") {
  if (!runtime) {
    return;
  }
  runtime.badNumberCount = (runtime.badNumberCount || 0) + 1;
  runtime.lastBadNumber = { nodeId, source };
  if (typeof nodeGraphRecordBadValueEvent === "function") {
    nodeGraphRecordBadValueEvent({
      engine: runtime.engine || "runtime",
      nodeId,
      reason: source.split(" ").pop() || "bad",
      source,
    });
  }
}

function nodeGraphSafeFilterNumber(value, runtime, nodeId, state, source) {
  const number = Number(value);
  const reason = nodeGraphBadValueReason(number);
  if (!reason) {
    return number;
  }
  if (state) {
    state.inputBuffer = 0;
    state.outputBuffer = 0;
  }
  nodeGraphMarkRuntimeBadNumber(runtime, nodeId, `${source} ${reason}`);
  return 0;
}

function nodeGraphCodeblockCacheKey(codeblock) {
  return `${codeblock.inputs.join(",")}=>${codeblock.outputs.join(",")}::${codeblock.code}`;
}

function nodeGraphCreateCodeblockOutputObject(codeblock) {
  const output = {};
  for (const port of codeblock.outputs) {
    output[port] = 0;
  }
  return output;
}

function nodeGraphCompileCodeblockFunction(runtime, node) {
  const codeblock = normalizeNodeGraphCodeblock(node.codeblock);
  const key = nodeGraphCodeblockCacheKey(codeblock);
  const cached = runtime.codeblockFunctions?.get(node.id);
  if (cached?.key === key) {
    return cached;
  }
  const fn = Function(
    "__inputs",
    "__outputs",
    "__state",
    "__context",
    nodeGraphCodeblockBuildFunctionBody(codeblock),
  );
  const compiled = {
    codeblock,
    fn,
    inputs: new Array(codeblock.inputs.length).fill(0),
    key,
    output: nodeGraphCreateCodeblockOutputObject(codeblock),
    state: Object.create(null),
  };
  runtime.codeblockFunctions?.set(node.id, compiled);
  return compiled;
}

function nodeGraphEvaluateCodeblock(runtime, node, mixInput, sampleRate = nodeGraphMvp?.sampleRate || 44100, frame = 0, frames = 1) {
  let compiled = null;
  try {
    compiled = nodeGraphCompileCodeblockFunction(runtime, node);
  } catch (error) {
    nodeGraphMarkRuntimeBadNumber(runtime, node.id, `codeblock compile error ${error?.message || ""}`);
    return {};
  }
  const { codeblock, fn, inputs, output, state } = compiled;
  try {
    for (let index = 0; index < codeblock.inputs.length; index += 1) {
      const port = codeblock.inputs[index];
      inputs[index] = nodeGraphSafeFilterNumber(
        mixInput(node.id, port),
        runtime,
        node.id,
        null,
        `codeblock ${port} input`,
      );
    }
    for (const port of codeblock.outputs) {
      output[port] = 0;
    }
    fn(inputs, output, state, {
      frame,
      frames,
      sampleRate,
      time: (Number(frame) || 0) / (Number(sampleRate) || 44100),
    });
    for (const port of codeblock.outputs) {
      output[port] = nodeGraphSafeFilterNumber(
        output[port],
        runtime,
        node.id,
        null,
        `codeblock ${port} output`,
      );
    }
    return output;
  } catch (error) {
    nodeGraphMarkRuntimeBadNumber(runtime, node.id, `codeblock runtime error ${error?.message || ""}`);
    for (const port of codeblock.outputs) {
      output[port] = 0;
    }
    return output;
  }
}

function nodeGraphEvaluateModuleGroup(runtime, node, mixInput, sampleRate, frame, frames) {
  const group = node.moduleGroup?.kind === "moduleGroup"
    ? node.moduleGroup
    : normalizeNodeGraphModuleGroup(node.moduleGroup);
  if (!group.sourcePatch) {
    return {};
  }
  let groupRuntime = runtime.moduleGroupRuntimes?.get(node.id);
  if (!groupRuntime) {
    try {
      groupRuntime = createNodeGraphLiveRuntime(nodeGraphBuildLivePlanForPatch(group.sourcePatch));
      runtime.moduleGroupRuntimes?.set(node.id, groupRuntime);
    } catch (error) {
      nodeGraphMarkRuntimeBadNumber(runtime, node.id, `module group plan error ${error?.message || ""}`);
      return {};
    }
  }
  groupRuntime.externalButtonEvents = runtime.externalButtonEvents;
  groupRuntime.wireBreakEvent = runtime.wireBreakEvent;
  groupRuntime.wireConnectEvent = runtime.wireConnectEvent;
  groupRuntime.wireDisconnectEvent = runtime.wireDisconnectEvent;
  groupRuntime.windowReopenEvent = runtime.windowReopenEvent;
  groupRuntime.shootingStarExplosionEvent = runtime.shootingStarExplosionEvent;
  groupRuntime.externalGroupInputs = new Map(
    group.inputs.map((input) => [input.nodeId, mixInput(node.id, input.name)]),
  );
  const groupFrame = evaluateNodeGraphPlanFrame(groupRuntime, sampleRate, frame, frames);
  const output = {};
  for (const endpoint of group.outputs) {
    output[endpoint.name] = readNodeGraphRuntimePortOutput(
      groupRuntime,
      groupFrame.frameValues,
      endpoint.nodeId,
      endpoint.port || "Out",
      frame,
      frames,
    );
  }
  return output;
}

function nodeGraphVisualControlIntensity(value, runtime, nodeId, source = "visual control") {
  const safeValue = nodeGraphSafeFilterNumber(value, runtime, nodeId, null, source);
  return clampNodeSliderValue(Math.abs(safeValue), 0, 1);
}

function nodeGraphVisualControlSigned(value, runtime, nodeId, source = "visual control") {
  const safeValue = nodeGraphSafeFilterNumber(value, runtime, nodeId, null, source);
  return clampNodeSliderValue(safeValue, -1, 1);
}

function nodeGraphScreenSpaceShaderSample(node, readInput, runtime, nodeId, sampleRate) {
  const script = normalizeNodeGraphScreenSpaceShader(node?.screenSpaceShader);
  const value = {};
  for (const input of script.visualInputs || []) {
    if (input.mode === "raw") {
      continue;
    }
    const raw = readInput(input.port);
    const signed = input.mode === "signed";
    const target = signed
      ? nodeGraphVisualControlSigned(raw, runtime, nodeId, `screen space shader ${input.port}`)
      : nodeGraphVisualControlIntensity(raw, runtime, nodeId, `screen space shader ${input.port}`);
    value[input.key] = nodeGraphSmoothVisualControl(
      runtime,
      input.key,
      target,
      sampleRate,
      signed ? 0.045 : 0.025,
      signed ? -1 : 0,
      1,
    );
  }
  return value;
}

function nodeGraphVisualHslToRgb(hue, saturation, lightness) {
  const h = ((Number(hue) || 0) % 1 + 1) % 1;
  const s = clampNodeSliderValue(Number(saturation) || 0, 0, 1);
  const l = clampNodeSliderValue(Number(lightness) || 0, 0, 1);
  if (s <= 0) {
    return [l, l, l];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (offset) => {
    let t = h + offset;
    if (t < 0) {
      t += 1;
    }
    if (t > 1) {
      t -= 1;
    }
    if (t < 1 / 6) {
      return p + (q - p) * 6 * t;
    }
    if (t < 1 / 2) {
      return q;
    }
    if (t < 2 / 3) {
      return p + (q - p) * (2 / 3 - t) * 6;
    }
    return p;
  };
  return [channel(1 / 3), channel(0), channel(-1 / 3)];
}

function createNodeGraphVisualControlState() {
  return {
    controls: {
      blue: 0,
      chromaAlpha: 0,
      chromaDrift: 0,
      chromaHue: 0,
      chromaLightness: 0,
      chromaSaturation: 0,
      chromaSpread: 0,
      green: 0,
      red: 0,
      scopePaused: 0,
      scopeTracesOff: 0,
      screenDim: 0,
      screenShake: 0,
      visualBloom: 0,
      visualBrightness: 0,
      visualGlow: 0,
      x: 0,
      y: 0,
    },
    states: new Map([
      ["blue", 0],
      ["chromaAlpha", 0],
      ["chromaDrift", 0],
      ["chromaHue", 0],
      ["chromaLightness", 0],
      ["chromaSaturation", 0],
      ["chromaSpread", 0],
      ["green", 0],
      ["red", 0],
      ["scopePaused", 0],
      ["scopeTracesOff", 0],
      ["screenDim", 0],
      ["screenShake", 0],
      ["visualBloom", 0],
      ["visualBrightness", 0],
      ["visualGlow", 0],
      ["x", 0],
      ["y", 0],
    ]),
  };
}

function resetNodeGraphRuntimeVisualControls(runtime) {
  if (!runtime) {
    return;
  }
  const visualState = createNodeGraphVisualControlState();
  runtime.visualControls = visualState.controls;
  runtime.visualControlStates = visualState.states;
}

function nodeGraphSmoothVisualControl(runtime, key, target, sampleRate, seconds = 0.045, min = 0, max = 1) {
  if (!runtime.visualControls) {
    runtime.visualControls = createNodeGraphVisualControlState().controls;
  }
  if (!runtime.visualControlStates) {
    runtime.visualControlStates = new Map();
  }
  const safeTarget = clampNodeSliderValue(Number(target) || 0, min, max);
  const previous = Number(runtime.visualControlStates.get(key));
  const current = Number.isFinite(previous) ? previous : 0;
  const rate = Math.max(1, sampleRate || nodeGraphMvp.sampleRate || 44100);
  const time = Math.max(0, Number(seconds) || 0);
  const coefficient = time <= 0 ? 1 : 1 - Math.exp(-1 / Math.max(1, time * rate));
  const next = current + (safeTarget - current) * coefficient;
  const cleaned = Math.abs(next) < 0.000001 ? 0 : clampNodeSliderValue(next, min, max);
  runtime.visualControlStates.set(key, cleaned);
  runtime.visualControls[key] = cleaned;
  return cleaned;
}

function nodeGraphBadValueMonitorSample(value, runtime, nodeId) {
  const number = Number(value);
  const reason = nodeGraphBadValueReason(number);
  if (reason) {
    if (runtime) {
      runtime.badNumberCount = (runtime.badNumberCount || 0) + 1;
      runtime.lastBadNumber = { nodeId, source: `badval monitor input ${reason}` };
    }
    if (typeof nodeGraphRecordBadValueEvent === "function") {
      nodeGraphRecordBadValueEvent({
        engine: runtime?.engine || "runtime",
        force: true,
        nodeId,
        reason,
        source: "BADVAL Monitor input",
      });
    }
  }
  return number;
}

function nodeGraphSpeakerProtectionSample(value, runtime, nodeId) {
  const number = Number(value);
  const unsafe = !Number.isFinite(number) || Math.abs(number) > 1;
  if (unsafe && runtime) {
    runtime.speakerProtectionMuteCount = (runtime.speakerProtectionMuteCount || 0) + 1;
    runtime.speakerProtectionPeak = Math.max(
      Number(runtime.speakerProtectionPeak) || 0,
      Number.isFinite(number) ? Math.abs(number) : Infinity,
    );
    runtime.lastSpeakerProtection = { nodeId, peak: runtime.speakerProtectionPeak };
  }
  return unsafe ? 0 : number;
}

function nodeGraphSoftClipperSample(input, center = 0, width = 2) {
  const safeWidth = Math.max(0.000001, Math.abs(Number(width) || 2));
  const safeCenter = Number(center) || 0;
  const scaleX = 2 / safeWidth;
  const shiftX = -1 - (scaleX * (safeCenter - 0.5 * safeWidth));
  const scaleY = 1 / scaleX;
  const shiftY = -shiftX * scaleY;
  return shiftY + scaleY * Math.tanh(scaleX * (Number(input) || 0) + shiftX);
}

function nodeGraphOnePoleHighpassSample(state, input, frequency, sampleRate, runtime = null, nodeId = "") {
  const rate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);
  const safeInput = nodeGraphSafeFilterNumber(input, runtime, nodeId, state, "highpass input");
  const frequencyValue = Math.max(0, nodeGraphSafeFilterNumber(frequency, runtime, nodeId, state, "highpass frequency"));
  const w = Math.min((Math.PI * 2) / rate, 0.000142475857) * frequencyValue;
  const a1 = Math.exp(-w);
  const b0 = 0.5 * (1 + a1);
  const b1 = -b0;
  state.outputBuffer = nodeGraphSafeFilterNumber(
    b0 * safeInput + b1 * state.inputBuffer + a1 * state.outputBuffer,
    runtime,
    nodeId,
    state,
    "highpass output",
  );
  state.inputBuffer = safeInput;
  return state.outputBuffer;
}

function nodeGraphOnePoleLowpassSample(state, input, frequency, sampleRate, runtime = null, nodeId = "") {
  const rate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);
  const safeInput = nodeGraphSafeFilterNumber(input, runtime, nodeId, state, "lowpass input");
  const frequencyValue = Math.max(0, nodeGraphSafeFilterNumber(frequency, runtime, nodeId, state, "lowpass frequency"));
  const w = Math.min((Math.PI * 2) / rate, 0.000142475857) * frequencyValue;
  const a1 = Math.exp(-w);
  const b0 = 1 - a1;
  state.outputBuffer = nodeGraphSafeFilterNumber(
    b0 * safeInput + a1 * state.outputBuffer,
    runtime,
    nodeId,
    state,
    "lowpass output",
  );
  return state.outputBuffer;
}


function nodeGraphLadderFilterStageCount(stages) {
  const value = Math.round(Number(stages));
  return Number.isFinite(value) ? clampNodeSliderValue(value, 1, 4) : 4;
}

function nodeGraphLadderFilterMix(mode, stages) {
  const safeMode = Math.round(clampNodeSliderValue(Number(mode) || 0, 0, 3));
  const stageCount = nodeGraphLadderFilterStageCount(stages);
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
  return { c, s, stageCount, mode: safeMode };
}

function nodeGraphLadderFilterComputeFeedbackFactor(feedback, cosWc, a) {
  const b = 1 + a;
  const denominator = Math.max(1e-12, 1 + a * a + 2 * a * cosWc);
  const g2 = (b * b) / denominator;
  return feedback / Math.max(1e-12, g2 * g2);
}

function nodeGraphLadderFilterCoefficients(frequency, resonance, mode, stages, sampleRate, runtime = null, nodeId = "", state = null) {
  const rate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);
  const frequencyValue = Math.max(0, nodeGraphSafeFilterNumber(frequency, runtime, nodeId, state, "ladder filter frequency"));
  const safeFrequency = clampNodeSliderValue(frequencyValue, 0.000001, Math.min(20000, rate * 0.49));
  const feedback = clampNodeSliderValue(
    nodeGraphSafeFilterNumber(resonance, runtime, nodeId, state, "ladder filter resonance"),
    0,
    0.999,
  );
  const wc = clampNodeSliderValue((2 * Math.PI * safeFrequency) / rate, 1e-9, Math.PI * 0.98);
  const sine = Math.sin(wc);
  const cosine = Math.cos(wc);
  const tangent = Math.tan(0.25 * (wc - Math.PI));
  let a = tangent / Math.max(1e-12, sine - cosine * tangent);
  if (!Number.isFinite(a)) {
    a = -1;
  }
  const mix = nodeGraphLadderFilterMix(mode, stages);
  const k = nodeGraphLadderFilterComputeFeedbackFactor(feedback, cosine, a);
  const g = 1 + mix.s * k;
  return { ...mix, a, g, k };
}

function nodeGraphLadderFilterSample(state, input, params, sampleRate, runtime = null, nodeId = "") {
  const safeInput = nodeGraphSafeFilterNumber(input, runtime, nodeId, state, "ladder filter input");
  const coeff = nodeGraphLadderFilterCoefficients(
    params.frequency,
    params.resonance,
    params.mode,
    params.stages,
    sampleRate,
    runtime,
    nodeId,
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
    y[index] = nodeGraphSafeFilterNumber(y[index], runtime, nodeId, state, `ladder filter stage ${index}`);
  }
  const output = coeff.c[0] * y[0] + coeff.c[1] * y[1] + coeff.c[2] * y[2] + coeff.c[3] * y[3] + coeff.c[4] * y[4];
  return nodeGraphSafeFilterNumber(output, runtime, nodeId, state, "ladder filter output");
}

// Resonant self-oscillating filter: a feedback-modulated phasor through two
// cascaded one-pole stages. Mirrors native_modules/flower_child_filter
// exactly -- see that file's header comment for the approximation note on
// the two proprietary node-based-function shaping curves.
function createNodeGraphFlowerChildFilterState() {
  return {
    phase: 0, phaseOffset: 0, stage1: 0, stage2: 0, selfMod: 0,
    rev3Feedback: 0, rev3Lpf1Y1: 0, rev3Lpf2Y1: 0,
    dsPhase: 0, dsHeld: 0,
  };
}

// Generic N-node soemdsp::utility::Graph evaluator (shape 1=RATIONAL,
// 2=EXPONENTIAL, else linear).
function nodeGraphFlowerChildFilterEvalGraph(nodes, x) {
  if (nodes.length === 0) return 0;
  if (x < nodes[0].x) return nodes[0].y;
  let i = -1;
  for (let k = 0; k < nodes.length; k++) {
    if (nodes[k].x > x) { i = k; break; }
  }
  if (i < 0) return nodes[nodes.length - 1].y;
  if (i === 0) return nodes[0].y;
  const n1 = nodes[i - 1];
  const n2 = nodes[i];
  if (n2.x - n1.x < 1e-9) return 0.5 * (n1.y + n2.y);
  const p = (x - n1.x) / (n2.x - n1.x);
  if (n2.shape === 1) return n1.y + (n2.y - n1.y) * nodeGraphFlowerChildFilterRationalCurve(p, n2.skew);
  if (n2.shape === 2) {
    const c = 0.5 * (n2.skew + 1);
    const a = 2 * Math.log((1 - c) / c);
    return n1.y + (n2.y - n1.y) * (1 - Math.exp(p * a)) / (1 - Math.exp(a));
  }
  return n1.y + (n2.y - n1.y) * p;
}

function nodeGraphFlowerChildFilterOnePoleIitCoefficient(cutoffHz, sampleRate) {
  const w = Math.max(1e-9, Math.min(Math.PI * 0.98, 2 * Math.PI * cutoffHz / sampleRate));
  return Math.exp(-w);
}

function nodeGraphFlowerChildFilterOnePoleIitStep(prevY1, input, a1) {
  const b0 = 1 - a1;
  return b0 * input + a1 * prevY1;
}

function nodeGraphFlowerChildFilterSampleAndHold(state, incoming, samplingFreq, sampleRate) {
  state.dsPhase += samplingFreq / sampleRate;
  if (state.dsPhase >= 1) {
    state.dsPhase -= Math.floor(state.dsPhase);
    state.dsHeld = incoming;
  }
  return state.dsHeld;
}

function nodeGraphFlowerChildFilterCurveShape(v, tension) {
  const denom = 2 * tension * v - tension - 1;
  if (denom === 0) return v;
  return (tension * v - v) / denom;
}

// Exact soemdsp::curve::Rational::get(p), p already normalized to [0,1].
function nodeGraphFlowerChildFilterRationalCurve(p, skew) {
  return ((1 + skew) * p) / (1 - skew + 2 * skew * p);
}

// Exact soemdsp::utility::Graph::getValue for the 3-node shape this filter
// uses -- see native_modules/flower_child_filter/flower_child_filter.cpp's
// header comment for the full derivation.
function nodeGraphFlowerChildFilterEvalResonanceGraph(x, n0y, breakpoint, n2y, skew) {
  if (x < 0) return n0y;
  if (x >= 1) return n2y;
  if (x < breakpoint) return n0y;
  const p = (x - breakpoint) / (1 - breakpoint);
  return n0y + (n2y - n0y) * nodeGraphFlowerChildFilterRationalCurve(p, skew);
}

function nodeGraphFlowerChildFilterOnePoleCoefficient(cutoffHz, sampleRate) {
  const rawWc = 2 * Math.PI * cutoffHz / sampleRate;
  const wc = Math.max(1e-9, Math.min(Math.PI * 0.98, rawWc));
  const s = Math.sin(wc);
  const c = Math.cos(wc);
  const t = Math.tan(0.25 * (wc - Math.PI));
  let denom = s - c * t;
  if (denom > -1e-12 && denom < 1e-12) denom = denom >= 0 ? 1e-12 : -1e-12;
  return t / denom;
}

function nodeGraphFlowerChildFilterOnePoleStep(prevY1, input, a) {
  let y0 = input;
  y0 = y0 / (1 + y0 * y0);
  return y0 + a * (y0 - prevY1);
}

function nodeGraphFlowerChildFilterEllipse(phase, ellipseC) {
  const sinX = Math.sin(phase * 2 * Math.PI);
  const cosX = Math.cos(phase * 2 * Math.PI);
  let sqrtVal = Math.sqrt(cosX * cosX + (ellipseC * sinX) * (ellipseC * sinX));
  if (sqrtVal < 1e-12) sqrtVal = 1e-12;
  return cosX / sqrtVal;
}

function nodeGraphFlowerChildFilterSample(state, input, params, sampleRate, runtime = null, nodeId = "") {
  const rate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);
  const freqNorm = Math.max(0, Math.min(1, Number(params.frequency) || 0));
  const reso = Math.max(0, Math.min(1, Number(params.resonance) || 0));
  const chaos = Math.max(0, Math.min(1, Number(params.chaos) || 0));
  const modeNum = Math.round(Number(params.mode) || 0);

  if (modeNum === 2) {
    const masterPitch = -120 + (105 - -120) * freqNorm;
    const masterFrequency = 440 * Math.pow(2, (masterPitch - 69) / 12);
    const fmAmount = 440 * Math.pow(2, (-48.377 - 69) / 12);
    const lpf1Cutoff = 440 * Math.pow(2, ((90 + (180 - 90) * (masterPitch - -120) / (120 - -120)) - 69) / 12);
    const lpf2Cutoff = 440 * Math.pow(2, ((80 + (130 - 80) * (masterPitch - -120) / (120 - -120)) - 69) / 12);
    const lpf1A = nodeGraphFlowerChildFilterOnePoleIitCoefficient(lpf1Cutoff, rate);
    const lpf2A = nodeGraphFlowerChildFilterOnePoleIitCoefficient(lpf2Cutoff, rate);

    const phaseModGraph = [{x:0,y:0.0,skew:0,shape:0},{x:0.5,y:-0.017446,skew:0.9,shape:1},{x:0.6,y:-0.017575,skew:0.0,shape:1},{x:1.0,y:-0.0147,skew:0.6,shape:1}];
    const sineAmpGraph = [{x:0,y:4.44777,skew:0,shape:0},{x:0.5,y:8.6687,skew:0.9,shape:1},{x:0.6,y:8.6687,skew:0.0,shape:1},{x:1.0,y:2.0,skew:0.6,shape:1}];
    const sineToSquareGraph = [{x:0,y:0.6792,skew:0,shape:0},{x:0.5,y:0.9552,skew:0.9,shape:1},{x:0.6,y:0.9552,skew:0.0,shape:1},{x:1.0,y:0.001,skew:0.6,shape:1}];
    const clipLevelGraph = [{x:0.0,y:7.0,skew:0,shape:0},{x:0.7,y:7.0,skew:0.0,shape:1},{x:1.0,y:2.0,skew:0.6,shape:1}];
    const noiseGraph = [{x:0.0,y:0.0,skew:0,shape:0},{x:0.8,y:0.1,skew:0,shape:0},{x:1.0,y:1.0,skew:0.0,shape:1}];

    const pmAmount = nodeGraphFlowerChildFilterEvalGraph(phaseModGraph, reso);
    const sineAmp = nodeGraphFlowerChildFilterEvalGraph(sineAmpGraph, reso);
    const sineToSquare = nodeGraphFlowerChildFilterEvalGraph(sineToSquareGraph, reso);
    const clipLevelRaw = nodeGraphFlowerChildFilterEvalGraph(clipLevelGraph, reso);
    const clipLevel = Math.min(sineAmp, clipLevelRaw);
    const noiseReduction = nodeGraphFlowerChildFilterEvalGraph(noiseGraph, reso);
    const chaosAmount4x = chaos * 4;

    const safeInput = nodeGraphSafeFilterNumber(input, runtime, nodeId, state, "flower child rev3 input");
    const inSig = state.rev3Feedback + Math.max(-clipLevel, Math.min(clipLevel, -1 * safeInput));
    const f = masterFrequency * inSig * fmAmount;
    const noiseTerm = masterFrequency * (Math.random() * 2 - 1) * chaosAmount4x * noiseReduction;

    state.phase = state.phase + (f + noiseTerm) / rate;
    state.phase = state.phase - Math.floor(state.phase);
    const bipolarPhasor = 2 * state.phase - 1;
    const phasorOut = bipolarPhasor + pmAmount * state.rev3Feedback;

    const ellipseOut = sineAmp * nodeGraphFlowerChildFilterEllipse(phasorOut, sineToSquare);

    let feedback = nodeGraphFlowerChildFilterOnePoleIitStep(state.rev3Lpf1Y1, ellipseOut, lpf1A);
    state.rev3Lpf1Y1 = feedback;
    feedback = nodeGraphFlowerChildFilterOnePoleIitStep(state.rev3Lpf2Y1, feedback, lpf2A);
    state.rev3Lpf2Y1 = feedback;
    state.rev3Feedback = feedback;

    return nodeGraphSafeFilterNumber(feedback * 0.15, runtime, nodeId, state, "flower child rev3 output");
  }

  if (modeNum === 3) {
    const maxNormFreq3 = rate <= 44100 ? 0.928 : 1;
    const normalizedFreqInUse3 = Math.min(freqNorm, maxNormFreq3) * (161 - 3) + 3;
    const frequencyHz3 = 440 * Math.pow(2, (normalizedFreqInUse3 - 69) / 12);

    const cutoff1 = frequencyHz3 * 0.4;
    const a1 = nodeGraphFlowerChildFilterOnePoleCoefficient(cutoff1, rate);

    let breakpoint, cap;
    if (rate <= 44100) { breakpoint = 0.732441; cap = 0.649123; }
    else if (rate <= 88200) { breakpoint = 0.816054; cap = 0.818713; }
    else { breakpoint = 0.879599; cap = 0.807018; }
    const cappedTarget = Math.min(reso, cap);
    const graphValue = nodeGraphFlowerChildFilterEvalResonanceGraph(reso, reso, breakpoint, cappedTarget, -0.38);
    const selfModAmp = 0.0368 + (0.6333 - 0.0368) * nodeGraphFlowerChildFilterCurveShape(graphValue, 0.4);

    const safeInput = nodeGraphSafeFilterNumber(input, runtime, nodeId, state, "flower child downsampled input");
    let inputSignal = Math.max(-1, Math.min(1, -safeInput)) * 0.036;
    inputSignal += state.selfMod;

    const mod = 1.4 * inputSignal;
    const fm = mod;

    state.phase = state.phase + (frequencyHz3 * fm * 6.0) / rate;
    state.phase = state.phase - Math.floor(state.phase);

    const dsf = [{x:0,y:0,skew:0,shape:0},{x:1,y:0.025*rate,skew:-0.09,shape:2}];
    const samplingFreq = frequencyHz3 * 2.0 + nodeGraphFlowerChildFilterEvalGraph(dsf, 10.0 * Math.abs(mod));

    const downsampledPhase = nodeGraphFlowerChildFilterSampleAndHold(state, state.phase, samplingFreq, rate);
    const current_osc_value = Math.sin(downsampledPhase * 2 * Math.PI) * 1.3;

    const filtered = nodeGraphFlowerChildFilterOnePoleStep(state.stage1, current_osc_value, a1);
    state.stage1 = filtered;
    state.selfMod = filtered * selfModAmp;

    return nodeGraphSafeFilterNumber(filtered * 1.4, runtime, nodeId, state, "flower child downsampled output");
  }

  const dirty = modeNum !== 0;

  const maxNormFreq = rate <= 44100 ? 0.928 : 1;
  const normalizedFreqInUse = (Math.min(freqNorm, maxNormFreq)) * (161 - 3) + 3;
  const frequencyHz = 440 * Math.pow(2, (normalizedFreqInUse - 69) / 12);

  // FM/PM crossfade is provably always 0 (see the .cpp header comment) --
  // collapses to pure FM feedback: fm = mod, pm = 0.

  const cutoff1 = frequencyHz * 0.164312;
  const cutoff2 = frequencyHz * 0.366131;
  const a1 = nodeGraphFlowerChildFilterOnePoleCoefficient(cutoff1, rate);
  const a2 = nodeGraphFlowerChildFilterOnePoleCoefficient(cutoff2, rate);

  let breakpoint, cap;
  if (dirty) {
    if (rate <= 44100) { breakpoint = 0.816054; cap = 0.602339; }
    else if (rate <= 88200) { breakpoint = 0.902657; cap = 0.654971; }
    else { breakpoint = 0.977649; cap = 0.760234; }
  } else {
    if (rate <= 44100) { breakpoint = 0.732441; cap = 0.649123; }
    else if (rate <= 88200) { breakpoint = 0.816054; cap = 0.818713; }
    else { breakpoint = 0.879599; cap = 0.807018; }
  }
  const cappedTarget = Math.min(reso, cap);

  let selfModAmp = 1;
  let ellipseC = -1;
  if (!dirty) {
    const graphValue = nodeGraphFlowerChildFilterEvalResonanceGraph(reso, reso, breakpoint, cappedTarget, -0.38);
    selfModAmp = 0.0368 + (0.6333 - 0.0368) * nodeGraphFlowerChildFilterCurveShape(graphValue, 0.4);
  } else {
    const graphValue = nodeGraphFlowerChildFilterEvalResonanceGraph(freqNorm, reso, breakpoint, cappedTarget, -0.38);
    ellipseC = -1 + (0.00001 - -1) * nodeGraphFlowerChildFilterCurveShape(graphValue, -0.6);
  }

  const clampLimit = dirty ? 1.198 : 1;
  const safeInput = nodeGraphSafeFilterNumber(input, runtime, nodeId, state, "flower child input");
  let inputSignal = Math.max(-clampLimit, Math.min(clampLimit, -safeInput));

  if (chaos > 0) {
    inputSignal += (Math.random() * 2 - 1) * chaos;
  }

  inputSignal = state.selfMod + 0.035848699999999845 * inputSignal;

  const mod = 1.4 * inputSignal;
  const fm = mod;

  state.phaseOffset = 0;
  const incAmt = (frequencyHz * fm) / rate;
  state.phase = state.phase + incAmt;
  state.phase = state.phase - Math.floor(state.phase);
  let unipolarPhase = state.phase + state.phaseOffset;
  unipolarPhase = unipolarPhase - Math.floor(unipolarPhase);

  const oscValue = dirty
    ? nodeGraphFlowerChildFilterEllipse(unipolarPhase, ellipseC) * 0.1
    : Math.sin(unipolarPhase * 2 * Math.PI) * 1.3;

  let out = nodeGraphFlowerChildFilterOnePoleStep(state.stage1, oscValue, a1);
  state.stage1 = out;
  out = nodeGraphFlowerChildFilterOnePoleStep(state.stage2, out, a2);
  state.stage2 = out;

  state.selfMod = dirty ? out * 0.465 : out * selfModAmp;

  const output = dirty ? out * 5.22 : out * 1.31;
  return nodeGraphSafeFilterNumber(output, runtime, nodeId, state, "flower child output");
}

// Shared helpers for the RSMET/Yellowjacket/SuperLove/ChaoticPhaseLocking/
// Resonator/Human filter family below -- mirrors each native module's C++
// exactly (same math, JS built-ins standing in for the freestanding
// polynomial approximations, which is fine offline where Math.sin/cos/tan
// are already available).

function nodeGraphAnalogLadderTapStep(y, input, a, mode, stages) {
  const c = [0, 0, 0, 0, 0];
  if (mode === 1) {
    c[stages] = 1;
  } else if (mode === 2) {
    const hp = [[1, -1, 0, 0, 0], [1, -2, 1, 0, 0], [1, -3, 3, -1, 0], [1, -4, 6, -4, 1]];
    for (let i = 0; i <= stages; i++) c[i] = hp[stages - 1][i];
  } else if (mode === 3) {
    const bp = [[0, 2, -2, 0, 0], [0, 2, -2, 0, 0], [0, 0, 3, -3, 0], [0, 0, 4, -8, 4]];
    for (let i = 0; i < 5; i++) c[i] = bp[stages - 1][i];
  }
  let y0 = input;
  y0 = y0 / (1 + y0 * y0);
  y[1] = y0 + a * (y0 - y[1]);
  y[2] = y[1] + a * (y[1] - y[2]);
  y[3] = y[2] + a * (y[2] - y[3]);
  y[4] = y[3] + a * (y[3] - y[4]);
  y[0] = y0;
  return c[0] * y[0] + c[1] * y[1] + c[2] * y[2] + c[3] * y[3] + c[4] * y[4];
}

function nodeGraphAnalogLadderCoefficient(cutoffHz, sampleRate) {
  const wc = Math.max(1e-9, Math.min(Math.PI * 0.98, 2 * Math.PI * cutoffHz / sampleRate));
  const s = Math.sin(wc);
  const c = Math.cos(wc);
  const t = Math.tan(0.25 * (wc - Math.PI));
  let denom = s - c * t;
  if (denom > -1e-12 && denom < 1e-12) denom = denom >= 0 ? 1e-12 : -1e-12;
  return t / denom;
}

function nodeGraphAnalogRationalCurve(p, skew) {
  return ((1 + skew) * p) / (1 - skew + 2 * skew * p);
}

function nodeGraphAnalogEvalGraph(nodes, x) {
  if (nodes.length === 0) return 0;
  if (x < nodes[0].x) return nodes[0].y;
  let i = -1;
  for (let k = 0; k < nodes.length; k++) {
    if (nodes[k].x > x) { i = k; break; }
  }
  if (i < 0) return nodes[nodes.length - 1].y;
  if (i === 0) return nodes[0].y;
  const n1 = nodes[i - 1];
  const n2 = nodes[i];
  if (n2.x - n1.x < 1e-9) return 0.5 * (n1.y + n2.y);
  const p = (x - n1.x) / (n2.x - n1.x);
  if (n2.shape === 1) return n1.y + (n2.y - n1.y) * nodeGraphAnalogRationalCurve(p, n2.skew);
  if (n2.shape === 2) {
    const c = 0.5 * (n2.skew + 1);
    const a = 2 * Math.log((1 - c) / c);
    return n1.y + (n2.y - n1.y) * (1 - Math.exp(p * a)) / (1 - Math.exp(a));
  }
  return n1.y + (n2.y - n1.y) * p;
}

function nodeGraphAnalogWaveEllipseFull(phaseCycles, A, bSin, bCos, C) {
  const sinX = Math.sin(phaseCycles * 2 * Math.PI);
  const cosX = Math.cos(phaseCycles * 2 * Math.PI);
  const apc = A + cosX;
  let sqrtVal = Math.sqrt(apc * apc + (C * sinX) * (C * sinX));
  if (sqrtVal < 1e-12) sqrtVal = 1e-12;
  return (apc * bCos + (C * sinX) * bSin) / sqrtVal;
}

function nodeGraphAnalogWaveEllipse(phaseCycles, ellipseC) {
  return nodeGraphAnalogWaveEllipseFull(phaseCycles, 0, 0, 1, ellipseC);
}

function nodeGraphAnalogWaveTrisaw(phaseCycles, morph) {
  let phaseRad = phaseCycles * 2 * Math.PI;
  phaseRad = phaseRad - 2 * Math.PI * Math.floor(phaseRad / (2 * Math.PI));
  const morphRad = morph * 2 * Math.PI;
  let sourceMin, sourceMax, targetMin, targetRange;
  if (phaseRad > morphRad) {
    sourceMin = morphRad; sourceMax = 2 * Math.PI; targetMin = 1; targetRange = -1;
  } else {
    sourceMin = 0; sourceMax = morphRad; targetMin = 0; targetRange = 1;
  }
  const sourceRange = sourceMax - sourceMin;
  let uni;
  if (sourceMin === sourceMax) uni = sourceMin;
  else uni = targetMin + (targetRange * (phaseRad - sourceMin)) / sourceRange;
  return 2 * uni - 1;
}

function nodeGraphAnalogPitchToFreq(pitch) {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

function nodeGraphAnalogNextNoiseBipolar() {
  return Math.random() * 2 - 1;
}

// --- RSMET Filter ---

function createNodeGraphRsmetFilterState() {
  return { y: [0, 0, 0, 0, 0] };
}

function nodeGraphRsmetFilterModeToLadder(rsmetMode) {
  const table = [[1,1],[1,2],[1,3],[1,4],[2,1],[2,2],[2,3],[2,4],[3,1],[3,4]];
  const idx = Math.max(0, Math.min(9, Math.round(rsmetMode)));
  return table[idx];
}

function nodeGraphRsmetFilterSample(state, input, params, sampleRate, runtime = null, nodeId = "") {
  const rate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);
  const freqNorm = Math.max(0, Math.min(1, Number(params.frequency) || 0));
  const resoNorm = Math.max(0, Math.min(1, Number(params.resonance) || 0));
  const chaos = Math.max(0, Math.min(1, Number(params.chaos) || 0));

  const freqGraph = [{x:0,y:3.0,skew:0,shape:0},{x:1,y:20000,skew:-0.95,shape:2}];
  const resoGraph = [{x:0,y:0.0,skew:0,shape:0},{x:1,y:1.0,skew:0.5,shape:2}];
  const cutoffHz = Math.max(0.000001, Math.min(rate * 0.49, nodeGraphAnalogEvalGraph(freqGraph, freqNorm)));
  const feedback = Math.max(0, Math.min(0.999, nodeGraphAnalogEvalGraph(resoGraph, resoNorm)));

  const [ladderMode, stages] = nodeGraphRsmetFilterModeToLadder(Number(params.mode) || 0);

  const wc = Math.max(1e-9, Math.min(Math.PI * 0.98, 2 * Math.PI * cutoffHz / rate));
  const sine = Math.sin(wc), cosine = Math.cos(wc), tangent = Math.tan(0.25 * (wc - Math.PI));
  let a = sine - cosine * tangent;
  a = (a > -1e-12 && a < 1e-12) ? (a >= 0 ? 1e-12 : -1e-12) : a;
  a = tangent / a;

  let mixS;
  const c = [0, 0, 0, 0, 0];
  if (ladderMode === 1) { c[stages] = 1; mixS = stages * 0.25; }
  else if (ladderMode === 2) {
    const hp = [[1,-1,0,0,0],[1,-2,1,0,0],[1,-3,3,-1,0],[1,-4,6,-4,1]];
    for (let i = 0; i <= stages; i++) c[i] = hp[stages-1][i];
    mixS = stages * 0.25;
  } else {
    const bp = [[0,2,-2,0,0],[0,2,-2,0,0],[0,0,3,-3,0],[0,0,4,-8,4]];
    for (let i = 0; i < 5; i++) c[i] = bp[stages-1][i];
    mixS = 0.125;
  }

  const b = 1 + a;
  const denom = Math.max(1e-12, 1 + a * a + 2 * a * cosine);
  const g2 = (b * b) / denom;
  const k = feedback / Math.max(1e-12, g2 * g2);
  const g = 1 + mixS * k;

  const safeInput = nodeGraphSafeFilterNumber(input, runtime, nodeId, state, "rsmet input");
  let inputSignal = Math.tanh(safeInput * 2);
  if (chaos > 0) inputSignal += nodeGraphAnalogNextNoiseBipolar() * chaos;

  const y = state.y;
  y[0] = (g * inputSignal - k * y[4]);
  y[0] = y[0] / (1 + y[0] * y[0]);
  y[1] = y[0] + a * (y[0] - y[1]);
  y[2] = y[1] + a * (y[1] - y[2]);
  y[3] = y[2] + a * (y[2] - y[3]);
  y[4] = y[3] + a * (y[3] - y[4]);

  const out = c[0]*y[0] + c[1]*y[1] + c[2]*y[2] + c[3]*y[3] + c[4]*y[4];
  return nodeGraphSafeFilterNumber(out * 0.41, runtime, nodeId, state, "rsmet output");
}

// --- Yellowjacket Filter ---

function createNodeGraphYellowjacketFilterState() {
  return { phase: 0, filterY1: 0, oscSelfMod: 0, lastOutValue: 0 };
}

function nodeGraphYellowjacketFilterSample(state, input, params, sampleRate, runtime = null, nodeId = "") {
  const rate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);
  const freqNorm = Math.max(0, Math.min(1, Number(params.frequency) || 0));
  const reso = Math.max(0, Math.min(1, Number(params.resonance) || 0));
  const chaos = Math.max(0, Math.min(1, Number(params.chaos) || 0));

  let maxPitch, resDropPoint;
  if (rate <= 44100) { maxPitch = 87.7; resDropPoint = 0.77; }
  else if (rate <= 88200) { maxPitch = 96.0; resDropPoint = 0.82; }
  else if (rate <= 132300) { maxPitch = 96.0; resDropPoint = 0.83; }
  else if (rate <= 176400) { maxPitch = 96.0; resDropPoint = 0.86; }
  else if (rate <= 220500) { maxPitch = 96.0; resDropPoint = 0.89; }
  else if (rate <= 264600) { maxPitch = 96.0; resDropPoint = 0.90; }
  else { maxPitch = 96.0; resDropPoint = 0.95; }

  const pitch = -156 + (96 - -156) * freqNorm;
  const frequencyHz = nodeGraphAnalogPitchToFreq(Math.min(pitch, maxPitch));
  const cutoffHz = frequencyHz * (4.56415 + (0.972007 - 4.56415) * chaos);

  const resGraph = [{x:0,y:reso,skew:0,shape:0},{x:resDropPoint,y:reso,skew:0,shape:0},{x:1,y:0.2,skew:0.57,shape:1}];
  const newResNormalized = nodeGraphAnalogEvalGraph(resGraph, freqNorm);
  const ellipseCGraph = [{x:0,y:7.6024,skew:0,shape:0},{x:1,y:0.00001,skew:0.99,shape:2}];
  const feedbackGainGraph = [{x:0,y:20.0,skew:0,shape:0},{x:1,y:-0.0429102,skew:0.99,shape:2}];
  const ellipseC = nodeGraphAnalogEvalGraph(ellipseCGraph, newResNormalized);
  const feedbackGain = nodeGraphAnalogEvalGraph(feedbackGainGraph, newResNormalized);

  const a = nodeGraphAnalogLadderCoefficient(cutoffHz, rate);

  const safeInput = nodeGraphSafeFilterNumber(input, runtime, nodeId, state, "yellowjacket input");
  let inputSignal = Math.max(-7, Math.min(7, safeInput * 4));
  inputSignal = state.oscSelfMod + 1.04025 * inputSignal + state.lastOutValue;

  state.phase += (frequencyHz * 1.9400625 * inputSignal) / rate;
  state.phase -= Math.floor(state.phase);

  let oscValue = nodeGraphAnalogWaveEllipseFull(state.phase, 0.0, -0.71286768918541499, 0.70129855105756955, ellipseC);
  oscValue *= 0.635417;

  let y0 = oscValue;
  y0 = y0 / (1 + y0 * y0);
  state.filterY1 = y0 + a * (y0 - state.filterY1);
  inputSignal = state.filterY1;

  state.oscSelfMod = inputSignal * 20.0;

  const out = 1.3892758936011171 * oscValue;
  state.lastOutValue = out * 0.5 * feedbackGain;

  return nodeGraphSafeFilterNumber(out, runtime, nodeId, state, "yellowjacket output");
}

// --- SuperLove Filter ---

function createNodeGraphSuperloveFilterState() {
  return { feedbackSignal: 0, filterY: [0,0,0,0,0], dcY: [0,0,0,0,0] };
}

function nodeGraphSuperloveFilterSample(state, input, params, sampleRate, runtime = null, nodeId = "") {
  const rate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);
  const freqNorm = Math.max(0, Math.min(1, Number(params.frequency) || 0));
  const reso = Math.max(0, Math.min(1, Number(params.resonance) || 0));
  const chaos = Math.max(0, Math.min(1, Number(params.chaos) || 0));
  const mode = Math.max(0, Math.min(3, Math.round(Number(params.mode) || 0)));

  const safeInput = nodeGraphSafeFilterNumber(input, runtime, nodeId, state, "superlove input");

  if (mode <= 1) {
    const resGraph = [{x:0,y:0,skew:0,shape:0},{x:1,y:-2.7175,skew:-0.85,shape:2}];
    const noiseGraph = [{x:0,y:0.00,skew:0,shape:0},{x:0.75,y:0.05,skew:-0.7,shape:2},{x:1,y:0.10,skew:0.6,shape:2}];
    const cutoffHz = Math.max(0, Math.min(0.5 * rate, nodeGraphAnalogPitchToFreq(-12 + (135 - -12) * freqNorm)));
    const mod = nodeGraphAnalogEvalGraph(resGraph, reso);
    const noiseAmp = nodeGraphAnalogEvalGraph(noiseGraph, chaos);
    const shape = chaos;

    state.feedbackSignal = mod * state.feedbackSignal + safeInput;
    const pm = nodeGraphAnalogNextNoiseBipolar() * noiseAmp;
    const oscValue = -nodeGraphAnalogWaveTrisaw(state.feedbackSignal + 0.25725 + pm, shape);

    const a = nodeGraphAnalogLadderCoefficient(cutoffHz, rate);
    const stages = mode === 0 ? 3 : 4;
    state.feedbackSignal = nodeGraphAnalogLadderTapStep(state.filterY, oscValue, a, 1, stages);

    const dcCutoff = mode === 0 ? 10.0 : 5.0;
    const dcStages = mode === 0 ? 3 : 1;
    const dcA = nodeGraphAnalogLadderCoefficient(dcCutoff, rate);
    const dcOut = nodeGraphAnalogLadderTapStep(state.dcY, state.feedbackSignal, dcA, 2, dcStages);

    return nodeGraphSafeFilterNumber(dcOut * 1.02, runtime, nodeId, state, "superlove lp output");
  } else if (mode === 2) {
    const resGraph = [{x:0,y:-0.2,skew:0,shape:0},{x:1,y:1.3,skew:-0.85,shape:2}];
    const mod = nodeGraphAnalogEvalGraph(resGraph, reso);
    const shape = 1 - chaos;

    state.feedbackSignal = mod * state.feedbackSignal + safeInput;
    const oscValue = -nodeGraphAnalogWaveTrisaw(state.feedbackSignal + 0.75, shape);

    const lpA = nodeGraphAnalogLadderCoefficient(rate * 0.5, rate);
    let fb = nodeGraphAnalogLadderTapStep(state.filterY, oscValue * 0.1, lpA, 1, 1);

    const cutoffHz = Math.max(0, Math.min(0.5 * rate, nodeGraphAnalogPitchToFreq(-12 + (135 - -12) * freqNorm)));
    const hpA = nodeGraphAnalogLadderCoefficient(cutoffHz, rate);
    fb = nodeGraphAnalogLadderTapStep(state.dcY, fb, hpA, 2, 1);
    fb *= 10;

    state.feedbackSignal = fb;
    return nodeGraphSafeFilterNumber(-fb * 0.31, runtime, nodeId, state, "superlove hp output");
  } else {
    const resGraph = [{x:0,y:-0.2,skew:0,shape:0},{x:1,y:1.3,skew:-0.85,shape:2}];
    const mod = nodeGraphAnalogEvalGraph(resGraph, reso);
    const shape = 1 - chaos;

    state.feedbackSignal = mod * state.feedbackSignal + safeInput;
    const oscValue = -nodeGraphAnalogWaveTrisaw(state.feedbackSignal + 0.75, shape);

    const cutoffHz = Math.max(0, Math.min(0.5 * rate, nodeGraphAnalogPitchToFreq(-12 + (135 - -12) * freqNorm)));
    const a = nodeGraphAnalogLadderCoefficient(cutoffHz, rate);
    let fb = nodeGraphAnalogLadderTapStep(state.filterY, oscValue * 0.1, a, 3, 1);
    fb *= 10;

    state.feedbackSignal = fb;
    return nodeGraphSafeFilterNumber(fb, runtime, nodeId, state, "superlove bp output");
  }
}

// --- Chaotic Phase Locking Filter ---

function createNodeGraphChaoticPhaseLockingFilterState() {
  return { feedbackSignal: 0, filterY: [0,0,0,0,0], dcY: [0,0,0,0,0] };
}

function nodeGraphChaoticPhaseLockingFilterSample(state, input, params, sampleRate, runtime = null, nodeId = "") {
  const rate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);
  const freqNorm = Math.max(0, Math.min(1, Number(params.frequency) || 0));
  const reso = Math.max(0, Math.min(1, Number(params.resonance) || 0));
  const chaos = Math.max(0, Math.min(1, Number(params.chaos) || 0));

  const cutoffHz = Math.max(0, Math.min(0.5 * rate, nodeGraphAnalogPitchToFreq(-12 + (135 - -12) * freqNorm)));
  const resGraph = [{x:0,y:0.1,skew:0,shape:0},{x:1,y:20.0,skew:-0.85,shape:2}];
  const mod = nodeGraphAnalogEvalGraph(resGraph, reso);
  const shape = 1 - chaos;

  const safeInput = nodeGraphSafeFilterNumber(input, runtime, nodeId, state, "chaotic phase locking input");
  state.feedbackSignal = mod * state.feedbackSignal + (-safeInput);
  const oscValue = nodeGraphAnalogWaveEllipse(state.feedbackSignal, shape);

  const a = nodeGraphAnalogLadderCoefficient(cutoffHz, rate);
  state.feedbackSignal = nodeGraphAnalogLadderTapStep(state.filterY, oscValue, a, 1, 2);

  const dcA = nodeGraphAnalogLadderCoefficient(5.0, rate);
  const dcOut = nodeGraphAnalogLadderTapStep(state.dcY, state.feedbackSignal, dcA, 2, 1);

  return nodeGraphSafeFilterNumber(-dcOut, runtime, nodeId, state, "chaotic phase locking output");
}

// --- Resonator Filter ---

function createNodeGraphResonatorFilterState() {
  return {
    phase1: 0, phase2: 0, filterY: [0,0,0,0,0], dcY: [0,0,0,0,0],
    osc1Value: 0, osc2Value: 0, osc1SelfMod: 0, osc2SelfMod: 0, sawFeedback: 0,
  };
}

function nodeGraphResonatorFilterSample(state, input, params, sampleRate, runtime = null, nodeId = "") {
  const rate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);
  const freqNorm = Math.max(0, Math.min(1, Number(params.frequency) || 0));
  const reso = Math.max(0, Math.min(1, Number(params.resonance) || 0));
  const chaos = Math.max(0, Math.min(1, Number(params.chaos) || 0));
  const mode = Math.max(0, Math.min(2, Math.round(Number(params.mode) || 0)));
  const safeInput = nodeGraphSafeFilterNumber(input, runtime, nodeId, state, "resonator input");

  if (mode === 0 || mode === 1) {
    const triangle = mode === 1;
    const inputAmplitude = triangle ? 3.0 : 2.0;

    let maxFreqNorm, resDropPoint;
    if (rate <= 44100) { maxFreqNorm = 0.855; resDropPoint = 0.74; }
    else if (rate <= 88200) { maxFreqNorm = 0.9; resDropPoint = 0.75; }
    else if (rate <= 132300) { maxFreqNorm = 0.9; resDropPoint = 0.82; }
    else if (rate <= 176400) { maxFreqNorm = 0.9; resDropPoint = 0.88; }
    else if (rate <= 220500) { maxFreqNorm = 0.9; resDropPoint = 0.92; }
    else { maxFreqNorm = 0.955; resDropPoint = 0.92; }

    const freqNormInUse = Math.min(freqNorm, maxFreqNorm);
    const frequencyHz = nodeGraphAnalogPitchToFreq(-72.96 + (69.76 - -72.96) * freqNormInUse);
    const cutoffHz = frequencyHz * (0.248387 + (0.0927813 - 0.248387) * nodeGraphFlowerChildFilterCurveShape(freqNormInUse, -0.36));
    const osc2Ratio = 0.015625 + (1.58 - 0.015625) * freqNormInUse;
    const osc1Ratio = osc2Ratio - 0.015625;

    const resGraph = [{x:0,y:reso,skew:0,shape:0},{x:resDropPoint,y:reso,skew:0,shape:0},{x:1,y:0.15,skew:0.557,shape:1}];
    const newResNorm = nodeGraphAnalogEvalGraph(resGraph, freqNorm);
    const freqModAmt = 10.0 + (484.43 - 10.0) * newResNorm;
    const phaseModAmt = 0.256 + (0.166 - 0.256) * chaos;

    let inputSignal = inputAmplitude * safeInput;
    inputSignal = state.osc2Value + state.osc1SelfMod + inputSignal;

    const freq1 = frequencyHz * osc1Ratio * freqModAmt * 0.1 * inputSignal;
    const clampedFreq1 = Math.max(-rate * 0.5, Math.min(rate * 0.5, freq1));
    state.phase1 += clampedFreq1 / rate;
    state.phase1 -= Math.floor(state.phase1);
    const phaseOffset1 = inputSignal * phaseModAmt;
    let unipolar1 = state.phase1 + phaseOffset1;
    unipolar1 -= Math.floor(unipolar1);
    state.osc1Value = nodeGraphAnalogWaveEllipse(unipolar1, 0.00749) * 0.5;

    const a = nodeGraphAnalogLadderCoefficient(cutoffHz, rate);
    inputSignal = nodeGraphAnalogLadderTapStep(state.filterY, state.osc1Value, a, 1, 1);

    state.osc1SelfMod = inputSignal;
    state.osc2SelfMod = state.osc2Value;

    const fm2 = freqModAmt * 4.53126 * inputSignal + state.osc2SelfMod * 3.0;
    const freq2 = frequencyHz * osc2Ratio * fm2;
    const clampedFreq2 = Math.max(-rate * 0.5, Math.min(rate * 0.5, freq2));
    state.phase2 += clampedFreq2 / rate;
    state.phase2 -= Math.floor(state.phase2);

    let out;
    if (!triangle) {
      out = Math.sin(state.phase2 * 2 * Math.PI);
      state.osc2Value = out * 10.0;
    } else {
      const ellipseCGraph = [{x:0,y:0.3,skew:0,shape:0},{x:1,y:1.0,skew:-0.99,shape:2}];
      const ellipseC = nodeGraphAnalogEvalGraph(ellipseCGraph, freqNormInUse);
      out = nodeGraphAnalogWaveEllipse(state.phase2, ellipseC);
      state.osc2Value = out * 10.0;
    }

    const dcA = nodeGraphAnalogLadderCoefficient(5.0, rate);
    const dcOut = nodeGraphAnalogLadderTapStep(state.dcY, -out, dcA, 2, 1);
    return nodeGraphSafeFilterNumber(dcOut * (triangle ? 10.0 : 4.6), runtime, nodeId, state, "resonator sinusoid/triangle output");
  } else {
    const inputAmplitude = 2.0;
    const frequencyHz = nodeGraphAnalogPitchToFreq(-50 + (108 - -50) * freqNorm);
    const cutoffHz = frequencyHz * 8.87718;

    const mod21Graph = [{x:0,y:-0.00105655,skew:0,shape:0},{x:1,y:-2.52898,skew:-0.99,shape:2}];
    const fmpm12Graph = [{x:0,y:0.0,skew:0,shape:0},{x:1,y:0.012216,skew:0.54,shape:2}];

    let breakpoint2, cap3;
    if (rate <= 44100) { breakpoint2 = 0.578595; cap3 = 0.432749; }
    else if (rate <= 88200) { breakpoint2 = 0.692308; cap3 = 0.502924; }
    else if (rate <= 132300) { breakpoint2 = 0.749164; cap3 = 0.561404; }
    else { breakpoint2 = 0.776273; cap3 = 0.54386; }
    const cappedTarget = Math.min(reso, cap3);
    const resGraph = [{x:0,y:0,skew:0,shape:0},{x:0.0434783,y:reso,skew:0,shape:0},{x:breakpoint2,y:reso,skew:0,shape:0},{x:1,y:cappedTarget,skew:0.195211,shape:1}];
    const resSample = nodeGraphAnalogEvalGraph(resGraph, freqNorm);
    let mod21 = nodeGraphAnalogEvalGraph(mod21Graph, resSample);
    if (mod21 < -1.53) mod21 = -1.53;
    const fmpm12 = nodeGraphAnalogEvalGraph(fmpm12Graph, chaos);

    let inputSignal = (-safeInput) * inputAmplitude + state.sawFeedback * -8.07896613446314289533 + state.osc2Value + state.osc1SelfMod * 20.0;

    const freq1 = frequencyHz * mod21 * inputSignal;
    state.phase1 += freq1 / rate;
    state.phase1 -= Math.floor(state.phase1);
    state.osc1Value = Math.sin(state.phase1 * 2 * Math.PI);
    // rsScaledAndShiftedSigmoid, center=0, width=0.00873698
    const scaleX = 2 / 0.00873698;
    state.osc1Value = (0.00873698 / 2) * Math.tanh(scaleX * state.osc1Value);

    const a = nodeGraphAnalogLadderCoefficient(cutoffHz, rate);
    inputSignal = nodeGraphAnalogLadderTapStep(state.filterY, state.osc1Value, a, 1, 1);

    state.osc1SelfMod = inputSignal;
    state.osc2SelfMod = state.osc2Value;

    const modv = inputSignal * -140.010789331 + state.osc2SelfMod * -1.05208;
    const fm = Math.cos((Math.PI / 2) * fmpm12) * modv;
    const pm = Math.sin((Math.PI / 2) * fmpm12) * modv;
    state.phase2 += (frequencyHz * (-0.425 + fm)) / rate;
    state.phase2 -= Math.floor(state.phase2);
    let unipolar2 = state.phase2 + pm;
    unipolar2 -= Math.floor(unipolar2);
    state.osc2Value = Math.sin(unipolar2 * 2 * Math.PI);

    state.sawFeedback = inputSignal + state.osc2Value;

    const dcA = nodeGraphAnalogLadderCoefficient(5.0, rate);
    const dcOut = nodeGraphAnalogLadderTapStep(state.dcY, -state.osc2Value * 0.1, dcA, 2, 1);
    return nodeGraphSafeFilterNumber(dcOut * 80.0, runtime, nodeId, state, "resonator sawtooth output");
  }
}

// --- Human Filter ---

function createNodeGraphHumanFilterState() {
  return {
    phase1: 0, phase2: 0, osc1Value: 0, osc2Value: 0, lastOutValue: 0,
    osc1ModSelf: 0, osc2ModSelf: 0, fbZ1: 0, fbZ2: 0, dcY: [0,0,0,0,0],
  };
}

function nodeGraphHumanFilterDbToAmp(db) {
  return Math.pow(10, db / 20);
}

function nodeGraphHumanFilterSample(state, input, params, sampleRate, runtime = null, nodeId = "") {
  const rate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);
  const freqNorm = Math.max(0, Math.min(1, Number(params.frequency) || 0));
  const reso = Math.max(0, Math.min(1, Number(params.resonance) || 0));
  const chaos = Math.max(0, Math.min(1, Number(params.chaos) || 0));
  const mode = Math.max(0, Math.min(2, Math.round(Number(params.mode) || 0)));

  let maxPitch, resDropPoint, chaosMax;
  if (rate <= 44100) { maxPitch = 115.57; resDropPoint = 0.78; chaosMax = 0.64; }
  else if (rate <= 88200) { maxPitch = 128.7; resDropPoint = 0.78; chaosMax = 1.0; }
  else if (rate <= 132300) { maxPitch = 137.0; resDropPoint = 0.83; chaosMax = 0.856; }
  else if (rate <= 176400) { maxPitch = 137.0; resDropPoint = 0.91; chaosMax = 1.0; }
  else if (rate <= 220500) { maxPitch = 137.0; resDropPoint = 1.0; chaosMax = 1.0; }
  else { maxPitch = 137.0; resDropPoint = 0.78; chaosMax = 1.0; }

  const pitch = -0.38 + (137.0 - -0.38) * freqNorm;
  const frequencyHz = nodeGraphAnalogPitchToFreq(Math.min(pitch, maxPitch));

  const mod11Graph = [{x:0.0,y:2.92396,skew:0,shape:0},{x:1.0,y:-1.7544,skew:0.785442,shape:1}];
  let mod11;
  if (resDropPoint !== 1.0) {
    const resVfreqGraph = [{x:0.0,y:reso,skew:0,shape:0},{x:resDropPoint,y:reso,skew:0,shape:0},{x:1.0,y:0.2,skew:0.57,shape:1}];
    const newResNormalized = nodeGraphAnalogEvalGraph(resVfreqGraph, freqNorm);
    mod11 = nodeGraphAnalogEvalGraph(mod11Graph, newResNormalized);
  } else {
    mod11 = nodeGraphAnalogEvalGraph(mod11Graph, reso);
  }

  const gainDb = Math.min(chaos, chaosMax) * 14.9;

  // rsStateVariableFilter BELL mode -- documented Q=1/1kHz approximation,
  // see human_filter.cpp's header comment.
  const centerHz = 1000.0;
  const Q = 1.0;
  const A = nodeGraphHumanFilterDbToAmp(gainDb);
  const w = Math.max(1e-9, Math.min(Math.PI * 0.98, 2 * Math.PI * centerHz / rate));
  const r = 1 / (Q * A);
  const g = Math.tan(0.5 * w);
  const c = g + r;
  const sCoef = 1 / (1 + g * c);
  const aB = A * A * r;

  const safeInput = nodeGraphSafeFilterNumber(input, runtime, nodeId, state, "human input");
  const clampedInput = Math.max(-2, Math.min(2, safeInput));
  const svfIn = state.osc2Value + state.osc1ModSelf + clampedInput + state.lastOutValue;
  const yH = (svfIn - c * state.fbZ1 - state.fbZ2) * sCoef;
  const yB = state.fbZ1 + g * yH;
  const yL = state.fbZ2 + g * yB;
  state.fbZ1 = 2 * yB - state.fbZ1;
  state.fbZ2 = 2 * yL - state.fbZ2;
  const inputSignal = yH + aB * yB + yL;

  const fm1 = -2.2784975504539248 * inputSignal;
  state.phase1 += (frequencyHz * fm1) / rate;
  state.phase1 -= Math.floor(state.phase1);
  state.osc1Value = Math.sin(state.phase1 * 2 * Math.PI) * 0.177898;

  state.osc1ModSelf = state.osc1Value * mod11;
  state.osc2ModSelf = state.osc2Value * -0.395833;

  const fm2 = 0.0333333 + 2.7429968062 * state.osc1Value + state.osc2ModSelf;
  state.phase2 += (frequencyHz * fm2) / rate;
  state.phase2 -= Math.floor(state.phase2);
  state.osc2Value = Math.sin(state.phase2 * 2 * Math.PI) * 0.71597;

  state.lastOutValue = (state.osc1Value + state.osc2Value) * 0.1443178;

  const dcA = nodeGraphAnalogLadderCoefficient(5.0, rate);
  let out;
  if (mode === 0) out = nodeGraphAnalogLadderTapStep(state.dcY, state.osc1Value, dcA, 2, 1) * 2.0;
  else if (mode === 1) out = nodeGraphAnalogLadderTapStep(state.dcY, state.osc1Value + state.osc2Value, dcA, 2, 1);
  else out = nodeGraphAnalogLadderTapStep(state.dcY, state.osc2Value, dcA, 2, 1);

  return nodeGraphSafeFilterNumber(out, runtime, nodeId, state, "human output");
}

// --- Pulse Explosion ---
// See native_modules/pulse_explosion/pulse_explosion.cpp's header comment
// for the full derivation of the density shape and rejection sampling.

const kNodeGraphPulseExplosionMaxPulses = 128;
const kNodeGraphPulseExplosionMaxRejectionAttempts = 200;

function createNodeGraphPulseExplosionState() {
  return {
    wasHigh: false,
    exploding: false,
    elapsed: 0,
    pulses: [],
    nextPulseIndex: 0,
    safeEnd: 1,
  };
}

function nodeGraphPulseExplosionRationalCurve(p, skew) {
  let denom = 1 - skew + 2 * skew * p;
  if (denom > -1e-12 && denom < 1e-12) denom = denom >= 0 ? 1e-12 : -1e-12;
  return ((1 + skew) * p) / denom;
}

function nodeGraphPulseExplosionRaisedCosineEase(x, x1, x2) {
  const span = x2 - x1;
  if (span > -1e-12 && span < 1e-12) return 0.5;
  let p = (x - x1) / span;
  p = Math.max(0, Math.min(1, p));
  return 1 - (0.5 + 0.5 * Math.sin((p - 0.5) * Math.PI));
}

function nodeGraphPulseExplosionDensity(t, startTime, centerTime, endTime, skew) {
  if (t <= startTime || t >= endTime) return 0;
  const ease = t < centerTime
    ? nodeGraphPulseExplosionRaisedCosineEase(t, centerTime, startTime)
    : nodeGraphPulseExplosionRaisedCosineEase(t, centerTime, endTime);
  return Math.max(0, Math.min(1, nodeGraphPulseExplosionRationalCurve(ease, skew)));
}

// Deterministic 32-bit mulberry32 PRNG, mirrors the xorshift32 used in the
// native module closely enough for display purposes: same seed always
// produces the same [0,1) sequence.
function nodeGraphPulseExplosionMulberry32(seed) {
  let a = seed >>> 0;
  return function pulseExplosionNext() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Folds an arbitrary numeric seed into a 32-bit mix (murmur3-style
// finalizer over the seed's raw f64 bits), matching the native module's
// seedHash so the same seed value looks "the same" conceptually across
// both implementations (the two RNGs still differ, only the seed-vs-seed
// determinism guarantee is what's shared).
function nodeGraphPulseExplosionSeedHash(seed) {
  const buffer = new ArrayBuffer(8);
  new Float64Array(buffer)[0] = Number(seed) || 0;
  const words = new Uint32Array(buffer);
  let x = (words[0] ^ words[1]) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) || 0x9e3779b9;
}

function nodeGraphPulseExplosionRandomFn(seed) {
  const seedNumber = Number(seed) || 0;
  if (seedNumber === 0) {
    return Math.random;
  }
  return nodeGraphPulseExplosionMulberry32(nodeGraphPulseExplosionSeedHash(seedNumber));
}

// Pure schedule computation shared by playback (nodeGraphPulseExplosionSample
// below) and the node's curve/pulse-position display, so the display always
// shows exactly what a trigger with the same seed will actually play.
function nodeGraphPulseExplosionComputeSchedule(params, random = Math.random) {
  const safeStart = Math.max(0, Number(params.startTime) || 0);
  let safeEnd = Number(params.endTime) || 0;
  if (safeEnd <= safeStart) safeEnd = safeStart + 0.001;
  let safeCenter = Math.max(safeStart, Math.min(safeEnd, Number(params.centerTime) || 0));
  if (safeCenter <= safeStart) safeCenter = safeStart + 1e-6;
  if (safeCenter >= safeEnd) safeCenter = safeEnd - 1e-6;
  // 0..1 spread -> -0.99..0.99 skew (0 concentrates tightly at centerTime,
  // 1 spreads widely -- measured empirically, see the .cpp header comment).
  const skew = -0.99 + 1.98 * Math.max(0, Math.min(1, Number(params.timeSpread) || 0));
  const safeCount = Math.max(1, Math.min(kNodeGraphPulseExplosionMaxPulses, Math.round(Number(params.numberOfPulses) || 1)));
  const lo = Math.min(Number(params.lowAmplitude) || 0, Number(params.highAmplitude) || 0);
  const hi = Math.max(Number(params.lowAmplitude) || 0, Number(params.highAmplitude) || 0);

  const pulses = [];
  for (let i = 0; i < safeCount; i++) {
    let chosenTime = safeCenter;
    for (let attempt = 0; attempt < kNodeGraphPulseExplosionMaxRejectionAttempts; attempt++) {
      const candidate = safeStart + (safeEnd - safeStart) * random();
      const roll = random();
      const density = nodeGraphPulseExplosionDensity(candidate, safeStart, safeCenter, safeEnd, skew);
      if (roll < density) {
        chosenTime = candidate;
        break;
      }
    }
    pulses.push({ time: chosenTime, amplitude: lo + (hi - lo) * random() });
  }
  pulses.sort((a, b) => a.time - b.time);
  return { pulses, safeStart, safeCenter, safeEnd, skew };
}

function nodeGraphPulseExplosionSample(state, trigger, params, sampleRate, runtime = null, nodeId = "") {
  const rate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);

  const high = (Number(trigger) || 0) > 0.5;
  if (high && !state.wasHigh) {
    state.nextPulseIndex = 0;
    state.elapsed = 0;
    state.exploding = true;
    const schedule = nodeGraphPulseExplosionComputeSchedule(params, nodeGraphPulseExplosionRandomFn(params.seed));
    state.pulses = schedule.pulses;
    state.safeStart = schedule.safeStart;
    state.safeCenter = schedule.safeCenter;
    state.safeEnd = schedule.safeEnd;
    state.skew = schedule.skew;
  }
  state.wasHigh = high;
  const safeStart = Number.isFinite(state.safeStart) ? state.safeStart : 0;
  const safeCenter = Number.isFinite(state.safeCenter) ? state.safeCenter : 0.5;
  const safeEnd = Number.isFinite(state.safeEnd) ? state.safeEnd : Number(params.endTime) || 1;
  const skew = Number.isFinite(state.skew) ? state.skew : 0;

  let output = 0;
  if (state.exploding) {
    if (state.nextPulseIndex < state.pulses.length && state.elapsed >= state.pulses[state.nextPulseIndex].time) {
      output = state.pulses[state.nextPulseIndex].amplitude;
      state.nextPulseIndex++;
    }
    state.elapsed += 1 / rate;
    if (state.nextPulseIndex >= state.pulses.length && state.elapsed > safeEnd) {
      state.exploding = false;
    }
  }

  // Curve output: the density shape shown on the node's display, sampled at
  // the current position in the burst -- lets it be patched elsewhere.
  const curve = nodeGraphPulseExplosionDensity(state.elapsed, safeStart, safeCenter, safeEnd, skew);

  return {
    Out: nodeGraphSafeFilterNumber(output, runtime, nodeId, state, "pulse explosion output"),
    Curve: nodeGraphSafeFilterNumber(curve, runtime, nodeId, state, "pulse explosion curve"),
  };
}

function createNodeGraphTb303FilterState() {
  return { y: [0, 0, 0, 0], hpX: 0, hpY: 0 };
}

function nodeGraphTb303FilterSample(state, input, params, sampleRate, runtime = null, nodeId = "") {
  const rate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);
  const safeCutoff = Math.max(200, Math.min(20000, Math.min(rate * 0.49, Number(params.cutoff) || 1000)));
  const resonanceRaw = Math.max(0, Math.min(1, (Number(params.resonance) || 0) * 0.01));
  const drive = Number(params.drive) || 0;
  const driveFactor = Math.pow(10, Math.max(-24, Math.min(24, drive)) / 20);
  const safeMode = Math.max(0, Math.min(14, Math.round(Number(params.mode) || 4)));

  // resonance skewing
  const r = (1 - Math.exp(-3 * resonanceRaw)) / (1 - Math.exp(-3));

  // coefficients
  const wc = Math.max(1e-9, Math.min(Math.PI * 0.98, 2 * Math.PI * safeCutoff / rate));
  const sinWc = Math.sin(wc), cosWc = Math.cos(wc);
  const tanWc = Math.tan(0.25 * (wc - Math.PI));
  const denomA = sinWc - cosWc * tanWc;
  const a1FullRes = Math.abs(denomA) < 1e-15 ? -1 : tanWc / denomA;
  const a1NoRes = -Math.exp(-wc);
  const a1 = r * a1FullRes + (1 - r) * a1NoRes;
  const b0 = 1 + a1;
  const gsqD = Math.max(1e-12, 1 + a1 * a1 + 2 * a1 * cosWc);
  const gsq = b0 * b0 / gsqD;
  const k = r / Math.max(1e-24, gsq * gsq);

  // feedback highpass (1-pole, 150 Hz)
  if (!state.hpP || state.lastRate !== rate) {
    state.hpP = Math.exp(-2 * Math.PI * 150 / rate);
    state.hpB0 = (1 + state.hpP) * 0.5;
    state.lastRate = rate;
  }
  const fbIn = k * (state.y[3] || 0);
  const fbHp = state.hpB0 * (fbIn - state.hpX) + state.hpP * state.hpY;
  state.hpX = fbIn;
  state.hpY = nodeGraphSafeFilterNumber(fbHp, runtime, nodeId, state, "tb303 hp");

  const safeIn = nodeGraphSafeFilterNumber(input, runtime, nodeId, state, "tb303 in");
  const y = state.y;
  const y0 = nodeGraphSafeFilterNumber(0.125 * driveFactor * safeIn - fbHp, runtime, nodeId, state, "tb303 y0");
  y[0] = nodeGraphSafeFilterNumber(y0 + a1 * (y0 - y[0]), runtime, nodeId, state, "tb303 y1");
  y[1] = nodeGraphSafeFilterNumber(y[0] + a1 * (y[0] - y[1]), runtime, nodeId, state, "tb303 y2");
  y[2] = nodeGraphSafeFilterNumber(y[1] + a1 * (y[1] - y[2]), runtime, nodeId, state, "tb303 y3");
  y[3] = nodeGraphSafeFilterNumber(y[2] + a1 * (y[2] - y[3]), runtime, nodeId, state, "tb303 y4");

  // mode mix coefficients
  const modes = [
    [1,0,0,0,0],[0,1,0,0,0],[0,0,1,0,0],[0,0,0,1,0],[0,0,0,0,1],
    [1,-1,0,0,0],[1,-2,1,0,0],[1,-3,3,-1,0],[1,-4,6,-4,1],
    [0,0,1,-2,1],[0,0,0,1,-1],[0,1,-3,3,-1],[0,0,1,-1,0],[0,1,-2,1,0],[0,1,-1,0,0],
  ];
  const c = modes[safeMode] || modes[4];
  const out = 8 * (c[0]*y0 + c[1]*y[0] + c[2]*y[1] + c[3]*y[2] + c[4]*y[3]);
  return nodeGraphSafeFilterNumber(out, runtime, nodeId, state, "tb303 out");
}

function nodeGraphSlewLimiterSample(state, input, upTime, downTime, sampleRate, runtime = null, nodeId = "") {
  const rate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);
  const target = nodeGraphSafeFilterNumber(input, runtime, nodeId, state, "slew input");
  if (!state.initialized) {
    state.initialized = true;
    state.out = target;
    return target;
  }
  const upSeconds = Math.max(0, nodeGraphSafeFilterNumber(upTime, runtime, nodeId, state, "slew up time"));
  const downSeconds = Math.max(0, nodeGraphSafeFilterNumber(downTime, runtime, nodeId, state, "slew down time"));
  const delta = target - state.out;
  const maxRise = upSeconds <= 0 ? Infinity : 1 / Math.max(1, upSeconds * rate);
  const maxFall = downSeconds <= 0 ? Infinity : 1 / Math.max(1, downSeconds * rate);
  state.out = nodeGraphSafeFilterNumber(
    state.out + Math.max(-maxFall, Math.min(maxRise, delta)),
    runtime,
    nodeId,
    state,
    "slew output",
  );
  return state.out;
}

function nodeGraphClockAnalogWhipSample(phase, level) {
  const p = clampNodeSliderValue(Number(phase) || 0, 0, 1);
  const attack = 1 - Math.pow(1 - Math.min(1, p / 0.035), 4);
  const release = Math.pow(Math.max(0, 1 - p), 1.85);
  const snapEnvelope = attack * release;
  const sweepTurns = (3.15 * (1 - Math.exp(-4.2 * p)) / (1 - Math.exp(-4.2))) + (0.18 * Math.sin(Math.PI * p));
  const liquidBend = 0.075 * Math.sin(Math.PI * 2 * p) * Math.pow(Math.max(0, 1 - p), 1.2);
  const body = Math.sin((sweepTurns + liquidBend) * Math.PI * 2);
  const sheen = Math.sin((sweepTurns * 2.02 + 0.17) * Math.PI * 2) * 0.16 * Math.pow(Math.max(0, 1 - p), 2.8);
  return (body + sheen) * snapEnvelope * level;
}

function nodeGraphClockSample(state, reset, phaseOffset, rate, duty, level, sampleRate, runtime = null, nodeId = "") {
  const safeReset = nodeGraphSafeFilterNumber(reset, runtime, nodeId, null, "clock reset");
  const safePhaseOffset = wrapNodeSliderValue(
    nodeGraphSafeFilterNumber(phaseOffset, runtime, nodeId, null, "clock phase"),
    0,
    1,
  );
  const safeRate = Math.max(0, nodeGraphSafeFilterNumber(rate, runtime, nodeId, null, "clock rate"));
  const safeDuty = clampNodeSliderValue(
    nodeGraphSafeFilterNumber(duty, runtime, nodeId, null, "clock duty"),
    0,
    1,
  );
  const safeLevel = nodeGraphSafeFilterNumber(level, runtime, nodeId, null, "clock level");
  const resetActive = safeReset > 0;
  const rawPhase = resetActive ? 0 : wrapNodeSliderValue(Number(state.phase) || 0, 0, 1);
  const phase = wrapNodeSliderValue(rawPhase + safePhaseOffset, 0, 1);
  const digital = phase < safeDuty ? safeLevel : 0;
  const analog = nodeGraphClockAnalogWhipSample(phase, safeLevel);
  const nextRawPhase = wrapNodeSliderValue(rawPhase + safeRate / Math.max(1, sampleRate), 0, 1);
  const pulse = safeRate > 0 && !resetActive && (!state.hasStarted || nextRawPhase < rawPhase) ? safeLevel : 0;
  state.hasStarted = !resetActive;
  state.phase = resetActive ? 0 : nextRawPhase;
  return {
    "Analog Out": analog,
    "Digital Out": digital,
    Out: digital,
    Pulse: pulse,
  };
}

function nodeGraphTransportDivisionFactor(divisions) {
  const division = Math.round(Number(divisions) || 0);
  if (division > 0) {
    return division + 1;
  }
  if (division < 0) {
    return 1 / (Math.abs(division) + 1);
  }
  return 1;
}

function nodeGraphTransportSample(params, absoluteFrame, sampleRate, runtime = null, nodeId = "") {
  const timing = normalizeNodeGraphPatchTiming(runtime?.timing);
  const rate = Math.max(1, sampleRate || nodeGraphMvp.sampleRate || 44100);
  const baseHz = Math.max(0, Number(timing.tempoBpm) || 120) / 60;
  const divisionFactor = nodeGraphTransportDivisionFactor(params.divisions);
  const frequency = baseHz * divisionFactor;
  const amplitude = clampNodeSliderValue(
    nodeGraphSafeFilterNumber(params.amplitude, runtime, nodeId, null, "transport amplitude"),
    0,
    1,
  );
  const frame = Math.max(0, Number(absoluteFrame) || 0);
  const phase = frequency > 0 ? wrapNodeSliderValue((frame / rate) * frequency, 0, 1) : 0;
  const high = phase < 0.5;
  return {
    "-1..1": high ? amplitude : -amplitude,
    "0..1": high ? amplitude : 0,
  };
}

function nodeGraphRandomClockNextUnit(state, nodeId, seed) {
  const seedKey = `${nodeId}:${Math.round(Number(seed) || 0)}`;
  if (state.seedKey !== seedKey) {
    state.seedKey = seedKey;
    state.randomState = nodeGraphStableSeed(seedKey);
    state.intervalSamples = 0;
    state.phaseSamples = 0;
    state.remainingTriggerSamples = 0;
  }
  state.randomState = (Math.imul(state.randomState || 1, 1664525) + 1013904223) >>> 0;
  return state.randomState / 4294967296;
}

function nodeGraphRandomClockChooseIntervalSamples(state, params, sampleRate, runtime, nodeId) {
  const rate = Math.max(1, sampleRate || nodeGraphMvp.sampleRate || 44100);
  const minSeconds = Math.max(0, nodeGraphSafeFilterNumber(params.minSeconds, runtime, nodeId, null, "random clock min"));
  const maxSeconds = Math.max(0, nodeGraphSafeFilterNumber(params.maxSeconds, runtime, nodeId, null, "random clock max"));
  const low = Math.min(minSeconds, maxSeconds);
  const high = Math.max(minSeconds, maxSeconds);
  const random = nodeGraphRandomClockNextUnit(state, nodeId, params.seed);
  return Math.max(1, Math.round((low + (high - low) * random) * rate));
}

function nodeGraphRandomClockSample(state, reset, params, sampleRate, runtime = null, nodeId = "") {
  const safeReset = nodeGraphSafeFilterNumber(reset, runtime, nodeId, null, "random clock reset");
  const threshold = nodeGraphSafeFilterNumber(params.threshold, runtime, nodeId, null, "random clock reset threshold");
  const rate = Math.max(1, sampleRate || nodeGraphMvp.sampleRate || 44100);
  const duty = clampNodeSliderValue(
    nodeGraphSafeFilterNumber(params.duty, runtime, nodeId, null, "random clock duty"),
    0,
    1,
  );
  const triggerTime = Math.max(0, nodeGraphSafeFilterNumber(params.triggerTime, runtime, nodeId, null, "random clock trigger"));
  const level = nodeGraphSafeFilterNumber(params.level, runtime, nodeId, null, "random clock level");
  const resetEdge = state.lastReset <= threshold && safeReset > threshold;

  if (resetEdge || state.intervalSamples <= 0) {
    state.intervalSamples = nodeGraphRandomClockChooseIntervalSamples(state, params, rate, runtime, nodeId);
    state.phaseSamples = 0;
    state.remainingTriggerSamples = Math.max(1, Math.round(triggerTime * rate));
  } else if (state.phaseSamples >= state.intervalSamples) {
    state.intervalSamples = nodeGraphRandomClockChooseIntervalSamples(state, params, rate, runtime, nodeId);
    state.phaseSamples = 0;
    state.remainingTriggerSamples = Math.max(1, Math.round(triggerTime * rate));
  }

  const gateSamples = Math.round(state.intervalSamples * duty);
  const trigger = state.remainingTriggerSamples > 0 ? level : 0;
  const gate = state.phaseSamples < gateSamples ? level : 0;
  state.remainingTriggerSamples = Math.max(0, state.remainingTriggerSamples - 1);
  state.phaseSamples += 1;
  state.lastReset = safeReset;
  return {
    Gate: nodeGraphSafeFilterNumber(gate, runtime, nodeId, null, "random clock gate"),
    Trigger: nodeGraphSafeFilterNumber(trigger, runtime, nodeId, null, "random clock trigger output"),
  };
}

function nodeGraphOfflineIncomingClockRate(nodeId) {
  const connection = (Array.isArray(nodeGraphMvp?.patch?.connections) ? nodeGraphMvp.patch.connections : [])
    .find((candidate) => candidate.destinationNode === nodeId && candidate.destinationPort === "Clock");
  const sourceNode = (Array.isArray(nodeGraphMvp?.patch?.nodes) ? nodeGraphMvp.patch.nodes : [])
    .find((node) => node.id === connection?.sourceNode);
  return sourceNode?.type === "clock"
    ? Math.max(0, Number(sourceNode.params?.rate) || 0)
    : 0;
}

function nodeGraphDelayedTriggerSample(state, trigger, reset, params, sampleRate, runtime = null, nodeId = "") {
  const safeTrigger = nodeGraphSafeFilterNumber(trigger, runtime, nodeId, null, "delayed trigger trigger");
  const safeReset = nodeGraphSafeFilterNumber(reset, runtime, nodeId, null, "delayed trigger reset");
  const threshold = nodeGraphSafeFilterNumber(params.threshold, runtime, nodeId, null, "delayed trigger threshold");
  const delay = Math.max(0, nodeGraphSafeFilterNumber(params.delay, runtime, nodeId, null, "delayed trigger delay"));
  const pulseTime = Math.max(0, nodeGraphSafeFilterNumber(params.pulseTime, runtime, nodeId, null, "delayed trigger pulse"));
  const level = nodeGraphSafeFilterNumber(params.level, runtime, nodeId, null, "delayed trigger level");
  const rate = Math.max(1, sampleRate || nodeGraphMvp.sampleRate || 44100);

  if (state.lastReset <= threshold && safeReset > threshold) {
    state.hasTriggered = true;
    state.remainingSamples = 0;
    state.running = false;
    state.waitSamples = 0;
  }
  if (state.lastTrigger <= threshold && safeTrigger > threshold) {
    state.hasTriggered = false;
    state.remainingSamples = 0;
    state.running = true;
    state.waitSamples = Math.max(0, Math.round(delay * rate));
  }

  if (state.running && !state.hasTriggered) {
    if (state.waitSamples <= 0) {
      state.hasTriggered = true;
      state.running = false;
      state.remainingSamples = Math.max(1, Math.round(pulseTime * rate));
    } else {
      state.waitSamples -= 1;
    }
  }

  state.lastTrigger = safeTrigger;
  state.lastReset = safeReset;
  const output = state.remainingSamples > 0 ? level : 0;
  state.remainingSamples = Math.max(0, state.remainingSamples - 1);
  return nodeGraphSafeFilterNumber(output, runtime, nodeId, null, "delayed trigger output");
}

function nodeGraphDelayParabolSample(phase) {
  const wrapped = phase - Math.floor(phase);
  return wrapped < 0.5 ? wrapped * 4 - 1 : 3 - wrapped * 4;
}

function nodeGraphDelayInterpolateLinear(buffer, where) {
  const length = buffer.length;
  if (!length) {
    return 0;
  }
  const before = Math.floor(where) % length;
  const after = (before + 1) % length;
  const mix = where - Math.floor(where);
  return buffer[before] * (1 - mix) + buffer[after] * mix;
}

function nodeGraphDelayEffectSample(state, input, params, sampleRate, runtime = null, nodeId = "") {
  const safeRate = Math.max(1, Number(sampleRate) || 44100);
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
  const dry = nodeGraphSafeFilterNumber(input, runtime, nodeId, state, "delay input");
  const time = Math.max(0.001, Math.min(maxDelaySeconds, nodeGraphSafeFilterNumber(params.time, runtime, nodeId, state, "delay time")));
  const feedback = Math.max(0, Math.min(0.95, nodeGraphSafeFilterNumber(params.feedback, runtime, nodeId, state, "delay feedback")));
  const mix = Math.max(0, Math.min(1, nodeGraphSafeFilterNumber(params.mix, runtime, nodeId, state, "delay mix")));
  const level = Math.max(0, Math.min(2, nodeGraphSafeFilterNumber(params.level, runtime, nodeId, state, "delay level")));
  const modAmount = Math.max(0, Math.min(0.5, nodeGraphSafeFilterNumber(params.modAmount, runtime, nodeId, state, "delay modulation")));
  const modRate = Math.max(0, Math.min(90, nodeGraphSafeFilterNumber(params.modRate, runtime, nodeId, state, "delay mod rate")));
  const modVariation = Math.max(0, Math.min(1, nodeGraphSafeFilterNumber(params.modVariation, runtime, nodeId, state, "delay variation")));
  const mode = Math.round(nodeGraphSafeFilterNumber(params.mode, runtime, nodeId, state, "delay mode")) >= 1 ? 1 : 0;

  const variationTarget = nodeGraphHashBipolar(
    Math.floor(state.lfoPhase * 997) + state.position,
    nodeGraphStableSeed(`${nodeId}:delayVariation`),
  );
  state.lfoVariationState += (variationTarget - state.lfoVariationState) * Math.min(1, modRate / safeRate);
  const variedRate = Math.max(0, modRate * (1 + state.lfoVariationState * modVariation));
  state.lfoPhase = (state.lfoPhase + variedRate / safeRate) % 1;
  const lfo = (nodeGraphDelayParabolSample(state.lfoPhase) + 1) * 0.5;

  const delaySamples = Math.max(1, Math.min(state.bufferSize - 2, time * safeRate));
  const bufferOffset = delaySamples - delaySamples * lfo * modAmount + 1;
  state.position = (state.position + 1) % state.bufferSize;
  const readPosition = (state.position + state.bufferSize - bufferOffset) % state.bufferSize;
  const wet = nodeGraphDelayInterpolateLinear(state.buffer, readPosition);
  const write = mode ? ((0 - dry) - wet * feedback) : (dry + wet * feedback);
  state.buffer[state.position] = Math.max(-8, Math.min(8, write));
  state.wet = mode ? (dry * feedback - wet * (1 - feedback * feedback)) : wet;
  return {
    Out: (dry * (1 - mix) + state.wet * mix) * level,
    Wet: state.wet * level,
  };
}

function nodeGraphPingPongDelayTimingModeMultiplier(mode) {
  const rounded = Math.round(Number(mode) || 0);
  if (rounded === 1) {
    return 1.5; // Dotted
  }
  if (rounded === 2) {
    return 2 / 3; // Triplet: three fit in the space of two normal notes
  }
  return 1; // Normal
}

// X/Y as a fraction of a whole note. Both are free metaparameters -- never
// clamped or rejected here, only floored for this one computation:
// - Negative numerator or denominator behaves like 0.
// - A numerator of 0 (or negative) always means "no time", for any
//   denominator including 0 -- this also sidesteps 0/0 producing NaN.
// - A non-zero numerator over a 0 (or negative) denominator falls back to
//   a denominator of 1, i.e. "X/0" reads as "X whole notes", rather than
//   dividing by zero.
function nodeGraphPingPongDelayFraction(numerator, denominator) {
  const effectiveNumerator = Math.max(0, Number(numerator) || 0);
  if (effectiveNumerator === 0) {
    return 0;
  }
  const effectiveDenominator = Math.max(0, Number(denominator) || 0);
  return effectiveNumerator / Math.max(1, effectiveDenominator);
}

function nodeGraphPingPongDelaySeconds(params, runtime) {
  const timing = normalizeNodeGraphPatchTiming(runtime?.timing);
  const secondsPerWholeNote = 240 / Math.max(1, Number(timing.tempoBpm) || 120);
  const fraction = nodeGraphPingPongDelayFraction(params.timeNumerator, params.timeDenominator);
  const syncedSeconds = secondsPerWholeNote * fraction * nodeGraphPingPongDelayTimingModeMultiplier(params.timingMode);
  const offsetSeconds = (Number(params.offsetMs) || 0) / 1000;
  return syncedSeconds + offsetSeconds;
}

function nodeGraphPingPongDelaySample(state, input, params, sampleRate, runtime = null, nodeId = "") {
  const safeRate = Math.max(1, Number(sampleRate) || 44100);
  const maxDelaySeconds = 8;
  const requiredSize = Math.max(2, Math.ceil(safeRate * maxDelaySeconds) + 2);
  if (!state.bufferL || state.bufferSize !== requiredSize) {
    state.bufferL = new Float32Array(requiredSize);
    state.bufferR = new Float32Array(requiredSize);
    state.bufferSize = requiredSize;
    state.position = 0;
    state.wetL = 0;
    state.wetR = 0;
  }
  const dry = nodeGraphSafeFilterNumber(input, runtime, nodeId, null, "ping pong delay input");
  const feedback = Math.max(0, Math.min(0.95, nodeGraphSafeFilterNumber(params.feedback, runtime, nodeId, null, "ping pong delay feedback")));
  const mix = Math.max(0, Math.min(1, nodeGraphSafeFilterNumber(params.mix, runtime, nodeId, null, "ping pong delay mix")));
  const level = Math.max(0, Math.min(2, nodeGraphSafeFilterNumber(params.level, runtime, nodeId, null, "ping pong delay level")));

  // The computed time is what gets bounded to fit the (necessarily finite)
  // delay buffer -- timeNumerator/timeDenominator/offsetMs themselves are
  // read as-is above, in nodeGraphPingPongDelaySeconds, with no clamp.
  const rawSeconds = nodeGraphPingPongDelaySeconds(params, runtime);
  const safeSeconds = Number.isFinite(rawSeconds) ? Math.max(0, rawSeconds) : 0;
  const delaySamples = Math.min(state.bufferSize - 2, Math.max(1, safeSeconds * safeRate));

  state.position = (state.position + 1) % state.bufferSize;
  const readPosition = (state.position + state.bufferSize - delaySamples) % state.bufferSize;
  const readL = nodeGraphDelayInterpolateLinear(state.bufferL, readPosition);
  const readR = nodeGraphDelayInterpolateLinear(state.bufferR, readPosition);

  // Classic ping-pong topology: the input only ever enters the left line;
  // the right line is driven purely by the left line's own feedback, so a
  // single input bounces left -> right -> left -> right as it decays.
  const writeL = dry + readR * feedback;
  const writeR = readL * feedback;
  state.bufferL[state.position] = Math.max(-8, Math.min(8, writeL));
  state.bufferR[state.position] = Math.max(-8, Math.min(8, writeR));
  state.wetL = readL;
  state.wetR = readR;

  return {
    Left: (dry * (1 - mix) + state.wetL * mix) * level,
    Right: (dry * (1 - mix) + state.wetR * mix) * level,
  };
}

// DspBinding for Sabrina Reverb (offline/preview evaluator path): resolves
// clamped native params, checks whether they've actually changed since the
// last apply (paramKey dirty check), and only then syncs them into native
// DSP memory via soemdsp_sabrina_reverb_set_params. Pure extraction of the
// duplicate block previously inline in nodeGraphSabrinaReverbSample -- same
// clamps, same key construction, same condition, same call args. Mirrors
// applySabrinaDspBindingIfDirty in node-live-audio-worklet-core.js (a plain
// function here since this evaluator module isn't class-based).
function applySabrinaDspBindingIfDirty(native, state, params, runtime, nodeId) {
  const safeParams = {
    delaySize: Math.max(0, Math.min(1, nodeGraphSafeFilterNumber(params.delaySize, runtime, nodeId, null, "Sabrina delay size"))),
    diffusionAmount: Math.max(0, Math.min(0.98, nodeGraphSafeFilterNumber(params.diffusionAmount, runtime, nodeId, null, "Sabrina diffusion amount"))),
    diffusionSize: Math.max(0, Math.min(1, nodeGraphSafeFilterNumber(params.diffusionSize, runtime, nodeId, null, "Sabrina diffusion size"))),
    lfoAmplitude: Math.max(0, Math.min(1, nodeGraphSafeFilterNumber(params.lfoAmplitude, runtime, nodeId, null, "Sabrina lfo amplitude"))),
    lfoBaseSpeed: Math.max(0, Math.min(1, nodeGraphSafeFilterNumber(params.lfoBaseSpeed, runtime, nodeId, null, "Sabrina lfo speed"))),
    lfoVariation: Math.max(0, Math.min(1, nodeGraphSafeFilterNumber(params.lfoVariation, runtime, nodeId, null, "Sabrina lfo variation"))),
    mix: Math.max(0, Math.min(1, nodeGraphSafeFilterNumber(params.mix, runtime, nodeId, null, "Sabrina mix"))),
    recycle: Math.max(0, Math.min(0.98, nodeGraphSafeFilterNumber(params.recycle, runtime, nodeId, null, "Sabrina recycle"))),
    seed: Math.max(0, Math.min(99999, Math.round(nodeGraphSafeFilterNumber(params.seed, runtime, nodeId, null, "Sabrina seed")))),
  };
  const paramKey = [
    safeParams.mix,
    safeParams.diffusionSize,
    safeParams.diffusionAmount,
    safeParams.delaySize,
    safeParams.recycle,
    safeParams.lfoAmplitude,
    safeParams.lfoBaseSpeed,
    safeParams.lfoVariation,
  ].map((value) => Math.round(value * 1000000)).join(":") + `:${safeParams.seed}`;
  if (paramKey === state.nativeParamKey || !native.soemdsp_sabrina_reverb_set_params) {
    return;
  }
  state.nativeParamKey = paramKey;
  native.soemdsp_sabrina_reverb_set_params(
    state.nativeHandle,
    safeParams.mix,
    safeParams.diffusionSize,
    safeParams.diffusionAmount,
    safeParams.delaySize,
    safeParams.recycle,
    safeParams.lfoAmplitude,
    safeParams.lfoBaseSpeed,
    safeParams.lfoVariation,
    safeParams.seed,
  );
}

function nodeGraphSabrinaReverbSample(state, leftInput, rightInput, params, sampleRate, runtime = null, nodeId = "") {
  const dryLeft = nodeGraphSafeFilterNumber(leftInput, runtime, nodeId, null, "Sabrina left input");
  const dryRight = nodeGraphSafeFilterNumber(rightInput, runtime, nodeId, null, "Sabrina right input");
  const dryMono = (dryLeft + dryRight) * 0.5;
  const dry = { "Left Dry": dryLeft, "Mono Dry": dryMono, "Right Dry": dryRight, "Left Mix": dryLeft, "Mono Mix": dryMono, "Right Mix": dryRight };
  const native = runtime?.nativeSabrinaReverbReady ? runtime?.nativeSabrinaReverb : null;
  if (!native?.soemdsp_sabrina_reverb_create || !native?.soemdsp_sabrina_reverb_process) {
    return dry;
  }
  try {
    const safeRate = Math.max(1, Math.round(Number(sampleRate) || 44100));
    if (!state.nativeHandle || state.nativeSampleRate !== safeRate) {
      if (state.nativeHandle && native.soemdsp_sabrina_reverb_destroy) {
        native.soemdsp_sabrina_reverb_destroy(state.nativeHandle);
      }
      state.nativeHandle = native.soemdsp_sabrina_reverb_create(safeRate) || 0;
      state.nativeSampleRate = safeRate;
      state.nativeParamKey = "";
    }
    if (!state.nativeHandle) {
      return dry;
    }
    applySabrinaDspBindingIfDirty(native, state, params, runtime, nodeId);
    native.soemdsp_sabrina_reverb_process(state.nativeHandle, dryLeft, dryRight);
    const mixLeft = nodeGraphSafeFilterNumber(native.soemdsp_sabrina_reverb_left?.(state.nativeHandle), runtime, nodeId, null, "Sabrina mix left");
    const mixRight = nodeGraphSafeFilterNumber(native.soemdsp_sabrina_reverb_right?.(state.nativeHandle), runtime, nodeId, null, "Sabrina mix right");
    return { "Left Dry": dryLeft, "Mono Dry": dryMono, "Right Dry": dryRight, "Left Mix": mixLeft, "Mono Mix": (mixLeft + mixRight) * 0.5, "Right Mix": mixRight };
  } catch (error) {
    if (runtime) {
      runtime.nativeSabrinaReverbReady = false;
    }
    if (state.nativeHandle && native.soemdsp_sabrina_reverb_destroy) {
      native.soemdsp_sabrina_reverb_destroy(state.nativeHandle);
    }
    state.nativeHandle = 0;
    state.nativeParamKey = "";
    return dry;
  }
}

function nodeGraphPllSample(state, signalIn, cvIn, cvConnected, params, sampleRate, runtime = null, nodeId = "") {
  const silent = { "VCO Out": 0, "PC Out": 0, "LPF Out": 0, Locked: 0 };
  const native = runtime?.nativePllReady ? runtime?.nativePll : null;
  if (!native?.soemdsp_pll_create || !native?.soemdsp_pll_process) return silent;
  try {
    const safeRate = Math.max(1, Math.round(Number(sampleRate) || 44100));
    if (!state.nativeHandle || state.nativeSampleRate !== safeRate) {
      if (state.nativeHandle && native.soemdsp_pll_destroy) {
        native.soemdsp_pll_destroy(state.nativeHandle);
      }
      state.nativeHandle = native.soemdsp_pll_create(safeRate) || 0;
      state.nativeSampleRate = safeRate;
      state.nativeParamKey = "";
    }
    if (!state.nativeHandle) return silent;
    const range  = Math.max(0, Math.min(2, Math.round(Number(params.range)  || 1)));
    const offset = Math.max(0, Math.min(10, Number(params.offset) || 5));
    const type   = Math.max(0, Math.min(2, Math.round(Number(params.type)   || 1)));
    const frequ  = Math.max(0.1, Number(params.frequ) || 10);
    const paramKey = `${range}:${Math.round(offset * 1000)}:${type}:${Math.round(frequ * 1000)}`;
    if (paramKey !== state.nativeParamKey && native.soemdsp_pll_set_params) {
      state.nativeParamKey = paramKey;
      native.soemdsp_pll_set_params(state.nativeHandle, safeRate, range, offset, type, frequ);
    }
    const safeSig = nodeGraphSafeFilterNumber(signalIn, runtime, nodeId, null, "PLL signal in");
    const safeCv  = Math.max(0, Math.min(1, nodeGraphSafeFilterNumber(cvIn, runtime, nodeId, null, "PLL cv in")));
    native.soemdsp_pll_process(state.nativeHandle, safeSig, safeCv, cvConnected);
    return {
      "VCO Out": nodeGraphSafeFilterNumber(native.soemdsp_pll_vco_out?.(state.nativeHandle), runtime, nodeId, null, "PLL vco out"),
      "PC Out":  nodeGraphSafeFilterNumber(native.soemdsp_pll_pc_out?.(state.nativeHandle),  runtime, nodeId, null, "PLL pc out"),
      "LPF Out": nodeGraphSafeFilterNumber(native.soemdsp_pll_lpf_out?.(state.nativeHandle), runtime, nodeId, null, "PLL lpf out"),
      Locked:    nodeGraphSafeFilterNumber(native.soemdsp_pll_locked?.(state.nativeHandle),   runtime, nodeId, null, "PLL locked"),
    };
  } catch {
    if (runtime) runtime.nativePllReady = false;
    if (state.nativeHandle && native.soemdsp_pll_destroy) native.soemdsp_pll_destroy(state.nativeHandle);
    state.nativeHandle = 0;
    return silent;
  }
}

function nodeGraphHelmholtzPitchView(frequencyHz) {
  if (!(frequencyHz > 0)) return -1;
  const minHz = 80;
  const octaves = 4;
  const clampedHz = Math.max(minHz, Math.min(minHz * Math.pow(2, octaves), frequencyHz));
  const norm = Math.log2(clampedHz / minHz) / octaves;
  return norm * 2 - 1;
}

function nodeGraphHelmholtzSample(state, input, params, inputConnected, sampleRate, runtime = null, nodeId = "") {
  const silent = { Frequency: 0, Fidelity: 0, "Pitch View": -1 };
  if (!inputConnected) {
    if (state.nativeHandle && runtime?.nativeHelmholtz?.soemdsp_helmholtz_destroy) {
      runtime.nativeHelmholtz.soemdsp_helmholtz_destroy(state.nativeHandle);
    }
    state.nativeHandle = 0;
    state.nativeSampleRate = 0;
    state.nativeParamKey = "";
    return silent;
  }
  const native = runtime?.nativeHelmholtzReady ? runtime?.nativeHelmholtz : null;
  if (!native?.soemdsp_helmholtz_create || !native?.soemdsp_helmholtz_process) return silent;
  try {
    const safeRate = Math.max(1, Math.round(Number(sampleRate) || 44100));
    if (!state.nativeHandle || state.nativeSampleRate !== safeRate) {
      if (state.nativeHandle && native.soemdsp_helmholtz_destroy) {
        native.soemdsp_helmholtz_destroy(state.nativeHandle);
      }
      state.nativeHandle = native.soemdsp_helmholtz_create(safeRate) || 0;
      state.nativeSampleRate = safeRate;
      state.nativeParamKey = "";
    }
    if (!state.nativeHandle) return silent;
    const windowSize = Math.max(128, Math.min(1024, Math.round(Number(params.windowSize) || 512)));
    const threshold = Math.max(0.5, Math.min(0.999, Number(params.threshold) || 0.93));
    const paramKey = `${windowSize}:${Math.round(threshold * 1000)}`;
    if (paramKey !== state.nativeParamKey && native.soemdsp_helmholtz_set_params) {
      state.nativeParamKey = paramKey;
      native.soemdsp_helmholtz_set_params(state.nativeHandle, safeRate, windowSize, threshold);
    }
    const safeIn = nodeGraphSafeFilterNumber(input, runtime, nodeId, null, "pitch detector input");
    native.soemdsp_helmholtz_process(state.nativeHandle, safeIn);
    const frequency = nodeGraphSafeFilterNumber(native.soemdsp_helmholtz_frequency?.(state.nativeHandle), runtime, nodeId, null, "pitch detector frequency");
    return {
      Frequency: frequency,
      Fidelity: nodeGraphSafeFilterNumber(native.soemdsp_helmholtz_fidelity?.(state.nativeHandle), runtime, nodeId, null, "pitch detector fidelity"),
      "Pitch View": nodeGraphHelmholtzPitchView(frequency),
    };
  } catch {
    if (runtime) runtime.nativeHelmholtzReady = false;
    if (state.nativeHandle && native.soemdsp_helmholtz_destroy) native.soemdsp_helmholtz_destroy(state.nativeHandle);
    state.nativeHandle = 0;
    return silent;
  }
}

function nodeGraphSampleHoldSample(state, input, trigger, threshold, sampleFrequency, sampleRate, hasInConnected, runtime = null, nodeId = "") {
  nodeGraphResetSeededState(state.noise, nodeId, 0, "sampleHoldNoise");
  const safeInput = hasInConnected
    ? nodeGraphSafeFilterNumber(input, runtime, nodeId, null, "sample hold input")
    : nodeGraphNextSeededBipolar(state.noise);
  const safeTrigger = nodeGraphSafeFilterNumber(trigger, runtime, nodeId, null, "sample hold trigger");
  const safeThreshold = nodeGraphSafeFilterNumber(threshold, runtime, nodeId, null, "sample hold threshold");
  const safeFreq = Math.max(0, Number(sampleFrequency) || 0);
  const safeRate = Math.max(1, Number(sampleRate) || 44100);
  let internalFire = false;
  if (safeFreq > 0) {
    state.clockPhase += safeFreq / safeRate;
    if (state.clockPhase >= 1) {
      state.clockPhase -= Math.floor(state.clockPhase);
      internalFire = true;
    }
  }
  if ((state.lastTrigger <= safeThreshold && safeTrigger > safeThreshold) || internalFire) {
    state.held = safeInput;
  }
  state.lastTrigger = safeTrigger;
  return nodeGraphSafeFilterNumber(state.held, runtime, nodeId, null, "sample hold output");
}

function nodeGraphStepSequencerSample(state, trigger, reset, params, runtime = null, nodeId = "") {
  const safeTrigger = nodeGraphSafeFilterNumber(trigger, runtime, nodeId, null, "step sequencer trigger");
  const safeReset = nodeGraphSafeFilterNumber(reset, runtime, nodeId, null, "step sequencer reset");
  const threshold = nodeGraphSafeFilterNumber(params.threshold, runtime, nodeId, null, "step sequencer threshold");
  const stepCount = Math.max(1, Math.min(8, Math.round(nodeGraphSafeFilterNumber(params.steps, runtime, nodeId, null, "step sequencer steps"))));
  const level = nodeGraphSafeFilterNumber(params.level, runtime, nodeId, null, "step sequencer level");
  const values = params.values.map((value) => nodeGraphSafeFilterNumber(value, runtime, nodeId, null, "step sequencer value"));
  if (state.index >= stepCount) {
    state.index %= stepCount;
  }
  if (state.lastReset <= threshold && safeReset > threshold) {
    state.index = 0;
    state.out = values[0] || 0;
  }
  if (state.lastTrigger <= threshold && safeTrigger > threshold) {
    state.out = values[state.index] || 0;
    state.index = (state.index + 1) % stepCount;
  }
  state.gate = safeTrigger > threshold ? 1 : 0;
  state.lastTrigger = safeTrigger;
  state.lastReset = safeReset;
  return {
    Gate: state.gate,
    Out: nodeGraphSafeFilterNumber(state.out * level, runtime, nodeId, null, "step sequencer output"),
  };
}

function nodeGraphTriggerCounterSample(state, trigger, reset, params, sampleRate, runtime = null, nodeId = "") {
  const safeTrigger = nodeGraphSafeFilterNumber(trigger, runtime, nodeId, null, "trigger counter trigger");
  const safeReset = nodeGraphSafeFilterNumber(reset, runtime, nodeId, null, "trigger counter reset");
  const threshold = nodeGraphSafeFilterNumber(params.threshold, runtime, nodeId, null, "trigger counter threshold");
  const countMax = Math.max(1, nodeGraphSafeFilterNumber(params.countMax, runtime, nodeId, null, "trigger counter max"));
  const increment = Math.max(0, nodeGraphSafeFilterNumber(params.increment, runtime, nodeId, null, "trigger counter increment"));
  const pulseTime = Math.max(0, nodeGraphSafeFilterNumber(params.pulseTime, runtime, nodeId, null, "trigger counter pulse"));
  const level = nodeGraphSafeFilterNumber(params.level, runtime, nodeId, null, "trigger counter level");
  if (state.lastReset <= threshold && safeReset > threshold) {
    state.count = 0;
    state.remainingSamples = 0;
  }
  if (state.lastTrigger <= threshold && safeTrigger > threshold) {
    state.count += increment;
    if (state.count >= countMax) {
      state.count = countMax > 0 ? state.count % countMax : 0;
      state.remainingSamples = Math.max(1, Math.round(pulseTime * Math.max(1, sampleRate)));
    }
  }
  state.lastTrigger = safeTrigger;
  state.lastReset = safeReset;
  const pulse = state.remainingSamples > 0 ? level : 0;
  state.remainingSamples = Math.max(0, state.remainingSamples - 1);
  return {
    Count: nodeGraphSafeFilterNumber(clampNodeSliderValue(state.count / countMax, 0, 1) * level, runtime, nodeId, null, "trigger counter count"),
    Pulse: nodeGraphSafeFilterNumber(pulse, runtime, nodeId, null, "trigger counter pulse output"),
  };
}

function nodeGraphTriggerDividerSample(state, trigger, reset, params, sampleRate, runtime = null, nodeId = "") {
  const safeTrigger = nodeGraphSafeFilterNumber(trigger, runtime, nodeId, null, "trigger divider trigger");
  const safeReset = nodeGraphSafeFilterNumber(reset, runtime, nodeId, null, "trigger divider reset");
  const threshold = nodeGraphSafeFilterNumber(params.threshold, runtime, nodeId, null, "trigger divider threshold");
  const division = Math.max(1, Math.min(64, Math.round(nodeGraphSafeFilterNumber(params.division, runtime, nodeId, null, "trigger divider division"))));
  const pulseTime = Math.max(0, nodeGraphSafeFilterNumber(params.pulseTime, runtime, nodeId, null, "trigger divider pulse"));
  const level = nodeGraphSafeFilterNumber(params.level, runtime, nodeId, null, "trigger divider level");
  if (state.lastReset <= threshold && safeReset > threshold) {
    state.count = 0;
    state.remainingSamples = 0;
  }
  if (state.lastTrigger <= threshold && safeTrigger > threshold) {
    state.count = (state.count + 1) % division;
    if (state.count === 0) {
      state.remainingSamples = Math.max(1, Math.round(pulseTime * Math.max(1, sampleRate)));
    }
  }
  state.lastTrigger = safeTrigger;
  state.lastReset = safeReset;
  const output = state.remainingSamples > 0 ? level : 0;
  state.remainingSamples = Math.max(0, state.remainingSamples - 1);
  return nodeGraphSafeFilterNumber(output, runtime, nodeId, null, "trigger divider output");
}

const nodeGraphPluckEnvelopeMinValue = 1e-8;
const nodeGraphPluckEnvelopeMaxFeedback = 1 - 1e-6;

function nodeGraphExponentialCurve(value, skew) {
  const safeValue = clampNodeSliderValue(Number(value) || 0, 0, 1);
  const safeSkew = clampNodeSliderValue(Number(skew) || 0, -0.99, 0.99);
  if (safeSkew === 0) {
    return safeValue;
  }
  const c = 0.5 * (safeSkew + 1);
  const a = 2 * Math.log10((1 - c) / c);
  const denom = 1 - Math.exp(a);
  return denom === 0 ? safeValue : (1 - Math.exp(safeValue * a)) / denom;
}

function nodeGraphPluckPrepareForDecay(state, rate, peak) {
  state.phasor = 0;
  state.autoReleasePhasor = 0;
  state.currentValue = peak;
  state.decayIncrement = (state.currentValue - 1) / Math.max(1, rate) / 50;
}

function nodeGraphPluckTriggerAttack(state, params, rate) {
  const period = 1 / Math.max(1, rate);
  const velocity = clampNodeSliderValue(params.velocity, 0, 1);
  const sensitivity = clampNodeSliderValue(params.velocitySensitivity, 0, 1);
  const peak = (1 - sensitivity) + velocity * sensitivity;
  state.secondsPassed = 0;
  state.state = "delay";
  if (params.delayTime < period) {
    if (params.attackFeedback <= nodeGraphPluckEnvelopeMinValue) {
      state.state = "decay";
      nodeGraphPluckPrepareForDecay(state, rate, peak);
    } else {
      state.state = "attack";
    }
  }
  state.peak = peak;
}

function nodeGraphPluckTriggerRelease(state, rate) {
  if (state.state !== "release") {
    state.state = "release";
    state.releaseIncrement = state.currentValue / Math.max(1, rate) / 50;
  }
}

function nodeGraphPluckDecayFeedback(state, params) {
  let finalDecayMod = params.endingDecay;
  if (state.phasor < 1) {
    const shaped = nodeGraphExponentialCurve(state.phasor, params.decayModCurve || -1e-8);
    finalDecayMod = params.decay + params.decayModStart + shaped * (params.decayModEnd - params.decayModStart);
  }
  return Math.min(nodeGraphPluckEnvelopeMaxFeedback, Math.exp(-finalDecayMod * 10));
}

function nodeGraphPluckEnvelopeSample(state, trigger, release, params, sampleRate, runtime = null, nodeId = "") {
  const rate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);
  const period = 1 / rate;
  const safeTrigger = nodeGraphSafeFilterNumber(trigger, runtime, nodeId, null, "pluck trigger");
  const safeRelease = nodeGraphSafeFilterNumber(release, runtime, nodeId, null, "pluck release");
  const read = (key, fallback, min = -Infinity, max = Infinity) => clampNodeSliderValue(
    nodeGraphSafeFilterNumber(params[key] ?? fallback, runtime, nodeId, null, `pluck ${key}`),
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
    nodeGraphPluckTriggerAttack(state, values, rate);
  }
  if (state.lastRelease <= 0 && safeRelease > 0) {
    nodeGraphPluckTriggerRelease(state, rate);
  }
  state.lastTrigger = safeTrigger;
  state.lastRelease = safeRelease;

  const attackFeedbackAmp = 1 / (Math.max(values.attackFeedback, nodeGraphPluckEnvelopeMinValue) * rate);
  const releaseFeedbackAmp = Math.min(nodeGraphPluckEnvelopeMaxFeedback, Math.exp(-values.releaseFeedback * 10));
  const autoReleaseIncrement = values.autoReleaseTime <= nodeGraphPluckEnvelopeMinValue
    ? 0
    : 1 / (Math.max(values.autoReleaseTime, nodeGraphPluckEnvelopeMinValue) * rate);
  const phasorIncrement = values.decayModFrequency / rate;

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
        nodeGraphPluckPrepareForDecay(state, rate, state.peak);
      }
      break;
    case "decay":
      state.currentValue -= state.decayIncrement + state.currentValue * state.currentValue * nodeGraphPluckDecayFeedback(state, values);
      state.phasor += phasorIncrement;
      state.autoReleasePhasor += autoReleaseIncrement;
      if (autoReleaseIncrement > 0 && state.autoReleasePhasor >= 1) {
        nodeGraphPluckTriggerRelease(state, rate);
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
  return nodeGraphSafeFilterNumber(state.currentValue * values.level, runtime, nodeId, null, "pluck output");
}

function nodeGraphSeedKey(nodeId, seed, salt) {
  return `${nodeId}.${salt}.${Math.max(0, Math.round(Number(seed) || 0))}`;
}

function nodeGraphResetSeededState(state, nodeId, seed, salt) {
  const key = nodeGraphSeedKey(nodeId, seed, salt);
  if (state.seedKey !== key) {
    state.seedKey = key;
    state.seed = nodeGraphStableSeed(key);
    state.gaussianSpare = null;
    state.brown = 0;
    state.pink = [0, 0, 0, 0, 0, 0, 0];
    if (Object.hasOwn(state, "out")) {
      state.out = 0;
    }
    if (state.lowpass) {
      state.lowpass.outputBuffer = 0;
    }
  }
}

function nodeGraphNextSeededUnipolar(state) {
  state.seed = (Math.imul(1664525, state.seed || 0x12345678) + 1013904223) >>> 0;
  return state.seed / 0xffffffff;
}

function nodeGraphNextSeededBipolar(state) {
  return nodeGraphNextSeededUnipolar(state) * 2 - 1;
}

function nodeGraphNextSeededGaussian(state) {
  if (state.gaussianSpare !== null && state.gaussianSpare !== undefined) {
    const spare = state.gaussianSpare;
    state.gaussianSpare = null;
    return spare;
  }
  const u1 = Math.max(1e-12, nodeGraphNextSeededUnipolar(state));
  const u2 = nodeGraphNextSeededUnipolar(state);
  const magnitude = Math.sqrt(-2 * Math.log(u1));
  const angle = nodeGraphTau * u2;
  state.gaussianSpare = magnitude * Math.sin(angle);
  return magnitude * Math.cos(angle);
}

function nodeGraphNoiseGeneratorChannelSample(state, mode, mean, deviation) {
  const white = nodeGraphNextSeededBipolar(state);
  if (mode === 1) {
    return mean + nodeGraphNextSeededGaussian(state) * deviation;
  }
  if (mode === 2) {
    state.brown = clampNodeSliderValue(state.brown + white * Math.max(0.001, deviation) * 0.05, -1, 1);
    return mean + state.brown;
  }
  if (mode === 3) {
    state.pink[0] = 0.99886 * state.pink[0] + white * 0.0555179;
    state.pink[1] = 0.99332 * state.pink[1] + white * 0.0750759;
    state.pink[2] = 0.969 * state.pink[2] + white * 0.153852;
    state.pink[3] = 0.8665 * state.pink[3] + white * 0.3104856;
    state.pink[4] = 0.55 * state.pink[4] + white * 0.5329522;
    state.pink[5] = -0.7616 * state.pink[5] - white * 0.016898;
    const out = mean + (state.pink[0] + state.pink[1] + state.pink[2] + state.pink[3] + state.pink[4] + state.pink[5] + state.pink[6] + white * 0.5362) * 0.11;
    state.pink[6] = white * 0.115926;
    return out;
  }
  if (mode === 4) {
    return Math.abs(white) > 0.94 ? mean + Math.sign(white) * deviation : mean;
  }
  return mean + white * deviation;
}

function nodeGraphNoiseGeneratorSample(state, params, runtime = null, nodeId = "") {
  nodeGraphResetSeededState(state.left, `${nodeId}:left`, params.seed, "noiseGenerator");
  nodeGraphResetSeededState(state.right, `${nodeId}:right`, params.seed, "noiseGenerator");
  const mode = Math.max(0, Math.min(4, Math.round(nodeGraphSafeFilterNumber(params.mode, runtime, nodeId, null, "noise generator mode"))));
  const mean = nodeGraphSafeFilterNumber(params.mean, runtime, nodeId, null, "noise generator mean");
  const deviation = Math.max(0, nodeGraphSafeFilterNumber(params.deviation, runtime, nodeId, null, "noise generator deviation"));
  const level = nodeGraphSafeFilterNumber(params.level, runtime, nodeId, null, "noise generator level");
  const left = clampNodeSliderValue(nodeGraphNoiseGeneratorChannelSample(state.left, mode, mean, deviation), -1, 1) * level;
  const right = clampNodeSliderValue(nodeGraphNoiseGeneratorChannelSample(state.right, mode, mean, deviation), -1, 1) * level;
  return {
    "Left Out": nodeGraphSafeFilterNumber(left, runtime, nodeId, null, "noise generator left out"),
    "Right Out": nodeGraphSafeFilterNumber(right, runtime, nodeId, null, "noise generator right out"),
  };
}

function nodeGraphRationalCurve(value, skew) {
  const t = clampNodeSliderValue(Number(value) || 0, 0, 1);
  const safeSkew = clampNodeSliderValue(Number(skew) || 0, -0.999, 0.999);
  return ((1 + safeSkew) * t) / (1 - safeSkew + 2 * safeSkew * t);
}

function nodeGraphRandomWalkSample(state, params, sampleRate, runtime = null, nodeId = "") {
  nodeGraphResetSeededState(state, nodeId, params.seed, "randomWalk");
  const rate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);
  const method = Math.max(0, Math.min(3, Math.round(nodeGraphSafeFilterNumber(params.method, runtime, nodeId, null, "random walk method"))));
  const frequency = Math.max(0, nodeGraphSafeFilterNumber(params.frequency, runtime, nodeId, null, "random walk frequency"));
  const jitter = Math.max(0, nodeGraphSafeFilterNumber(params.jitter, runtime, nodeId, null, "random walk jitter"));
  const level = nodeGraphSafeFilterNumber(params.level, runtime, nodeId, null, "random walk level");
  const noise = nodeGraphNextSeededBipolar(state);
  const increment = clampNodeSliderValue(frequency / rate, 0, 1);
  const jitterInc = clampNodeSliderValue(jitter / rate, 0, 1);
  const stepSize = clampNodeSliderValue(increment + nodeGraphRationalCurve(jitterInc, 0.99), 0, 1);
  const averageIncrement = (jitterInc + increment) * 0.5;
  const whiteNoiseMix = averageIncrement >= 0.9
    ? nodeGraphRationalCurve((averageIncrement - 0.9) / 0.1, -0.7)
    : 0;
  const randomMix = 1 - whiteNoiseMix;

  if (method === 0) {
    return nodeGraphSafeFilterNumber(noise * level, runtime, nodeId, null, "random walk white output");
  }
  if (method === 1) {
    return nodeGraphOnePoleLowpassSample(state.lowpass, noise, frequency, rate, runtime, nodeId) * level;
  }
  const step = method === 3 ? (noise > 0 ? stepSize : -stepSize) : noise * stepSize;
  state.out = clampNodeSliderValue(state.out + step, -1, 1);
  const mixed = state.out * randomMix + noise * whiteNoiseMix;
  return nodeGraphSafeFilterNumber(
    nodeGraphOnePoleLowpassSample(state.lowpass, mixed, frequency, rate, runtime, nodeId) * level,
    runtime,
    nodeId,
    null,
    "random walk output",
  );
}

function nodeGraphHashBipolar(index, seed) {
  let value = (Math.trunc(index) ^ Math.trunc(seed)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 2246822507) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 3266489909) >>> 0;
  value = (value ^ (value >>> 16)) >>> 0;
  return (value / 0xffffffff) * 2 - 1;
}

function nodeGraphSmoothNoise1d(x, seed) {
  const left = Math.floor(x);
  const frac = x - left;
  const smooth = frac * frac * (3 - 2 * frac);
  const a = nodeGraphHashBipolar(left, seed);
  const b = nodeGraphHashBipolar(left + 1, seed);
  return a + (b - a) * smooth;
}

function nodeGraphFractalBrownianNoiseAxisState(state, axis) {
  const key = String(axis || "x");
  if (!state.axes || typeof state.axes !== "object") {
    state.axes = {};
  }
  if (!state.axes[key]) {
    state.axes[key] = { seedKey: "", time: 0 };
  }
  return state.axes[key];
}

function nodeGraphFractalBrownianNoiseSample(state, params, sampleRate, runtime = null, nodeId = "", axis = "x", options = {}) {
  const axisState = nodeGraphFractalBrownianNoiseAxisState(state, axis);
  const rate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);
  const seed = Math.max(0, Math.round(nodeGraphSafeFilterNumber(params.seed, runtime, nodeId, null, "fbm seed")));
  const seedKey = nodeGraphSeedKey(nodeId, seed, `fractalBrownianNoise:${axis}`);
  if (axisState.seedKey !== seedKey) {
    axisState.seedKey = seedKey;
    axisState.time = 0;
  }
  const frequency = Math.max(0, nodeGraphSafeFilterNumber(params.frequency, runtime, nodeId, null, "fbm frequency"));
  const octaves = Math.max(1, Math.min(8, Math.round(nodeGraphSafeFilterNumber(params.octaves, runtime, nodeId, null, "fbm octaves"))));
  const persistence = clampNodeSliderValue(nodeGraphSafeFilterNumber(params.persistence, runtime, nodeId, null, "fbm persistence"), 0, 0.99);
  const scale = Math.max(0.000001, nodeGraphSafeFilterNumber(params.scale, runtime, nodeId, null, "fbm scale"));
  const level = nodeGraphSafeFilterNumber(params.level, runtime, nodeId, null, "fbm level");
  let total = 0;
  let amplitude = 1;
  let noiseFrequency = 1;
  let maxValue = 0;
  const baseSeed = nodeGraphStableSeed(seedKey);
  for (let i = 0; i < octaves; i += 1) {
    total += nodeGraphSmoothNoise1d(axisState.time * scale * noiseFrequency, baseSeed + i * 1013) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    noiseFrequency *= 2;
  }
  axisState.time += frequency / rate;
  const normalized = maxValue > 0 ? total / maxValue : 0;
  return nodeGraphSafeFilterNumber(options.raw ? normalized : normalized * level, runtime, nodeId, null, "fbm output");
}

function nodeGraphFractalBrownianNoiseVector(state, params, sampleRate, runtime = null, nodeId = "", reset = 0) {
  const resetHigh = Number(reset) > 0.5;
  if (resetHigh && !state.resetWasHigh) {
    for (const axisState of Object.values(state.axes || {})) {
      axisState.time = 0;
    }
  }
  state.resetWasHigh = resetHigh;
  const rawX = nodeGraphFractalBrownianNoiseSample(state, params, sampleRate, runtime, nodeId, "x", { raw: true });
  const rawY = nodeGraphFractalBrownianNoiseSample(state, params, sampleRate, runtime, nodeId, "y", { raw: true });
  const rawZ = nodeGraphFractalBrownianNoiseSample(state, params, sampleRate, runtime, nodeId, "z", { raw: true });
  const level = nodeGraphSafeFilterNumber(params.level, runtime, nodeId, null, "fbm level");
  return {
    "Out X": nodeGraphSafeFilterNumber(rawX * level, runtime, nodeId, null, "fbm output"),
    "Out Y": nodeGraphSafeFilterNumber(rawY * level, runtime, nodeId, null, "fbm output"),
    "Out Z": nodeGraphSafeFilterNumber(rawZ * level, runtime, nodeId, null, "fbm output"),
    "Out X Raw": rawX,
    "Out Y Raw": rawY,
    "Out Z Raw": rawZ,
  };
}

function nodeGraphExpAdsrCalcCoef(rate, targetRatio) {
  const safeRate = Math.max(0, Number(rate) || 0);
  const safeRatio = Math.max(0.000000001, Number(targetRatio) || 0.000000001);
  return safeRate <= 0 ? 0 : Math.exp(-Math.log((1 + safeRatio) / safeRatio) / safeRate);
}

function nodeGraphExpAdsrTriggerAttack(state, delay, attack, sampleRate) {
  const period = 1 / Math.max(1, sampleRate);
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
}

function nodeGraphExpAdsrSample(state, gate, params, sampleRate, runtime = null, nodeId = "") {
  const safeGate = nodeGraphSafeFilterNumber(gate, runtime, nodeId, null, "exp adsr gate");
  const delay = Math.max(0, nodeGraphSafeFilterNumber(params.delay, runtime, nodeId, null, "exp adsr delay"));
  const attack = Math.max(0, nodeGraphSafeFilterNumber(params.attack, runtime, nodeId, null, "exp adsr attack"));
  const decay = Math.max(0, nodeGraphSafeFilterNumber(params.decay, runtime, nodeId, null, "exp adsr decay"));
  const sustain = clampNodeSliderValue(
    nodeGraphSafeFilterNumber(params.sustain, runtime, nodeId, null, "exp adsr sustain"),
    0,
    1,
  );
  const release = Math.max(0, nodeGraphSafeFilterNumber(params.release, runtime, nodeId, null, "exp adsr release"));
  const attackShape = Math.max(0.000000001, nodeGraphSafeFilterNumber(params.attackShape, runtime, nodeId, null, "exp adsr attack shape"));
  const releaseShape = Math.max(0.000000001, nodeGraphSafeFilterNumber(params.releaseShape, runtime, nodeId, null, "exp adsr release shape"));
  const level = nodeGraphSafeFilterNumber(params.level, runtime, nodeId, null, "exp adsr level");
  const looping = nodeGraphSafeFilterNumber(params.loop, runtime, nodeId, null, "exp adsr loop") >= 0.5;
  const rate = Math.max(1, sampleRate || nodeGraphMvp.sampleRate || 44100);
  const period = 1 / rate;

  if (state.lastGate <= 0 && safeGate > 0) {
    nodeGraphExpAdsrTriggerAttack(state, delay, attack, rate);
  } else if (state.lastGate > 0 && safeGate <= 0) {
    state.state = "release";
  }
  state.lastGate = safeGate;

  const attackCoef = nodeGraphExpAdsrCalcCoef(attack * rate, attackShape);
  const decayCoef = nodeGraphExpAdsrCalcCoef(decay * rate, releaseShape);
  const releaseCoef = nodeGraphExpAdsrCalcCoef(release * rate, releaseShape);
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
        nodeGraphExpAdsrTriggerAttack(state, delay, attack, rate);
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

  return nodeGraphSafeFilterNumber(state.out * level, runtime, nodeId, null, "exp adsr output");
}

function nodeGraphLinearEnvelopeTriggerAttack(state, delay, attack, sampleRate) {
  const period = 1 / Math.max(1, sampleRate);
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
}

function nodeGraphLinearEnvelopeSample(state, gate, params, sampleRate, runtime = null, nodeId = "") {
  const safeGate = nodeGraphSafeFilterNumber(gate, runtime, nodeId, null, "linear envelope gate");
  const delay = Math.max(0, nodeGraphSafeFilterNumber(params.delay, runtime, nodeId, null, "linear envelope delay"));
  const attack = Math.max(0, nodeGraphSafeFilterNumber(params.attack, runtime, nodeId, null, "linear envelope attack"));
  const decay = Math.max(0, nodeGraphSafeFilterNumber(params.decay, runtime, nodeId, null, "linear envelope decay"));
  const sustain = clampNodeSliderValue(nodeGraphSafeFilterNumber(params.sustain, runtime, nodeId, null, "linear envelope sustain"), 0, 1);
  const release = Math.max(0, nodeGraphSafeFilterNumber(params.release, runtime, nodeId, null, "linear envelope release"));
  const level = nodeGraphSafeFilterNumber(params.level, runtime, nodeId, null, "linear envelope level");
  const looping = nodeGraphSafeFilterNumber(params.loop, runtime, nodeId, null, "linear envelope loop") >= 0.5;
  const rate = Math.max(1, sampleRate || nodeGraphMvp.sampleRate || 44100);
  const period = 1 / rate;

  if (state.lastGate <= 0 && safeGate > 0) {
    nodeGraphLinearEnvelopeTriggerAttack(state, delay, attack, rate);
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

  return nodeGraphSafeFilterNumber(clampNodeSliderValue(state.out, 0, 1) * level, runtime, nodeId, null, "linear envelope output");
}

function nodeGraphVactrolEnvelopeCoefficient(seconds, sampleRate) {
  const time = Number(seconds);
  if (!Number.isFinite(time) || time <= 0) {
    return 1;
  }
  const samples = Math.max(1, time * Math.max(1, sampleRate || nodeGraphMvp.sampleRate || 44100));
  return 1 - Math.exp(-1 / samples);
}

function nodeGraphVactrolEnvelopeSample(state, light, params, sampleRate, runtime = null, nodeId = "") {
  const safeLight = nodeGraphSafeFilterNumber(light, runtime, nodeId, null, "vactrol light");
  const attack = Math.max(0, nodeGraphSafeFilterNumber(params.attack, runtime, nodeId, null, "vactrol attack"));
  const release = Math.max(0, nodeGraphSafeFilterNumber(params.release, runtime, nodeId, null, "vactrol release"));
  const curve = Math.max(0.001, nodeGraphSafeFilterNumber(params.curve, runtime, nodeId, null, "vactrol curve"));
  const sensitivity = Math.max(0, nodeGraphSafeFilterNumber(params.sensitivity, runtime, nodeId, null, "vactrol sensitivity"));
  const lightOffset = clampNodeSliderValue(
    nodeGraphSafeFilterNumber(params.lightOffset, runtime, nodeId, null, "vactrol light offset"),
    0,
    1,
  );
  const darkCurrent = clampNodeSliderValue(
    nodeGraphSafeFilterNumber(params.darkCurrent, runtime, nodeId, null, "vactrol dark current"),
    0,
    1,
  );
  const rate = Math.max(1, sampleRate || nodeGraphMvp.sampleRate || 44100);
  const target = clampNodeSliderValue(safeLight * sensitivity + lightOffset, 0, 1);
  const coefficient = target > state.raw
    ? nodeGraphVactrolEnvelopeCoefficient(attack, rate)
    : nodeGraphVactrolEnvelopeCoefficient(release, rate);
  state.raw += (target - state.raw) * coefficient;
  const shaped = Math.pow(clampNodeSliderValue(state.raw, 0, 1), curve);
  state.out = clampNodeSliderValue(darkCurrent + shaped * (1 - darkCurrent), 0, 1);
  return nodeGraphSafeFilterNumber(state.out, runtime, nodeId, null, "vactrol output");
}

function nodeGraphFlowerChildSecondsToSamples(seconds, sampleRate) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return Math.max(1, value * Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100));
}

function nodeGraphFlowerChildEnvelopeFollowerSample(state, input, params, sampleRate, runtime = null, nodeId = "") {
  const target = clampNodeSliderValue(
    Math.abs(nodeGraphSafeFilterNumber(input, runtime, nodeId, state, "flowerchild envelope input")),
    0,
    1,
  );
  const attackSamples = nodeGraphFlowerChildSecondsToSamples(
    nodeGraphSafeFilterNumber(params.attack, runtime, nodeId, state, "flowerchild envelope attack"),
    sampleRate,
  );
  const holdSamples = nodeGraphFlowerChildSecondsToSamples(
    nodeGraphSafeFilterNumber(params.hold, runtime, nodeId, state, "flowerchild envelope hold"),
    sampleRate,
  );
  const decaySamples = nodeGraphFlowerChildSecondsToSamples(
    nodeGraphSafeFilterNumber(params.decay, runtime, nodeId, state, "flowerchild envelope decay"),
    sampleRate,
  );
  const attackStep = 1 / attackSamples;
  const decayStep = 1 / decaySamples;
  const current = clampNodeSliderValue(Number(state.currentSlewedValue) || 0, 0, 1);
  if (target >= current) {
    state.currentSlewedValue = Math.min(target, current + attackStep);
    state.holdCounter = holdSamples;
  } else if ((Number(state.holdCounter) || 0) > 0) {
    state.holdCounter = Math.max(0, (Number(state.holdCounter) || 0) - 1);
    state.currentSlewedValue = current;
  } else {
    state.currentSlewedValue = Math.max(target, current - decayStep);
  }
  state.out = nodeGraphSafeFilterNumber(
    clampNodeSliderValue(state.currentSlewedValue, 0, 1),
    runtime,
    nodeId,
    state,
    "flowerchild envelope output",
  );
  return state.out;
}

function nodeGraphSampleChannelAt(sample, channelIndex, frameIndex) {
  const channel = sample?.channelData?.[channelIndex] || sample?.samples;
  if (!channel?.length) {
    return 0;
  }
  const maxIndex = channel.length - 1;
  const index = clampNodeSliderValue(Number(frameIndex) || 0, 0, maxIndex);
  const low = Math.floor(index);
  const high = Math.min(maxIndex, low + 1);
  const frac = index - low;
  return (Number(channel[low]) || 0) + ((Number(channel[high]) || 0) - (Number(channel[low]) || 0)) * frac;
}

function nodeGraphSampleStereoAt(sample, frameIndex) {
  const left = nodeGraphSampleChannelAt(sample, 0, frameIndex);
  const right = sample?.channelData?.length > 1
    ? nodeGraphSampleChannelAt(sample, 1, frameIndex)
    : left;
  return {
    Left: left,
    Mono: (left + right) * 0.5,
    Out: (left + right) * 0.5,
    Right: right,
  };
}

function nodeGraphAudioPlayerSample(runtime, node, nodeId, readInput, readParam, sampleRate) {
  const state = runtime.samplePlaybackStates.get(nodeId) || createNodeGraphSamplePlaybackState();
  runtime.samplePlaybackStates.set(nodeId, state);
  const sampleId = normalizeNodeGraphSampleId(node.sample?.id);
  const sample = runtime.samples?.get?.(sampleId);
  const frames = Math.max(0, Number(sample?.frames) || sample?.samples?.length || sample?.channelData?.[0]?.length || 0);
  if (!sample || frames <= 1) {
    return { Left: 0, Mono: 0, Out: 0, Phase: 0, Right: 0 };
  }
  const start = clampNodeSliderValue(readParam("start", 0), 0, 1);
  const end = clampNodeSliderValue(readParam("end", 1), 0, 1);
  const collapsedRange = Math.abs(end - start) <= 0.000001;
  const startPhase = collapsedRange ? 0 : Math.min(start, end);
  const endPhase = collapsedRange ? 1 : Math.max(start, end);
  const span = Math.max(0.000001, endPhase - startPhase);
  const rangeKey = `${startPhase}:${endPhase}`;
  if (state.sampleId !== sampleId) {
    state.phase = startPhase;
    state.completed = false;
    state.sampleId = sampleId;
  } else if (state.rangeKey !== rangeKey) {
    const currentPhase = Number(state.phase);
    if (!Number.isFinite(currentPhase) || currentPhase < startPhase || currentPhase > endPhase) {
      state.phase = startPhase;
    }
    state.completed = false;
  }
  if (state.rangeKey !== rangeKey) {
    state.rangeKey = rangeKey;
  }
  const transportFallback = Object.hasOwn(node?.params || {}, "transport")
    ? 4
    : ((Number(node?.params?.loop) || 0) >= 0.5 ? 4 : 0);
  const transportMode = Math.max(0, Math.min(4, Math.round(readParam("transport", transportFallback))));
  const transportReset = transportMode <= 0;
  const transportStopped = transportMode === 1;
  const transportPlayOnce = transportMode === 3;
  const transportLooping = transportMode >= 4;
  if (state.transportMode !== transportMode) {
    state.completed = false;
    state.transportMode = transportMode;
  }
  const reset = readInput("Reset");
  const resetEdge = state.lastReset <= 0 && reset > 0;
  if (resetEdge || transportReset || transportStopped) {
    state.phase = startPhase;
    state.completed = false;
  }
  state.playing = (transportPlayOnce || transportLooping) && !state.completed;
  state.lastReset = reset;

  const phaseConnected = runtime.inputConnections?.has?.(nodeGraphInputKey(nodeId, "Phase"));
  const speedInput = readInput("Speed");
  const speed = readParam("speed", 1) + speedInput;
  const sampleRateRatio = (Number(sample.sampleRate) || sampleRate || 44100) / Math.max(1, sampleRate || 44100);
  const increment = (speed * sampleRateRatio) / frames;
  const phase = phaseConnected
    ? clampNodeSliderValue(readInput("Phase"), 0, 1)
    : clampNodeSliderValue(state.phase, 0, 1);
  const boundedPhase = phase < startPhase || phase > endPhase
    ? startPhase
    : phase;
  const frameIndex = boundedPhase * (frames - 1);
  const stereo = nodeGraphSampleStereoAt(sample, frameIndex);
  const level = readParam("level", 1);
  let done = 0;
  if (!phaseConnected && state.playing) {
    const nextPhase = boundedPhase + increment;
    if (transportLooping) {
      const normalizedNext = (nextPhase - startPhase) / span;
      done = normalizedNext < 0 || normalizedNext >= 1 ? 1 : 0;
      state.phase = startPhase + wrapNodeSliderValue((nextPhase - startPhase) / span, 0, 1) * span;
    } else if (speed >= 0 && nextPhase >= endPhase) {
      state.phase = endPhase;
      state.completed = true;
      state.playing = false;
      done = 1;
    } else if (speed < 0 && nextPhase <= startPhase) {
      state.phase = startPhase;
      state.completed = true;
      state.playing = false;
      done = 1;
    } else {
      state.phase = clampNodeSliderValue(nextPhase, startPhase, endPhase);
    }
  } else if (!phaseConnected && (transportReset || transportStopped)) {
    state.phase = startPhase;
  } else {
    state.phase = boundedPhase;
  }
  const outputActive = state.playing;
  return {
    Left: outputActive ? stereo.Left * level : 0,
    Mono: outputActive ? stereo.Mono * level : 0,
    Out: outputActive ? stereo.Mono * level : 0,
    Phase: boundedPhase,
    Right: outputActive ? stereo.Right * level : 0,
    Trigger: done,
  };
}

// Registry of per-module-type dispatch handlers extracted into their own
// files (e.g. native_modules/logistic_map/logistic_map-live-evaluator.js),
// each self-registering on load. Checked ahead of the big if/else-if chain
// below so a migrated module type never requires editing this file again.
const nodeGraphLiveModuleEvaluators = {};

function evaluateNodeGraphPlanFrame(runtime, sampleRate, frame, frames) {
  const frameValues = new Map();
  const mixInput = (nodeId, port = "In") => (runtime.inputConnections.get(`${nodeId}.${port}`) || []).reduce(
    (sum, connection) => sum + readNodeGraphRuntimePortOutput(
      runtime,
      frameValues,
      connection.sourceNode,
      connection.sourcePort,
      frame,
      frames,
    ),
    0,
  );
  const hasInput = (nodeId, port) => runtime.inputConnections.has(`${nodeId}.${port}`);

  const graphSampleX = (node, nodeId) => {
    const mode = Math.round(readNodeGraphLiveEffectiveParam(runtime, node, "mode", 0, frame, frames, frameValues));
    if (mode <= 0) {
      return mixInput(nodeId);
    }
    const safeRate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);
    const absoluteFrame = Number.isFinite(runtime.absoluteFrame) ? runtime.absoluteFrame : frame;
    const rate = Math.max(0, readNodeGraphLiveEffectiveParam(runtime, node, "rate", 1, frame, frames, frameValues));
    const phase = readNodeGraphLiveEffectiveParam(runtime, node, "phase", 0, frame, frames, frameValues);
    const state = runtime.graphLfoStates.get(nodeId) || createNodeGraphGraphLfoState();
    runtime.graphLfoStates.set(nodeId, state);
    const resetValue = 0;
    if (state.lastReset <= 0 && resetValue > 0) {
      state.resetFrame = absoluteFrame;
    }
    state.lastReset = resetValue;
    const resetFrame = Number.isFinite(state.resetFrame) ? state.resetFrame : 0;
    return wrapNodeSliderValue(((absoluteFrame - resetFrame) / safeRate) * rate + phase, 0, 1);
  };
  const graphOutputValue = (node, nodeId) => {
    const normalizedValue = nodeGraphGraphValueAt(
      nodeGraphGraphForNode(node),
      graphSampleX(node, nodeId),
      nodeGraphGraphSmoothingModeForNode(node),
    );
    const outputMin = readNodeGraphLiveEffectiveParam(runtime, node, "outputMin", 0, frame, frames, frameValues);
    const outputMax = readNodeGraphLiveEffectiveParam(runtime, node, "outputMax", 1, frame, frames, frameValues);
    return outputMin + normalizedValue * (outputMax - outputMin);
  };
  const graphInputValue = (nodeId, graphInput, x, fallback) => {
    const connection = (runtime.graphInputConnections?.get(nodeGraphGraphInputKey(nodeId, graphInput)) || [])[0];
    const source = connection ? runtime.nodes.get(connection.sourceNode) : null;
    if (!source || !nodeGraphModuleIsGraphType(source.type)) {
      return fallback;
    }
    return nodeGraphGraphValueAt(
      nodeGraphGraphForNode(source),
      clampNodeSliderValue(Number(x) || 0, 0, 1),
      nodeGraphGraphSmoothingModeForNode(source),
    );
  };

  for (const nodeId of runtime.order || []) {
    const node = runtime.nodes.get(nodeId);
    let value = 0;

    const liveModuleEvaluator = node?.type ? nodeGraphLiveModuleEvaluators[node.type] : null;
    if (liveModuleEvaluator) {
      value = liveModuleEvaluator({ runtime, node, nodeId, frame, frames, frameValues, mixInput, hasInput, sampleRate, graphInputValue, graphOutputValue });
    }

    frameValues.set(nodeId, value);
    runtime.nodeOutputs?.set(nodeId, value);
  }

  const outputNode = runtime.nodes.get(runtime.outputNode || "output");
  const outputVolume = outputNode
    ? readNodeGraphLiveEffectiveParam(
      runtime,
      outputNode,
      "volume",
      0.1,
      frame,
      frames,
      frameValues,
    )
    : 1;

  const outputMono = mixInput(runtime.outputNode || "output", "Mono");
  return {
    frameValues,
    left: (outputMono + mixInput(runtime.outputNode || "output", "Left")) * outputVolume,
    right: (outputMono + mixInput(runtime.outputNode || "output", "Right")) * outputVolume,
  };
}
