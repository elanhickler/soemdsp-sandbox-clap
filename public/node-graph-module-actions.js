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
