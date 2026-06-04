function cloneNodeGraphParamMeta(paramMeta = {}) {
  return Object.fromEntries(
    Object.entries(paramMeta || {}).map(([key, metadata]) => [
      key,
      {
        ...(metadata || {}),
        choices: [...(metadata?.choices || [])],
      },
    ]),
  );
}

function normalizeNodeGraphPatchNodeUi(ui = {}) {
  const source = ui && typeof ui === "object" ? ui : {};
  return {
    buttonsHidden: Boolean(source.buttonsHidden),
    titleHidden: Boolean(source.titleHidden),
  };
}

function normalizeNodeGraphPatchNodeAlias(alias) {
  return String(alias ?? "").trim().slice(0, 64);
}

function nodeGraphDefaultNodeTitle(type, id) {
  return id === type
    ? nodeGraphNodeLabels[type]
    : `${nodeGraphNodeLabels[type]} ${String(id).split("-").at(-1)}`;
}

function nodeGraphPatchNodeTitle(node) {
  const patchNode = typeof node === "string" ? nodeGraphPatchNode(node) : node;
  if (!patchNode) {
    return nodeGraphNodeLabels[nodeGraphNodeType(node)] || String(node || "");
  }
  return normalizeNodeGraphPatchNodeAlias(patchNode.alias) || nodeGraphDefaultNodeTitle(patchNode.type, patchNode.id);
}

function cloneNodeGraphPatch(patch) {
  return {
    audio: normalizeNodeGraphPatchAudio(patch.audio),
    bypassedNodes: Array.isArray(patch.bypassedNodes) ? [...patch.bypassedNodes] : [],
    connections: (patch.connections || []).map((connection) => ({
      ...connection,
      tracePoints: normalizeNodeGraphTracePoints(connection.tracePoints),
    })),
    format: { ...(patch.format || nodeGraphPatchFormat) },
    grid: normalizeNodeGraphPatchGrid(patch.grid),
    info: normalizeNodeGraphPatchInfo(patch.info),
    modulations: (patch.modulations || []).map((modulation) => ({
      ...modulation,
      tracePoints: normalizeNodeGraphTracePoints(modulation.tracePoints),
    })),
    monitors: normalizeNodeGraphPatchMonitors(patch.monitors, patch),
    nodes: (patch.nodes || []).map((node) => {
      const ui = nodeGraphModuleDefinitions[node.type]?.layout === "textBox" && !Object.hasOwn(node, "ui")
        ? { buttonsHidden: true }
        : normalizeNodeGraphPatchNodeUi(node.ui);
      return {
        ...node,
        ...(normalizeNodeGraphPatchNodeAlias(node.alias)
          ? { alias: normalizeNodeGraphPatchNodeAlias(node.alias) }
          : {}),
        ...(nodeGraphModuleDefinitions[node.type]?.layout === "textBox"
          ? { layout: normalizeNodeGraphTextBoxLayout(node.layout) }
          : {}),
        ...(nodeGraphModuleDefinitions[node.type]?.layout === "image"
          ? { layout: normalizeNodeGraphImageLayout(node.layout) }
          : {}),
        ...(node.type === "graph"
          ? { graph: normalizeNodeGraphGraph(node.graph) }
          : {}),
        ...(node.type === "codeblock"
          ? { codeblock: normalizeNodeGraphCodeblock(node.codeblock) }
          : {}),
        paramMeta: cloneNodeGraphParamMeta(node.paramMeta),
        params: { ...(node.params || {}) },
        ...(ui.buttonsHidden || ui.titleHidden ? { ui } : {}),
      };
    }),
    timing: normalizeNodeGraphPatchTiming(patch.timing),
    uiItems: normalizeNodeGraphPatchUiItems(patch.uiItems),
    view: normalizeNodeGraphPatchView(patch.view),
    visual: normalizeNodeGraphPatchVisual(patch.visual),
    windows: normalizeNodeGraphPatchWindows(patch.windows),
  };
}
