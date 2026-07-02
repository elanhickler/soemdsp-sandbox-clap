// Phosphor-style waveform display for the Music Player (audioPlayer) module.
//
// Reads the node's decoded sample buffer directly (nodeGraphMvp.sampleBuffers,
// keyed by node.sample.id) and draws a min/max-per-pixel envelope with a
// green-phosphor glow (layered shadowBlur passes, matching this project's
// scope-green aesthetic), plus a live playhead and the Start/End loop-region
// markers already present on the module. Zoom (wheel) and pan (drag) operate
// on a per-node view window in sample frames, independent of the shared
// WebGL scope compositor used by every other module's display.

const nodeGraphPhosphorWaveformViewStates = new Map();
const nodeGraphPhosphorWaveformMinWindowFrames = 32;

function nodeGraphPhosphorWaveformViewState(nodeId, frames) {
  const safeFrames = Math.max(1, Math.round(Number(frames) || 1));
  let state = nodeGraphPhosphorWaveformViewStates.get(nodeId);
  if (!state || state.totalFrames !== safeFrames) {
    state = { endFrame: safeFrames, startFrame: 0, totalFrames: safeFrames };
    nodeGraphPhosphorWaveformViewStates.set(nodeId, state);
  }
  return state;
}

function nodeGraphPhosphorWaveformClampWindow(state) {
  const minWindow = Math.min(state.totalFrames, nodeGraphPhosphorWaveformMinWindowFrames);
  let width = state.endFrame - state.startFrame;
  width = Math.max(minWindow, Math.min(state.totalFrames, width));
  state.startFrame = Math.max(0, Math.min(state.totalFrames - width, state.startFrame));
  state.endFrame = state.startFrame + width;
}

function nodeGraphPhosphorWaveformSampleEntry(nodeId) {
  const node = nodeGraphPatchNode(nodeId);
  const sampleId = node?.sample?.id;
  if (!sampleId) {
    return null;
  }
  const entry = nodeGraphMvp?.sampleBuffers?.get?.(sampleId);
  return entry && entry.samples && entry.frames > 0 ? entry : null;
}

function nodeGraphPhosphorWaveformZoomAt(section, canvas, clientX, factor) {
  const entry = nodeGraphPhosphorWaveformSampleEntry(section.dataset.node);
  if (!entry) {
    return;
  }
  const state = nodeGraphPhosphorWaveformViewState(section.dataset.node, entry.frames);
  const rect = canvas.getBoundingClientRect();
  const ratio = rect.width > 0 ? clampNodeSliderValue((clientX - rect.left) / rect.width, 0, 1) : 0.5;
  const anchorFrame = state.startFrame + ratio * (state.endFrame - state.startFrame);
  const width = state.endFrame - state.startFrame;
  const newWidth = Math.max(
    nodeGraphPhosphorWaveformMinWindowFrames,
    Math.min(state.totalFrames, width * factor),
  );
  state.startFrame = anchorFrame - ratio * newWidth;
  state.endFrame = state.startFrame + newWidth;
  nodeGraphPhosphorWaveformClampWindow(state);
  drawNodeGraphPhosphorWaveformDisplay(section);
}

function nodeGraphPhosphorWaveformPanBy(section, deltaPixels, canvasWidth) {
  const entry = nodeGraphPhosphorWaveformSampleEntry(section.dataset.node);
  if (!entry || canvasWidth <= 0) {
    return;
  }
  const state = nodeGraphPhosphorWaveformViewState(section.dataset.node, entry.frames);
  const framesPerPixel = (state.endFrame - state.startFrame) / canvasWidth;
  state.startFrame -= deltaPixels * framesPerPixel;
  state.endFrame -= deltaPixels * framesPerPixel;
  nodeGraphPhosphorWaveformClampWindow(state);
  drawNodeGraphPhosphorWaveformDisplay(section);
}

function nodeGraphPhosphorWaveformResetZoom(section) {
  const entry = nodeGraphPhosphorWaveformSampleEntry(section.dataset.node);
  if (!entry) {
    return;
  }
  nodeGraphPhosphorWaveformViewStates.set(section.dataset.node, {
    endFrame: entry.frames,
    startFrame: 0,
    totalFrames: entry.frames,
  });
  drawNodeGraphPhosphorWaveformDisplay(section);
}

