// Phosphillator — draw a shape freehand with the mouse, get a closed-loop
// X/Y drawing back. This file covers capture + storage (stage 1): a
// drawable phosphor-style canvas, live Papoulis-smoothed capture of the
// pointer stream, and cubic (Catmull-Rom) uniform-arclength resampling into
// a fixed-length closed loop, stored on the patch node and rendered with the
// same phosphor-glow look as the rest of this fork. Playback (turning the
// stored loop into audio-rate X/Y CV output) is a separate follow-up pass.

const nodeGraphPhosphillatorCaptureStates = new Map();
const nodeGraphPhosphillatorResampledPointCount = 256;

function normalizeNodeGraphPhosphillatorDrawnPath(drawnPath) {
  const rawPoints = Array.isArray(drawnPath?.points) ? drawnPath.points : [];
  const points = rawPoints
    .filter((value) => Number.isFinite(value))
    .slice(0, nodeGraphPhosphillatorResampledPointCount);
  return points.length >= 3 ? { points } : null;
}
const nodeGraphPhosphillatorCaptureRateHz = 120; // nominal pointermove rate for the live smoothing filter
const nodeGraphPhosphillatorMinCutoffHz = 2;
const nodeGraphPhosphillatorMaxCutoffHz = 60;
const nodeGraphPhosphillatorDrawIntensity = 24;

function nodeGraphPhosphillatorSmoothingCutoffHz(smoothingAmount) {
  const amount = clampNodeSliderValue(Number(smoothingAmount) || 0, 0, 1);
  // amount 0 -> barely smoothed (high cutoff), amount 1 -> heavily smoothed (low cutoff).
  const logMin = Math.log(nodeGraphPhosphillatorMinCutoffHz);
  const logMax = Math.log(nodeGraphPhosphillatorMaxCutoffHz);
  return Math.exp(logMax + amount * (logMin - logMax));
}

function createNodeGraphPhosphillatorCaptureState() {
  return {
    filterCoeffs: null,
    filterStateX: createPapoulisLowpass3State(),
    filterStateY: createPapoulisLowpass3State(),
    points: [],
  };
}

function nodeGraphPhosphillatorPointerToNormalized(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const px = rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5;
  const py = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
  return {
    x: clampNodeSliderValue(px * 2 - 1, -1, 1),
    y: clampNodeSliderValue(-(py * 2 - 1), -1, 1),
  };
}

function nodeGraphPhosphillatorBeginCapture(nodeId, smoothingAmount) {
  const state = createNodeGraphPhosphillatorCaptureState();
  state.filterCoeffs = designPapoulisLowpass3(
    nodeGraphPhosphillatorSmoothingCutoffHz(smoothingAmount),
    nodeGraphPhosphillatorCaptureRateHz,
  );
  nodeGraphPhosphillatorCaptureStates.set(nodeId, state);
  return state;
}

function nodeGraphPhosphillatorAddCapturePoint(nodeId, x, y) {
  const state = nodeGraphPhosphillatorCaptureStates.get(nodeId);
  if (!state) {
    return;
  }
  const smoothedX = papoulisLowpass3Process(state.filterStateX, state.filterCoeffs, x);
  const smoothedY = papoulisLowpass3Process(state.filterStateY, state.filterCoeffs, y);
  state.points.push({ x: clampNodeSliderValue(smoothedX, -1, 1), y: clampNodeSliderValue(smoothedY, -1, 1) });
}

