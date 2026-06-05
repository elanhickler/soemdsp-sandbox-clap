function nodeGraphBypassGlyph(bypassed) {
  return "\u{1F5F2}";
}

function normalizeNodeGraphPatchParameter(type, key, value, metadata = null) {
  const parameter = nodeGraphModuleDefinitions[type]?.parameters?.find(
    (candidate) => candidate.key === key,
  );
  if (!parameter && type !== "clapPlugin") {
    return null;
  }
  const number = Number(value);
  const fallback = Number(metadata?.def ?? parameter?.defaultValue);
  const candidate = Number.isFinite(number)
    ? number
    : Number.isFinite(fallback)
      ? fallback
      : 0;
  const min = Number(metadata?.min ?? parameter?.min);
  const max = Number(metadata?.max ?? parameter?.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return candidate;
  }
  return metadata?.wraparound || parameter?.wraparound
    ? wrapNodeSliderValue(candidate, min, max)
    : clampNodeSliderValue(candidate, min, max);
}

function validateNodeGraphPatch(patch) {
  if (!patch || typeof patch !== "object") {
    throw new Error("patch must be an object");
  }

  if (patch.format !== undefined) {
    if (
      patch.format?.kind !== nodeGraphPatchFormat.kind ||
      Number(patch.format?.version) !== nodeGraphPatchFormat.version
    ) {
      throw new Error("unsupported patch format");
    }
  }

  const cameraState = normalizeNodeGraphPatchCameras(patch.cameras, patch.activeCameraId);
  const grid = normalizeNodeGraphPatchGrid(patch.grid);
  if (!Number.isFinite(grid.widthPx) || grid.widthPx <= 0) {
    throw new Error("grid.widthPx must be a positive number");
  }
  if (!Number.isFinite(grid.heightPx) || grid.heightPx <= 0) {
    throw new Error("grid.heightPx must be a positive number");
  }

  if (!Array.isArray(patch.nodes)) {
    throw new Error("nodes must be an array");
  }

  const ids = new Set();
  const nodes = patch.nodes.map((node) => {
    const id = String(node.id || "").trim();
    const type = String(node.type || "").trim();
    if (!id) {
      throw new Error("node id missing");
    }
    if (ids.has(id)) {
      throw new Error(`duplicate node id ${id}`);
    }
    if (!Object.hasOwn(nodeGraphModuleDefinitions, type)) {
      throw new Error(`unknown node type ${type}`);
    }
    if (type === "output" && id !== "output") {
      throw new Error("output module id must be output");
    }
    const gx = Math.round(Number(node.gx));
    const gy = Math.round(Number(node.gy));
    if (!Number.isFinite(gx) || !Number.isFinite(gy)) {
      throw new Error(`node ${id} grid position invalid`);
    }
    const hasCustomWidth = Object.hasOwn(node, "widthGu");
    const widthGu = normalizeNodeGraphModuleWidthUnits(type, node.widthGu);
    if (hasCustomWidth && !Number.isFinite(Number(node.widthGu))) {
      throw new Error(`node ${id} widthGu invalid`);
    }
    const hasCustomHeight = Object.hasOwn(node, "heightGu");
    const heightGu = normalizeNodeGraphModuleHeightUnits(type, node.heightGu, node.ui);
    if (hasCustomHeight && !Number.isFinite(Number(node.heightGu))) {
      throw new Error(`node ${id} heightGu invalid`);
    }
    const params = {};
    const paramMeta = {};
    for (const parameter of nodeGraphModuleDefinitions[type].parameters || []) {
      const metadata = normalizeNodeGraphPatchParameterMetadata(
        type,
        parameter.key,
        node.paramMeta?.[parameter.key],
      );
      paramMeta[parameter.key] = metadata;
      const value = Object.hasOwn(node.params || {}, parameter.key)
        ? node.params[parameter.key]
        : parameter.defaultValue;
      params[parameter.key] = normalizeNodeGraphPatchParameter(
        type,
        parameter.key,
        value,
        metadata,
      );
    }
    if (type === "clapPlugin") {
      for (const [key, sourceMetadata] of Object.entries(node.paramMeta || {})) {
        if (Object.hasOwn(paramMeta, key)) {
          continue;
        }
        const metadata = normalizeNodeGraphPatchParameterMetadata(type, key, sourceMetadata);
        if (!metadata) {
          continue;
        }
        paramMeta[key] = metadata;
        params[key] = normalizeNodeGraphPatchParameter(
          type,
          key,
          Object.hasOwn(node.params || {}, key) ? node.params[key] : metadata.def,
          metadata,
        );
      }
    }
    ids.add(id);
    const normalizedNode = {
      gx,
      gy,
      id,
      paramMeta,
      params,
      type,
      ...(normalizeNodeGraphPatchNodeAlias(node.alias)
        ? { alias: normalizeNodeGraphPatchNodeAlias(node.alias) }
        : {}),
      ...(hasCustomWidth ? { widthGu } : {}),
      ...(hasCustomHeight ? { heightGu } : {}),
    };
    if (nodeGraphModuleDefinitions[type].layout === "textBox") {
      normalizedNode.layout = normalizeNodeGraphTextBoxLayout(node.layout);
    } else if (nodeGraphModuleDefinitions[type].layout === "image") {
      normalizedNode.layout = normalizeNodeGraphImageLayout(node.layout);
    }
    if (type === "graph") {
      normalizedNode.graph = normalizeNodeGraphGraph(node.graph);
    }
    if (type === "codeblock") {
      normalizedNode.codeblock = normalizeNodeGraphCodeblock(node.codeblock);
    }
    if (type === "moduleGroup") {
      normalizedNode.moduleGroup = normalizeNodeGraphModuleGroup(node.moduleGroup);
    }
    if (type === "clapPlugin") {
      normalizedNode.clap = normalizeNodeGraphClapPluginBinding(node.clap);
    }
    const ui = nodeGraphModuleDefinitions[type].layout === "textBox" && !Object.hasOwn(node, "ui")
      ? { buttonsHidden: true }
      : normalizeNodeGraphPatchNodeUi(node.ui);
    if (ui.buttonsHidden || ui.titleHidden) {
      normalizedNode.ui = ui;
    }
    return normalizedNode;
  });

  const uiItems = normalizeNodeGraphPatchUiItems(patch.uiItems, { nodeIds: ids });

  const bypassedNodes = [];
  const bypassedNodeIds = new Set();
  if (patch.bypassedNodes !== undefined && !Array.isArray(patch.bypassedNodes)) {
    throw new Error("bypassedNodes must be an array");
  }
  for (const value of patch.bypassedNodes || []) {
    const id = String(value || "").trim();
    if (!id) {
      throw new Error("bypassedNodes entry missing node id");
    }
    if (!ids.has(id)) {
      throw new Error(`bypassed node missing: ${id}`);
    }
    if (id === "output") {
      throw new Error("output module cannot be bypassed");
    }
    if (!bypassedNodeIds.has(id)) {
      bypassedNodeIds.add(id);
      bypassedNodes.push(id);
    }
  }

  const connectionKeys = new Set();
  const connections = Array.isArray(patch.connections) ? patch.connections.map((connection) => {
    const sourceNode = String(connection.sourceNode || "").trim();
    let sourcePort = String(connection.sourcePort || "").trim();
    const destinationNode = String(connection.destinationNode || "").trim();
    let destinationPort = String(connection.destinationPort || "").trim();
    const sourceType = nodes.find((node) => node.id === sourceNode)?.type;
    const destinationType = nodes.find((node) => node.id === destinationNode)?.type;
    if (!sourceType || !destinationType) {
      throw new Error("connection references missing node");
    }
    sourcePort = nodeGraphCanonicalOutputPort(sourceType, sourcePort);
    if (!nodeGraphPatchNodeOutputPorts(nodes.find((node) => node.id === sourceNode)).includes(sourcePort)) {
      throw new Error(`connection source port invalid: ${sourceNode}.${sourcePort}`);
    }
    if (destinationType === "output" && destinationPort === "In") {
      destinationPort = "Left";
    }
    destinationPort = nodeGraphCanonicalInputPort(destinationType, destinationPort);
    if (!nodeGraphPatchNodeInputPorts(nodes.find((node) => node.id === destinationNode)).includes(destinationPort)) {
      throw new Error(`connection destination port invalid: ${destinationNode}.${destinationPort}`);
    }
    const key = `${sourceNode}.${sourcePort}->${destinationNode}.${destinationPort}`;
    if (connectionKeys.has(key)) {
      throw new Error(`duplicate connection ${key}`);
    }
    connectionKeys.add(key);
    return {
      destinationNode,
      destinationPort,
      sourceNode,
      sourcePort,
      ...(nodeGraphWireTypePatchValue(connection.wireType)
        ? { wireType: nodeGraphWireTypePatchValue(connection.wireType) }
        : {}),
      ...(normalizeNodeGraphTracePoints(connection.tracePoints).length
        ? { tracePoints: normalizeNodeGraphTracePoints(connection.tracePoints) }
        : {}),
    };
  }) : [];

  const modulationKeys = new Set();
  const modulations = Array.isArray(patch.modulations) ? patch.modulations.map((modulation) => {
    const sourceNode = String(modulation.sourceNode || "").trim();
    let sourcePort = String(modulation.sourcePort || "").trim();
    const destinationNode = String(modulation.destinationNode || "").trim();
    const destinationParam = String(modulation.destinationParam || "").trim();
    if (!sourceNode || !sourcePort || !destinationNode || !destinationParam) {
      throw new Error("modulation entries require sourceNode, sourcePort, destinationNode, destinationParam");
    }
    const sourceType = nodes.find((node) => node.id === sourceNode)?.type;
    const destinationType = nodes.find((node) => node.id === destinationNode)?.type;
    if (!sourceType || !destinationType) {
      throw new Error("modulation references missing node");
    }
    sourcePort = nodeGraphCanonicalOutputPort(sourceType, sourcePort);
    if (!nodeGraphPatchNodeOutputPorts(nodes.find((node) => node.id === sourceNode)).includes(sourcePort)) {
      throw new Error(`modulation source port invalid: ${sourceNode}.${sourcePort}`);
    }
    const destinationPatchNode = nodes.find((node) => node.id === destinationNode);
    if (!nodeGraphPatchNodeParameterDefinitions(destinationPatchNode).some((parameter) => parameter.key === destinationParam)) {
      throw new Error(`modulation destination parameter invalid: ${destinationNode}.${destinationParam}`);
    }
    const key = `${sourceNode}.${sourcePort}->${destinationNode}.${destinationParam}`;
    if (modulationKeys.has(key)) {
      throw new Error(`duplicate modulation ${key}`);
    }
    modulationKeys.add(key);
    return {
      destinationNode,
      destinationParam,
      sourceNode,
      sourcePort,
      ...(nodeGraphWireTypePatchValue(modulation.wireType)
        ? { wireType: nodeGraphWireTypePatchValue(modulation.wireType) }
        : {}),
      ...(normalizeNodeGraphTracePoints(modulation.tracePoints).length
        ? { tracePoints: normalizeNodeGraphTracePoints(modulation.tracePoints) }
        : {}),
    };
  }) : [];

  const view = normalizeNodeGraphPatchView(patch.view);
  if (view.widthGu && view.widthGu < nodeGraphWorkspaceViewLimits.minWidthGu) {
    throw new Error(`view.widthGu must be 0 or at least ${nodeGraphWorkspaceViewLimits.minWidthGu}`);
  }
  if (view.heightGu && view.heightGu < nodeGraphWorkspaceViewLimits.minHeightGu) {
    throw new Error(`view.heightGu must be 0 or at least ${nodeGraphWorkspaceViewLimits.minHeightGu}`);
  }

  return {
    activeCameraId: cameraState.activeCameraId,
    audio: normalizeNodeGraphPatchAudio(patch.audio),
    bypassedNodes,
    cameras: cameraState.cameras,
    connections,
    format: { ...nodeGraphPatchFormat },
    grid,
    info: normalizeNodeGraphPatchInfo(patch.info),
    modulations,
    monitors: normalizeNodeGraphPatchMonitors(patch.monitors, {
      ...patch,
      nodes,
    }),
    nodes,
    timing: normalizeNodeGraphPatchTiming(patch.timing),
    uiItems,
    view,
    visual: normalizeNodeGraphPatchVisual(patch.visual),
    windows: normalizeNodeGraphPatchWindows(patch.windows),
  };
}