function bindNodeGraphPhosphorWaveformInteractions(section, canvas) {
  canvas.style.touchAction = "none";
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const factor = event.deltaY > 0 ? 1.25 : 0.8;
    nodeGraphPhosphorWaveformZoomAt(section, canvas, event.clientX, factor);
  }, { passive: false });

  let dragPointerId = null;
  let lastClientX = 0;
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.button !== undefined) {
      return;
    }
    dragPointerId = event.pointerId;
    lastClientX = event.clientX;
    canvas.setPointerCapture?.(dragPointerId);
    canvas.classList.add("dragging");
    event.stopPropagation();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (dragPointerId === null || event.pointerId !== dragPointerId) {
      return;
    }
    const deltaX = event.clientX - lastClientX;
    lastClientX = event.clientX;
    nodeGraphPhosphorWaveformPanBy(section, deltaX, canvas.clientWidth || canvas.width);
    event.stopPropagation();
  });
  const endDrag = (event) => {
    if (dragPointerId === null || event.pointerId !== dragPointerId) {
      return;
    }
    canvas.releasePointerCapture?.(dragPointerId);
    dragPointerId = null;
    canvas.classList.remove("dragging");
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("dblclick", (event) => {
    event.stopPropagation();
    nodeGraphPhosphorWaveformResetZoom(section);
  });
}

function scheduleNodeGraphPhosphorWaveformFrame(section) {
  if (!section.isConnected) {
    return;
  }
  drawNodeGraphPhosphorWaveformDisplay(section);
  window.requestAnimationFrame(() => scheduleNodeGraphPhosphorWaveformFrame(section));
}

function createNodeGraphPhosphorWaveformDisplay(nodeId, type) {
  const section = document.createElement("section");
  section.className = "node-phosphor-waveform-display";
  section.dataset.node = nodeId;
  section.dataset.nodeType = type;
  section.setAttribute("aria-label", `${nodeGraphNodeDisplayName?.(nodeId) || "Music Player"} phosphor waveform display`);

  const canvas = document.createElement("canvas");
  canvas.className = "node-phosphor-waveform-canvas";
  section.append(canvas);
  bindNodeGraphPhosphorWaveformInteractions(section, canvas);
  window.requestAnimationFrame(() => scheduleNodeGraphPhosphorWaveformFrame(section));
  return section;
}

function nodeGraphPhosphorWaveformMinMaxColumns(samples, startFrame, endFrame, columns) {
  const values = new Float32Array(columns * 2);
  const span = Math.max(1, endFrame - startFrame);
  const framesPerColumn = span / columns;
  const totalFrames = samples.length;
  for (let column = 0; column < columns; column += 1) {
    const rangeStart = Math.max(0, Math.floor(startFrame + column * framesPerColumn));
    const rangeEnd = Math.min(totalFrames, Math.max(rangeStart + 1, Math.ceil(startFrame + (column + 1) * framesPerColumn)));
    let min = Infinity;
    let max = -Infinity;
    for (let frame = rangeStart; frame < rangeEnd; frame += 1) {
      const value = samples[frame];
      if (value < min) min = value;
      if (value > max) max = value;
    }
    if (min > max) {
      min = 0;
      max = 0;
    }
    values[column * 2] = min;
    values[column * 2 + 1] = max;
  }
  return values;
}

function drawNodeGraphPhosphorWaveformPlaceholder(context, width, height, message) {
  context.fillStyle = "rgba(70, 220, 140, 0.55)";
  context.font = "600 11px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(message, width / 2, height / 2);
  context.textAlign = "start";
  context.textBaseline = "alphabetic";
}

