const nodeGraphImageLayoutKind = "image";
const nodeGraphImageAcceptedTypes = Object.freeze(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);

function normalizeNodeGraphImageDataUrl(value) {
  const text = String(value || "");
  if (!/^data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(text)) {
    return "";
  }
  return text.length <= 3_000_000 ? text : "";
}

function normalizeNodeGraphImageLayout(layout = {}) {
  const source = layout && typeof layout === "object" ? layout : {};
  return {
    dataUrl: normalizeNodeGraphImageDataUrl(source.dataUrl || source.src),
    fileName: nodeGraphOneLineText(source.fileName || source.name || "trace-image").slice(0, 96),
    kind: nodeGraphImageLayoutKind,
    refreshedAt: Math.max(0, Math.floor(Number(source.refreshedAt) || 0)),
  };
}

function nodeGraphImageLayoutForNode(node) {
  const patchNode = typeof node === "string" ? nodeGraphPatchNode(node) : node;
  return normalizeNodeGraphImageLayout(patchNode?.layout);
}

function nodeGraphImageFileName(layout = {}) {
  const normalized = normalizeNodeGraphImageLayout(layout);
  const base = nodeGraphOneLineText(normalized.fileName || "trace-image").replace(/[\\/:*?"<>|]+/g, "-") || "trace-image";
  const extensionMatch = normalized.dataUrl.match(/^data:image\/([^;]+)/i);
  const extension = (extensionMatch?.[1] || "png").replace("jpeg", "jpg").replace("svg+xml", "svg");
  return base.toLowerCase().endsWith(`.${extension}`) ? base : `${base}.${extension}`;
}

function createNodeGraphImageBody(nodeId) {
  const body = document.createElement("div");
  body.className = "node-image-body";
  body.dataset.node = nodeId;

  const preview = document.createElement("div");
  preview.className = "node-image-preview";
  preview.dataset.nodeImagePreview = nodeId;
  preview.setAttribute("aria-label", "Image preview");

  const status = document.createElement("span");
  status.className = "node-image-status";
  status.dataset.nodeImageStatus = nodeId;
  status.textContent = "no image";
  preview.append(status);
  body.append(preview);

  renderNodeGraphImageBody(body, nodeId);
  return body;
}

function renderNodeGraphImageBody(body, nodeId = body?.dataset?.node) {
  const preview = body?.querySelector?.("[data-node-image-preview]");
  const status = body?.querySelector?.("[data-node-image-status]");
  if (!preview || !status || !nodeId) {
    return;
  }
  const layout = nodeGraphImageLayoutForNode(nodeId);
  preview.style.backgroundImage = layout.dataUrl ? `url("${layout.dataUrl}")` : "";
  preview.dataset.hasImage = layout.dataUrl ? "true" : "false";
  status.textContent = layout.dataUrl ? layout.fileName || "image loaded" : "no image";
}

function refreshNodeGraphImageBodies() {
  for (const body of document.querySelectorAll(".node-image-body")) {
    renderNodeGraphImageBody(body);
  }
}

function nodeGraphImageOutputDataUrl(nodeId) {
  const node = nodeGraphPatchNode(nodeId);
  if (!node || node.type !== "image") {
    return "";
  }
  return nodeGraphImageLayoutForNode(node).dataUrl;
}

function nodeGraphTraceImageDataUrl() {
  const patch = nodeGraphMvp.patch || {};
  const connection = (patch.connections || []).find((wire) => {
    const destinationNode = nodeGraphPatchNode(wire.destinationNode);
    return destinationNode?.type === "sandboxVisuals" &&
      nodeGraphCanonicalInputPort("sandboxVisuals", wire.destinationPort) === "Trace Image";
  });
  if (!connection) {
    return "";
  }
  const sourceNode = nodeGraphPatchNode(connection.sourceNode);
  if (sourceNode?.type !== "image" || connection.sourcePort !== "Image") {
    return "";
  }
  return nodeGraphImageOutputDataUrl(sourceNode.id);
}
