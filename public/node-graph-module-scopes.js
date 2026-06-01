const nodeGraphModuleScopeState = {
  buffers: new Map(),
  drawFrame: 0,
  enabled: false,
  frames: 0,
  monitorFingerprint: "",
  monitors: [],
  patchFingerprint: "",
  renderer: null,
  sampleRate: 0,
  slots: new Map(),
};

function nodeGraphModuleScopeCanvas() {
  return document.getElementById("nodeModuleScopeCanvas");
}

function nodeGraphModuleScopesEnabled() {
  return Boolean(nodeGraphModuleScopeState.enabled);
}

function setNodeGraphModuleScopesEnabled(enabled) {
  nodeGraphModuleScopeState.enabled = Boolean(enabled);
  document.getElementById("nodeGraphWorkspace")
    ?.classList.toggle("module-scopes-enabled", nodeGraphModuleScopesEnabled());
  syncNodeGraphModuleScopeCanvas();
}

function registerNodeGraphModuleScopeSlot(moduleElement, options = {}) {
  const nodeId = moduleElement?.dataset?.node || options.nodeId || "";
  if (!nodeId) {
    return null;
  }
  const scopeElement = options.scopeElement
    || moduleElement?.querySelector?.(".node-module-scope-window")
    || null;
  const slot = {
    element: moduleElement,
    nodeId,
    scopeElement,
    type: options.type || moduleElement?.dataset?.nodeType || "",
  };
  nodeGraphModuleScopeState.slots.set(nodeId, slot);
  return slot;
}

function unregisterNodeGraphModuleScopeSlot(nodeId) {
  nodeGraphModuleScopeState.slots.delete(nodeId);
}

function nodeGraphModuleScopeSlots() {
  return [...nodeGraphModuleScopeState.slots.values()]
    .filter((slot) => slot.element?.isConnected && !slot.element.hidden && slot.scopeElement);
}

function nodeGraphModuleScopeMonitorFingerprint(monitors = []) {
  return normalizeNodeGraphPatchMonitors(monitors)
    .map(nodeGraphMonitorEndpointKey)
    .sort()
    .join("|");
}

function clearNodeGraphModuleScopeBuffers() {
  nodeGraphModuleScopeState.buffers.clear();
  nodeGraphModuleScopeState.frames = 0;
  nodeGraphModuleScopeState.monitorFingerprint = "";
  nodeGraphModuleScopeState.patchFingerprint = "";
  nodeGraphModuleScopeState.sampleRate = 0;
  setNodeGraphModuleScopesEnabled(false);
  clearNodeGraphModuleScopeCanvas();
}

function nodeGraphMonitorEndpointKey(endpoint) {
  return `${endpoint?.node || ""}.${endpoint?.io || ""}.${endpoint?.port || endpoint?.param || ""}`;
}

function nodeGraphMonitorEndpointFromElement(element) {
  if (!element) {
    return null;
  }
  if (element.classList?.contains("modulation-input")) {
    return {
      io: "modulation",
      node: String(element.dataset.node || ""),
      port: String(element.dataset.param || element.dataset.port || ""),
    };
  }
  if (element.classList?.contains("node-port")) {
    return {
      io: String(element.dataset.io || ""),
      node: String(element.dataset.node || ""),
      port: String(element.dataset.port || ""),
    };
  }
  return null;
}

function nodeGraphMonitorEndpointIsValid(endpoint, nodes = []) {
  const node = nodes.find((candidate) => candidate.id === endpoint?.node);
  const definition = nodeGraphModuleDefinitions[node?.type];
  if (!node || !definition || !endpoint?.port) {
    return false;
  }
  if (endpoint.io === "modulation") {
    return (definition.parameters || []).some((parameter) => parameter.key === endpoint.port);
  }
  if (endpoint.io === "input") {
    return (definition.inputs || []).includes(endpoint.port);
  }
  if (endpoint.io === "output") {
    return nodeGraphModuleOutputPorts(node.type).includes(endpoint.port);
  }
  return false;
}

function normalizeNodeGraphPatchMonitors(monitors = [], patch = nodeGraphMvp?.patch) {
  const nodes = Array.isArray(patch?.nodes) ? patch.nodes : [];
  const normalized = [];
  const seen = new Set();
  for (const monitor of Array.isArray(monitors) ? monitors : []) {
    const endpoint = {
      io: String(monitor?.io || ""),
      node: String(monitor?.node || ""),
      port: String(monitor?.port || monitor?.param || ""),
    };
    if (!nodeGraphMonitorEndpointIsValid(endpoint, nodes)) {
      continue;
    }
    const key = nodeGraphMonitorEndpointKey(endpoint);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(endpoint);
  }
  return normalized;
}

