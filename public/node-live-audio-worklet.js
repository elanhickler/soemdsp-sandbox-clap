class NodeLiveAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.inputConnections = new Map();
    this.meterCounter = 0;
    this.meterPeak = 0;
    this.meterSamples = 0;
    this.meterSquareSum = 0;
    this.modulationConnections = new Map();
    this.nodes = new Map();
    this.noiseSeeds = new Map();
    this.order = [];
    this.outputNode = "output";
    this.phases = new Map();
    this.planSerial = 0;
    this.sessionId = 0;
    this.smoothers = new Map();
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
    this.modulationConnections = new Map();
    this.nodes = new Map();
    this.order = [];
    this.smoothers = new Map();
  }

  setPlan(plan, message = {}) {
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
      const node = this.nodes.get(id);
      if (node?.type === "osc" && !this.phases.has(id)) {
        this.phases.set(id, 0);
      }
      if ((node?.type === "osc" || node?.type === "noise") && !this.noiseSeeds.has(id)) {
        this.noiseSeeds.set(id, this.stableSeed(id));
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
    for (const id of [...this.noiseSeeds.keys()]) {
      if (!ids.has(id)) {
        this.noiseSeeds.delete(id);
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
      modulationCount: Array.isArray(plan?.modulations) ? plan.modulations.length : 0,
      nodeCount: this.nodes.size,
      order: [...this.order],
      planSerial: this.planSerial,
      sessionId: this.sessionId,
      type: "planApplied",
    });
  }

  setParams(nodes, message = {}) {
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

  readEffectiveParameter(node, key, fallback, frame, frames, frameValues) {
    const base = this.readSmoothedParameter(node, key, fallback, frame, frames);
    const metadata = node?.paramMeta?.[key] || {};
    const min = Number(metadata.min);
    const max = Number(metadata.max);
    const depth = Number.isFinite(min) && Number.isFinite(max) ? (max - min) * 0.5 : 0;
    const modulations = this.modulationConnections.get(this.parameterKey(node?.id, key)) || [];
    const modulationValue = modulations.reduce(
      (sum, modulation) => sum + (frameValues.get(modulation.sourceNode) || 0) * depth,
      0,
    );
    return this.applyParameterBounds(base + modulationValue, metadata);
  }

  phaseRadians(value) {
    return this.wrapValue(Number(value) || 0, 0, 1) * Math.PI * 2;
  }

  nextNoiseSample(nodeId) {
    const seed = (Math.imul(1664525, this.noiseSeeds.get(nodeId) || 0x12345678) + 1013904223) >>> 0;
    this.noiseSeeds.set(nodeId, seed);
    return (seed / 0xffffffff) * 2 - 1;
  }

  oscillatorSample(nodeId, phase, waveform) {
    const phaseCycle = this.wrapValue(phase / (Math.PI * 2), 0, 1);
    switch (Math.round(Number(waveform) || 0)) {
      case 1:
        return phaseCycle < 0.5 ? 1 : -1;
      case 2:
        return 1 - Math.abs(phaseCycle - 0.5) * 4;
      case 3:
        return Math.sin(phase);
      case 4:
        return this.nextNoiseSample(nodeId);
      case 0:
      default:
        return phaseCycle * 2 - 1;
    }
  }

  evaluateFrame(frame, frames) {
    const frameValues = new Map();
    const mixInput = (nodeId, port = "In") => (
      this.inputConnections.get(this.inputKey(nodeId, port)) || []
    ).reduce((sum, connection) => sum + (frameValues.get(connection.sourceNode) || 0), 0);

    for (const nodeId of this.order) {
      const node = this.nodes.get(nodeId);
      let value = 0;
      if (node?.type === "osc") {
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
        value = this.oscillatorSample(nodeId, phase + phaseOffset, waveform) *
          this.readEffectiveParameter(node, "level", 0.35, frame, frames, frameValues);
        this.phases.set(
          nodeId,
          (phase + (Math.PI * 2 * frequency) / sampleRate) % (Math.PI * 2),
        );
      } else if (node?.type === "noise") {
        value = this.nextNoiseSample(nodeId) *
          this.readEffectiveParameter(node, "level", 0.12, frame, frames, frameValues);
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
    }

    return {
      left: mixInput(this.outputNode || "output", "Left"),
      right: mixInput(this.outputNode || "output", "Right"),
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0] || [];
    const frames = output[0]?.length || 128;
    if (!this.nodes.size || !this.order.length) {
      for (const channel of output) {
        channel.fill(0);
      }
      return true;
    }

    for (let frame = 0; frame < frames; frame += 1) {
      const frameOutput = this.evaluateFrame(frame, frames);
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
        peak: this.meterPeak,
        sessionId: this.sessionId,
        rms: Math.sqrt(this.meterSquareSum / Math.max(1, this.meterSamples)),
        type: "meter",
      });
      this.meterCounter = 0;
      this.meterPeak = 0;
      this.meterSamples = 0;
      this.meterSquareSum = 0;
    }
    return true;
  }
}

registerProcessor("node-live-audio-processor", NodeLiveAudioProcessor);