function drawNodeGraphPhosphorWaveformDisplay(section) {
  const nodeId = section?.dataset?.node || "";
  const node = nodeGraphPatchNode(nodeId);
  const canvas = section?.querySelector?.(".node-phosphor-waveform-canvas");
  if (!node || !canvas) {
    return;
  }
  const rect = section.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const zoom = Math.max(0.01, Number(nodeGraphMvp?.zoom) || 1);
  const width = Math.max(1, Number(section.clientWidth || section.offsetWidth || 0) || rect.width / zoom);
  const height = Math.max(1, Number(section.clientHeight || section.offsetHeight || 0) || rect.height / zoom);
  const canvasWidth = Math.max(1, Math.round(width * pixelRatio));
  const canvasHeight = Math.max(1, Math.round(height * pixelRatio));
  if (canvas.width !== canvasWidth) {
    canvas.width = canvasWidth;
  }
  if (canvas.height !== canvasHeight) {
    canvas.height = canvasHeight;
  }
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#020a06";
  context.fillRect(0, 0, width, height);

  const entry = nodeGraphPhosphorWaveformSampleEntry(nodeId);
  if (!entry) {
    drawNodeGraphPhosphorWaveformPlaceholder(context, width, height, "No sample loaded");
    return;
  }

  const state = nodeGraphPhosphorWaveformViewState(nodeId, entry.frames);
  nodeGraphPhosphorWaveformClampWindow(state);
  const columns = Math.max(1, Math.round(width));
  const minMax = nodeGraphPhosphorWaveformMinMaxColumns(entry.samples, state.startFrame, state.endFrame, columns);
  const midY = height / 2;
  const amplitude = midY * 0.92;

  // Start/End loop-region shading, reusing the module's existing Start/End params.
  const loopStart = clampNodeSliderValue(Number(node.params?.start) || 0, 0, 1) * entry.frames;
  const loopEnd = clampNodeSliderValue(Number(node.params?.end) || 1, 0, 1) * entry.frames;
  const frameToX = (frame) => ((frame - state.startFrame) / Math.max(1, state.endFrame - state.startFrame)) * width;
  const regionX0 = clampNodeSliderValue(frameToX(loopStart), 0, width);
  const regionX1 = clampNodeSliderValue(frameToX(loopEnd), 0, width);
  if (regionX1 > regionX0) {
    context.fillStyle = "rgba(70, 220, 140, 0.08)";
    context.fillRect(regionX0, 0, regionX1 - regionX0, height);
  }

  // Zero line.
  context.strokeStyle = "rgba(70, 220, 140, 0.16)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, midY);
  context.lineTo(width, midY);
  context.stroke();

  // Phosphor glow: a wide blurred pass beneath a sharp core pass.
  const drawEnvelope = (glow) => {
    context.beginPath();
    for (let x = 0; x < columns; x += 1) {
      const min = minMax[x * 2];
      const max = minMax[x * 2 + 1];
      const yTop = midY - max * amplitude;
      const yBottom = midY - min * amplitude;
      context.moveTo(x + 0.5, yTop);
      context.lineTo(x + 0.5, Math.max(yTop + 1, yBottom));
    }
    if (glow) {
      context.shadowBlur = 8;
      context.shadowColor = "rgba(90, 255, 150, 0.85)";
      context.strokeStyle = "rgba(90, 255, 150, 0.35)";
      context.lineWidth = 2.5;
    } else {
      context.shadowBlur = 0;
      context.strokeStyle = "rgba(180, 255, 210, 0.95)";
      context.lineWidth = 1;
    }
    context.stroke();
  };
  drawEnvelope(true);
  drawEnvelope(false);
  context.shadowBlur = 0;

  // Playhead.
  const phase = typeof nodeGraphSamplePhaseForNode === "function" ? nodeGraphSamplePhaseForNode(nodeId) : 0;
  const playheadFrame = phase * entry.frames;
  if (playheadFrame >= state.startFrame && playheadFrame <= state.endFrame) {
    const x = frameToX(playheadFrame);
    context.shadowBlur = 6;
    context.shadowColor = "rgba(255, 255, 255, 0.9)";
    context.strokeStyle = "rgba(255, 255, 255, 0.85)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
    context.shadowBlur = 0;
  }

  const zoomRatio = (state.endFrame - state.startFrame) / Math.max(1, state.totalFrames);
  context.fillStyle = "rgba(180, 255, 210, 0.7)";
  context.font = "600 10px system-ui, sans-serif";
  context.fillText(`${(zoomRatio * 100).toFixed(zoomRatio < 0.1 ? 1 : 0)}%`, 6, 13);
}

function drawNodeGraphPhosphorWaveformDisplays() {
  document.querySelectorAll(".node-phosphor-waveform-display").forEach(drawNodeGraphPhosphorWaveformDisplay);
}
