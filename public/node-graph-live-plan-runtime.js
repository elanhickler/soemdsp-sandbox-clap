function nodeGraphBuildLivePlan() {
  const compiled = compileNodeGraphExecutionPlan();
  if (!compiled.valid) {
    const error = new Error(compiled.issues.join(", "));
    error.issues = [...compiled.issues];
    throw error;
  }

  const activeNodeIds = nodeGraphActiveNodeIds(compiled);
  const activeSignalConnections = nodeGraphActiveSignalConnections(compiled)
    .map((connection) => ({ ...connection }));
  const activeModulations = nodeGraphActiveModulations(compiled)
    .map((modulation) => ({ ...modulation }));

  return {
    connections: activeSignalConnections,
    feedbackConnections: compiled.feedbackConnections.map((connection) => ({ ...connection })),
    feedbackModulations: compiled.feedbackModulations.map((modulation) => ({ ...modulation })),
    modulations: activeModulations,
    nodes: nodeGraphBuildLiveParameterNodes(activeNodeIds),
    order: [...compiled.order],
    outputNode: compiled.outputNode,
    patchFingerprint: nodeGraphPatchFingerprint(),
    sourceNodes: [...compiled.sourceNodes],
  };
}

function nodeGraphBuildLiveParameterNodes(activeNodeIds = null) {
  const activeIds = activeNodeIds instanceof Set ? activeNodeIds : null;
  return nodeGraphMvp.patch.nodes
    .filter((node) => !activeIds || activeIds.has(node.id))
    .map((node) => {
      const definition = nodeGraphModuleDefinitions[node.type];
      const params = {};
      const paramMeta = {};
      for (const parameter of definition.parameters || []) {
        const value = nodeGraphReadPatchParameterValue(node, parameter.key);
        params[parameter.key] = Number.isFinite(value)
          ? value
          : nodeGraphParameterFallback(node.type, parameter.key);
        paramMeta[parameter.key] = nodeGraphReadPatchParameterMetadata(node, parameter.key);
      }
      return {
        id: node.id,
        paramMeta,
        params,
        type: node.type,
      };
    });
}

function createNodeGraphLiveRuntime(plan) {
  const nodes = new Map((plan.nodes || []).map((node) => [node.id, node]));
  const inputConnections = new Map();
  for (const connection of plan.connections || []) {
    const key = `${connection.destinationNode}.${connection.destinationPort}`;
    const connections = inputConnections.get(key) || [];
    connections.push(connection);
    inputConnections.set(key, connections);
  }
  const modulationConnections = new Map();
  for (const modulation of plan.modulations || []) {
    const key = nodeGraphParameterKey(modulation.destinationNode, modulation.destinationParam);
    const modulations = modulationConnections.get(key) || [];
    modulations.push(modulation);
    modulationConnections.set(key, modulations);
  }
  const phases = new Map();
  const noiseSeeds = new Map();
  const spiralStates = new Map();
  const smoothers = new Map();
  const triangleStates = new Map();
  for (const node of plan.nodes || []) {
    if (node.type === "osc") {
      phases.set(node.id, 0);
      triangleStates.set(node.id, 0);
    }
    if (node.type === "osc" || node.type === "noise") {
      noiseSeeds.set(node.id, nodeGraphStableSeed(node.id));
    }
    if (node.type === "spiral") {
      spiralStates.set(node.id, createJerobeamSpiralState());
    }
    for (const [key, value] of Object.entries(node.params || {})) {
      smoothers.set(
        nodeGraphParameterKey(node.id, key),
        createNodeGraphParameterSmoother(value, node.paramMeta?.[key]),
      );
    }
  }
  return {
    inputConnections,
    meterCounter: 0,
    meterClipCount: 0,
    meterPeak: 0,
    meterSamples: 0,
    meterSquareSum: 0,
    modulationConnections,
    nodeOutputs: new Map((plan.nodes || []).map((node) => [node.id, 0])),
    nodes,
    noiseSeeds,
    order: [...(plan.order || [])],
    outputNode: plan.outputNode || "output",
    phases,
    smoothers,
    spiralStates,
    triangleStates,
  };
}

