function defaultNodeGraphModuleGridPoint(type) {
  const count = nodeGraphMvp.nodeTypeCounts[type] || 1;
  return {
    gx: 3 + count * 2,
    gy: 3 + count * 2,
  };
}

function ensureNodeGraphLiveInputModule() {
  if (nodeGraphMvp.patch.nodes.some((node) => node.type === "audioInput")) {
    return false;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const counts = nextNodeGraphTypeCounts(patch.nodes);
  const id = counts.audioInput > 0 ? `audioInput-${counts.audioInput + 1}` : "audioInput";
  const gridPoint = nodeGraphFindFreeModuleGridPoint("audioInput", patch.nodes, { gx: 0, gy: 1 });
  patch.nodes.push(createNodeGraphPatchNode("audioInput", {
    id,
    gx: gridPoint.gx,
    gy: gridPoint.gy,
  }));
  commitNodeGraphPatch(patch, { status: "input module shown" });
  return true;
}

function nodeGraphFindFreeModuleGridPoint(type, nodes = nodeGraphMvp.patch.nodes, preferred = null) {
  const start = preferred || defaultNodeGraphModuleGridPoint(type);
  for (let rowOffset = 0; rowOffset < 200; rowOffset += 1) {
    const candidate = {
      gx: start.gx,
      gy: start.gy + rowOffset,
      type,
    };
    const rect = nodeGraphPatchNodeGridRect(candidate);
    const overlaps = nodes.some((node) => nodeGraphGridRectsOverlap(rect, nodeGraphPatchNodeGridRect(node)));
    if (!overlaps) {
      return { gx: candidate.gx, gy: candidate.gy };
    }
  }
  return { gx: start.gx, gy: start.gy + 200 };
}

function nodeGraphPatchNodeGridRect(node) {
  return {
    bottom: node.gy + nodeGraphPatchNodeGridHeightUnits(node),
    left: node.gx,
    right: node.gx + nodeGraphPatchNodeGridWidthUnits(node),
    top: node.gy,
  };
}

function nodeGraphGridRectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function nodeGraphFindCopiedModuleGridPoint(sourceNode, nodes = nodeGraphMvp.patch.nodes) {
  const sourceRect = nodeGraphPatchNodeGridRect(sourceNode);
  const candidate = {
    gx: sourceNode.gx,
    gy: sourceRect.bottom + 1,
  };
  const maxSearchRows = 200;

  for (let offset = 0; offset < maxSearchRows; offset += 1) {
    const rect = nodeGraphPatchNodeGridRect({
      gx: candidate.gx,
      gy: candidate.gy + offset,
      type: sourceNode.type,
    });
    const overlaps = nodes.some((node) => nodeGraphGridRectsOverlap(rect, nodeGraphPatchNodeGridRect(node)));
    if (!overlaps) {
      return { gx: candidate.gx, gy: candidate.gy + offset };
    }
  }

  return { gx: candidate.gx, gy: candidate.gy + maxSearchRows };
}

function showNodeGraphModule(node, point = null) {
  const type = node;
  if (type === "output" || !Object.hasOwn(nodeGraphModuleDefinitions, type)) {
    return;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const counts = nextNodeGraphTypeCounts(patch.nodes);
  counts[type] = (counts[type] || 0) + 1;
  const id = `${type}-${counts[type]}`;
  const gridPoint = point ? nodeGraphPixelToGrid(point) : defaultNodeGraphModuleGridPoint(type);
  patch.nodes.push(createNodeGraphPatchNode(type, {
    id,
    gx: gridPoint.gx,
    gy: gridPoint.gy,
  }));
  commitNodeGraphPatch(patch, { status: "module added" });
}

function showPaletteNode(node) {
  showNodeGraphModule(node);
}

function addNodeGraphModuleFromContext(event) {
  showNodeGraphModule(event.currentTarget.dataset.contextModule, nodeGraphMvp.sceneContextPoint);
  closeNodeSceneContextMenu();
}

function copyNodeGraphModule(sourceNode) {
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const counts = nextNodeGraphTypeCounts(patch.nodes);
  counts[sourceNode.type] = (counts[sourceNode.type] || 0) + 1;
  const id = `${sourceNode.type}-${counts[sourceNode.type]}`;
  const gridPoint = nodeGraphFindCopiedModuleGridPoint(sourceNode, patch.nodes);
  patch.nodes.push({
    ...createNodeGraphPatchNode(sourceNode.type, {
      alias: sourceNode.alias,
      gx: gridPoint.gx,
      gy: gridPoint.gy,
      id,
      layout: sourceNode.layout,
      ui: sourceNode.ui,
      ...(Object.hasOwn(sourceNode, "widthGu") ? { widthGu: sourceNode.widthGu } : {}),
      ...(Object.hasOwn(sourceNode, "heightGu") ? { heightGu: sourceNode.heightGu } : {}),
    }),
    ...(sourceNode.layout ? { layout: normalizeNodeGraphTextBoxLayout(sourceNode.layout) } : {}),
    paramMeta: cloneNodeGraphParamMeta(sourceNode.paramMeta),
    params: { ...(sourceNode.params || {}) },
  });
  commitNodeGraphPatch(patch, { status: "module copied" });
  return id;
}

function copyNodeGraphModuleFromContext() {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (sourceNode && sourceNode.type !== "output") {
    const copiedNodeId = copyNodeGraphModule(sourceNode);
    if (copiedNodeId) {
      nodeGraphMvp.sceneContextTargetNode = copiedNodeId;
      setNodeGraphNodeSelection([copiedNodeId]);
    }
  }
  configureNodeSceneContextMenu("module");
}

function deleteNodeGraphSelectionFromContext() {
  deleteSelectedNodeGraphItem();
  const menu = document.getElementById("nodeSceneContextMenu");
  if (!menu || menu.hidden) {
    return;
  }
  if (nodeGraphMvp.selected?.type === "wire") {
    configureNodeSceneContextMenu("wire");
  } else if (nodeGraphSelectedNodeIds().size) {
    configureNodeSceneContextMenu("module");
  } else {
    configureNodeSceneContextMenu(menu.dataset.mode === "wire" ? "wire" : "module");
  }
}

function adjustNodeGraphModuleWidthFromContext(delta) {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (!sourceNode) {
    return;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === sourceNode.id);
  if (!targetNode) {
    return;
  }
  const currentWidthGu = nodeGraphPatchNodeGridWidthUnits(targetNode);
  const nextWidthGu = normalizeNodeGraphModuleWidthUnits(targetNode.type, currentWidthGu + delta);
  if (nextWidthGu === currentWidthGu) {
    configureNodeSceneContextMenu("module");
    return;
  }

  const defaultWidthGu = nodeGraphDefaultModuleGridWidthUnits(targetNode.type);
  if (nextWidthGu === defaultWidthGu) {
    delete targetNode.widthGu;
  } else {
    targetNode.widthGu = nextWidthGu;
  }
  commitNodeGraphPatch(patch, { status: "module width changed" });
  configureNodeSceneContextMenu("module");
}

function adjustNodeGraphTextBoxHeightFromContext(delta) {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (!sourceNode || sourceNode.type !== "textBox") {
    return;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === sourceNode.id);
  if (!targetNode) {
    return;
  }
  const currentHeightGu = nodeGraphPatchNodeGridHeightUnits(targetNode);
  const nextHeightGu = normalizeNodeGraphTextBoxHeightUnits(currentHeightGu + delta);
  if (nextHeightGu === currentHeightGu) {
    configureNodeSceneContextMenu("module");
    return;
  }

  const defaultHeightGu = nodeGraphModuleGridHeightUnitsForUi("textBox", targetNode.ui);
  if (nextHeightGu === defaultHeightGu) {
    delete targetNode.heightGu;
  } else {
    targetNode.heightGu = nextHeightGu;
  }
  commitNodeGraphPatch(patch, { status: "text box height changed" });
  configureNodeSceneContextMenu("module");
}

function adjustNodeGraphTextBoxTextSizeFromContext(delta) {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (!sourceNode || sourceNode.type !== "textBox") {
    return;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === sourceNode.id);
  if (!targetNode) {
    return;
  }
  const currentLayout = normalizeNodeGraphTextBoxLayout(targetNode.layout);
  const nextTextSizePercent = normalizeNodeGraphTextBoxTextSizePercent(
    currentLayout.textSizePercent + delta,
  );
  if (nextTextSizePercent === currentLayout.textSizePercent) {
    configureNodeSceneContextMenu("module");
    return;
  }
  targetNode.layout = normalizeNodeGraphTextBoxLayout({
    ...currentLayout,
    textSizePercent: nextTextSizePercent,
  });
  commitNodeGraphPatch(patch, { status: "text box text size changed" });
  configureNodeSceneContextMenu("module");
}

function setNodeGraphModuleAliasFromContext({ record = true } = {}) {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (!sourceNode) {
    return;
  }
  const input = document.getElementById("nodeSceneAliasInput");
  const alias = normalizeNodeGraphPatchNodeAlias(input?.value);
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === sourceNode.id);
  if (!targetNode) {
    return;
  }
  if (alias) {
    targetNode.alias = alias;
  } else {
    delete targetNode.alias;
  }
  commitNodeGraphPatch(patch, {
    record,
    status: alias ? "module alias changed" : "module alias cleared",
  });
  if (document.activeElement === input) {
    input.focus();
    input.setSelectionRange?.(input.value.length, input.value.length);
  }
}

function setNodeGraphTextBoxModeFromContext(textMode) {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (!sourceNode || sourceNode.type !== "textBox") {
    return;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === sourceNode.id);
  if (!targetNode) {
    return;
  }
  targetNode.layout = normalizeNodeGraphTextBoxLayout({
    ...(targetNode.layout || {}),
    textMode,
  });
  commitNodeGraphPatch(patch, { status: "text box mode changed" });
  configureNodeSceneContextMenu("module");
}

function setNodeGraphTextBoxTextFromContext({ record = true } = {}) {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (!sourceNode || sourceNode.type !== "textBox") {
    return;
  }
  const input = document.getElementById("nodeSceneTextBoxTextInput");
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === sourceNode.id);
  if (!targetNode) {
    return;
  }
  const currentLayout = normalizeNodeGraphTextBoxLayout(targetNode.layout);
  targetNode.layout = normalizeNodeGraphTextBoxLayout({
    ...currentLayout,
    text: input?.value ?? "",
  });
  commitNodeGraphPatch(patch, {
    record,
    status: "text box text changed",
  });
  if (document.activeElement === input) {
    input.focus();
  }
}

