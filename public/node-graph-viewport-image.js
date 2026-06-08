function nodeGraphViewportImageFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `soemdsp-modular-view-${stamp}.png`;
}

function nodeGraphViewportExportFileName(extension) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `soemdsp-modular-view-${stamp}.${extension}`;
}

const nodeGraphViewportDefaultDownloadFolder = "C:\\Users\\argit\\Downloads";

function nodeGraphViewportFullDownloadPath(fileName, folder = nodeGraphViewportDefaultDownloadFolder) {
  const safeFileName = String(fileName || "").trim();
  const safeFolder = String(folder || nodeGraphViewportDefaultDownloadFolder).trim();
  if (!safeFileName) {
    return "";
  }
  if (/^[A-Za-z]:[\\/]/.test(safeFileName) || safeFileName.startsWith("\\\\")) {
    return safeFileName;
  }
  return `${safeFolder.replace(/[\\/]+$/, "")}\\${safeFileName}`;
}

function setNodeGraphViewportLastFileMade(fileName, options = {}) {
  const folderBox = document.getElementById("nodeViewportLastFolderBox");
  const fileBox = document.getElementById("nodeViewportLastFilePathBox");
  const folderButton = document.getElementById("nodeViewportOpenFolderButton");
  const fileButton = document.getElementById("nodeViewportOpenFileButton");
  if (!folderBox && !fileBox && !folderButton && !fileButton) {
    return;
  }
  const label = String(options.label || "last file").trim() || "last file";
  const folderPath = String(options.folder || nodeGraphViewportDefaultDownloadFolder);
  const filePath = fileName ? nodeGraphViewportFullDownloadPath(fileName, folderPath) : label;
  if (folderBox) {
    folderBox.value = folderPath;
    folderBox.title = folderPath;
  }
  if (folderButton) {
    folderButton.dataset.path = folderPath;
    folderButton.title = `Open ${folderPath}`;
    folderButton.disabled = false;
    folderButton.setAttribute("aria-disabled", "false");
  }
  if (fileBox) {
    fileBox.value = filePath;
    fileBox.title = filePath;
    fileBox.dataset.fileName = fileName || "";
  }
  if (fileButton) {
    fileButton.dataset.path = fileName ? filePath : "";
    fileButton.title = fileName ? `Open ${filePath}` : "No exported file yet";
    fileButton.disabled = !fileName;
    fileButton.setAttribute("aria-disabled", fileName ? "false" : "true");
  }
}

async function openNodeGraphViewportPath(path) {
  const value = String(path || "").trim();
  if (!value || value === "file path: none") {
    return false;
  }
  try {
    const response = await fetch("/api/open-path", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: value }),
    });
    const payload = await response.json().catch(() => ({}));
    return Boolean(response.ok && payload?.ok);
  } catch (_error) {
    return false;
  }
}

async function openNodeGraphViewportPathButtonValue(event) {
  const button = event.target?.closest?.("#nodeViewportOpenFolderButton, #nodeViewportOpenFileButton");
  if (!button || button.disabled) {
    return;
  }
  event.preventDefault?.();
  const path = String(button.dataset.path || "");
  const opened = await openNodeGraphViewportPath(path);
  button.dataset.opened = opened ? "true" : "false";
}

function bindNodeGraphViewportPathButtons() {
  for (const button of document.querySelectorAll("#nodeViewportOpenFolderButton, #nodeViewportOpenFileButton")) {
    if (button.dataset.pathButtonBound === "true") {
      continue;
    }
    button.dataset.pathButtonBound = "true";
    button.addEventListener("click", openNodeGraphViewportPathButtonValue);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindNodeGraphViewportPathButtons, { once: true });
} else {
  bindNodeGraphViewportPathButtons();
}

function nodeGraphViewportCanvasBlob(canvas, type = "image/png", quality) {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    } catch {
      resolve(null);
    }
  });
}

