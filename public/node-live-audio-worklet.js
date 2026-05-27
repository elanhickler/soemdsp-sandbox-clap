class NodeLiveAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.connections = [];
    this.inputConnections = new Map();
    this.nodes = new Map();
    this.noiseSeeds = new Map();
    this.outputNode = "output";
    this.phases = new Map();
    this.port.onmessage = (event) => this.handleMessage(event.data || {});
  }

  handleMessage(message) {
    if (message.type === "stop") {
      this.connections = [];
      this.inputConnections = new Map();
      this.nodes = new Map();
      return;
    }
    if (message.type === "setPlan") {
      this.setPlan(message.plan);
    }
  }

  setPlan(plan) {
    const nodes = Array.isArray(plan?.nodes) ? plan.nodes : [];
    const ids = new Set(nodes.map((node) => node.id));
    this.nodes = new Map(nodes.map((node) => [node.id, {
      id: node.id,
      params: node.params || {},
      type: node.type,
    }]));
    this.outputNode = plan?.outputNode || "output";
    this.connections = (Array.isArray(plan?.connections) ? plan.connections : []).filter(
      (connection) =>
        ids.has(connection.sourceNode) &&
        ids.has(connection.destinationNode),
    );
    this.inputConnections = new Map();
    for (const connection of this.connections) {
      const key = this.inputKey(connection.destinationNode, connection.destinationPort);
      const connections = this.inputConnections.get(key) || [];
      connections.push(connection);
      this.inputConnections.set(key, connections);
    }
    for (const id of ids) {
      if (!this.phases.has(id)) {
        this.phases.set(id, 0);
      }
      if (!this.noiseSeeds.has(id)) {
        this.noiseSeeds.set(id, this.stableSeed(id));
      }
    }
  }

  inputKey(node, port) {
    return `${node}.${port}`;
  }

  stableSeed(text) {
    let seed = 0x12345678;
    for (const character of String(text)) {
      seed = (Math.imul(seed ^ character.charCodeAt(0), 16777619)) >>> 0;
    }
    return seed || 0x12345678;
  }

  readParam(node, key, fallback = 0) {
    const value = Number(node?.params?.[key]);
    return Number.isFinite(value) ? value : fallback;
  }

  mixNodeInput(nodeId, frameValues, visiting) {
    const connections = this.inputConnections.get(this.inputKey(nodeId, "In")) || [];
    return connections.reduce(
      (sum, connection) => sum + this.evaluateNode(connection.sourceNode, frameValues, visiting),
      0,
    );
  }

  evaluateNode(nodeId, frameValues, visiting) {
    if (frameValues.has(nodeId)) {
      return frameValues.get(nodeId);
    }
    if (visiting.has(nodeId)) {
      return 0;
    }
    visiting.add(nodeId);

    const node = this.nodes.get(nodeId);
    let value = 0;
    if (node?.type === "osc") {
      const phase = this.phases.get(nodeId) || 0;
      const frequency = this.readParam(node, "frequency", 220);
      value = Math.sin(phase) * this.readParam(node, "level", 0.35);
      this.phases.set(
        nodeId,
        (phase + (Math.PI * 2 * frequency) / sampleRate) % (Math.PI * 2),
      );
    } else if (node?.type === "noise") {
      const seed = (Math.imul(1664525, this.noiseSeeds.get(nodeId) || 0x12345678) + 1013904223) >>> 0;
      this.noiseSeeds.set(nodeId, seed);
      value = ((seed / 0xffffffff) * 2 - 1) * this.readParam(node, "level", 0.12);
    } else if (node?.type === "gain") {
      value = this.mixNodeInput(nodeId, frameValues, visiting) * this.readParam(node, "amount", 1);
    } else if (node?.type === "bias") {
      value = this.mixNodeInput(nodeId, frameValues, visiting) + this.readParam(node, "offset", 0);
    } else if (node?.type === "output") {
      value = this.mixNodeInput(nodeId, frameValues, visiting);
    }

    visiting.delete(nodeId);
    frameValues.set(nodeId, value);
    return value;
  }

  process(_inputs, outputs) {
    const output = outputs[0] || [];
    const frames = output[0]?.length || 128;
    for (let frame = 0; frame < frames; frame += 1) {
      const value = Math.max(
        -0.95,
        Math.min(0.95, this.evaluateNode(this.outputNode, new Map(), new Set())),
      );
      for (const channel of output) {
        channel[frame] = value;
      }
    }
    return true;
  }
}

registerProcessor("node-live-audio-processor", NodeLiveAudioProcessor);