function setNodeGraphTextBoxHorizontalAlignFromContext(value) {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (!sourceNode || sourceNode.type !== "textBox") {
    return;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === sourceNode.id);
  if (!targetNode) {
    return;
  }
  const currentLayout = normalizeNodeGraphTextBoxLayout(targetNode.layout);
  targetNode.layout = normalizeNodeGraphTextBoxLayout({
    ...currentLayout,
    horizontalAlign: value,
  });
  commitNodeGraphPatch(patch, { status: "text box alignment changed" });
  configureNodeSceneContextMenu("module");
}

function setNodeGraphTextBoxVerticalAlignFromContext({ record = true } = {}) {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (!sourceNode || sourceNode.type !== "textBox") {
    return;
  }
  const input = document.getElementById("nodeSceneTextBoxVerticalAlign");
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === sourceNode.id);
  if (!targetNode) {
    return;
  }
  const currentLayout = normalizeNodeGraphTextBoxLayout(targetNode.layout);
  const verticalAlignPercent = normalizeNodeGraphTextBoxVerticalAlignPercent(input?.value);
  targetNode.layout = normalizeNodeGraphTextBoxLayout({
    ...currentLayout,
    verticalAlignPercent,
  });
  commitNodeGraphPatch(patch, {
    record,
    status: "text box vertical position changed",
  });
  document.getElementById("nodeSceneTextBoxVerticalAlignValue").textContent = `${verticalAlignPercent}%`;
  if (document.activeElement === input) {
    input.focus();
  }
}