// Catmull-Rom evaluation for one axis at parameter t in [0,1], given the
// four control values surrounding the segment (p1 -> p2 is the segment).
function nodeGraphPhosphillatorCatmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1)
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function nodeGraphPhosphillatorResampleClosedLoop(points, targetCount) {
  const n = points.length;
  if (n < 3) {
    return [];
  }
  const at = (index) => points[((index % n) + n) % n];
  const segmentLengths = [];
  let totalLength = 0;
  for (let i = 0; i < n; i += 1) {
    const a = at(i);
    const b = at(i + 1);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    segmentLengths.push(length);
    totalLength += length;
  }
  if (totalLength <= 0) {
    return [];
  }
  const resampled = [];
  let segmentIndex = 0;
  let segmentStartLength = 0;
  for (let k = 0; k < targetCount; k += 1) {
    const targetLength = (k / targetCount) * totalLength;
    while (
      segmentIndex < n - 1
      && segmentStartLength + segmentLengths[segmentIndex] < targetLength
    ) {
      segmentStartLength += segmentLengths[segmentIndex];
      segmentIndex += 1;
    }
    const segmentLength = segmentLengths[segmentIndex] || 1e-9;
    const t = clampNodeSliderValue((targetLength - segmentStartLength) / segmentLength, 0, 1);
    const p0 = at(segmentIndex - 1);
    const p1 = at(segmentIndex);
    const p2 = at(segmentIndex + 1);
    const p3 = at(segmentIndex + 2);
    resampled.push({
      x: clampNodeSliderValue(nodeGraphPhosphillatorCatmullRom(p0.x, p1.x, p2.x, p3.x, t), -1, 1),
      y: clampNodeSliderValue(nodeGraphPhosphillatorCatmullRom(p0.y, p1.y, p2.y, p3.y, t), -1, 1),
    });
  }
  return resampled;
}

function nodeGraphPhosphillatorFinishCapture(nodeId) {
  const state = nodeGraphPhosphillatorCaptureStates.get(nodeId);
  nodeGraphPhosphillatorCaptureStates.delete(nodeId);
  if (!state || state.points.length < 3) {
    return;
  }
  const resampled = nodeGraphPhosphillatorResampleClosedLoop(state.points, nodeGraphPhosphillatorResampledPointCount);
  if (!resampled.length) {
    return;
  }
  const packedPoints = resampled.map((point) => packNodeGraphPhosphorDrawSample(
    point.x,
    point.y,
    true,
    nodeGraphPhosphillatorDrawIntensity,
  ));
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === nodeId);
  if (!targetNode) {
    return;
  }
  targetNode.drawnPath = { points: packedPoints };
  commitNodeGraphPatch(patch, { status: "phosphillator shape drawn" });
}

function nodeGraphPhosphillatorClearDrawnPath(nodeId) {
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === nodeId);
  if (!targetNode || !targetNode.drawnPath) {
    return;
  }
  delete targetNode.drawnPath;
  commitNodeGraphPatch(patch, { status: "phosphillator shape cleared" });
}

function bindNodeGraphPhosphillatorInteractions(section, canvas) {
  canvas.style.touchAction = "none";
  let pointerId = null;

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.button !== undefined) {
      return;
    }
    pointerId = event.pointerId;
    try {
      canvas.setPointerCapture?.(pointerId);
    } catch {
      // No active pointer to capture (e.g. synthetic events) — capture is a
      // nicety for drag-outside-canvas continuity, not a correctness need.
    }
    const nodeId = section.dataset.node;
    const node = nodeGraphPatchNode(nodeId);
    nodeGraphPhosphillatorBeginCapture(nodeId, node?.params?.smoothing ?? 0.5);
    const point = nodeGraphPhosphillatorPointerToNormalized(canvas, event.clientX, event.clientY);
    nodeGraphPhosphillatorAddCapturePoint(nodeId, point.x, point.y);
    event.stopPropagation();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (pointerId === null || event.pointerId !== pointerId) {
      return;
    }
    const point = nodeGraphPhosphillatorPointerToNormalized(canvas, event.clientX, event.clientY);
    nodeGraphPhosphillatorAddCapturePoint(section.dataset.node, point.x, point.y);
    event.stopPropagation();
  });

  const endCapture = (event) => {
    if (pointerId === null || event.pointerId !== pointerId) {
      return;
    }
    try {
      canvas.releasePointerCapture?.(pointerId);
    } catch {
      // Already released/not captured — safe to ignore.
    }
    pointerId = null;
    nodeGraphPhosphillatorFinishCapture(section.dataset.node);
  };
  canvas.addEventListener("pointerup", endCapture);
  canvas.addEventListener("pointercancel", endCapture);

  canvas.addEventListener("dblclick", (event) => {
    event.stopPropagation();
    nodeGraphPhosphillatorClearDrawnPath(section.dataset.node);
  });
}

