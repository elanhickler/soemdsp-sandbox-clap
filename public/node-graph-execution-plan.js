function nodeGraphInputKey(node, port) {
  return `${node}.${port}`;
}

function nodeGraphFindInputConnections(node, port) {
  return nodeGraphMvp.connections.filter(
    (connection) =>
      nodeGraphMvp.activeNodes.has(connection.sourceNode) &&
      nodeGraphMvp.activeNodes.has(connection.destinationNode) &&
      connection.destinationNode === node && connection.destinationPort === port,
  );
}

function nodeGraphBuildDependencyMap(patch = nodeGraphMvp.patch) {
  const issues = [];
  const nodeList = Array.isArray(patch.nodes) ? patch.nodes.map((node) => ({ ...node })) : [];
  const nodeMap = new Map(nodeList.map((node) => [node.id, node]));
  const bypassedNodes = nodeGraphRuntimeBypassedNodeIds(patch);
  const dependencies = new Map(nodeList.map((node) => [node.id, new Set()]));
  const inputConnections = new Map();
  const modulationConnections = new Map();

  function addDependency(map, destinationNode, sourceNode) {
    if (!map.has(destinationNode)) {
      map.set(destinationNode, new Set());
    }
    map.get(destinationNode).add(sourceNode);
  }

  for (const node of nodeList) {
    if (!nodeGraphModuleDefinitions[node.type]) {
      issues.push(`unsupported source ${node.id}`);
    }
  }

  for (const connection of patch.connections || []) {
    const source = nodeMap.get(connection.sourceNode);
    const destination = nodeMap.get(connection.destinationNode);
    if (!source || !destination) {
      issues.push("connection references missing node");
      continue;
    }
    const sourceOutputs = nodeGraphModuleOutputPorts(source.type);
    const destinationInputs = nodeGraphModuleDefinitions[destination.type]?.inputs || [];
    if (!sourceOutputs.includes(connection.sourcePort)) {
      issues.push(`connection source port invalid: ${connection.sourceNode}.${connection.sourcePort}`);
      continue;
    }
    if (!destinationInputs.includes(connection.destinationPort)) {
      issues.push(`connection destination port invalid: ${connection.destinationNode}.${connection.destinationPort}`);
      continue;
    }
    if (bypassedNodes.has(connection.sourceNode) || bypassedNodes.has(connection.destinationNode)) {
      continue;
    }
    const key = nodeGraphInputKey(connection.destinationNode, connection.destinationPort);
    const connections = inputConnections.get(key) || [];
    connections.push({ ...connection });
    inputConnections.set(key, connections);
    addDependency(dependencies, connection.destinationNode, connection.sourceNode);
  }

  for (const modulation of patch.modulations || []) {
    const source = nodeMap.get(modulation.sourceNode);
    const destination = nodeMap.get(modulation.destinationNode);
    if (!source || !destination) {
      issues.push("modulation references missing node");
      continue;
    }
    const sourceOutputs = nodeGraphModuleOutputPorts(source.type);
    const destinationParameters = nodeGraphModuleDefinitions[destination.type]?.parameters || [];
    if (!sourceOutputs.includes(modulation.sourcePort)) {
      issues.push(`modulation source port invalid: ${modulation.sourceNode}.${modulation.sourcePort}`);
      continue;
    }
    if (!destinationParameters.some((parameter) => parameter.key === modulation.destinationParam)) {
      issues.push(`modulation destination parameter invalid: ${modulation.destinationNode}.${modulation.destinationParam}`);
      continue;
    }
    if (bypassedNodes.has(modulation.sourceNode) || bypassedNodes.has(modulation.destinationNode)) {
      continue;
    }
    const key = nodeGraphParameterKey(modulation.destinationNode, modulation.destinationParam);
    const modulations = modulationConnections.get(key) || [];
    modulations.push({ ...modulation });
    modulationConnections.set(key, modulations);
    addDependency(dependencies, modulation.destinationNode, modulation.sourceNode);
  }

  return {
    bypassedNodes: [...bypassedNodes],
    connections: (patch.connections || []).map((connection) => ({ ...connection })),
    dependencies,
    inputConnections,
    issues,
    modulationConnections,
    modulations: (patch.modulations || []).map((modulation) => ({ ...modulation })),
    nodeMap,
    nodes: nodeList,
  };
}

