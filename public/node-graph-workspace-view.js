function applyNodeGraphPan() {
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (!workspace) {
    return;
  }
  const pan = nodeGraphMvp.pan || { x: 0, y: 0 };
  workspace.style.setProperty("--node-graph-pan-x", `${pan.x}px`);
  workspace.style.setProperty("--node-graph-pan-y", `${pan.y}px`);
  workspace.dataset.panX = String(Math.round(pan.x));
  workspace.dataset.panY = String(Math.round(pan.y));
  updateNodeGraphGridHeatmap();
  drawNodeGraphWires();
}

function setNodeGraphPan(x, y) {
  nodeGraphMvp.pan = {
    x: Number.isFinite(Number(x)) ? Number(x) : 0,
    y: Number.isFinite(Number(y)) ? Number(y) : 0,
  };
  applyNodeGraphPan();
}

function snapNodeGraphWorkspaceEdgesToGrid(zoom = nodeGraphZoom()) {
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (!workspace) {
    return;
  }
  const rect = workspace.getBoundingClientRect();
  const chromeWidth = nodeGraphWorkspaceChromeSize("x");
  const chromeHeight = nodeGraphWorkspaceChromeSize("y");
  const contentWidth = Math.max(0, rect.width - chromeWidth);
  const contentHeight = Math.max(0, rect.height - chromeHeight);
  const renderedGridWidth = nodeGraphGridWidth() * zoom;
  const renderedGridHeight = nodeGraphGridHeight() * zoom;
  const snapContentSize = (value, step, minGridUnits) => {
    if (!Number.isFinite(step) || step <= 0) {
      return value;
    }
    const min = step * minGridUnits;
    return Math.max(min, Math.round(value / step) * step);
  };
  const snappedContentWidth = snapContentSize(
    contentWidth,
    renderedGridWidth,
    nodeGraphWorkspaceViewLimits.minWidthGu,
  );
  const snappedContentHeight = snapContentSize(
    contentHeight,
    renderedGridHeight,
    nodeGraphWorkspaceViewLimits.minHeightGu,
  );
  withNodeGraphWorkspaceContentAnchored(workspace, () => {
    const widthCss = nodeGraphWorkspaceWidthCss(snappedContentWidth);
    const heightCss = nodeGraphWorkspaceHeightCss(snappedContentHeight);
    if (document.getElementById("nodeWiringPanel")?.classList.contains("modular-only-view")) {
      workspace.style.setProperty("--node-modular-only-view-width", widthCss);
      workspace.style.setProperty("--node-modular-only-view-height", heightCss);
    } else {
      workspace.style.width = widthCss;
      workspace.style.height = heightCss;
      workspace.style.removeProperty("aspect-ratio");
    }
  });
  drawNodeGraphWires();
}

function snapNodeGraphPanValueToGrid(value, gridSize, zoom = nodeGraphZoom()) {
  const step = gridSize * zoom;
  return Number.isFinite(step) && step > 0
    ? Math.round((Number(value) || 0) / step) * step
    : Number(value) || 0;
}

function renderNodeGraphSnapGridButton() {
  const button = document.getElementById("nodeSnapGridViewButton");
  if (!button) {
    return;
  }
  const active = Boolean(nodeGraphMvp.snapGridWhilePanning);
  button.classList.toggle("active", active);
  button.setAttribute("aria-pressed", String(active));
  button.removeAttribute("title");
}