function downloadNodeGraphViewportBlob(blob, fileName) {
  if (!blob) {
    return false;
  }
  const controls = document.getElementById("nodeViewportExportControls");
  const oldLink = document.getElementById("nodeViewportExportDownloadLink");
  if (oldLink?.dataset.objectUrl) {
    URL.revokeObjectURL(oldLink.dataset.objectUrl);
  }
  oldLink?.remove();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.id = "nodeViewportExportDownloadLink";
  link.className = "node-viewport-export-download-link";
  link.href = url;
  link.download = fileName;
  link.dataset.objectUrl = url;
  link.textContent = `${fileName.split(".").pop().toUpperCase()} Ready`;
  (controls || document.body).append(link);
  setNodeGraphViewportLastFileMade(fileName);
  try {
    link.click();
    return true;
  } catch (_error) {
    console.warn("Viewport export download was blocked; keeping save link", _error);
    return false;
  }
}

function openNodeGraphYoutubeUploadPage() {
  const url = "https://studio.youtube.com/channel/UC/videos/upload";
  try {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    return Boolean(opened);
  } catch (_error) {
    return false;
  }
}

function nodeGraphViewportDefaultYoutubeTitle() {
  const patchName = document.getElementById("patchNameValue")?.value
    || document.getElementById("nodePatchNameHeader")?.value
    || "";
  return String(patchName || "").trim() || "Soundemote Sandbox Patch";
}

function promptNodeGraphYoutubeUploadMetadata() {
  const title = window.prompt("YouTube title", nodeGraphViewportDefaultYoutubeTitle());
  if (title === null) {
    return null;
  }
  const cleanTitle = String(title).trim();
  if (!cleanTitle) {
    window.alert("YouTube upload needs a title.");
    return null;
  }
  const description = window.prompt("YouTube description", "Generated with Soundemote Sandbox.");
  if (description === null) {
    return null;
  }
  return {
    description: String(description),
    title: cleanTitle,
  };
}

function nodeGraphViewportBlobBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",").pop() : result);
    }, { once: true });
    reader.addEventListener("error", () => reject(new Error("video encode failed")), { once: true });
    reader.readAsDataURL(blob);
  });
}

async function uploadNodeGraphViewportYoutubeVideo(blob, metadata, fileName) {
  const videoBase64 = await nodeGraphViewportBlobBase64(blob);
  const response = await fetch("/api/youtube/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description: metadata.description,
      fileName,
      mimeType: blob.type || "video/mp4",
      title: metadata.title,
      videoBase64,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    const error = payload?.setup || payload?.error || "YouTube upload failed";
    throw new Error(error);
  }
  return payload;
}

function nodeGraphViewportExportTargetWidth(fallbackWidth = 1280) {
  const input = document.getElementById("nodeViewportExportWidthInput");
  const value = Number.parseInt(input?.value, 10);
  if (Number.isFinite(value)) {
    return Math.max(64, Math.min(8192, Math.round(value)));
  }
  return Math.max(64, Math.min(8192, Math.round(fallbackWidth)));
}

function nodeGraphViewportExportSeconds() {
  const input = document.getElementById("nodeViewportExportSecondsInput");
  const value = Number.parseFloat(input?.value);
  const seconds = Number.isFinite(value) && value > 0 ? value : 2;
  return Math.max(0.25, Math.min(60, seconds));
}

function nodeGraphViewportRoundedRectPath(context, x, y, width, height, radius) {
  const safeRadius = Math.max(0, Math.min(radius, width * 0.5, height * 0.5));
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
}

function drawNodeGraphViewportFallbackGrid(context, width, height, gridWidth, gridHeight, pan, zoom) {
  context.fillStyle = "#0d0d0d";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(255, 255, 255, 0.075)";
  context.lineWidth = 1;
  const stepX = Math.max(4, gridWidth * zoom);
  const stepY = Math.max(4, gridHeight * zoom);
  const startX = ((Number(pan.x) || 0) % stepX + stepX) % stepX;
  const startY = ((Number(pan.y) || 0) % stepY + stepY) % stepY;
  context.beginPath();
  for (let x = startX; x <= width; x += stepX) {
    context.moveTo(Math.round(x) + 0.5, 0);
    context.lineTo(Math.round(x) + 0.5, height);
  }
  for (let y = startY; y <= height; y += stepY) {
    context.moveTo(0, Math.round(y) + 0.5);
    context.lineTo(width, Math.round(y) + 0.5);
  }
  context.stroke();
}