function loadNodeGraphPatchFromScript(text) {
  try {
    return validateNodeGraphPatch(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`script JSON parse failed: ${error.message}`);
    }
    throw new Error(`script validation failed: ${error.message}`);
  }
}

function nodeGraphModuleShouldBeVisible(node) {
  const type = typeof node === "string" ? nodeGraphPatchNodeType(node) : node?.type;
  return type !== "audioInput" || Boolean(nodeGraphMvp.live.inputActive);
}

function nodeGraphPatchNodeIsVisible(nodeId) {
  const node = nodeGraphPatchNode(nodeId);
  return Boolean(
    node &&
    nodeGraphModuleShouldBeVisible(node),
  );
}

function applyNodeGraphPatchToDom() {
  const container = document.getElementById("nodeGraphNodes");
  if (!container) {
    return;
  }

  applyNodeGraphWorkspaceView();
  const workspace = document.getElementById("nodeGraphWorkspace");
  const visiblePatchNodeCount = nodeGraphMvp.patch.nodes.filter((node) => nodeGraphModuleShouldBeVisible(node)).length;
  workspace?.classList.toggle("empty-patch", visiblePatchNodeCount === 0);
  const emptyButton = document.getElementById("nodeGraphEmptyModuleButton");
  if (emptyButton) {
    emptyButton.hidden = visiblePatchNodeCount !== 0;
  }

  for (const element of [...container.querySelectorAll(".dsp-node")]) {
    if (!nodeGraphPatchNode(element.dataset.node)) {
      element.remove();
    }
  }

  for (const patchNode of nodeGraphMvp.patch.nodes) {
    let element = nodeGraphNodeElement(patchNode.id);
    const outputPorts = nodeGraphPatchNodeOutputPorts(patchNode).filter(
      (port) => !(nodeGraphModuleDefinitions[patchNode.type]?.parameters || []).some((parameter) => parameter.key === port),
    );
    const portSignature = `${nodeGraphPatchNodeInputPorts(patchNode).join(",")}=>${outputPorts.join(",")}`;
    if (
      element &&
      (
        element.dataset.nodeType !== patchNode.type ||
        element.dataset.portSignature !== portSignature
      )
    ) {
      element.remove();
      element = null;
    }
    if (!element) {
      element = createNodeGraphModuleElement(patchNode.type, patchNode.id);
      container.append(element);
    }
    element.style.setProperty("--node-grid-width-units", String(nodeGraphPatchNodeGridWidthUnits(patchNode)));
    element.style.setProperty("--node-grid-height-units", String(nodeGraphPatchNodeGridHeightUnits(patchNode)));
    const point = nodeGraphGridToPixel(patchNode);
    positionNodeGraphNode(element, point, { clamp: false, snap: false });
    element.hidden = !nodeGraphModuleShouldBeVisible(patchNode);
    element.dataset.gridX = String(patchNode.gx);
    element.dataset.gridY = String(patchNode.gy);
    const titleText = element.querySelector(".node-header-title");
    if (titleText) {
      titleText.textContent = nodeGraphPatchNodeTitle(patchNode);
    }
    const patchNodeUi = normalizeNodeGraphPatchNodeUi(patchNode.ui);
    element.classList.toggle("buttons-hidden", patchNodeUi.buttonsHidden);
    element.classList.toggle("title-hidden", patchNodeUi.titleHidden);
    const bypassed = nodeGraphNodeDisplaysBypassed(patchNode.id);
    element.classList.toggle("bypassed", bypassed);
    const bypassButton = element.querySelector(".node-bypass-button");
    if (bypassButton) {
      bypassButton.setAttribute("aria-pressed", bypassed ? "true" : "false");
      bypassButton.textContent = nodeGraphBypassGlyph(bypassed);
      nodeGraphApplyTooltip(
        bypassButton,
        patchNode.id === "output"
          ? (bypassed ? "module.outputOn" : "module.outputOff")
          : (bypassed ? "module.include" : "module.bypass"),
        {},
        { title: false },
      );
    }
    for (const parameter of nodeGraphModuleDefinitions[patchNode.type]?.parameters || []) {
      const input = element.querySelector(`input[data-param="${CSS.escape(parameter.key)}"]`);
      if (!input) {
        continue;
      }
      setNodeSliderMetadata(
        input,
        patchNode.paramMeta?.[parameter.key] ||
        nodeGraphParameterDefinitionMetadata(parameter),
      );
      input.value = String(
        patchNode.params?.[parameter.key] ??
        nodeGraphParameterFallback(patchNode.type, parameter.key),
      );
      syncNodeSliderReadout(input);
    }
    if (nodeGraphModuleDefinitions[patchNode.type]?.layout === "textBox") {
      syncNodeGraphTextBoxElement(element, patchNode);
    } else if (nodeGraphModuleDefinitions[patchNode.type]?.layout === "graph") {
      syncNodeGraphGraphElement(element, patchNode);
    } else if (
      nodeGraphModuleDefinitions[patchNode.type]?.layout === "clapPlugin" &&
      typeof syncNodeGraphClapPluginElement === "function"
    ) {
      syncNodeGraphClapPluginElement(element, patchNode);
    }
  }
  syncNodeGraphInputModuleLiveState();
  if (typeof renderNodeGraphCameraView === "function") {
    renderNodeGraphCameraView();
  }
  syncNodeGraphHeaderTimingWidgets();
  updateNodeGraphGridHeatmap();
  if (typeof scheduleNodeGraphModuleScopeDraw === "function") {
    scheduleNodeGraphModuleScopeDraw();
  }
}

