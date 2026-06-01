function nodeGraphPatchNode(id) {
  return nodeGraphMvp.patch.nodes.find((node) => node.id === id) || null;
}

function nodeGraphPatchNodeType(id) {
  return nodeGraphPatchNode(id)?.type || id;
}

function nodeGraphBypassedNodeIds(patch = nodeGraphMvp.patch) {
  return new Set(Array.isArray(patch.bypassedNodes) ? patch.bypassedNodes : []);
}

function nodeGraphRuntimeBypassedNodeIds(patch = nodeGraphMvp.patch) {
  const bypassed = nodeGraphBypassedNodeIds(patch);
  if (!nodeGraphMvp.live.inputActive) {
    for (const node of patch.nodes || []) {
      if (node.type === "audioInput") {
        bypassed.add(node.id);
      }
    }
  }
  return bypassed;
}

function nodeGraphNodeIsBypassed(nodeId, patch = nodeGraphMvp.patch) {
  return nodeGraphBypassedNodeIds(patch).has(nodeId);
}

function nextNodeGraphTypeCounts(nodes = nodeGraphMvp.patch.nodes) {
  const counts = {};
  for (const node of nodes) {
    const match = node.id.match(new RegExp(`^${node.type}-(\\d+)$`));
    const count = match ? Number(match[1]) : node.id === node.type ? 1 : 0;
    counts[node.type] = Math.max(counts[node.type] || 0, count);
  }
  return {
    audioInput: counts.audioInput || 0,
    bias: counts.bias || 0,
    gain: counts.gain || 0,
    noise: counts.noise || 0,
    osc: counts.osc || 0,
    spiral: counts.spiral || 0,
    textBox: counts.textBox || 0,
  };
}

function syncNodeGraphRuntimeFromPatch() {
  nodeGraphMvp.activeNodes = new Set(nodeGraphMvp.patch.nodes.map((node) => node.id));
  nodeGraphMvp.connections = nodeGraphMvp.patch.connections.map((connection) => ({
    ...connection,
    tracePoints: normalizeNodeGraphTracePoints(connection.tracePoints),
  }));
  nodeGraphMvp.modulations = nodeGraphMvp.patch.modulations.map((modulation) => ({
    ...modulation,
    tracePoints: normalizeNodeGraphTracePoints(modulation.tracePoints),
  }));
  nodeGraphMvp.monitors = normalizeNodeGraphPatchMonitors(
    nodeGraphMvp.patch.monitors,
    nodeGraphMvp.patch,
  );
  nodeGraphMvp.nodeTypeCounts = nextNodeGraphTypeCounts();
}