function drawNodeGraphViewportFallbackWires(context, workspace, zoom, pan) {
  const svg = document.getElementById("nodeWireSvg");
  if (!svg || typeof Path2D !== "function") {
    return;
  }
  context.save();
  context.translate(Number(pan.x) || 0, Number(pan.y) || 0);
  context.scale(zoom, zoom);
  for (const path of svg.querySelectorAll("path")) {
    const d = path.getAttribute("d");
    if (!d) {
      continue;
    }
    const style = getComputedStyle(path);
    context.strokeStyle = style.stroke && style.stroke !== "none" ? style.stroke : "rgba(127, 199, 217, 0.82)";
    context.globalAlpha = Number.parseFloat(style.opacity) || 1;
    context.lineWidth = Math.max(1, Number.parseFloat(style.strokeWidth) || 4);
    context.lineCap = "round";
    context.lineJoin = "round";
    try {
      context.stroke(new Path2D(d));
    } catch {
      // Ignore paths the browser cannot parse into Canvas Path2D.
    }
  }
  context.restore();
  context.globalAlpha = 1;
}

function drawNodeGraphViewportFallbackModules(context, workspace) {
  const workspaceRect = workspace.getBoundingClientRect();
  context.textBaseline = "top";
  for (const node of workspace.querySelectorAll(".dsp-node:not(.removed):not([hidden])")) {
    const rect = node.getBoundingClientRect();
    const x = rect.left - workspaceRect.left;
    const y = rect.top - workspaceRect.top;
    const width = rect.width;
    const height = rect.height;
    if (width <= 0 || height <= 0) {
      continue;
    }
    nodeGraphViewportRoundedRectPath(context, x, y, width, height, 5);
    context.fillStyle = "rgba(10, 12, 15, 0.96)";
    context.fill();
    context.strokeStyle = node.classList.contains("selected")
      ? "rgba(226, 168, 109, 0.9)"
      : "rgba(243, 241, 236, 0.2)";
    context.lineWidth = 1;
    context.stroke();

    const header = node.querySelector(".dsp-node-header");
    if (header) {
      const headerRect = header.getBoundingClientRect();
      context.fillStyle = "rgba(8, 9, 11, 0.96)";
      context.fillRect(x, y, width, Math.max(18, headerRect.height));
    }

    const title = node.querySelector(".dsp-node-header strong, .dsp-node-title, strong");
    if (title?.textContent) {
      context.fillStyle = "rgba(243, 241, 236, 0.9)";
      context.font = "700 14px Consolas, monospace";
      context.textAlign = "center";
      context.fillText(title.textContent.trim().slice(0, 32), x + width * 0.5, y + 6);
    }

    context.textAlign = "left";
    context.font = "12px Consolas, monospace";
    context.fillStyle = "rgba(214, 230, 238, 0.88)";
    const rows = [...node.querySelectorAll(".node-slider-readout, .node-port-label, .node-io-label, label, output")]
      .map((element) => element.textContent.trim().replace(/\s+/g, " "))
      .filter(Boolean)
      .slice(0, 10);
    let textY = y + Math.min(42, height - 14);
    for (const row of rows) {
      if (textY > y + height - 14) {
        break;
      }
      context.fillText(row.slice(0, 28), x + 12, textY);
      textY += 15;
    }

    for (const port of node.querySelectorAll("[data-port], .node-port, .node-param-port")) {
      const portRect = port.getBoundingClientRect();
      if (portRect.width <= 0 || portRect.height <= 0) {
        continue;
      }
      const cx = portRect.left - workspaceRect.left + portRect.width * 0.5;
      const cy = portRect.top - workspaceRect.top + portRect.height * 0.5;
      const portStyle = getComputedStyle(port);
      context.beginPath();
      context.arc(cx, cy, Math.max(3, Math.min(8, portRect.width * 0.35)), 0, Math.PI * 2);
      context.fillStyle = portStyle.backgroundColor || "rgba(127, 199, 217, 0.85)";
      context.fill();
      context.strokeStyle = portStyle.borderColor || "rgba(243, 241, 236, 0.55)";
      context.stroke();
    }
  }
}

