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

function normalizeNodeGraphGraphConnections(graphConnections = []) {
  if (!Array.isArray(graphConnections)) {
    return [];
  }
  return graphConnections.map((connection) => ({
    destinationGraphInput: String(connection.destinationGraphInput || "").trim(),
    destinationNode: String(connection.destinationNode || "").trim(),
    sourceNode: String(connection.sourceNode || "").trim(),
    sourcePort: String(connection.sourcePort || "").trim(),
    ...(nodeGraphWireTypePatchValue(connection.wireType)
      ? { wireType: nodeGraphWireTypePatchValue(connection.wireType) }
      : {}),
    ...(normalizeNodeGraphTracePoints(connection.tracePoints).length
      ? { tracePoints: normalizeNodeGraphTracePoints(connection.tracePoints) }
      : {}),
  })).filter((connection) =>
    connection.sourceNode &&
    connection.sourcePort &&
    connection.destinationNode &&
    connection.destinationGraphInput,
  );
}

const nodeGraphLedDefaultColor = "#ff0000";
const nodeGraphLedCenterColor = "#ffffff";

function normalizeNodeGraphLedLayout(layout = {}) {
  const source = layout && typeof layout === "object" ? layout : {};
  return {
    color: normalizeNodeGraphModuleScopeDotCoreColor(source.color ?? nodeGraphLedDefaultColor, nodeGraphLedDefaultColor),
    kind: "led",
  };
}

function normalizeNodeGraphClapAudioPorts(ports = []) {
  if (!Array.isArray(ports)) {
    return [];
  }
  return ports.slice(0, 32).map((port, index) => {
    const source = port && typeof port === "object" ? port : {};
    const id = Number(source.id);
    const sourceIndex = Number(source.index);
    const channelCount = Number(source.channelCount);
    return {
      channelCount: Number.isFinite(channelCount) ? Math.max(0, Math.min(64, Math.round(channelCount))) : 0,
      flags: Number.isFinite(Number(source.flags)) ? Math.round(Number(source.flags)) : 0,
      id: Number.isFinite(id) ? Math.round(id) : index,
      inPlacePair: Number.isFinite(Number(source.inPlacePair)) ? Math.round(Number(source.inPlacePair)) : -1,
      index: Number.isFinite(sourceIndex) ? Math.round(sourceIndex) : index,
      name: String(source.name || "").trim().slice(0, 128),
      portType: String(source.portType || "").trim().slice(0, 128),
    };
  });
}

function normalizeNodeGraphClapPluginBinding(clap = {}) {
  const source = clap && typeof clap === "object" ? clap : {};
  const catalogId = String(source.catalogId ?? source.pluginId ?? "").trim().slice(0, 128);
  const clapId = String(source.clapId ?? "").trim().slice(0, 256);
  const path = String(source.path ?? "").trim().slice(0, 2048);
  const name = String(source.name ?? "").trim().slice(0, 128);
  const vendor = String(source.vendor ?? "").trim().slice(0, 128);
  const instanceId = String(source.instanceId ?? "").trim().slice(0, 128);
  const stateBase64 = String(source.stateBase64 ?? "").trim().slice(0, 6_000_000);
  const stateByteCount = Number(source.stateByteCount);
  const stateSavedAt = String(source.stateSavedAt ?? "").trim().slice(0, 64);
  const binding = {};
  if (catalogId) binding.catalogId = catalogId;
  if (clapId) binding.clapId = clapId;
  if (path) binding.path = path;
  if (name) binding.name = name;
  if (vendor) binding.vendor = vendor;
  if (instanceId) binding.instanceId = instanceId;
  if (stateBase64 && /^[A-Za-z0-9+/=]+$/.test(stateBase64)) binding.stateBase64 = stateBase64;
  if (Number.isFinite(stateByteCount) && stateByteCount >= 0) {
    binding.stateByteCount = Math.floor(stateByteCount);
  }
  if (stateSavedAt) binding.stateSavedAt = stateSavedAt;
  const audioInputs = normalizeNodeGraphClapAudioPorts(source.audioInputs);
  const audioOutputs = normalizeNodeGraphClapAudioPorts(source.audioOutputs);
  if (audioInputs.length) binding.audioInputs = audioInputs;
  if (audioOutputs.length) binding.audioOutputs = audioOutputs;
  return binding;
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
  if (patchNode.type === "moduleGroup") {
    return normalizeNodeGraphPatchNodeAlias(patchNode.alias) ||
      normalizeNodeGraphModuleGroup(patchNode.moduleGroup).name ||
      nodeGraphNodeLabels.moduleGroup;
  }
  if (patchNode.type === "clapPlugin") {
    return normalizeNodeGraphPatchNodeAlias(patchNode.alias) ||
      normalizeNodeGraphClapPluginBinding(patchNode.clap).name ||
      nodeGraphNodeLabels.clapPlugin;
  }
  return normalizeNodeGraphPatchNodeAlias(patchNode.alias) || nodeGraphDefaultNodeTitle(patchNode.type, patchNode.id);
}

function cloneNodeGraphPatch(patch) {
  const cameraState = normalizeNodeGraphPatchCameras(patch.cameras, patch.activeCameraId);
  return {
    activeCameraId: cameraState.activeCameraId,
    audio: normalizeNodeGraphPatchAudio(patch.audio),
    bypassedNodes: Array.isArray(patch.bypassedNodes) ? [...patch.bypassedNodes] : [],
    cameras: cameraState.cameras,
    codeScreen: normalizeNodeGraphCodeScreen(patch.codeScreen),
    connections: (patch.connections || []).map((connection) => ({
      ...connection,
      tracePoints: normalizeNodeGraphTracePoints(connection.tracePoints),
    })),
    format: { ...(patch.format || nodeGraphPatchFormat) },
    grid: normalizeNodeGraphPatchGrid(patch.grid),
    graphConnections: normalizeNodeGraphGraphConnections(patch.graphConnections),
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
        ...(nodeGraphModuleDefinitions[node.type]?.layout === "led"
          ? { led: normalizeNodeGraphLedLayout(node.led) }
          : {}),
        ...(node.type === "graph"
          ? { graph: normalizeNodeGraphGraph(node.graph) }
          : {}),
        ...(node.type === "codeblock"
          ? { codeblock: normalizeNodeGraphCodeblock(node.codeblock) }
          : {}),
        ...(Object.hasOwn(node, "scopeShader")
          ? { scopeShader: normalizeNodeGraphScopeShader(node.scopeShader) }
          : {}),
        ...(node.type === "moduleGroup"
          ? { moduleGroup: normalizeNodeGraphModuleGroup(node.moduleGroup) }
          : {}),
        ...(node.type === "clapPlugin"
          ? { clap: normalizeNodeGraphClapPluginBinding(node.clap) }
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