function alignNodeGraphViewToGridWithOptions(options = {}) {
  const workspace = document.getElementById("nodeGraphWorkspace");
  const rect = workspace?.getBoundingClientRect();
  const oldZoom = nodeGraphZoom();
  const oldPan = nodeGraphMvp.pan || { x: 0, y: 0 };
  const zoomStep = 1 / Math.max(1, nodeGraphGridSize());
  const nextZoom = Math.max(
    nodeGraphZoomLimits.min,
    Math.min(nodeGraphZoomLimits.max, Math.round(oldZoom / zoomStep) * zoomStep),
  );
  const anchor = rect
    ? {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
    : null;
  const anchoredContentPoint = rect && anchor
    ? {
      x: (anchor.x - rect.left - (Number(oldPan.x) || 0)) / oldZoom,
      y: (anchor.y - rect.top - (Number(oldPan.y) || 0)) / oldZoom,
    }
    : null;
  nodeGraphMvp.zoom = nextZoom;
  applyNodeGraphZoom();
  if (options.snapWorkspaceEdges) {
    snapNodeGraphWorkspaceEdgesToGrid(nextZoom);
  }
  const nextRect = workspace?.getBoundingClientRect();
  const nextAnchor = nextRect
    ? {
      x: nextRect.left + nextRect.width / 2,
      y: nextRect.top + nextRect.height / 2,
    }
    : anchor;
  const unsnappedPan = nextRect && nextAnchor && anchoredContentPoint
    ? {
      x: nextAnchor.x - nextRect.left - anchoredContentPoint.x * nextZoom,
      y: nextAnchor.y - nextRect.top - anchoredContentPoint.y * nextZoom,
    }
    : oldPan;
  const snapPan = (value, gridSize) => snapNodeGraphPanValueToGrid(value, gridSize, nextZoom);
  nodeGraphMvp.pan = {
    x: snapPan(unsnappedPan.x, nodeGraphGridWidth()),
    y: snapPan(unsnappedPan.y, nodeGraphGridHeight()),
  };
  applyNodeGraphPan();
  setNodeInteractionHelp(options.snapWorkspaceEdges
    ? "View snapped to complete grid cells."
    : "View aligned to grid. Hotkey: Ctrl+Shift+G.");
}

function alignNodeGraphViewToGrid() {
  alignNodeGraphViewToGridWithOptions();
}

function snapNodeGraphViewToGrid() {
  alignNodeGraphViewToGridWithOptions({ snapWorkspaceEdges: true });
}

function handleNodeGraphSnapGridButtonClick(event) {
  if (event.shiftKey) {
    nodeGraphMvp.snapGridWhilePanning = !nodeGraphMvp.snapGridWhilePanning;
    renderNodeGraphSnapGridButton();
    setNodeInteractionHelp(nodeGraphMvp.snapGridWhilePanning
      ? "Grid snap while moving is on."
      : "Grid snap while moving is off.");
    return;
  }
  snapNodeGraphViewToGrid();
}

function nodeGraphWorkspaceCurrentGridSize() {
  const workspace = document.getElementById("nodeGraphWorkspace");
  const rect = workspace.getBoundingClientRect();
  const contentWidth = Math.max(0, rect.width - nodeGraphWorkspaceChromeSize("x"));
  const contentHeight = Math.max(0, rect.height - nodeGraphWorkspaceChromeSize("y"));
  return {
    heightGu: Math.max(
      nodeGraphWorkspaceViewLimits.minHeightGu,
      Math.round(contentHeight / nodeGraphGridHeight()),
    ),
    widthGu: Math.max(
      nodeGraphWorkspaceViewLimits.minWidthGu,
      Math.round(contentWidth / nodeGraphGridWidth()),
    ),
  };
}

function setNodeGraphWorkspacePreviewSize(widthGu, heightGu) {
  const workspace = document.getElementById("nodeGraphWorkspace");
  withNodeGraphWorkspaceContentAnchored(workspace, () => {
    workspace.style.width = nodeGraphWorkspaceWidthCss(widthGu * nodeGraphGridWidth());
    workspace.style.height = nodeGraphWorkspaceHeightCss(heightGu * nodeGraphGridHeight());
    workspace.style.removeProperty("aspect-ratio");
  });
  workspace.dataset.widthGu = String(widthGu);
  workspace.dataset.heightGu = String(heightGu);
  drawNodeGraphWires();
}

function beginNodeGraphWorkspaceResize(event) {
  if (event.button !== 0) {
    return;
  }
  if (!nodeGraphScriptReadyForGraphAction("resize workspace")) {
    return;
  }
  const workspace = document.getElementById("nodeGraphWorkspace");
  const startSize = nodeGraphWorkspaceCurrentGridSize();
  nodeGraphMvp.workspaceResizing = {
    heightGu: startSize.heightGu,
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startHeightGu: startSize.heightGu,
    startWidthGu: startSize.widthGu,
    widthGu: startSize.widthGu,
  };
  workspace.classList.add("resizing");
  event.currentTarget.setPointerCapture(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function dragNodeGraphWorkspaceResize(event) {
  const drag = nodeGraphMvp.workspaceResizing;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }
  const widthGu = Math.max(
    nodeGraphWorkspaceViewLimits.minWidthGu,
    drag.startWidthGu + Math.round((event.clientX - drag.startClientX) / nodeGraphGridWidth()) * 2,
  );
  const heightGu = Math.max(
    nodeGraphWorkspaceViewLimits.minHeightGu,
    drag.startHeightGu + Math.round((event.clientY - drag.startClientY) / nodeGraphGridHeight()),
  );
  if (widthGu === drag.widthGu && heightGu === drag.heightGu) {
    return;
  }
  drag.widthGu = widthGu;
  drag.heightGu = heightGu;
  setNodeGraphWorkspacePreviewSize(widthGu, heightGu);
}

function endNodeGraphWorkspaceResize(event) {
  const drag = nodeGraphMvp.workspaceResizing;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }
  const handle = document.getElementById("nodeGraphResizeHandle");
  if (handle?.hasPointerCapture?.(event.pointerId)) {
    handle.releasePointerCapture(event.pointerId);
  }
  document.getElementById("nodeGraphWorkspace")?.classList.remove("resizing");
  nodeGraphMvp.workspaceResizing = null;
  if (drag.widthGu === drag.startWidthGu && drag.heightGu === drag.startHeightGu) {
    applyNodeGraphWorkspaceView();
    return;
  }
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  patch.view = {
    heightGu: drag.heightGu,
    widthGu: drag.widthGu,
  };
  commitNodeGraphPatch(patch, {
    markPending: false,
    status: "workspace resized",
  });
}

function handleNodeGraphWindowResize() {
  applyNodeGraphWorkspaceView();
  drawNodeGraphWires();
}

function beginNodeGraphWorkspacePan(event) {
  if (event.button !== 1 || event.ctrlKey || event.altKey) {
    return;
  }

  const workspace = document.getElementById("nodeGraphWorkspace");
  const pan = nodeGraphMvp.pan || { x: 0, y: 0 };
  nodeGraphMvp.workspacePanning = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startPanX: pan.x,
    startPanY: pan.y,
  };
  workspace.classList.add("panning");
  workspace.setPointerCapture(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function dragNodeGraphWorkspacePan(event) {
  const drag = nodeGraphMvp.workspacePanning;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  const nextX = drag.startPanX + event.clientX - drag.startClientX;
  const nextY = drag.startPanY + event.clientY - drag.startClientY;
  setNodeGraphPan(
    nodeGraphMvp.snapGridWhilePanning
      ? snapNodeGraphPanValueToGrid(nextX, nodeGraphGridWidth())
      : nextX,
    nodeGraphMvp.snapGridWhilePanning
      ? snapNodeGraphPanValueToGrid(nextY, nodeGraphGridHeight())
      : nextY,
  );
  event.preventDefault();
  event.stopPropagation();
}

function endNodeGraphWorkspacePan(event) {
  const drag = nodeGraphMvp.workspacePanning;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  const workspace = document.getElementById("nodeGraphWorkspace");
  if (workspace?.hasPointerCapture?.(event.pointerId)) {
    workspace.releasePointerCapture(event.pointerId);
  }
  workspace?.classList.remove("panning");
  nodeGraphMvp.workspacePanning = null;
  drawNodeGraphWires();
  event.preventDefault();
  event.stopPropagation();
}

function preventNodeGraphMiddleMouseAuxClick(event) {
  if (event.button === 1 && event.target.closest("#nodeGraphWorkspace")) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function preventNodeGraphMiddleMouseDefault(event) {
  if (event.button === 1 && event.target.closest("#nodeGraphWorkspace")) {
    event.preventDefault();
  }
}