function createNodeGraphViewportFallbackCanvas(options = {}) {
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (!workspace) {
    return null;
  }
  if (typeof drawNodeGraphWires === "function") {
    drawNodeGraphWires();
  }
  const rect = workspace.getBoundingClientRect();
  const width = Math.max(1, Math.round(workspace.clientWidth || rect.width));
  const height = Math.max(1, Math.round(workspace.clientHeight || rect.height));
  const targetWidth = options.targetWidth === null
    ? width
    : nodeGraphViewportExportTargetWidth(options.targetWidth || width);
  const targetHeight = Math.max(1, Math.round(targetWidth * (height / width)));
  const exportScale = targetWidth / width;
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  context.scale(exportScale, exportScale);
  const pan = nodeGraphMvp.pan || { x: 0, y: 0 };
  const zoom = typeof nodeGraphZoom === "function" ? nodeGraphZoom() : 1;
  drawNodeGraphViewportFallbackGrid(context, width, height, nodeGraphGridWidth(), nodeGraphGridHeight(), pan, zoom);
  drawNodeGraphViewportFallbackWires(context, workspace, zoom, pan);
  drawNodeGraphViewportFallbackModules(context, workspace);
  return canvas;
}

function nodeGraphViewportReadableStyles() {
  const parts = [];
  for (const sheet of document.styleSheets) {
    try {
      const rules = sheet.cssRules;
      if (!rules) {
        continue;
      }
      for (const rule of rules) {
        parts.push(rule.cssText);
      }
    } catch {
      // Cross-origin sheets are skipped; the sandbox styles are same-origin.
    }
  }
  return parts.join("\n");
}

function nodeGraphViewportCanvasImage(sourceCanvas) {
  const image = document.createElement("img");
  image.className = sourceCanvas.className;
  image.setAttribute("aria-hidden", "true");
  image.style.cssText = sourceCanvas.style.cssText;
  image.style.width = `${sourceCanvas.offsetWidth || sourceCanvas.width}px`;
  image.style.height = `${sourceCanvas.offsetHeight || sourceCanvas.height}px`;
  try {
    image.src = sourceCanvas.toDataURL("image/png");
  } catch {
    const fallback = document.createElement("canvas");
    fallback.width = Math.max(1, sourceCanvas.width || sourceCanvas.offsetWidth || 1);
    fallback.height = Math.max(1, sourceCanvas.height || sourceCanvas.offsetHeight || 1);
    image.src = fallback.toDataURL("image/png");
  }
  return image;
}

function replaceNodeGraphViewportCloneCanvases(source, clone) {
  const sourceCanvases = [...source.querySelectorAll("canvas")];
  const cloneCanvases = [...clone.querySelectorAll("canvas")];
  sourceCanvases.forEach((sourceCanvas, index) => {
    const cloneCanvas = cloneCanvases[index];
    if (!cloneCanvas) {
      return;
    }
    cloneCanvas.replaceWith(nodeGraphViewportCanvasImage(sourceCanvas));
  });
}