function commitNodeGraphPatch(patch, options = {}) {
  nodeGraphMvp.patch = cloneNodeGraphPatch(validateNodeGraphPatch(patch));
  syncNodeGraphRuntimeFromPatch();
  applyNodeGraphPatchToDom();
  syncNodeGraphMonitorIndicators();
  pruneNodeGraphSelectionAfterPatch();
  renderNodePalette();
  renderNodeGraphConnectionList();
  syncNodeGraphGhostSliders();
  syncNodeGraphFilterCurveDisplays();
  renderNodeGraphVisualSettings();
  syncNodeGraphSettingsView();
  const scriptStatus = nodeGraphPatchScriptStatus(
    options.status || "script synced",
    options.ok ?? true,
  );
  syncNodeGraphScriptView(scriptStatus.message, scriptStatus.ok);
  if (options.record !== false) {
    recordNodeGraphHistory();
  } else {
    renderNodeGraphHistoryControls();
  }
  if (options.markPending !== false) {
    markNodeGraphRenderPending();
  }
  scheduleNodeGraphLivePlanSync();
}

function clearNodeGraphWires() {
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  patch.connections = [];
  patch.modulations = [];
  setNodeGraphSelection(null);
  markNodeGraphRenderPending();
  commitNodeGraphPatch(patch, { status: "wires cleared" });
}

