class NodeLiveAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.inputConnections = new Map();
    this.inputMeterPeak = 0;
    this.inputMeterSamples = 0;
    this.inputMeterSquareSum = 0;
    this.meterClipCount = 0;
    this.meterCounter = 0;
    this.meterPeak = 0;
    this.meterSamples = 0;
    this.meterSquareSum = 0;
    this.modulationConnections = new Map();
    this.nodeOutputs = new Map();
    this.nodes = new Map();
    this.noiseSeeds = new Map();
    this.order = [];
    this.outputNode = "output";
    this.phases = new Map();
    this.planSerial = 0;
    this.sessionId = 0;
    this.smoothers = new Map();
    this.spiralStates = new Map();
    this.triangleStates = new Map();
    this.port.onmessage = (event) => this.handleMessage(event.data || {});
  }

  handleMessage(message) {
    if (message.type === "stop") {
      this.clearPlan();
      return;
    }
    if (message.type === "setPlan") {
      this.setPlan(message.plan, message);
      return;
    }
    if (message.type === "setParams") {
      this.setParams(message.nodes, message);
    }
  }

  clearPlan() {
    this.inputConnections = new Map();
    this.inputMeterPeak = 0;
    this.inputMeterSamples = 0;
    this.inputMeterSquareSum = 0;
    this.meterClipCount = 0;
    this.meterCounter = 0;
    this.meterPeak = 0;
    this.meterSamples = 0;
    this.meterSquareSum = 0;
    this.modulationConnections = new Map();
    this.nodeOutputs = new Map();
    this.nodes = new Map();
    this.order = [];
    this.smoothers = new Map();
    this.spiralStates = new Map();
    this.triangleStates = new Map();
  }

  setPlan(plan, message = {}) {
    const patchFingerprint = message.patchFingerprint || plan?.patchFingerprint || "";
    this.planSerial = message.planSerial || 0;
    this.sessionId = message.sessionId || 0;
    const nodes = Array.isArray(plan?.nodes) ? plan.nodes : [];
    const ids = new Set(nodes.map((node) => node.id));
    this.nodes = new Map(nodes.map((node) => [node.id, {
      id: node.id,
      paramMeta: node.paramMeta || {},
      params: node.params || {},
      type: node.type,
    }]));
    this.order = Array.isArray(plan?.order) ? [...plan.order] : [...ids];
    this.outputNode = plan?.outputNode || "output";
    this.inputConnections = this.buildInputConnectionMap(plan?.connections, ids);
    this.modulationConnections = this.buildModulationConnectionMap(plan?.modulations, ids);

    for (const id of ids) {
      if (!this.nodeOutputs.has(id)) {
        this.nodeOutputs.set(id, 0);
      }
      const node = this.nodes.get(id);
      if (node?.type === "osc" && !this.phases.has(id)) {
        this.phases.set(id, 0);
      }
      if (node?.type === "osc" && !this.triangleStates.has(id)) {
        this.triangleStates.set(id, 0);
      }
      if ((node?.type === "osc" || node?.type === "noise") && !this.noiseSeeds.has(id)) {
        this.noiseSeeds.set(id, this.stableSeed(id));
      }
      if (node?.type === "spiral" && !this.spiralStates.has(id)) {
        this.spiralStates.set(id, this.createSpiralState());
      }
      for (const [key, value] of Object.entries(node?.params || {})) {
        const smootherKey = this.parameterKey(id, key);
        const metadata = node.paramMeta?.[key];
        if (!this.smoothers.has(smootherKey)) {
          this.smoothers.set(smootherKey, this.createSmoother(value, metadata));
        } else {
          this.updateSmoother(this.smoothers.get(smootherKey), value, metadata);
        }
      }
    }

    for (const id of [...this.phases.keys()]) {
      if (!ids.has(id)) {
        this.phases.delete(id);
      }
    }
    for (const id of [...this.triangleStates.keys()]) {
      if (!ids.has(id)) {
        this.triangleStates.delete(id);
      }
    }
    for (const id of [...this.noiseSeeds.keys()]) {
      if (!ids.has(id)) {
        this.noiseSeeds.delete(id);
      }
    }
    for (const id of [...this.nodeOutputs.keys()]) {
      if (!ids.has(id)) {
        this.nodeOutputs.delete(id);
      }
    }
    for (const id of [...this.spiralStates.keys()]) {
      if (!ids.has(id)) {
        this.spiralStates.delete(id);
      }
    }
    for (const key of [...this.smoothers.keys()]) {
      const [nodeId, parameter] = key.split(".");
      if (!ids.has(nodeId) || !(parameter in (this.nodes.get(nodeId)?.params || {}))) {
        this.smoothers.delete(key);
      }
    }
    this.port.postMessage({
      connectionCount: Array.isArray(plan?.connections) ? plan.connections.length : 0,
      feedbackConnectionCount: Array.isArray(plan?.feedbackConnections) ? plan.feedbackConnections.length : 0,
      feedbackModulationCount: Array.isArray(plan?.feedbackModulations) ? plan.feedbackModulations.length : 0,
      feedbackModulations: (Array.isArray(plan?.feedbackModulations) ? plan.feedbackModulations : []).map(
        (modulation) =>
          `${modulation.sourceNode}.${modulation.sourcePort} -> ${modulation.destinationNode}.${modulation.destinationParam}`,
      ),
      feedbackSignals: (Array.isArray(plan?.feedbackConnections) ? plan.feedbackConnections : []).map(
        (connection) =>
          `${connection.sourceNode}.${connection.sourcePort} -> ${connection.destinationNode}.${connection.destinationPort}`,
      ),
      modulationCount: Array.isArray(plan?.modulations) ? plan.modulations.length : 0,
      nodeCount: this.nodes.size,
      order: [...this.order],
      patchFingerprint,
      planSerial: this.planSerial,
      sessionId: this.sessionId,
      stateReadCount: (
        (Array.isArray(plan?.feedbackConnections) ? plan.feedbackConnections.length : 0) +
        (Array.isArray(plan?.feedbackModulations) ? plan.feedbackModulations.length : 0)
      ),
      type: "planApplied",
    });
  }

  setParams(nodes, message = {}) {
    const patchFingerprint = message.patchFingerprint || "";
    this.planSerial = message.planSerial || 0;
    this.sessionId = message.sessionId || 0;
    let parameterCount = 0;
    for (const node of Array.isArray(nodes) ? nodes : []) {
      const current = this.nodes.get(node.id);
      if (!current) {
        continue;
      }
      current.params = { ...(node.params || {}) };
      current.paramMeta = { ...(node.paramMeta || {}) };
      parameterCount += Object.keys(current.params || {}).length;
      for (const [key, value] of Object.entries(current.params || {})) {
        const smootherKey = this.parameterKey(node.id, key);
        const metadata = current.paramMeta?.[key];
        if (!this.smoothers.has(smootherKey)) {
          this.smoothers.set(smootherKey, this.createSmoother(value, metadata));
        } else {
          this.updateSmoother(this.smoothers.get(smootherKey), value, metadata);
        }
      }
    }
    this.port.postMessage({
      nodeCount: this.nodes.size,
      order: [...this.order],
      parameterCount,
      patchFingerprint,
      planSerial: this.planSerial,
      sessionId: this.sessionId,
      type: "paramsApplied",
    });
  }

  buildInputConnectionMap(connections, ids) {
    const map = new Map();
    for (const connection of Array.isArray(connections) ? connections : []) {
      if (!ids.has(connection.sourceNode) || !ids.has(connection.destinationNode)) {
        continue;
      }
      const key = this.inputKey(connection.destinationNode, connection.destinationPort);
      const list = map.get(key) || [];
      list.push({ ...connection });
      map.set(key, list);
    }
    return map;
  }

  buildModulationConnectionMap(modulations, ids) {
    const map = new Map();
    for (const modulation of Array.isArray(modulations) ? modulations : []) {
      if (!ids.has(modulation.sourceNode) || !ids.has(modulation.destinationNode)) {
        continue;
      }
      const key = this.parameterKey(modulation.destinationNode, modulation.destinationParam);
      const list = map.get(key) || [];
      list.push({ ...modulation });
      map.set(key, list);
    }
    return map;
  }

  inputKey(node, port) {
    return `${node}.${port}`;
  }

  parameterKey(node, parameter) {
    return `${node}.${parameter}`;
  }

  stableSeed(text) {
    let seed = 0x12345678;
    for (const character of String(text)) {
      seed = (Math.imul(seed ^ character.charCodeAt(0), 16777619)) >>> 0;
    }
    return seed || 0x12345678;
  }

  wrapValue(value, min, max) {
    const range = max - min;
    if (!Number.isFinite(range) || range <= 0) {
      return min;
    }
    return min + ((((value - min) % range) + range) % range);
  }

  clampValue(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  outputSampleClipped(value) {
    return value < -0.95 || value > 0.95;
  }

  shortestWrapDelta(from, to, min, max) {
    const range = max - min;
    if (!Number.isFinite(range) || range <= 0) {
      return to - from;
    }
    let delta = to - from;
    if (delta > range / 2) {
      delta -= range;
    } else if (delta < -range / 2) {
      delta += range;
    }
    return delta;
  }

  createSmoother(initialValue, metadata = {}) {
    const value = Number(initialValue);
    const safeValue = Number.isFinite(value) ? value : 0;
    return {
      current: safeValue,
      linearSmoothing: metadata?.linearSmoothing !== false,
      max: Number.isFinite(Number(metadata?.max)) ? Number(metadata.max) : 1,
      min: Number.isFinite(Number(metadata?.min)) ? Number(metadata.min) : 0,
      target: safeValue,
      wraparound: Boolean(metadata?.wraparound),
    };
  }

  updateSmoother(smoother, targetValue, metadata = {}) {
    const value = Number(targetValue);
    smoother.target = Number.isFinite(value) ? value : smoother.target;
    smoother.linearSmoothing = metadata?.linearSmoothing !== false;
    smoother.max = Number.isFinite(Number(metadata?.max)) ? Number(metadata.max) : smoother.max;
    smoother.min = Number.isFinite(Number(metadata?.min)) ? Number(metadata.min) : smoother.min;
    smoother.wraparound = Boolean(metadata?.wraparound);
    if (!smoother.linearSmoothing) {
      smoother.current = smoother.target;
    }
  }

  readSmoothedParameter(node, key, fallback, frame, frames) {
    const smoother = this.smoothers.get(this.parameterKey(node?.id, key));
    if (!smoother) {
      const value = Number(node?.params?.[key]);
      return Number.isFinite(value) ? value : fallback;
    }
    if (!smoother.linearSmoothing || frames <= 1) {
      return smoother.target;
    }
    const progress = (frame + 1) / frames;
    const delta = smoother.wraparound
      ? this.shortestWrapDelta(smoother.current, smoother.target, smoother.min, smoother.max)
      : smoother.target - smoother.current;
    const value = smoother.current + delta * progress;
    return smoother.wraparound
      ? this.wrapValue(value, smoother.min, smoother.max)
      : value;
  }

  finishSmoothing() {
    for (const smoother of this.smoothers.values()) {
      smoother.current = smoother.wraparound
        ? this.wrapValue(smoother.target, smoother.min, smoother.max)
        : smoother.target;
    }
  }

  applyParameterBounds(value, metadata = {}) {
    const min = Number(metadata.min);
    const max = Number(metadata.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
      return value;
    }
    return metadata.wraparound
      ? this.wrapValue(value, min, max)
      : this.clampValue(value, min, max);
  }

  readRuntimeOutput(frameValues, nodeId, port = "Out") {
    const output = frameValues?.has(nodeId)
      ? frameValues.get(nodeId)
      : this.nodeOutputs.get(nodeId);
    if (output && typeof output === "object") {
      return Number(output[port] ?? output.Out ?? 0) || 0;
    }
    return Number(output) || 0;
  }

  parameterOutputExists(node, port) {
    return Boolean(node?.params && Object.hasOwn(node.params, port));
  }

  normalizeParameterOutputValue(value, metadata = {}) {
    return this.parameterValueToNormalizedSignal(value, metadata);
  }

  parameterSkewExponent(metadata = {}) {
    if (!metadata.nonlinearSlider) {
      return 1;
    }
    const min = Number(metadata.min);
    const max = Number(metadata.max);
    const mid = Number(metadata.mid);
    const range = max - min;
    if (!Number.isFinite(range) || range <= 0 || !Number.isFinite(mid)) {
      return 1;
    }
    const normalizedMid = this.clampValue((mid - min) / range, 0.000001, 0.999999);
    return Math.log(normalizedMid) / Math.log(0.5);
  }

  parameterValueToNormalizedSignal(value, metadata = {}) {
    const min = Number(metadata.min);
    const max = Number(metadata.max);
    const range = max - min;
    if (!Number.isFinite(range) || range <= 0) {
      return 0;
    }
    const bounded = metadata.wraparound
      ? this.wrapValue(Number(value) || 0, min, max)
      : this.clampValue(Number(value) || 0, min, max);
    const normalizedValue = this.clampValue((bounded - min) / range, 0, 1);
    return this.clampValue(normalizedValue ** (1 / this.parameterSkewExponent(metadata)), 0, 1);
  }

  normalizedSignalToParameterValue(signal, metadata = {}) {
    const min = Number(metadata.min);
    const max = Number(metadata.max);
    const range = max - min;
    if (!Number.isFinite(range) || range <= 0) {
      return Number.isFinite(min) ? min : 0;
    }
    const normalizedSignal = metadata.wraparound
      ? this.wrapValue(Number(signal) || 0, 0, 1)
      : this.clampValue(Number(signal) || 0, 0, 1);
    const normalizedValue = normalizedSignal ** this.parameterSkewExponent(metadata);
    return this.applyParameterBounds(min + range * normalizedValue, metadata);
  }

  readRuntimePortOutput(frameValues, nodeId, port = "Out", frame = 0, frames = 1) {
    const node = this.nodes.get(nodeId);
    if (!this.parameterOutputExists(node, port)) {
      return this.readRuntimeOutput(frameValues, nodeId, port);
    }
    const value = this.readSmoothedParameter(node, port, 0, frame, frames);
    return this.normalizeParameterOutputValue(value, node?.paramMeta?.[port] || {});
  }

  readEffectiveParameter(node, key, fallback, frame, frames, frameValues) {
    const base = this.readSmoothedParameter(node, key, fallback, frame, frames);
    const metadata = node?.paramMeta?.[key] || {};
    const modulations = this.modulationConnections.get(this.parameterKey(node?.id, key)) || [];
    const modulationSignal = modulations.reduce(
      (sum, modulation) => sum + this.clampValue(this.readRuntimePortOutput(
        frameValues,
        modulation.sourceNode,
        modulation.sourcePort,
        frame,
        frames,
      ), 0, 1),
      0,
    );
    const baseSignal = this.parameterValueToNormalizedSignal(base, metadata);
    return this.normalizedSignalToParameterValue(baseSignal + modulationSignal, metadata);
  }

  phaseRadians(value) {
    return this.wrapValue(Number(value) || 0, 0, 1) * Math.PI * 2;
  }

  nextNoiseSample(nodeId) {
    const seed = (Math.imul(1664525, this.noiseSeeds.get(nodeId) || 0x12345678) + 1013904223) >>> 0;
    this.noiseSeeds.set(nodeId, seed);
    return (seed / 0xffffffff) * 2 - 1;
  }

  polyBlep(phaseCycle, phaseIncrement) {
    const dt = this.clampValue(Math.abs(Number(phaseIncrement) || 0), 1e-6, 0.5);
    if (phaseCycle < dt) {
      const t = phaseCycle / dt;
      return t + t - t * t - 1;
    }
    if (phaseCycle > 1 - dt) {
      const t = (phaseCycle - 1) / dt;
      return t * t + t + t + 1;
    }
    return 0;
  }

  polyBlepSquare(phaseCycle, phaseIncrement) {
    let value = phaseCycle < 0.5 ? 1 : -1;
    value += this.polyBlep(phaseCycle, phaseIncrement);
    value -= this.polyBlep(this.wrapValue(phaseCycle + 0.5, 0, 1), phaseIncrement);
    return value;
  }

  oscillatorSample(nodeId, phase, phaseIncrement, waveform) {
    const phaseCycle = this.wrapValue(phase / (Math.PI * 2), 0, 1);
    switch (Math.round(Number(waveform) || 0)) {
      case 1:
        return this.polyBlepSquare(phaseCycle, phaseIncrement);
      case 2:
        {
          const triangle = this.triangleStates.get(nodeId) || 0;
          const nextTriangle = (triangle + this.polyBlepSquare(phaseCycle, phaseIncrement) * phaseIncrement * 4) * 0.995;
          this.triangleStates.set(nodeId, this.clampValue(nextTriangle, -1, 1));
          return this.clampValue(nextTriangle, -1, 1);
        }
      case 3:
        return Math.sin(phase);
      case 4:
        return this.nextNoiseSample(nodeId);
      case 0:
      default:
        return phaseCycle * 2 - 1 - this.polyBlep(phaseCycle, phaseIncrement);
    }
  }

  createSpiralState() {
    return {
      morph: 0,
      phase: 0,
      position: 0,
      rotX: 0,
      rotY: 0,
      zHistory: 0,
    };
  }

  spiralWrap01(value) {
    return value - Math.floor(value);
  }

  spiralFmod(value, divisor) {
    return value - Math.trunc(value / divisor) * divisor;
  }

  spiralTrisaw(phase, sharp) {
    const wrapped = this.spiralWrap01(phase);
    const warp = Math.max(0.001, Math.min(0.999, sharp));
    return wrapped < warp ? wrapped / warp : (1 - wrapped) / (1 - warp);
  }

  spiralNextPhasor(state, key, frequency, offset, sampleRate, bipolar = false) {
    const base = Number(state[key]) || 0;
    const current = this.spiralWrap01(base + offset);
    state[key] = this.spiralWrap01(base + frequency / sampleRate);
    return bipolar ? current * 2 - 1 : current;
  }

  spiralRotate(inX, inY, inZ, rotX, rotY) {
    const cosRotX = Math.cos(rotX);
    const sinRotX = Math.sin(rotX);
    const cosRotY = Math.cos(rotY);
    const sinRotY = Math.sin(rotY);
    const help11 = inX * cosRotX - inY * sinRotX;
    const help12 = inX * sinRotX + inY * cosRotX;
    const help21 = help11 * cosRotY - inZ * sinRotY;
    const help22 = help11 * sinRotY + inZ * cosRotY;
    return { x: help12, y: help21, z: help22 };
  }

  spiralShape(lophas, phasor, dense, div, morph) {
    const tau = Math.PI * 2;
    const piOver2 = Math.PI / 2;
    const piOver4 = Math.PI / 4;
    const clampMorph01 = this.clampValue(morph, 0, 1);
    const clampMorph02 = this.clampValue(morph, 0, 2);
    const formula001 = piOver2 * (lophas - 0.5) * clampMorph02 + piOver4;
    let loSin = Math.sin(formula001);
    let loCos = Math.cos(formula001);
    const formula002 = Math.pow(clampMorph01, 2);
    const oneZDiv = 1 / div;
    const loY = formula002 * (1 - oneZDiv * loSin);
    const loZ = formula002 * (1 - oneZDiv * loCos);
    const formula003 = Math.PI / (2 + 6 * (1 - clampMorph01)) * (lophas - 0.5) * clampMorph02 + piOver4;
    loSin = Math.sin(formula003);
    loCos = Math.cos(formula003);
    const tauPhasor = tau * phasor;
    const sp0Sin = Math.sin(tauPhasor);
    const sp0Cos = Math.cos(tauPhasor);
    const spiral0X = sp0Sin;
    const spiral0Y = sp0Cos * loSin;
    const spiral0Z = sp0Cos * loCos;
    let sp1Sin = Math.sin(dense * tauPhasor - piOver2);
    const sp1Cos = Math.cos(dense * tauPhasor - piOver2);
    sp1Sin *= -1;
    const sp1SinTimesSp0Sin = sp1Sin * sp0Sin;
    const spiral1X = div * sp1SinTimesSp0Sin;
    const spiral1Y = div * ((sp1Sin * sp0Cos) * loSin + sp1Cos * loCos);
    const spiral1Z = div * (sp1Cos * -loSin + (sp1Sin * sp0Cos) * loCos);
    let sp2Cos = Math.sin(dense * dense * tau * phasor);
    const sp2Sin = Math.cos(dense * dense * tau * phasor);
    sp2Cos *= -1;
    const divSquared = div * div;
    const spiral2X = divSquared * (sp2Cos * sp0Cos + sp2Sin * sp1SinTimesSp0Sin);
    const spiral2Y = divSquared * ((sp2Cos * -sp0Sin + sp2Sin * sp1Sin * sp0Cos) * loSin + (sp2Sin * sp1Cos) * loCos);
    const spiral2Z = divSquared * ((sp2Sin * sp1Cos) * -loSin + (sp2Cos * -sp0Sin + sp2Sin * sp1Sin * sp0Cos) * loCos);
    let waveX = spiral0X + spiral1X + spiral2X;
    let waveY = loY + spiral0Y + spiral1Y + spiral2Y;
    let waveZ = loZ + spiral0Z + spiral1Z + spiral2Z;
    let x = Math.exp(morph * Math.log(div));
    waveX *= x;
    waveY *= x;
    waveZ *= x;
    let y = 0;
    const formula004 = Math.exp(morph * Math.log(dense)) / 4;
    if (formula004 < 1) {
      y = Math.pow(1 - formula004, 2);
    }
    x = x * Math.sin(piOver4) * y;
    waveX -= x;
    waveY += x;
    return this.spiralRotate(waveX, waveY, waveZ, 0, 0);
  }

  spiralRender(inX, inY, inZ, zDepth) {
    const formula = zDepth * 1.25 * (inZ / 2 + 0.5);
    const multiplier = 1 + zDepth;
    return {
      left: (inX - formula * inX) * multiplier,
      right: (inY - formula * inY) * multiplier,
    };
  }

  jerobeamSpiralSample(options) {
    const tau = Math.PI * 2;
    const piOver2 = Math.PI / 2;
    const state = options.state;
    const dense = Math.max(Math.abs(options.density), 1e-6);
    const div = Math.max(options.size, 0.1);
    const logDense = Math.log(dense);
    const zDarkness = Math.pow(Math.pow(options.zAmount, 2) * 5 + 1, state.zHistory || 0);
    const mainPhasor = this.spiralNextPhasor(state, "phase", options.frequency * zDarkness, 0, options.sampleRate);
    const fphasEnds = this.spiralTrisaw(mainPhasor, options.sharp);
    const fphasMids = options.sharpCurveMult * (Math.asin((Math.asin(fphasEnds * 2 - 1) / Math.PI + 0.5) * 2 - 1) / Math.PI + 0.5);
    const lophas = options.sharpCurve * fphasMids + (1 - options.sharpCurve) * fphasEnds;
    const morph = this.spiralNextPhasor(state, "morph", options.morphSpeed, options.morph, options.sampleRate, true) + 0.5;
    let morph2 = morph + 1;
    if (morph2 > 1.5) {
      morph2 -= 2;
    }
    const fmodLophas = this.spiralFmod(lophas - 0.5, 1);
    let phas = this.spiralFmod(fmodLophas * Math.exp(morph * logDense) / 4 + 0.375, 1);
    const phas2 = this.spiralFmod(fmodLophas * Math.exp(morph2 * logDense) / 4 + 0.375, 1);
    phas += this.spiralNextPhasor(state, "position", options.positionSpeed, options.position, options.sampleRate);
    const wave1 = this.spiralShape(lophas, phas, dense, div, morph);
    const wave2 = this.spiralShape(lophas, phas2, dense, div, morph2);
    const switchAmount = Math.sin(Math.PI * morph) / 2 + 0.5;
    let waveX = wave1.x * switchAmount + wave2.x * (1 - switchAmount);
    let waveY = wave1.y * switchAmount + wave2.y * (1 - switchAmount);
    let waveZ = wave1.z * switchAmount + wave2.z * (1 - switchAmount);
    let volumeCorrection = 1 / (1 + div + div * div);
    const halfZDepth = options.zDepth / 2;
    volumeCorrection = volumeCorrection + halfZDepth - volumeCorrection * halfZDepth;
    waveX *= volumeCorrection;
    waveY *= volumeCorrection;
    waveZ *= volumeCorrection;
    waveY += 0.25;
    waveZ += 0.36;
    const rotated = this.spiralRotate(
      waveX,
      waveY,
      waveZ,
      -tau * this.spiralNextPhasor(state, "rotX", options.rotXSpeed, options.rotX, options.sampleRate),
      tau * this.spiralNextPhasor(state, "rotY", options.rotYSpeed, options.rotY, options.sampleRate) - piOver2,
    );
    const stereo = this.spiralRender(rotated.x, rotated.y, rotated.z, options.zDepth);
    state.zHistory = rotated.z;
    return { ...stereo, x: rotated.x, y: rotated.y, z: rotated.z };
  }

  evaluateFrame(frame, frames, inputs = []) {
    const frameValues = new Map();
    const mixInput = (nodeId, port = "In") => (
      this.inputConnections.get(this.inputKey(nodeId, port)) || []
    ).reduce((sum, connection) => sum + this.readRuntimePortOutput(
      frameValues,
      connection.sourceNode,
      connection.sourcePort,
      frame,
      frames,
    ), 0);

    for (const nodeId of this.order) {
      const node = this.nodes.get(nodeId);
      let value = 0;
      if (node?.type === "audioInput") {
        const input = inputs[0] || [];
        const leftChannel = input[0] || input[1] || null;
        const rightChannel = input[1] || input[0] || null;
        const left = Number(leftChannel?.[frame]) || 0;
        const right = Number(rightChannel?.[frame]) || left;
        const level = this.readEffectiveParameter(node, "level", 0.35, frame, frames, frameValues);
        value = {
          Left: left * level,
          Out: ((left + right) * 0.5) * level,
          Right: right * level,
        };
      } else if (node?.type === "osc") {
        const phase = this.phases.get(nodeId) || 0;
        const phaseOffset = this.phaseRadians(
          this.readEffectiveParameter(node, "phase", 0, frame, frames, frameValues),
        );
        const frequency = this.readEffectiveParameter(
          node,
          "frequency",
          220,
          frame,
          frames,
          frameValues,
        );
        const waveform = this.readEffectiveParameter(
          node,
          "waveform",
          0,
          frame,
          frames,
          frameValues,
        );
        const phaseIncrement = frequency / sampleRate;
        value = this.oscillatorSample(nodeId, phase + phaseOffset, phaseIncrement, waveform) *
          this.readEffectiveParameter(node, "level", 0.35, frame, frames, frameValues);
        this.phases.set(
          nodeId,
          (phase + (Math.PI * 2 * frequency) / sampleRate) % (Math.PI * 2),
        );
      } else if (node?.type === "noise") {
        value = this.nextNoiseSample(nodeId) *
          this.readEffectiveParameter(node, "level", 0.12, frame, frames, frameValues);
      } else if (node?.type === "spiral") {
        const state = this.spiralStates.get(nodeId) || this.createSpiralState();
        this.spiralStates.set(nodeId, state);
        const read = (key, fallback) => this.readEffectiveParameter(
          node,
          key,
          fallback,
          frame,
          frames,
          frameValues,
        );
        const spiral = this.jerobeamSpiralSample({
          density: read("density", 1),
          frequency: read("frequency", 440),
          morph: read("morph", 0),
          morphSpeed: read("morphSpeed", 0),
          position: read("position", 0),
          positionSpeed: read("positionSpeed", 0),
          rotX: read("rotX", 0),
          rotXSpeed: read("rotXSpeed", 0),
          rotY: read("rotY", 0),
          rotYSpeed: read("rotYSpeed", 0),
          sampleRate,
          sharp: read("sharp", 0.5),
          sharpCurve: read("sharpCurve", 0),
          sharpCurveMult: read("sharpCurveMult", 1),
          size: read("size", 0.5),
          state,
          zAmount: read("zAmount", 0),
          zDepth: read("zDepth", 0),
        });
        const level = read("level", 0.35);
        value = {
          X: spiral.x * level,
          Y: spiral.y * level,
          Z: spiral.z * level,
        };
      } else if (node?.type === "gain") {
        value = mixInput(nodeId) *
          this.readEffectiveParameter(node, "amount", 1, frame, frames, frameValues);
      } else if (node?.type === "bias") {
        value = mixInput(nodeId) +
          this.readEffectiveParameter(node, "offset", 0, frame, frames, frameValues);
      } else if (node?.type === "output") {
        value = (mixInput(nodeId, "Left") + mixInput(nodeId, "Right")) * 0.5;
      }
      frameValues.set(nodeId, value);
      this.nodeOutputs.set(nodeId, value);
    }

    const outputNode = this.nodes.get(this.outputNode || "output");
    const outputVolume = outputNode
      ? this.readEffectiveParameter(outputNode, "volume", 1, frame, frames, frameValues)
      : 1;

    return {
      left: mixInput(this.outputNode || "output", "Left") * outputVolume,
      right: mixInput(this.outputNode || "output", "Right") * outputVolume,
    };
  }

  process(inputs, outputs) {
    const output = outputs[0] || [];
    const frames = output[0]?.length || 128;
    const input = inputs[0] || [];
    if (!this.nodes.size || !this.order.length) {
      for (const channel of output) {
        channel.fill(0);
      }
      return true;
    }

    for (let frame = 0; frame < frames; frame += 1) {
      const inputLeft = Number(input[0]?.[frame]) || 0;
      const inputRight = Number(input[1]?.[frame]) || inputLeft;
      this.inputMeterPeak = Math.max(this.inputMeterPeak, Math.abs(inputLeft), Math.abs(inputRight));
      this.inputMeterSquareSum += (inputLeft * inputLeft + inputRight * inputRight) * 0.5;
      this.inputMeterSamples += 1;
      const frameOutput = this.evaluateFrame(frame, frames, inputs);
      if (this.outputSampleClipped(frameOutput.left)) {
        this.meterClipCount += 1;
      }
      if (this.outputSampleClipped(frameOutput.right)) {
        this.meterClipCount += 1;
      }
      const left = this.clampValue(frameOutput.left, -0.95, 0.95);
      const right = this.clampValue(frameOutput.right, -0.95, 0.95);
      this.meterPeak = Math.max(this.meterPeak, Math.abs(left), Math.abs(right));
      this.meterSquareSum += (left * left + right * right) * 0.5;
      this.meterSamples += 1;
      for (let channelIndex = 0; channelIndex < output.length; channelIndex += 1) {
        output[channelIndex][frame] = channelIndex === 0 ? left : right;
      }
    }
    this.finishSmoothing();
    this.meterCounter += frames;
    if (this.meterCounter >= sampleRate / 10) {
      this.port.postMessage({
        clipCount: this.meterClipCount,
        inputPeak: this.inputMeterPeak,
        inputRms: Math.sqrt(this.inputMeterSquareSum / Math.max(1, this.inputMeterSamples)),
        peak: this.meterPeak,
        sessionId: this.sessionId,
        rms: Math.sqrt(this.meterSquareSum / Math.max(1, this.meterSamples)),
        type: "meter",
      });
      this.meterCounter = 0;
      this.inputMeterPeak = 0;
      this.inputMeterSamples = 0;
      this.inputMeterSquareSum = 0;
      this.meterClipCount = 0;
      this.meterPeak = 0;
      this.meterSamples = 0;
      this.meterSquareSum = 0;
    }
    return true;
  }
}

registerProcessor("node-live-audio-processor", NodeLiveAudioProcessor);