function cloneNodeGraphViewportForImage(workspace) {
  const clone = workspace.cloneNode(true);
  clone.querySelector("#nodeGraphResizeHandle")?.remove();
  clone.querySelector("#nodeCopyViewportImageOverlayButton")?.remove();
  clone.querySelector("#nodeExportViewportGifButton")?.remove();
  clone.querySelector("#nodeExportViewportMp4Button")?.remove();
  clone.querySelector("#nodeExportViewportYoutubeButton")?.remove();
  clone.querySelector("#nodeExportViewportWavButton")?.remove();
  clone.querySelector("#nodeExportViewportOggButton")?.remove();
  clone.querySelector("#nodeExportViewportFlacButton")?.remove();
  clone.querySelector("#nodeViewportExportSecondsInput")?.remove();
  clone.querySelector("#nodeViewportExportWidthInput")?.remove();
  clone.querySelector("#nodeModularOnlyBackButton")?.remove();
  clone.querySelector("#nodeSelectionMarquee")?.remove();
  clone.querySelector("#nodeCameraOverlayLayer")?.remove();
  replaceNodeGraphViewportCloneCanvases(workspace, clone);
  clone.removeAttribute("id");
  clone.style.width = `${Math.round(workspace.clientWidth)}px`;
  clone.style.height = `${Math.round(workspace.clientHeight)}px`;
  clone.style.margin = "0";
  return clone;
}

