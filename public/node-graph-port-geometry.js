function nodeGraphCanonicalPortForNode(node, port, io) {
  const patchNode = typeof node === "string" ? nodeGraphPatchNode(node) : node;
  const type = patchNode?.type || (typeof node === "string" ? nodeGraphPatchNodeType(node) : "");
  if (io === "input") {
    return nodeGraphCanonicalInputPort(type, port);
  }
  if (io === "output") {
    return nodeGraphCanonicalOutputPort(type, port);
  }
  return String(port || "").trim();
}

function nodeGraphPortSelector(node, port, io) {
  const canonicalPort = nodeGraphCanonicalPortForNode(node, port, io);
  return `.node-port.${io}[data-node="${CSS.escape(node)}"][data-port="${CSS.escape(canonicalPort)}"]`;
}

function nodeGraphModulationPortSelector(node, parameter) {
  return `.node-param-port.modulation-input[data-node="${CSS.escape(node)}"][data-param="${CSS.escape(parameter)}"]`;
}

function markNodeGraphPortConnected(node, port, io) {
  const canonicalPort = nodeGraphCanonicalPortForNode(node, port, io);
  nodeGraphZoomSurface()
    ?.querySelector(nodeGraphPortSelector(node, canonicalPort, io))
    ?.classList.add("connected-port");
}

function markNodeGraphModulationPortConnected(node, parameter) {
  nodeGraphZoomSurface()
    ?.querySelector(nodeGraphModulationPortSelector(node, parameter))
    ?.classList.add("connected-port");
}

function nodeGraphPortCenter(node, port, io) {
  const surface = nodeGraphZoomSurface();
  const canonicalPort = nodeGraphCanonicalPortForNode(node, port, io);
  const element = surface.querySelector(nodeGraphPortSelector(node, canonicalPort, io));
  return nodeGraphElementCenter(element, io);
}

function nodeGraphModulationPortCenter(node, parameter) {
  const surface = nodeGraphZoomSurface();
  const element = surface.querySelector(nodeGraphModulationPortSelector(node, parameter));
  return nodeGraphElementCenter(element, "modulation");
}

function nodeGraphElementCenter(element, io = null) {
  const surface = nodeGraphZoomSurface();
  if (!element) {
    return { x: 0, y: 0 };
  }

  const surfaceRect = surface.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const zoom = nodeGraphZoom();
  const centerX = elementRect.left + elementRect.width / 2;
  const anchorX = io === "output"
    ? elementRect.right
    : io === "input" || io === "modulation"
      ? elementRect.left
      : centerX;
  return {
    x: (anchorX - surfaceRect.left) / zoom,
    y: (elementRect.top + elementRect.height / 2 - surfaceRect.top) / zoom,
  };
}

function nodeGraphCssColor(property, fallback) {
  const workspace = document.getElementById("nodeGraphWorkspace");
  const value = workspace
    ? getComputedStyle(workspace).getPropertyValue(property).trim()
    : "";
  return value || fallback;
}

function nodeGraphPortWireColor(node, port, io) {
  const canonicalPort = nodeGraphCanonicalPortForNode(node, port, io);
  if (io === "input") {
    return nodeGraphCssColor("--node-input-fill", "#7fc7d9");
  }
  if (io === "modulation") {
    return nodeGraphCssColor("--node-mod-input-fill", "#b184ff");
  }
  if (nodeGraphParameterOutputPort(nodeGraphPatchNode(node) || nodeGraphPatchNodeType(node), canonicalPort)) {
    return nodeGraphCssColor("--node-param-output-fill", "#66e0a3");
  }
  return nodeGraphCssColor("--node-output-fill", "#e2a86d");
}
