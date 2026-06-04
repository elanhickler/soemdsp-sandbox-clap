function renderNodeGraphUiView() {
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (!workspace) {
    return;
  }

  const visibleNodeIds = nodeGraphUiViewNodeIds();
  for (const node of workspace.querySelectorAll(".dsp-node")) {
    node.classList.toggle("ui-view-visible", visibleNodeIds.has(node.dataset.node));
  }
}

function nodeGraphUiViewIsActive() {
  return document.getElementById("nodeGraphWorkspace")?.classList.contains("ui-view-mode") === true;
}

function setNodeGraphUiViewActive(active) {
  document.getElementById("nodeGraphWorkspace")?.classList.toggle("ui-view-mode", Boolean(active));
  renderNodeGraphUiView();
}

function nodeGraphUiViewNodeIds() {
  const patchNodeIds = new Set(nodeGraphMvp.patch.nodes.map((node) => node.id));
  const items = normalizeNodeGraphPatchUiItems(nodeGraphMvp.patch.uiItems, { nodeIds: patchNodeIds });
  return new Set(items.map((item) => item.sourceNodeId).filter(Boolean));
}

function nodeGraphNodeIsInUiView(nodeId) {
  return nodeGraphUiViewNodeIds().has(nodeId);
}