function toggleNodeGraphModuleButtonsFromContext() {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (!sourceNode) {
    return;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === sourceNode.id);
  if (!targetNode) {
    return;
  }
  const ui = normalizeNodeGraphPatchNodeUi(targetNode.ui);
  ui.buttonsHidden = !ui.buttonsHidden;
  if (ui.buttonsHidden || ui.titleHidden) {
    targetNode.ui = ui;
  } else {
    delete targetNode.ui;
  }
  commitNodeGraphPatch(patch, {
    status: ui.buttonsHidden ? "module buttons hidden" : "module buttons shown",
  });
  configureNodeSceneContextMenu("module");
}

function toggleNodeGraphModuleTitleFromContext() {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (!sourceNode) {
    return;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === sourceNode.id);
  if (!targetNode) {
    return;
  }
  const ui = normalizeNodeGraphPatchNodeUi(targetNode.ui);
  ui.titleHidden = !ui.titleHidden;
  if (ui.buttonsHidden || ui.titleHidden) {
    targetNode.ui = ui;
  } else {
    delete targetNode.ui;
  }
  commitNodeGraphPatch(patch, {
    status: ui.titleHidden ? "module title hidden" : "module title shown",
  });
  configureNodeSceneContextMenu("module");
}

function copySelectedNodeGraphModule() {
  const selectedNodeIds = [...nodeGraphSelectedNodeIds()];
  if (selectedNodeIds.length !== 1) {
    return false;
  }
  const sourceNode = nodeGraphPatchNode(selectedNodeIds[0]);
  if (!sourceNode || sourceNode.type === "output") {
    return false;
  }
  copyNodeGraphModule(sourceNode);
  return true;
}

function deleteNodeGraphModuleFromContext() {
  const targetNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (targetNode && targetNode.type !== "output") {
    const targetNodeIds = new Set([targetNode.id]);
    const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
    patch.nodes = patch.nodes.filter((node) => !targetNodeIds.has(node.id));
    patch.bypassedNodes = patch.bypassedNodes.filter((nodeId) => !targetNodeIds.has(nodeId));
    patch.connections = patch.connections.filter(
      (connection) =>
        !targetNodeIds.has(connection.sourceNode) &&
        !targetNodeIds.has(connection.destinationNode),
    );
    patch.modulations = patch.modulations.filter(
      (modulation) =>
        !targetNodeIds.has(modulation.sourceNode) &&
        !targetNodeIds.has(modulation.destinationNode),
    );
    commitNodeGraphPatch(patch, { status: "module deleted" });
    nodeGraphMvp.sceneContextTargetNode = null;
    if (nodeGraphSelectedNodeIds().has(targetNode.id)) {
      setNodeGraphSelection(null);
    } else {
      configureNodeSceneContextMenu("module");
    }
    return;
  }
  configureNodeSceneContextMenu("module");
}