function scheduleNodeGraphPhosphillatorFrame(section) {
  if (!section.isConnected) {
    return;
  }
  drawNodeGraphPhosphillatorDrawDisplay(section);
  window.requestAnimationFrame(() => scheduleNodeGraphPhosphillatorFrame(section));
}

function createNodeGraphPhosphillatorDrawDisplay(nodeId, type) {
  const section = document.createElement("section");
  section.className = "node-phosphillator-draw-display";
  section.dataset.node = nodeId;
  section.dataset.nodeType = type;
  section.setAttribute("aria-label", `${nodeGraphNodeDisplayName?.(nodeId) || "Phosphillator"} drawing surface — draw a shape, double-click to clear`);

  const canvas = document.createElement("canvas");
  canvas.className = "node-phosphillator-draw-canvas";
  section.append(canvas);
  bindNodeGraphPhosphillatorInteractions(section, canvas);
  window.requestAnimationFrame(() => scheduleNodeGraphPhosphillatorFrame(section));
  return section;
}

function nodeGraphPhosphillatorPointToPixel(point, width, height) {
  return {
    x: ((point.x + 1) / 2) * width,
    y: ((1 - point.y) / 2) * height,
  };
}

function drawNodeGraphPhosphillatorGlowPath(context, pixels, closed) {
  if (pixels.length < 2) {
    return;
  }
  const drawPass = (glow) => {
    context.beginPath();
    context.moveTo(pixels[0].x, pixels[0].y);
    for (let i = 1; i < pixels.length; i += 1) {
      context.lineTo(pixels[i].x, pixels[i].y);
    }
    if (closed) {
      context.closePath();
    }
    if (glow) {
      context.shadowBlur = 9;
      context.shadowColor = "rgba(90, 255, 150, 0.85)";
      context.strokeStyle = "rgba(90, 255, 150, 0.4)";
      context.lineWidth = 3;
    } else {
      context.shadowBlur = 0;
      context.strokeStyle = "rgba(190, 255, 215, 0.95)";
      context.lineWidth = 1.4;
    }
    context.stroke();
  };
  drawPass(true);
  drawPass(false);
  context.shadowBlur = 0;
}

function drawNodeGraphPhosphillatorDrawDisplay(section) {
  const nodeId = section?.dataset?.node || "";
  const node = nodeGraphPatchNode(nodeId);
  const canvas = section?.querySelector?.(".node-phosphillator-draw-canvas");
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

  const capture = nodeGraphPhosphillatorCaptureStates.get(nodeId);
  if (capture && capture.points.length >= 2) {
    const pixels = capture.points.map((point) => nodeGraphPhosphillatorPointToPixel(point, width, height));
    drawNodeGraphPhosphillatorGlowPath(context, pixels, false);
    return;
  }

  const drawnPoints = node.drawnPath?.points;
  if (Array.isArray(drawnPoints) && drawnPoints.length >= 2) {
    const pixels = drawnPoints.map((packed) => {
      const unpacked = unpackNodeGraphPhosphorDrawSample(packed);
      return nodeGraphPhosphillatorPointToPixel(unpacked, width, height);
    });
    drawNodeGraphPhosphillatorGlowPath(context, pixels, true);
    return;
  }

  drawNodeGraphPhosphorWaveformPlaceholder(context, width, height, "Draw a shape — dblclick to clear");
}