function deleteSelectedNodeGraphItem() {
  if (!nodeGraphScriptReadyForGraphAction("delete")) {
    return;
  }
  const selection = nodeGraphMvp.selected;
  if (!selection) {
    return;
  }

  if (selection.type === "wire") {
    disconnectNodeGraphConnection(selection.index, selection.kind || "signal");
    return;
  }

  const selectedNodeIds = nodeGraphSelectedNodeIds(selection);
  const hideOnlyNodeIds = new Set();
  const removableNodeIds = new Set();
  for (const nodeId of selectedNodeIds) {
    const node = nodeGraphPatchNode(nodeId);
    if (!nodeGraphNodeCanBeDeleted(node)) {
      continue;
    }
    if (nodeGraphNodeDeleteHidesOnly(node)) {
      hideOnlyNodeIds.add(nodeId);
    } else {
      removableNodeIds.add(nodeId);
    }
  }

  if (hideOnlyNodeIds.size) {
    nodeGraphMvp.live.inputActive = false;
    stopNodeGraphLiveInputSource();
  }

  if (removableNodeIds.size) {
    const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
    patch.nodes = patch.nodes.filter((node) => !removableNodeIds.has(node.id));
    patch.bypassedNodes = patch.bypassedNodes.filter((nodeId) => !removableNodeIds.has(nodeId));
    patch.connections = patch.connections.filter(
      (connection) =>
        !removableNodeIds.has(connection.sourceNode) &&
        !removableNodeIds.has(connection.destinationNode),
    );
    patch.modulations = patch.modulations.filter(
      (modulation) =>
        !removableNodeIds.has(modulation.sourceNode) &&
        !removableNodeIds.has(modulation.destinationNode),
    );
    setNodeGraphSelection(null);
    commitNodeGraphPatch(patch, {
      status: removableNodeIds.size === 1 ? "module deleted" : "modules deleted",
    });
    renderNodeGraphLiveControls();
    return;
  }

  if (hideOnlyNodeIds.size) {
    setNodeGraphSelection(null);
    applyNodeGraphPatchToDom();
    drawNodeGraphWires();
    scheduleNodeGraphLivePlanSync();
    renderNodeGraphLiveControls();
    setNodeGraphScriptStatus("input module hidden; script preserved", true);
  }
}

function nodeGraphStableSeed(text) {
  let seed = 0x12345678;
  for (const character of text) {
    seed = (Math.imul(seed ^ character.charCodeAt(0), 16777619)) >>> 0;
  }
  return seed || 0x12345678;
}