function nodeGraphMonitorPortSelector(endpoint) {
  if (endpoint?.io === "modulation") {
    return nodeGraphModulationPortSelector(endpoint.node, endpoint.port);
  }
  return nodeGraphPortSelector(endpoint.node, endpoint.port, endpoint.io);
}

function syncNodeGraphMonitorIndicators(patch = nodeGraphMvp?.patch) {
  const workspace = nodeGraphZoomSurface?.();
  if (!workspace || !patch) {
    return;
  }
  const monitors = normalizeNodeGraphPatchMonitors(patch.monitors, patch);
  nodeGraphModuleScopeState.monitors = monitors;
  for (const port of workspace.querySelectorAll(".node-port, .node-param-port")) {
    port.classList.remove("monitored-port");
    port.removeAttribute("data-monitor-state");
  }
  for (const monitor of monitors) {
    const element = workspace.querySelector(nodeGraphMonitorPortSelector(monitor));
    element?.classList.add("monitored-port");
    element?.setAttribute("data-monitor-state", "active");
  }
  scheduleNodeGraphModuleScopeDraw();
}

function toggleNodeGraphMonitorForPort(port) {
  const endpoint = nodeGraphMonitorEndpointFromElement(port);
  if (!endpoint || !nodeGraphMonitorEndpointIsValid(endpoint, nodeGraphMvp.patch.nodes)) {
    return false;
  }
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const monitors = normalizeNodeGraphPatchMonitors(patch.monitors, patch);
  const key = nodeGraphMonitorEndpointKey(endpoint);
  const nextMonitors = monitors.filter((monitor) => nodeGraphMonitorEndpointKey(monitor) !== key);
  const enabled = nextMonitors.length === monitors.length;
  if (enabled) {
    nextMonitors.push(endpoint);
  }
  patch.monitors = nextMonitors;
  commitNodeGraphPatch(patch, {
    status: enabled ? "monitor added" : "monitor removed",
  });
  return true;
}

function toggleNodeGraphMonitorFromPortEvent(event) {
  if (event.button !== 0 || !event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }
  if (toggleNodeGraphMonitorForPort(event.currentTarget)) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }
}

function beginNodeGraphRenderedScopeCapture(options = {}) {
  const patch = options.patch || nodeGraphMvp?.patch;
  const monitors = normalizeNodeGraphPatchMonitors(patch?.monitors, patch);
  const frames = Math.max(0, Math.floor(Number(options.frames) || 0));
  if (!monitors.length || frames <= 0) {
    clearNodeGraphModuleScopeBuffers();
    return null;
  }

  const groups = new Map();
  for (const monitor of monitors) {
    const group = groups.get(monitor.node) || [];
    group.push(monitor);
    groups.set(monitor.node, group);
  }

  const buffers = new Map(
    [...groups.keys()].map((nodeId) => [nodeId, new Float32Array(frames)]),
  );
  return {
    buffers,
    frames,
    groups,
    monitorFingerprint: nodeGraphModuleScopeMonitorFingerprint(monitors),
    patchFingerprint: String(options.patchFingerprint || ""),
    sampleRate: Number(options.sampleRate) || 0,
  };
}

function nodeGraphRenderedScopeMonitorValue(
  monitor,
  runtime,
  frameValues,
  frame,
  frames,
) {
  if (monitor.io === "output") {
    return readNodeGraphRuntimePortOutput(
      runtime,
      frameValues,
      monitor.node,
      monitor.port,
      frame,
      frames,
    );
  }
  if (monitor.io === "input") {
    return (runtime.inputConnections?.get(`${monitor.node}.${monitor.port}`) || [])
      .reduce((sum, connection) => sum + readNodeGraphRuntimePortOutput(
        runtime,
        frameValues,
        connection.sourceNode,
        connection.sourcePort,
        frame,
        frames,
      ), 0);
  }
  if (monitor.io === "modulation") {
    return (runtime.modulationConnections?.get(nodeGraphParameterKey(monitor.node, monitor.port)) || [])
      .reduce((sum, modulation) => sum + clampNodeSliderValue(readNodeGraphRuntimePortOutput(
        runtime,
        frameValues,
        modulation.sourceNode,
        modulation.sourcePort,
        frame,
        frames,
      ), 0, 1), 0);
  }
  return 0;
}