function nodeGraphViewportSvgMarkup(clone, width, height) {
  const styles = nodeGraphViewportReadableStyles().replaceAll("]]>", "]]]]><![CDATA[>");
  const bodyClass = document.body.className;
  const html = new XMLSerializer().serializeToString(clone);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" class="${bodyClass}">
      <style><![CDATA[${styles}]]></style>
      ${html}
    </div>
  </foreignObject>
</svg>`;
}

function nodeGraphImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("viewport image decode failed"));
    };
    image.src = url;
  });
}

async function createNodeGraphViewportSvgCanvas(options = {}) {
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (!workspace) {
    return null;
  }
  if (typeof drawNodeGraphWires === "function") {
    drawNodeGraphWires();
  }
  const width = Math.max(1, Math.round(workspace.clientWidth || workspace.getBoundingClientRect().width));
  const height = Math.max(1, Math.round(workspace.clientHeight || workspace.getBoundingClientRect().height));
  const targetWidth = options.targetWidth === null
    ? width
    : nodeGraphViewportExportTargetWidth(options.targetWidth || width);
  const targetHeight = Math.max(1, Math.round(targetWidth * (height / width)));
  const clone = cloneNodeGraphViewportForImage(workspace);
  const svgBlob = new Blob([nodeGraphViewportSvgMarkup(clone, width, height)], {
    type: "image/svg+xml;charset=utf-8",
  });
  const image = await nodeGraphImageFromBlob(svgBlob);
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  return {
    canvas,
    height: targetHeight,
    svgBlob,
    width: targetWidth,
  };
}

function nodeGraphCanvasToPngBlob(canvas) {
  return nodeGraphViewportCanvasBlob(canvas, "image/png");
}

async function createNodeGraphViewportImageBlob() {
  const image = await createNodeGraphViewportImage();
  return image?.pngBlob || null;
}

async function createNodeGraphViewportImage() {
  try {
    const svgCapture = await createNodeGraphViewportSvgCanvas();
    const pngBlob = svgCapture?.canvas
      ? await nodeGraphViewportCanvasBlob(svgCapture.canvas, "image/png")
      : null;
    if (svgCapture?.canvas && pngBlob) {
      return {
        canvas: svgCapture.canvas,
        height: svgCapture.height,
        pngBlob,
        svgBlob: svgCapture.svgBlob,
        width: svgCapture.width,
      };
    }
  } catch (_error) {
    console.warn("Viewport DOM capture failed; using fallback renderer", _error);
  }

  const fallbackCanvas = createNodeGraphViewportFallbackCanvas();
  const fallbackPngBlob = fallbackCanvas
    ? await nodeGraphViewportCanvasBlob(fallbackCanvas, "image/png")
    : null;
  if (fallbackCanvas && fallbackPngBlob) {
    return {
      canvas: fallbackCanvas,
      height: fallbackCanvas.height,
      pngBlob: fallbackPngBlob,
      svgBlob: null,
      width: fallbackCanvas.width,
    };
  }
  return null;
}

async function createNodeGraphViewportVideoFrameCanvas(options = {}) {
  // MediaRecorder canvas.captureStream requires an origin-clean canvas. The DOM/SVG
  // foreignObject capture path can taint the canvas in Chromium, so video uses the
  // manual renderer even when still PNG capture can try the more accurate path.
  return createNodeGraphViewportFallbackCanvas(options);
}

function setNodeGraphViewportImageButtonStatus(text, options = {}) {
  const buttons = Array.isArray(options.buttons)
    ? options.buttons.filter(Boolean)
    : [
      document.getElementById("nodeCopyViewportImageOverlayButton"),
    ].filter(Boolean);
  for (const button of buttons) {
    if (!button.dataset.defaultText) {
      button.dataset.defaultText = button.textContent;
    }
    button.textContent = text;
    window.clearTimeout(Number(button.dataset.statusTimer) || 0);
    button.dataset.statusTimer = String(window.setTimeout(() => {
      button.textContent = button.dataset.defaultText || "Copy Viewport Image";
      button.dataset.statusTimer = "";
    }, 1400));
  }
}

async function copyNodeGraphViewportImageToClipboard() {
  const buttons = [
    document.getElementById("nodeCopyViewportImageOverlayButton"),
  ].filter(Boolean);
  if (!navigator.clipboard?.write || typeof ClipboardItem !== "function") {
    setNodeGraphViewportImageButtonStatus("Clipboard Unavailable");
    return;
  }
  let image = null;
  try {
    for (const button of buttons) {
      button.disabled = true;
    }
    image = await createNodeGraphViewportImage();
    if (!image?.pngBlob) {
      setNodeGraphViewportImageButtonStatus("Copy Failed");
      return;
    }
  } catch (_error) {
    console.warn("Viewport image capture failed", _error);
    setNodeGraphViewportImageButtonStatus("Copy Failed");
    for (const button of buttons) {
      button.disabled = false;
    }
    return;
  }
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": image.pngBlob }),
    ]);
    setNodeGraphViewportImageButtonStatus("PNG Copied");
    setNodeGraphViewportLastFileMade("", { label: "PNG copied to clipboard" });
  } catch (_error) {
    setNodeGraphViewportImageButtonStatus("Copy Blocked");
  } finally {
    for (const button of buttons) {
      button.disabled = false;
    }
  }
}

async function exportNodeGraphViewportGif() {
  setNodeGraphViewportImageButtonStatus("GIF Unsupported");
}

async function exportNodeGraphViewportWav() {
  if (typeof saveNodeGraphRenderedWav !== "function") {
    setNodeGraphViewportImageButtonStatus("WAV Unavailable");
    return;
  }
  saveNodeGraphRenderedWav();
  const rendered = typeof nodeGraphVideoExportRendered === "function"
    ? nodeGraphVideoExportRendered()
    : null;
  setNodeGraphViewportImageButtonStatus(rendered ? "WAV Saved" : "Render First");
}

async function exportNodeGraphViewportOgg() {
  if (typeof exportNodeGraphRenderedOgg === "function") {
    await exportNodeGraphRenderedOgg();
  }
  setNodeGraphViewportImageButtonStatus("OGG Unsupported");
}

async function exportNodeGraphViewportFlac() {
  if (typeof exportNodeGraphRenderedFlac === "function") {
    await exportNodeGraphRenderedFlac();
  }
  setNodeGraphViewportImageButtonStatus("FLAC Unsupported");
}

async function captureNodeGraphViewportMp4Blob(options = {}) {
  const buttons = Array.isArray(options.buttons) ? options.buttons.filter(Boolean) : [];
  const setMp4Status = (text) => setNodeGraphViewportImageButtonStatus(text, { buttons });
  document.body.dataset.nodeViewportMp4Error = "";
  if (typeof MediaRecorder !== "function") {
    setMp4Status("MP4 Unsupported");
    return null;
  }
  const mimeType = typeof nodeGraphVideoExportMimeForFormat === "function"
    ? nodeGraphVideoExportMimeForFormat("mp4", true)
    : "";
  if (!mimeType) {
    setMp4Status("MP4 Unsupported");
    return null;
  }
  const targetWidth = nodeGraphViewportExportTargetWidth();
  const firstFrame = await createNodeGraphViewportVideoFrameCanvas({ targetWidth });
  if (!firstFrame) {
    setMp4Status("MP4 Capture Failed");
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = firstFrame.width;
  canvas.height = firstFrame.height;
  const context = canvas.getContext("2d");
  context.drawImage(firstFrame, 0, 0, canvas.width, canvas.height);
  if (!canvas.captureStream) {
    setMp4Status("MP4 Unsupported");
    return null;
  }
  for (const button of buttons) {
    button.disabled = true;
  }
  try {
    const fps = 12;
    const durationMs = Math.ceil(nodeGraphViewportExportSeconds() * 1000);
    const stream = canvas.captureStream(fps);
    const [track] = stream.getVideoTracks();
    const chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data?.size) {
        chunks.push(event.data);
      }
    });
    const finished = new Promise((resolve, reject) => {
      recorder.addEventListener("stop", resolve, { once: true });
      recorder.addEventListener("error", () => reject(new Error("viewport mp4 export failed")), { once: true });
    });
    const frameMs = 1000 / fps;
    recorder.start(Math.ceil(frameMs));
    const startedAt = performance.now();
    let nextFrameAt = startedAt + frameMs;
    while (performance.now() - startedAt < durationMs) {
      await new Promise((resolve) => window.setTimeout(resolve, Math.max(1, nextFrameAt - performance.now())));
      const frame = await createNodeGraphViewportVideoFrameCanvas({ targetWidth: canvas.width });
      if (frame) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(frame, 0, 0, canvas.width, canvas.height);
        if (typeof track?.requestFrame === "function") {
          track.requestFrame();
        }
      }
      nextFrameAt += frameMs;
    }
    if (typeof recorder.requestData === "function" && recorder.state === "recording") {
      recorder.requestData();
    }
    recorder.stop();
    await finished;
    stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(chunks, { type: mimeType });
    if (!blob.size) {
      setMp4Status("MP4 Failed");
      return null;
    }
    return blob;
  } catch (_error) {
    const message = String(_error?.message || _error || "unknown");
    document.body.dataset.nodeViewportMp4Error = message;
    console.warn("Viewport MP4 export failed", _error);
    setMp4Status("MP4 Failed");
    return null;
  } finally {
    for (const button of buttons) {
      button.disabled = false;
    }
  }
}

async function exportNodeGraphViewportMp4() {
  const buttons = [
    document.getElementById("nodeExportViewportMp4Button"),
  ].filter(Boolean);
  const setMp4Status = (text) => setNodeGraphViewportImageButtonStatus(text, { buttons });
  const blob = await captureNodeGraphViewportMp4Blob({ buttons });
  if (!blob) {
    return;
  }
  const saved = downloadNodeGraphViewportBlob(blob, nodeGraphViewportExportFileName("mp4"));
  setMp4Status(saved ? "MP4 Saved" : "MP4 Ready");
}

async function exportNodeGraphViewportYoutube() {
  const buttons = [
    document.getElementById("nodeExportViewportYoutubeButton"),
  ].filter(Boolean);
  const setYoutubeStatus = (text) => setNodeGraphViewportImageButtonStatus(text, { buttons });
  const metadata = promptNodeGraphYoutubeUploadMetadata();
  if (!metadata) {
    setYoutubeStatus("Upload Canceled");
    return;
  }
  const blob = await captureNodeGraphViewportMp4Blob({ buttons });
  if (!blob) {
    return;
  }
  const fileName = nodeGraphViewportExportFileName("mp4");
  downloadNodeGraphViewportBlob(blob, fileName);
  try {
    const upload = await uploadNodeGraphViewportYoutubeVideo(blob, metadata, fileName);
    setYoutubeStatus("Uploaded");
    if (upload.url) {
      window.open(upload.url, "_blank", "noopener,noreferrer");
    }
  } catch (error) {
    console.warn("YouTube upload failed", error);
    setYoutubeStatus("Setup Needed");
    window.alert(String(error?.message || error || "YouTube upload failed"));
  }
}
