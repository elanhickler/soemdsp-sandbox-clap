function nodeGraphGridSize() {
  return normalizeNodeGraphPatchGrid(nodeGraphMvp.patch?.grid).sizePx;
}

function nodeGraphGridWidth() {
  return normalizeNodeGraphPatchGrid(nodeGraphMvp.patch?.grid).widthPx;
}

function nodeGraphGridHeight() {
  return normalizeNodeGraphPatchGrid(nodeGraphMvp.patch?.grid).heightPx;
}

function withNodeGraphWorkspaceContentAnchored(workspace, update) {
  const before = workspace.getBoundingClientRect();
  update();
  const after = workspace.getBoundingClientRect();
  const deltaX = before.left - after.left;
  const deltaY = before.top - after.top;
  if (
    !Number.isFinite(deltaX) ||
    !Number.isFinite(deltaY) ||
    (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001)
  ) {
    return;
  }
  const pan = nodeGraphMvp.pan || { x: 0, y: 0 };
  nodeGraphMvp.pan = {
    x: (Number(pan.x) || 0) + deltaX,
    y: (Number(pan.y) || 0) + deltaY,
  };
  applyNodeGraphPan();
}

function nodeGraphWorkspaceChromeSize(axis) {
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (!workspace) {
    return 0;
  }
  const styles = getComputedStyle(workspace);
  const keys = axis === "y"
    ? ["borderTopWidth", "borderBottomWidth", "paddingTop", "paddingBottom"]
    : ["borderLeftWidth", "borderRightWidth", "paddingLeft", "paddingRight"];
  return keys.reduce((total, key) => total + (Number.parseFloat(styles[key]) || 0), 0);
}

function nodeGraphWorkspaceWidthCss(widthPx) {
  return `${Math.round(widthPx + nodeGraphWorkspaceChromeSize("x"))}px`;
}

function nodeGraphWorkspaceHeightCss(heightPx) {
  return `${Math.round(heightPx + nodeGraphWorkspaceChromeSize("y"))}px`;
}

function defaultNodeGraphModuleGridInsetPx() {
  return 6;
}

function nodeGraphModuleGridInsetPx() {
  const inputValue = Number(document.getElementById("nodeUiDevModuleGridInset")?.value);
  if (Number.isFinite(inputValue)) {
    return Math.max(0, Math.min(20, inputValue));
  }
  return defaultNodeGraphModuleGridInsetPx();
}

function nodeGraphGridSnapOffset() {
  return nodeGraphModuleGridInsetPx();
}

function nodeGraphGridToPixel(point) {
  const offset = nodeGraphGridSnapOffset();
  return {
    x: point.gx * nodeGraphGridWidth() + offset,
    y: point.gy * nodeGraphGridHeight() + offset,
  };
}

function nodeGraphPixelToGrid(point) {
  const offset = nodeGraphGridSnapOffset();
  return {
    gx: Math.round((point.x - offset) / nodeGraphGridWidth()),
    gy: Math.round((point.y - offset) / nodeGraphGridHeight()),
  };
}

function snapNodeGraphPointToGrid(point) {
  return nodeGraphGridToPixel(nodeGraphPixelToGrid(point));
}