function captureNodeGraphRenderedScopeFrame(
  capture,
  runtime,
  frameValues,
  bufferFrame,
  evaluationFrame,
  evaluationFrames,
) {
  if (!capture) {
    return;
  }
  for (const [nodeId, monitors] of capture.groups) {
    const buffer = capture.buffers.get(nodeId);
    if (!buffer || bufferFrame < 0 || bufferFrame >= buffer.length) {
      continue;
    }
    const sum = monitors.reduce(
      (total, monitor) => total + nodeGraphRenderedScopeMonitorValue(
        monitor,
        runtime,
        frameValues,
        evaluationFrame,
        evaluationFrames,
      ),
      0,
    );
    buffer[bufferFrame] = sum / Math.max(1, monitors.length);
  }
}

function finishNodeGraphRenderedScopeCapture(capture) {
  if (!capture) {
    return;
  }
  nodeGraphModuleScopeState.buffers = capture.buffers;
  nodeGraphModuleScopeState.frames = capture.frames;
  nodeGraphModuleScopeState.monitorFingerprint = capture.monitorFingerprint;
  nodeGraphModuleScopeState.patchFingerprint = capture.patchFingerprint;
  nodeGraphModuleScopeState.sampleRate = capture.sampleRate;
  scheduleNodeGraphModuleScopeDraw();
}

function nodeGraphModuleScopeBuffersCurrent() {
  if (!nodeGraphModuleScopeState.buffers.size) {
    return false;
  }
  const patch = nodeGraphMvp?.patch;
  return nodeGraphModuleScopeState.patchFingerprint === nodeGraphPatchFingerprint()
    && nodeGraphModuleScopeState.monitorFingerprint === nodeGraphModuleScopeMonitorFingerprint(patch?.monitors);
}

function clearNodeGraphModuleScopeCanvas() {
  const canvas = nodeGraphModuleScopeCanvas();
  if (!canvas) {
    return;
  }
  if (nodeGraphModuleScopeState.renderer?.kind === "webgl") {
    const gl = nodeGraphModuleScopeState.renderer.gl;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return;
  }
  canvas.width = canvas.width;
}

function syncNodeGraphModuleScopeCanvas() {
  const canvas = nodeGraphModuleScopeCanvas();
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (!canvas || !workspace) {
    return false;
  }

  const pixelRatio = window.devicePixelRatio || 1;
  const rect = workspace.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * pixelRatio));
  const height = Math.max(1, Math.round(rect.height * pixelRatio));
  if (canvas.width !== width) {
    canvas.width = width;
  }
  if (canvas.height !== height) {
    canvas.height = height;
  }
  return true;
}

function createNodeGraphModuleScopeShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createNodeGraphModuleScopeWebGlRenderer(canvas) {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
  }) || canvas.getContext("experimental-webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
  });
  if (!gl) {
    return null;
  }

  const vertexShader = createNodeGraphModuleScopeShader(gl, gl.VERTEX_SHADER, `
    attribute vec2 aPosition;
    void main() {
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `);
  const fragmentShader = createNodeGraphModuleScopeShader(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform vec4 uColor;
    void main() {
      gl_FragColor = uColor;
    }
  `);
  if (!vertexShader || !fragmentShader) {
    return null;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  return {
    canvas,
    gl,
    kind: "webgl",
    positionBuffer: gl.createBuffer(),
    positionLocation: gl.getAttribLocation(program, "aPosition"),
    program,
    colorLocation: gl.getUniformLocation(program, "uColor"),
  };
}

function createNodeGraphModuleScopeCanvas2dRenderer(canvas) {
  const context = canvas.getContext("2d");
  return context
    ? { canvas, context, kind: "2d" }
    : null;
}

function nodeGraphModuleScopeRenderer(canvas) {
  const current = nodeGraphModuleScopeState.renderer;
  if (current?.canvas === canvas) {
    return current;
  }
  const renderer = createNodeGraphModuleScopeWebGlRenderer(canvas)
    || createNodeGraphModuleScopeCanvas2dRenderer(canvas);
  nodeGraphModuleScopeState.renderer = renderer;
  return renderer;
}

function nodeGraphModuleScopeBufferPoints(buffer, rect, canvas, pixelRatio) {
  const points = [];
  if (!buffer?.length || rect.width <= 1 || rect.height <= 1) {
    return points;
  }
  const midY = rect.top + rect.height * 0.5;
  const halfHeight = Math.max(1, rect.height * 0.42);
  const step = Math.max(1, Math.ceil(buffer.length / Math.max(1, rect.width)));
  for (let index = 0; index < buffer.length; index += step) {
    const x = rect.left + (index / Math.max(1, buffer.length - 1)) * rect.width;
    const y = midY - clampNodeSliderValue(buffer[index] || 0, -1, 1) * halfHeight;
    points.push(
      ((x * pixelRatio) / canvas.width) * 2 - 1,
      1 - ((y * pixelRatio) / canvas.height) * 2,
    );
  }
  return points;
}

function drawNodeGraphModuleScopeBufferWebGl(renderer, rect, buffer, pixelRatio) {
  const { canvas, gl } = renderer;
  const points = nodeGraphModuleScopeBufferPoints(buffer, rect, canvas, pixelRatio);
  if (points.length < 4) {
    return;
  }
  gl.scissor(
    Math.max(0, Math.floor(rect.left * pixelRatio)),
    Math.max(0, Math.floor(canvas.height - ((rect.top + rect.height) * pixelRatio))),
    Math.max(1, Math.ceil(rect.width * pixelRatio)),
    Math.max(1, Math.ceil(rect.height * pixelRatio)),
  );
  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STREAM_DRAW);
  gl.vertexAttribPointer(renderer.positionLocation, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(renderer.positionLocation);
  gl.drawArrays(gl.LINE_STRIP, 0, points.length / 2);
}

function drawNodeGraphModuleScopeBuffer2d(context, rect, buffer) {
  if (!buffer?.length || rect.width <= 1 || rect.height <= 1) {
    return;
  }
  const midY = rect.top + rect.height * 0.5;
  const halfHeight = Math.max(1, rect.height * 0.42);
  const step = Math.max(1, Math.ceil(buffer.length / Math.max(1, rect.width)));

  context.save();
  context.beginPath();
  context.rect(rect.left, rect.top, rect.width, rect.height);
  context.clip();
  context.strokeStyle = "rgba(127, 199, 217, 0.76)";
  context.lineWidth = 1;
  context.shadowColor = "rgba(127, 199, 217, 0.24)";
  context.shadowBlur = 3;
  context.beginPath();
  let drawn = false;
  for (let index = 0; index < buffer.length; index += step) {
    const x = rect.left + (index / Math.max(1, buffer.length - 1)) * rect.width;
    const y = midY - clampNodeSliderValue(buffer[index] || 0, -1, 1) * halfHeight;
    if (!drawn) {
      context.moveTo(x, y);
      drawn = true;
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();
  context.restore();
}

function drawNodeGraphModuleScopes() {
  const canvas = nodeGraphModuleScopeCanvas();
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (!canvas || !workspace || !nodeGraphModuleScopeBuffersCurrent()) {
    setNodeGraphModuleScopesEnabled(false);
    clearNodeGraphModuleScopeCanvas();
    return;
  }
  setNodeGraphModuleScopesEnabled(true);
  if (!syncNodeGraphModuleScopeCanvas()) {
    return;
  }
  const renderer = nodeGraphModuleScopeRenderer(canvas);
  if (!renderer) {
    return;
  }
  const pixelRatio = window.devicePixelRatio || 1;
  const workspaceRect = workspace.getBoundingClientRect();
  if (renderer.kind === "webgl") {
    const gl = renderer.gl;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(renderer.program);
    gl.uniform4f(renderer.colorLocation, 0.498, 0.78, 0.85, 0.76);
    gl.lineWidth(1);
    gl.enable(gl.SCISSOR_TEST);
  } else {
    renderer.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    renderer.context.clearRect(0, 0, canvas.width / pixelRatio, canvas.height / pixelRatio);
  }
  for (const slot of nodeGraphModuleScopeSlots()) {
    const buffer = nodeGraphModuleScopeState.buffers.get(slot.nodeId);
    if (!buffer) {
      continue;
    }
    const rect = slot.scopeElement.getBoundingClientRect();
    const scopeRect = {
      height: rect.height,
      left: rect.left - workspaceRect.left,
      top: rect.top - workspaceRect.top,
      width: rect.width,
    };
    if (renderer.kind === "webgl") {
      drawNodeGraphModuleScopeBufferWebGl(renderer, scopeRect, buffer, pixelRatio);
    } else {
      drawNodeGraphModuleScopeBuffer2d(renderer.context, scopeRect, buffer);
    }
  }
  if (renderer.kind === "webgl") {
    renderer.gl.disable(renderer.gl.SCISSOR_TEST);
  }
}

function scheduleNodeGraphModuleScopeDraw() {
  if (nodeGraphModuleScopeState.drawFrame) {
    return;
  }
  nodeGraphModuleScopeState.drawFrame = window.requestAnimationFrame(() => {
    nodeGraphModuleScopeState.drawFrame = 0;
    drawNodeGraphModuleScopes();
  });
}