function updateNodeGraphLiveRuntimePlan(runtime, plan) {
  runtime.nodes = new Map((plan.nodes || []).map((node) => [node.id, node]));
  runtime.inputConnections = new Map();
  for (const connection of plan.connections || []) {
    const key = `${connection.destinationNode}.${connection.destinationPort}`;
    const connections = runtime.inputConnections.get(key) || [];
    connections.push(connection);
    runtime.inputConnections.set(key, connections);
  }
  runtime.modulationConnections = new Map();
  for (const modulation of plan.modulations || []) {
    const key = nodeGraphParameterKey(modulation.destinationNode, modulation.destinationParam);
    const modulations = runtime.modulationConnections.get(key) || [];
    modulations.push(modulation);
    runtime.modulationConnections.set(key, modulations);
  }
  runtime.order = [...(plan.order || [])];
  runtime.outputNode = plan.outputNode || "output";
  const nodeIds = new Set(runtime.nodes.keys());
  if (!runtime.nodeOutputs) {
    runtime.nodeOutputs = new Map();
  }
  if (!runtime.spiralStates) {
    runtime.spiralStates = new Map();
  }
  if (!runtime.triangleStates) {
    runtime.triangleStates = new Map();
  }
  for (const node of plan.nodes || []) {
    if (!runtime.nodeOutputs.has(node.id)) {
      runtime.nodeOutputs.set(node.id, 0);
    }
    if (node.type === "osc" && !runtime.phases.has(node.id)) {
      runtime.phases.set(node.id, 0);
    }
    if (node.type === "osc" && !runtime.triangleStates.has(node.id)) {
      runtime.triangleStates.set(node.id, 0);
    }
    if ((node.type === "osc" || node.type === "noise") && !runtime.noiseSeeds.has(node.id)) {
      runtime.noiseSeeds.set(node.id, nodeGraphStableSeed(node.id));
    }
    if (node.type === "spiral" && !runtime.spiralStates.has(node.id)) {
      runtime.spiralStates.set(node.id, createJerobeamSpiralState());
    }
    for (const [key, value] of Object.entries(node.params || {})) {
      const smootherKey = nodeGraphParameterKey(node.id, key);
      const metadata = node.paramMeta?.[key];
      if (!runtime.smoothers.has(smootherKey)) {
        runtime.smoothers.set(
          smootherKey,
          createNodeGraphParameterSmoother(value, metadata),
        );
      } else {
        updateNodeGraphParameterSmoother(runtime.smoothers.get(smootherKey), value, metadata);
      }
    }
  }
  for (const id of [...runtime.phases.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.phases.delete(id);
    }
  }
  for (const id of [...runtime.triangleStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.triangleStates.delete(id);
    }
  }
  for (const id of [...runtime.noiseSeeds.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.noiseSeeds.delete(id);
    }
  }
  for (const id of [...runtime.nodeOutputs.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.nodeOutputs.delete(id);
    }
  }
  for (const id of [...runtime.spiralStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.spiralStates.delete(id);
    }
  }
  for (const key of [...runtime.smoothers.keys()]) {
    const [nodeId, parameter] = key.split(".");
    if (!nodeIds.has(nodeId) || !runtime.nodes.get(nodeId)?.params || !(parameter in runtime.nodes.get(nodeId).params)) {
      runtime.smoothers.delete(key);
    }
  }
}

function updateNodeGraphLiveRuntimeParameters(runtime, nodes) {
  if (!runtime) {
    return;
  }
  for (const node of nodes || []) {
    const current = runtime.nodes.get(node.id);
    if (!current) {
      continue;
    }
    current.params = { ...(node.params || {}) };
    current.paramMeta = cloneNodeGraphParamMeta(node.paramMeta);
    for (const [key, value] of Object.entries(current.params || {})) {
      const smootherKey = nodeGraphParameterKey(node.id, key);
      const metadata = current.paramMeta?.[key];
      if (!runtime.smoothers.has(smootherKey)) {
        runtime.smoothers.set(
          smootherKey,
          createNodeGraphParameterSmoother(value, metadata),
        );
      } else {
        updateNodeGraphParameterSmoother(runtime.smoothers.get(smootherKey), value, metadata);
      }
    }
  }
}