function nodeGraphTopologicalOrder(nodes, dependencies, reachableNodes) {
  const order = [];
  const visiting = new Set();
  const visited = new Set();

  function visit(nodeId) {
    if (!reachableNodes.has(nodeId)) {
      return;
    }
    if (visiting.has(nodeId)) {
      return;
    }
    if (visited.has(nodeId)) {
      return;
    }

    visiting.add(nodeId);
    for (const dependency of dependencies.get(nodeId) || []) {
      visit(dependency);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    if (!order.includes(nodeId)) {
      order.push(nodeId);
    }
  }

  for (const node of nodes) {
    visit(node.id);
  }

  return { order };
}

function nodeGraphDependencyPathExists(dependencies, startNode, targetNode) {
  if (startNode === targetNode) {
    return true;
  }
  const visited = new Set();

  function visit(nodeId) {
    if (nodeId === targetNode) {
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }
    visited.add(nodeId);
    for (const dependency of dependencies.get(nodeId) || []) {
      if (visit(dependency)) {
        return true;
      }
    }
    return false;
  }

  return visit(startNode);
}

function nodeGraphNodeOrderIndexes(nodes) {
  return new Map(nodes.map((node, index) => [node.id, index]));
}

function nodeGraphCompareSchedulingEdges(a, b) {
  return Number(a.isBackward) - Number(b.isBackward) ||
    a.sourceOrder - b.sourceOrder ||
    a.destinationOrder - b.destinationOrder ||
    a.kindOrder - b.kindOrder ||
    a.index - b.index;
}

function nodeGraphSchedulingEdge(sourceNode, destinationNode, kind, index, payload, nodeOrder) {
  const sourceOrder = nodeOrder.get(sourceNode) ?? Number.MAX_SAFE_INTEGER;
  const destinationOrder = nodeOrder.get(destinationNode) ?? Number.MAX_SAFE_INTEGER;
  return {
    destinationNode,
    index,
    isBackward: sourceOrder >= destinationOrder,
    kind,
    kindOrder: kind === "signal" ? 0 : 1,
    payload: { ...payload },
    sourceNode,
    sourceOrder,
    destinationOrder,
  };
}

function nodeGraphBuildSchedulingDependencies(planGraph, reachableNodes) {
  const orderDependencies = new Map(planGraph.nodes.map((node) => [node.id, new Set()]));
  const feedbackConnections = [];
  const feedbackModulations = [];
  const nodeOrder = nodeGraphNodeOrderIndexes(planGraph.nodes);
  const schedulingEdges = [];
  const validSignalWires = new Set(
    [...planGraph.inputConnections.values()]
      .flat()
      .map(nodeGraphSignalWireIdentity),
  );
  const validModulationWires = new Set(
    [...planGraph.modulationConnections.values()]
      .flat()
      .map(nodeGraphModulationWireIdentity),
  );

  for (const [index, connection] of planGraph.connections.entries()) {
    if (
      !validSignalWires.has(nodeGraphSignalWireIdentity(connection)) ||
      !reachableNodes.has(connection.sourceNode) ||
      !reachableNodes.has(connection.destinationNode)
    ) {
      continue;
    }
    schedulingEdges.push(nodeGraphSchedulingEdge(
      connection.sourceNode,
      connection.destinationNode,
      "signal",
      index,
      connection,
      nodeOrder,
    ));
  }

  for (const [index, modulation] of planGraph.modulations.entries()) {
    if (
      !validModulationWires.has(nodeGraphModulationWireIdentity(modulation)) ||
      !reachableNodes.has(modulation.sourceNode) ||
      !reachableNodes.has(modulation.destinationNode)
    ) {
      continue;
    }
    schedulingEdges.push(nodeGraphSchedulingEdge(
      modulation.sourceNode,
      modulation.destinationNode,
      "modulation",
      index,
      modulation,
      nodeOrder,
    ));
  }

  for (const edge of schedulingEdges.sort(nodeGraphCompareSchedulingEdges)) {
    if (nodeGraphDependencyPathExists(orderDependencies, edge.sourceNode, edge.destinationNode)) {
      if (edge.kind === "signal") {
        feedbackConnections.push(edge.payload);
      } else {
        feedbackModulations.push(edge.payload);
      }
    } else {
      orderDependencies.get(edge.destinationNode)?.add(edge.sourceNode);
    }
  }

  return { feedbackConnections, feedbackModulations, orderDependencies };
}

function compileNodeGraphExecutionPlan(patch = nodeGraphMvp.patch) {
  const graph = nodeGraphBuildDependencyMap(patch);
  const issues = [...graph.issues];
  const outputNode = "output";
  const reachableNodes = new Set();

  function markReachable(nodeId) {
    if (reachableNodes.has(nodeId) || !graph.nodeMap.has(nodeId)) {
      return;
    }
    reachableNodes.add(nodeId);
    for (const dependency of graph.dependencies.get(nodeId) || []) {
      markReachable(dependency);
    }
  }

  if (!graph.nodeMap.has(outputNode)) {
    issues.push("output node missing");
  } else {
    markReachable(outputNode);
  }

  const hasOutputSpeakerInput = nodeGraphOutputInputPorts.some(
    (port) => (graph.inputConnections.get(nodeGraphInputKey(outputNode, port)) || []).length > 0,
  );
  if (!hasOutputSpeakerInput) {
    issues.push("missing Output speaker input");
  }

  for (const nodeId of reachableNodes) {
    const type = graph.nodeMap.get(nodeId)?.type;
    if (type === "gain" || type === "bias") {
      const inputCount = (graph.inputConnections.get(nodeGraphInputKey(nodeId, "In")) || []).length;
      if (!inputCount && nodeGraphNodeSignalOutputRequired(graph, nodeId)) {
        issues.push(`missing ${nodeGraphNodeDisplayName(nodeId)} input`);
      }
    } else if (
      type !== "audioInput" &&
      type !== "osc" &&
      type !== "spiral" &&
      type !== "noise" &&
      type !== "output"
    ) {
      issues.push(`unsupported source ${nodeId}`);
    }
  }

  const scheduling = nodeGraphBuildSchedulingDependencies(graph, reachableNodes);
  const topology = nodeGraphTopologicalOrder(graph.nodes, scheduling.orderDependencies, reachableNodes);
  const order = topology.order.filter((nodeId) => reachableNodes.has(nodeId));
  const sourceNodes = order.filter((nodeId) => {
    const type = graph.nodeMap.get(nodeId)?.type;
    return type === "audioInput" || type === "osc" || type === "spiral" || type === "noise";
  });
  const inactiveNodes = graph.nodes
    .filter((node) => !reachableNodes.has(node.id))
    .map((node) => node.id);

  const uniqueIssues = [...new Set(issues)];

  return {
    connections: graph.connections,
    dependencies: graph.dependencies,
    bypassedNodes: graph.bypassedNodes,
    feedbackConnections: scheduling.feedbackConnections,
    feedbackModulations: scheduling.feedbackModulations,
    inactiveNodes,
    inputConnections: graph.inputConnections,
    issues: uniqueIssues,
    modulationConnections: graph.modulationConnections,
    modulations: graph.modulations,
    nodeMap: graph.nodeMap,
    nodes: graph.nodes,
    orderDependencies: scheduling.orderDependencies,
    order,
    outputNode,
    reachableNodes: [...reachableNodes],
    sourceNodes,
    valid: uniqueIssues.length === 0,
  };
}

function nodeGraphNodeSignalOutputRequired(graph, nodeId) {
  const node = graph.nodeMap.get(nodeId);
  const signalOutputs = new Set(nodeGraphModuleDefinitions[node?.type]?.outputs || []);
  if (!signalOutputs.size) {
    return false;
  }
  return [...graph.inputConnections.values()]
    .flat()
    .some((connection) =>
      connection.sourceNode === nodeId && signalOutputs.has(connection.sourcePort),
    );
}

function compileValidatedNodeGraphExecutionPlan(patch = nodeGraphMvp.patch) {
  return compileNodeGraphExecutionPlan(validateNodeGraphPatch(patch));
}

function nodeGraphValidate() {
  const plan = compileNodeGraphExecutionPlan();
  return {
    issues: plan.issues,
    order: plan.order,
    scheduleText: nodeGraphScheduleText(
      plan.order,
      plan.issues,
      plan.feedbackConnections,
      plan.feedbackModulations,
    ),
    sourceNode: plan.sourceNodes[0] || "",
    sourceNodes: plan.sourceNodes,
    valid: plan.valid,
  };
}
