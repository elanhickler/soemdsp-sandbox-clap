const nodeGraphModuleScopeState = {
  animationTime: 0,
  animationDeltaSeconds: 1 / 60,
  animationLastTime: 0,
  buffers: new Map(),
  drawFrame: 0,
  enabled: false,
  frames: 0,
  liveFrameCapacity: 16384,
  clockLedStates: new Map(),
  monitorFingerprint: "",
  modelFrameTimes: new Map(),
  monitors: [],
  mode: "",
  oscillatorFrozenBuffers: new Map(),
  oscillatorPhasors: new Map(),
  additiveHarmonicProfiles: new Map(),
  patchFingerprint: "",
  phosphorFrame: {
    key: "",
    lastUpdate: 0,
  },
  scopeTracesOffActive: false,
  renderer: null,
  sampleRate: 0,
  slots: new Map(),
  traceImageTexture: {
    dataUrl: "",
    generatedKey: "",
    image: null,
    texture: null,
  },
};
const nodeGraphModuleScopeSettingsStorageKey = "soemdsp-sandbox.moduleScopeSettings.v1";
const nodeGraphModuleScopeDefaultSettings = Object.freeze({
  brightness: 1,
  cycles: 2,
  gain: 1,
  lineThickness: 1.5,
  offset: 0,
  oscillatorTraceMode: "frequencyReset",
  pan: 0,
  screenBurn: 0.62,
  sync: true,
  timeMs: 20,
});
const nodeGraphModuleScopeUnipolarTypes = new Set([
  "badvalMonitor",
  "clock",
  "clockDivider",
  "delayedTrigger",
  "expAdsr",
  "linearEnvelope",
  "midiNotePitch",
  "midiOut",
  "pluckEnvelope",
  "bloomGlow",
  "chromaColor",
  "rgbaHsla",
  "sandboxVisuals",
  "stepSequencer",
  "triggerCounter",
  "triggerDivider",
  "vactrolEnvelope",
]);

function normalizeNodeGraphModuleScopeSetting(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const cycles = Number(source.cycles);
  const timeMs = Number(source.timeMs);
  const offset = Number(source.offset);
  const pan = Number(source.pan);
  return {
    brightness: nodeGraphModuleScopeDefaultSettings.brightness,
    cycles: Number.isFinite(cycles) && cycles >= 0
      ? clampNodeSliderValue(cycles, 0, 128)
      : nodeGraphModuleScopeDefaultSettings.cycles,
    gain: nodeGraphModuleScopeDefaultSettings.gain,
    lineThickness: nodeGraphModuleScopeDefaultSettings.lineThickness,
    offset: Number.isFinite(offset) ? clampNodeSliderValue(offset, -1, 1) : nodeGraphModuleScopeDefaultSettings.offset,
    oscillatorTraceMode: source.oscillatorTraceMode === "window" ? "window" : "frequencyReset",
    pan: Number.isFinite(pan) ? clampNodeSliderValue(pan, -128, 128) : nodeGraphModuleScopeDefaultSettings.pan,
    screenBurn: nodeGraphModuleScopeDefaultSettings.screenBurn,
    sync: source.sync !== false,
    timeMs: Number.isFinite(timeMs) && timeMs >= 0
      ? clampNodeSliderValue(timeMs, 0, 10000)
      : nodeGraphModuleScopeDefaultSettings.timeMs,
  };
}

function normalizeNodeGraphModuleScopeBrightness(value, fallback = 1) {
  const number = Number(value);
  const safeFallback = Number.isFinite(Number(fallback)) ? Number(fallback) : 1;
  return Number.isFinite(number) ? clampNodeSliderValue(number, 0, 4) : clampNodeSliderValue(safeFallback, 0, 4);
}

function nodeGraphNormalizeScopeTraceColor(value) {
  const color = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color.toLowerCase();
  }
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    const [, r, g, b] = color.toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return nodeGraphModuleScopeDefaultSettings.traceColor;
}

function nodeGraphScopeHexColorToRgb(color) {
  const normalized = nodeGraphNormalizeScopeTraceColor(color);
  return [0, 2, 4].map((offset) => parseInt(normalized.slice(offset + 1, offset + 3), 16) / 255);
}

function normalizeNodeGraphModuleScopeSettings(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(
    Object.entries(source)
      .filter(([nodeId]) => Boolean(nodeId))
      .map(([nodeId, setting]) => [nodeId, normalizeNodeGraphModuleScopeSetting(setting)]),
  );
}

function nodeGraphModuleScopeSetting(nodeId) {
  return normalizeNodeGraphModuleScopeSetting(nodeGraphMvp.moduleScopeSettings?.[nodeId]);
}

function applyNodeGraphModuleScopeSettings(value = {}) {
  nodeGraphMvp.moduleScopeSettings = normalizeNodeGraphModuleScopeSettings(value);
  renderNodeGraphSceneScopeControls();
  scheduleNodeGraphModuleScopeDraw();
}

function loadNodeGraphModuleScopeSettingsLocal() {
  if (!nodeGraphLocalDefaultPresetAllowed()) {
    return null;
  }
  try {
    const text = window.localStorage.getItem(nodeGraphModuleScopeSettingsStorageKey);
    const settings = text ? normalizeNodeGraphModuleScopeSettings(JSON.parse(text)) : null;
    if (settings) {
      applyNodeGraphModuleScopeSettings(settings);
    }
    return settings;
  } catch {
    return null;
  }
}

function saveNodeGraphModuleScopeSettingsLocal(value = nodeGraphMvp.moduleScopeSettings) {
  if (!nodeGraphLocalDefaultPresetAllowed()) {
    return false;
  }
  try {
    window.localStorage.setItem(
      nodeGraphModuleScopeSettingsStorageKey,
      JSON.stringify(normalizeNodeGraphModuleScopeSettings(value)),
    );
    return true;
  } catch {
    return false;
  }
}

function updateNodeGraphModuleScopeSetting(nodeId, patch = {}) {
  if (!nodeId) {
    return;
  }
  nodeGraphMvp.moduleScopeSettings = {
    ...normalizeNodeGraphModuleScopeSettings(nodeGraphMvp.moduleScopeSettings),
    [nodeId]: normalizeNodeGraphModuleScopeSetting({
      ...nodeGraphModuleScopeSetting(nodeId),
      ...patch,
    }),
  };
  saveNodeGraphModuleScopeSettingsLocal();
  renderNodeGraphSceneScopeControls(nodeId);
  scheduleNodeGraphModuleScopeDraw();
}

function nodeGraphFormatScopeNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "";
  }
  return Number(number.toFixed(4)).toString();
}

function nodeGraphScopeControlTargetNodeId() {
  const scopeNode = nodeGraphMvp.scopeContextTargetNode;
  if (scopeNode && nodeGraphPatchNode(scopeNode)) {
    return scopeNode;
  }
  return nodeGraphModuleActionTargetNodeId();
}

function renderNodeGraphSceneScopeControls(nodeId = nodeGraphScopeControlTargetNodeId()) {
  const setting = nodeGraphModuleScopeSetting(nodeId);
  const targetNode = nodeGraphPatchNode(nodeId);
  const individualControls = document.getElementById("nodeIndividualScopeControls");
  if (individualControls) {
    individualControls.hidden = !targetNode;
  }
  const timeInput = document.getElementById("nodeSceneScopeTime");
  if (timeInput && document.activeElement !== timeInput) {
    timeInput.value = nodeGraphFormatScopeNumber(setting.cycles);
    timeInput.title = "Scope horizontal window in detected cycles. Use 0 to show the full captured buffer.";
  }
  const scopeFields = document.querySelector("#nodeSceneScopeControls .scene-context-scope-fields");
  if (scopeFields) {
    const showOscillatorMode = targetNode?.type === "osc";
    scopeFields.classList.toggle("three", showOscillatorMode);
    scopeFields.classList.toggle("two", !showOscillatorMode);
  }
  const syncButton = document.getElementById("nodeSceneScopeSync");
  if (syncButton) {
    syncButton.textContent = setting.sync ? "sync" : "free";
    syncButton.setAttribute("aria-pressed", String(setting.sync));
    syncButton.title = "Scope rising-edge sync";
  }
  const oscillatorTraceModeButton = document.getElementById("nodeSceneScopeOscillatorTraceMode");
  if (oscillatorTraceModeButton) {
    const isFrequencyResetMode = setting.oscillatorTraceMode !== "window";
    oscillatorTraceModeButton.hidden = targetNode?.type !== "osc";
    oscillatorTraceModeButton.textContent = isFrequencyResetMode ? "freq reset" : "window";
    oscillatorTraceModeButton.setAttribute("aria-pressed", String(isFrequencyResetMode));
    oscillatorTraceModeButton.title = "Oscillator scope redraw mode";
  }
}

function handleNodeGraphSceneScopeNumericInput(event) {
  const input = event.currentTarget;
  const nodeId = nodeGraphScopeControlTargetNodeId();
  if (!nodeId) {
    return;
  }
  const value = Number(input.value.trim());
  if (!Number.isFinite(value)) {
    renderNodeGraphSceneScopeControls(nodeId);
    return;
  }
  if (input.dataset.scopeInput === "cycles") {
    updateNodeGraphModuleScopeSetting(nodeId, { cycles: value });
  }
}

function handleNodeGraphSceneScopeNumericKeydown(event) {
  if (event.key === "Enter") {
    event.currentTarget.blur();
  }
}

function nodeGraphScopeNumberInputRange(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const step = Number(input.step);
  return {
    max: Number.isFinite(max) ? max : 1,
    min: Number.isFinite(min) ? min : 0,
    step: Number.isFinite(step) && step > 0 ? step : 0.01,
  };
}

function nodeGraphScopeNumberInputStepDecimals(input) {
  const stepText = String(input.step || "");
  const decimalPart = stepText.includes(".") ? stepText.split(".").pop() : "";
  return Math.min(6, decimalPart.length);
}

function nodeGraphScopeNumberInputSnapValue(input, value) {
  const { min, max, step } = nodeGraphScopeNumberInputRange(input);
  const decimals = nodeGraphScopeNumberInputStepDecimals(input);
  const clamped = clampNodeSliderValue(Number(value) || 0, min, max);
  const quantized = Math.round(clamped / step) * step;
  const snapped = clampNodeSliderValue(quantized, min, max);
  return Number(snapped.toFixed(decimals));
}

function setNodeGraphScopeNumberInputValue(input, value) {
  input.value = nodeGraphScopeNumberInputSnapValue(input, value).toString();
  if (input.dataset.globalScopeInput === "dotCore1Size") {
    setNodeGraphModuleScopeDotCore1Size(input.value);
  } else if (input.dataset.globalScopeInput === "dotCore1Brightness") {
    setNodeGraphModuleScopeDotCore1Brightness(input.value);
  } else if (input.dataset.globalScopeInput === "dotCore2Size") {
    setNodeGraphModuleScopeDotCore2Size(input.value);
  } else if (input.dataset.globalScopeInput === "dotCore2Brightness") {
    setNodeGraphModuleScopeDotCore2Brightness(input.value);
  } else {
    handleNodeGraphSceneScopeNumericInput({ currentTarget: input });
  }
}

function bindNodeGraphModuleScopeViewDrag(scopeElement) {
  if (!scopeElement || scopeElement.dataset.scopeViewDragBound === "true") {
    return;
  }
  scopeElement.dataset.scopeViewDragBound = "true";
  scopeElement.addEventListener("pointerdown", beginNodeGraphModuleScopeViewDrag);
}

function ensureNodeGraphModuleScopeViewDragEvents() {
  if (nodeGraphModuleScopeState.viewDragEventsBound) {
    return;
  }
  nodeGraphModuleScopeState.viewDragEventsBound = true;
  document.addEventListener("pointermove", dragNodeGraphModuleScopeView);
  document.addEventListener("pointerup", endNodeGraphModuleScopeViewDrag);
  document.addEventListener("pointercancel", endNodeGraphModuleScopeViewDrag);
}

function beginNodeGraphModuleScopeViewDrag(event) {
  if (event.button !== 0 || event.detail > 1) {
    return;
  }
  const scopeElement = event.currentTarget;
  const moduleElement = scopeElement?.closest?.(".dsp-node");
  const nodeId = moduleElement?.dataset?.node || scopeElement?.dataset?.node || "";
  if (!nodeId) {
    return;
  }
  const setting = nodeGraphModuleScopeSetting(nodeId);
  const rect = scopeElement.getBoundingClientRect();
  nodeGraphMvp.scopeViewDragging = {
    nodeId,
    pointerId: event.pointerId ?? null,
    scopeElement,
    startCycles: setting.cycles > 0 ? setting.cycles : nodeGraphModuleScopeDefaultSettings.cycles,
    startPan: setting.pan,
    startSync: setting.sync !== false,
    startX: event.clientX,
    startY: event.clientY,
    width: Math.max(1, rect.width),
  };
  scopeElement.classList.add("view-dragging");
  if (event.pointerId !== undefined) {
    scopeElement.setPointerCapture?.(event.pointerId);
  }
  event.preventDefault();
  event.stopPropagation();
}

function dragNodeGraphModuleScopeView(event) {
  const drag = nodeGraphMvp.scopeViewDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }
  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  const rawCycles = clampNodeSliderValue(
    drag.startCycles * Math.pow(2, dy / 160),
    0.125,
    128,
  );
  const nextCycles = drag.startSync
    ? Math.max(1, Math.round(rawCycles))
    : rawCycles;
  const rawPan = clampNodeSliderValue(
    drag.startPan + (dx / drag.width) * Math.max(0.125, nextCycles),
    -128,
    128,
  );
  const nextPan = drag.startSync ? Math.round(rawPan) : rawPan;
  updateNodeGraphModuleScopeSetting(drag.nodeId, {
    cycles: nextCycles,
    pan: nextPan,
  });
  event.preventDefault();
}

function endNodeGraphModuleScopeViewDrag(event) {
  const drag = nodeGraphMvp.scopeViewDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }
  drag.scopeElement?.classList.remove("view-dragging");
  if (event.pointerId !== undefined && drag.scopeElement?.hasPointerCapture?.(event.pointerId)) {
    drag.scopeElement.releasePointerCapture(event.pointerId);
  }
  nodeGraphMvp.scopeViewDragging = null;
}

function nodeGraphScopeNumberDragScale(input, event) {
  const { min, max, step } = nodeGraphScopeNumberInputRange(input);
  if (input.dataset.scopeInput === "cycles") {
    const baseCycles = Math.max(step / 8, (max - min) / 960);
    if (event.ctrlKey && event.shiftKey) {
      return baseCycles * 0.01;
    }
    if (event.shiftKey) {
      return baseCycles * 0.1;
    }
    if (event.ctrlKey) {
      return baseCycles * 0.25;
    }
    return baseCycles;
  }
  const base = Math.max(step, (max - min) / 160);
  if (event.ctrlKey && event.shiftKey) {
    return base * 0.01;
  }
  if (event.shiftKey) {
    return base * 0.1;
  }
  if (event.ctrlKey) {
    return base * 0.25;
  }
  return base;
}

function beginNodeGraphScopeNumberDrag(event) {
  if (event.button > 0 || event.detail > 1) {
    return;
  }
  const input = event.currentTarget;
  nodeGraphMvp.scopeNumberDragging = {
    input,
    pointerId: event.pointerId ?? null,
    scale: nodeGraphScopeNumberDragScale(input, event),
    startValue: Number(input.value) || 0,
    startX: event.clientX,
    startY: event.clientY,
  };
  input.classList.add("value-dragging");
  input.readOnly = true;
  input.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function dragNodeGraphScopeNumber(event) {
  const drag = nodeGraphMvp.scopeNumberDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }
  const horizontalDelta = event.clientX - drag.startX;
  const verticalDelta = drag.startY - event.clientY;
  setNodeGraphScopeNumberInputValue(
    drag.input,
    drag.startValue + (horizontalDelta + verticalDelta) * drag.scale,
  );
  event.preventDefault();
}

function endNodeGraphScopeNumberDrag(event) {
  const drag = nodeGraphMvp.scopeNumberDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }
  drag.input.classList.remove("value-dragging");
  drag.input.readOnly = false;
  if (event.pointerId !== undefined && drag.input.hasPointerCapture?.(event.pointerId)) {
    drag.input.releasePointerCapture(event.pointerId);
  }
  nodeGraphMvp.scopeNumberDragging = null;
  event.preventDefault();
}

function beginNodeGraphScopeNumberEdit(event) {
  const input = event.currentTarget;
  input.readOnly = false;
  input.focus();
  input.select();
  event.preventDefault();
  event.stopPropagation();
}

function handleNodeGraphSceneScopeControlClick(event) {
  const button = event.currentTarget;
  const nodeId = nodeGraphScopeControlTargetNodeId();
  const setting = nodeGraphModuleScopeSetting(nodeId);
  if (button.dataset.scopeControl === "sync") {
    updateNodeGraphModuleScopeSetting(nodeId, {
      sync: !setting.sync,
    });
  } else if (button.dataset.scopeControl === "oscillatorTraceMode") {
    updateNodeGraphModuleScopeSetting(nodeId, {
      oscillatorTraceMode: setting.oscillatorTraceMode === "window" ? "frequencyReset" : "window",
    });
  }
  event.preventDefault();
  event.stopPropagation();
}

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
  bindNodeGraphModuleScopeViewDrag(scopeElement);
  ensureNodeGraphModuleScopeViewDragEvents();
  nodeGraphModuleScopeState.slots.set(nodeId, slot);
  scheduleNodeGraphModuleScopeDraw();
  return slot;
}

function unregisterNodeGraphModuleScopeSlot(nodeId) {
  nodeGraphModuleScopeState.slots.delete(nodeId);
  nodeGraphModuleScopeState.clockLedStates.delete(nodeId);
  nodeGraphModuleScopeState.modelFrameTimes.delete(nodeId);
  nodeGraphModuleScopeState.oscillatorFrozenBuffers.delete(nodeId);
  nodeGraphModuleScopeState.oscillatorPhasors.delete(nodeId);
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

function nodeGraphDefaultModuleScopeMonitors(patch = nodeGraphMvp?.patch) {
  return (Array.isArray(patch?.nodes) ? patch.nodes : [])
    .map((node) => {
      if (node?.type === "osc") {
        return {
          io: "output",
          node: node.id,
          port: nodeGraphOscillatorSelectedOutputPort(node),
        };
      }
      const inputs = nodeGraphPatchNodeInputPorts(node);
      if (inputs.length) {
        return {
          io: "input",
          node: node.id,
          port: inputs[0],
        };
      }
      const outputs = nodeGraphPatchNodeOutputPorts(node);
      if (!outputs.length) {
        return null;
      }
      const port = outputs.includes("Out") ? "Out" : outputs[0];
      return {
        io: "output",
        node: node.id,
        port,
      };
    })
    .filter(Boolean);
}

function nodeGraphOscillatorSelectedOutputPort(node) {
  const waveform = Math.round(Number(nodeGraphModuleScopeNodeParam(node, "waveform", 0)) || 0);
  return ["Saw", "Square", "Tri", "Sine"][waveform] || "Saw";
}

function nodeGraphModuleScopeCaptureMonitors(patch = nodeGraphMvp?.patch) {
  const monitors = normalizeNodeGraphPatchMonitors(patch?.monitors, patch);
  return monitors.length ? monitors : nodeGraphDefaultModuleScopeMonitors(patch);
}

function nodeGraphModuleScopeHasModelDisplay() {
  return nodeGraphModuleScopeSlots().some((slot) =>
    slot.type === "clock" ||
    slot.type === "osc" ||
    slot.type === "noise" ||
    slot.type === "stereoNoise" ||
    (slot.type === "gain" && nodeGraphModuleScopeConnectionsTo(slot.nodeId, "In").length > 0));
}

function resetNodeGraphModuleScopeFrameClocks() {
  nodeGraphModuleScopeState.modelFrameTimes.clear();
  nodeGraphModuleScopeState.phosphorFrame = {
    key: "",
    lastUpdate: 0,
  };
}

function clearNodeGraphModuleScopeBuffers() {
  if (nodeGraphModuleScopeState.drawFrame) {
    window.cancelAnimationFrame(nodeGraphModuleScopeState.drawFrame);
    nodeGraphModuleScopeState.drawFrame = 0;
  }
  nodeGraphModuleScopeState.buffers.clear();
  nodeGraphModuleScopeState.clockLedStates.clear();
  nodeGraphModuleScopeState.frames = 0;
  nodeGraphModuleScopeState.monitorFingerprint = "";
  nodeGraphModuleScopeState.mode = "";
  resetNodeGraphModuleScopeFrameClocks();
  nodeGraphModuleScopeState.oscillatorFrozenBuffers.clear();
  nodeGraphModuleScopeState.oscillatorPhasors.clear();
  nodeGraphModuleScopeState.patchFingerprint = "";
  nodeGraphModuleScopeState.sampleRate = 0;
  nodeGraphModuleScopeState.animationLastTime = 0;
  nodeGraphModuleScopeState.animationTime = 0;
  nodeGraphModuleScopeState.animationDeltaSeconds = 0;
  setNodeGraphModuleScopesEnabled(false);
  clearNodeGraphModuleScopeCanvas();
}

function clearNodeGraphRenderedModuleScopeBuffers() {
  if (nodeGraphModuleScopeState.mode === "live") {
    return;
  }
  if (nodeGraphModuleScopeHasModelDisplay()) {
    nodeGraphModuleScopeState.buffers.clear();
    nodeGraphModuleScopeState.frames = 0;
    nodeGraphModuleScopeState.monitorFingerprint = "";
    nodeGraphModuleScopeState.mode = "model";
    nodeGraphModuleScopeState.patchFingerprint = nodeGraphPatchFingerprint();
    nodeGraphModuleScopeState.sampleRate = nodeGraphMvp.sampleRate || 44100;
    scheduleNodeGraphModuleScopeDraw();
    return;
  }
  clearNodeGraphModuleScopeBuffers();
}

function nodeGraphMonitorEndpointKey(endpoint) {
  return `${endpoint?.node || ""}.${endpoint?.io || ""}.${endpoint?.port || endpoint?.param || ""}`;
}

function nodeGraphMonitorEndpointFromElement(element) {
  if (!element) {
    return null;
  }
  if (element.classList?.contains("node-io-row")) {
    return {
      io: String(element.dataset.io || ""),
      node: String(element.dataset.node || ""),
      port: String(element.dataset.port || ""),
    };
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
    return nodeGraphPatchNodeInputPorts(node).includes(endpoint.port);
  }
  if (endpoint.io === "output") {
    return nodeGraphPatchNodeOutputPorts(node).includes(endpoint.port);
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
  const monitors = nodeGraphModuleScopeCaptureMonitors(patch);
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
  nodeGraphModuleScopeState.mode = "rendered";
  nodeGraphModuleScopeState.patchFingerprint = capture.patchFingerprint;
  nodeGraphModuleScopeState.sampleRate = capture.sampleRate;
  scheduleNodeGraphModuleScopeDraw();
}

function nodeGraphLiveModuleScopeFingerprint(plan = {}) {
  const ids = Array.isArray(plan.order) && plan.order.length
    ? plan.order
    : (Array.isArray(plan.nodes) ? plan.nodes.map((node) => node.id) : []);
  return ids.map((id) => String(id || "")).filter(Boolean).sort().join("|");
}

function beginNodeGraphLiveModuleScopeCapture(plan = {}, options = {}) {
  const ids = Array.isArray(plan.order) && plan.order.length
    ? plan.order
    : (Array.isArray(plan.nodes) ? plan.nodes.map((node) => node.id) : []);
  const frameCapacity = Math.max(
    32,
    Math.floor(Number(options.frames) || nodeGraphModuleScopeState.liveFrameCapacity),
  );
  nodeGraphModuleScopeState.buffers = new Map(
    ids
      .map((id) => String(id || ""))
      .filter(Boolean)
      .map((id) => [id, new Float32Array(frameCapacity)]),
  );
  nodeGraphModuleScopeState.frames = frameCapacity;
  nodeGraphModuleScopeState.monitorFingerprint = nodeGraphLiveModuleScopeFingerprint(plan);
  nodeGraphModuleScopeState.mode = "live";
  nodeGraphModuleScopeState.patchFingerprint = String(plan.patchFingerprint || nodeGraphPatchFingerprint());
  nodeGraphModuleScopeState.sampleRate = Number(options.sampleRate) || 0;
  scheduleNodeGraphModuleScopeDraw();
}

function updateNodeGraphLiveModuleScopeFingerprint(patchFingerprint = nodeGraphPatchFingerprint()) {
  if (nodeGraphModuleScopeState.mode !== "live") {
    return;
  }
  const fingerprint = String(patchFingerprint || "");
  if (!fingerprint || nodeGraphModuleScopeState.patchFingerprint === fingerprint) {
    return;
  }
  nodeGraphModuleScopeState.patchFingerprint = fingerprint;
}

function nodeGraphModuleScopeScalarValue(value) {
  const readNumber = (candidate) => {
    const number = Number(candidate);
    if (!Number.isFinite(number) || Number.isNaN(number)) {
      return null;
    }
    return number;
  };
  if (typeof value === "number") {
    return readNumber(value) ?? 0;
  }
  if (!value || typeof value !== "object") {
    return 0;
  }
  for (const key of ["Out", "Out X", "Out Y", "Out Z", "Left", "Right", "X", "Y", "Z", "Pulse", "Gate", "Count"]) {
    const number = readNumber(value[key]);
    if (number !== null) {
      return number;
    }
  }
  for (const candidate of Object.values(value)) {
    const number = readNumber(candidate);
    if (number !== null) {
      return number;
    }
  }
  return 0;
}

function nodeGraphModuleScopeNodeForSlot(slot) {
  return (Array.isArray(nodeGraphMvp?.patch?.nodes) ? nodeGraphMvp.patch.nodes : [])
    .find((node) => node.id === slot?.nodeId) || null;
}

function nodeGraphModuleScopeNodeParam(node, key, fallback) {
  const value = Number(node?.params?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function nodeGraphModuleScopeAdvanceFixedFrameClock(state, now, fps) {
  const frameDuration = 1 / normalizeNodeGraphModuleScopeFramesPerSecond(fps);
  const lastUpdate = Number(state?.lastUpdate);
  const stateTime = Number(state?.time);
  if (!Number.isFinite(lastUpdate) || lastUpdate <= 0 || now <= lastUpdate) {
    return {
      ready: true,
      steps: 1,
      lastUpdate: now,
      time: Number.isFinite(stateTime) ? stateTime : now,
    };
  }
  const elapsed = now - lastUpdate;
  const resyncDuration = Math.max(0.5, frameDuration * 4);
  if (elapsed > resyncDuration) {
    return {
      ready: true,
      steps: 1,
      lastUpdate: now,
      time: now,
    };
  }
  if (elapsed + frameDuration * 0.05 < frameDuration) {
    return {
      ready: false,
      steps: 0,
      lastUpdate,
      time: Number.isFinite(stateTime) ? stateTime : lastUpdate,
    };
  }
  const steps = Math.max(1, Math.floor((elapsed + frameDuration * 0.05) / frameDuration));
  const nextLastUpdate = lastUpdate + steps * frameDuration;
  const nextTime = (Number.isFinite(stateTime) ? stateTime : lastUpdate) + steps * frameDuration;
  return {
    ready: true,
    steps,
    lastUpdate: nextLastUpdate,
    time: nextTime,
  };
}

function nodeGraphModuleScopeModelFrameTime(slot) {
  const nodeId = String(slot?.nodeId || "");
  if (!nodeId) {
    return Math.max(0, Number(nodeGraphModuleScopeState.animationTime) || 0);
  }
  const fps = normalizeNodeGraphModuleScopeFramesPerSecond(nodeGraphMvp?.moduleScopeFramesPerSecond ?? 60);
  const now = Math.max(0, Number(nodeGraphModuleScopeState.animationTime) || 0);
  const state = nodeGraphModuleScopeState.modelFrameTimes.get(nodeId);
  if (!state) {
    const initialState = {
      lastUpdate: now,
      time: now,
    };
    nodeGraphModuleScopeState.modelFrameTimes.set(nodeId, initialState);
    return initialState.time;
  }
  const tick = nodeGraphModuleScopeAdvanceFixedFrameClock(state, now, fps);
  if (tick.ready) {
    state.lastUpdate = tick.lastUpdate;
    state.time = tick.time;
  }
  nodeGraphModuleScopeState.modelFrameTimes.set(nodeId, state);
  return state.time;
}

function nodeGraphModuleScopeNodeMap() {
  return new Map((Array.isArray(nodeGraphMvp?.patch?.nodes) ? nodeGraphMvp.patch.nodes : [])
    .map((node) => [node.id, node]));
}

function nodeGraphModuleScopeConnectionsTo(nodeId, port = "In") {
  return (Array.isArray(nodeGraphMvp?.patch?.connections) ? nodeGraphMvp.patch.connections : [])
    .filter((connection) => connection.destinationNode === nodeId && connection.destinationPort === port);
}

function nodeGraphModuleScopeStableSeed(text) {
  let seed = 0x12345678;
  for (const character of String(text)) {
    seed = (Math.imul(seed ^ character.charCodeAt(0), 16777619)) >>> 0;
  }
  return seed || 0x12345678;
}

function nodeGraphModuleScopeAdvanceNoiseSeed(seed, steps) {
  let delta = Math.max(0, Math.floor(Number(steps) || 0)) >>> 0;
  let accumulatedMultiplier = 1;
  let accumulatedIncrement = 0;
  let currentMultiplier = 1664525;
  let currentIncrement = 1013904223;
  while (delta > 0) {
    if (delta & 1) {
      accumulatedMultiplier = Math.imul(accumulatedMultiplier, currentMultiplier) >>> 0;
      accumulatedIncrement = (Math.imul(accumulatedIncrement, currentMultiplier) + currentIncrement) >>> 0;
    }
    currentIncrement = (Math.imul(currentMultiplier + 1, currentIncrement)) >>> 0;
    currentMultiplier = Math.imul(currentMultiplier, currentMultiplier) >>> 0;
    delta >>>= 1;
  }
  return (Math.imul(accumulatedMultiplier, seed >>> 0) + accumulatedIncrement) >>> 0;
}

function nodeGraphModuleScopeNoiseSeedToSample(seed) {
  return ((seed >>> 0) / 0xffffffff) * 2 - 1;
}

function nodeGraphModuleScopeNoiseSeedKey(nodeId, seedValue) {
  const seed = Math.max(0, Math.min(99999, Math.floor(Number(seedValue) || 0)));
  return `${nodeId}:seed:${seed}`;
}

function nodeGraphModuleScopeNoiseHoldSample(nodeId, seedValue, speed, sampleIndex, sampleRate) {
  const safeSampleRate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);
  const safeSpeed = clampNodeSliderValue(Number(speed) || 0, 0, 1);
  const clockRate = safeSpeed * safeSampleRate * 0.5;
  const holdIndex = clockRate > 0
    ? Math.floor(Math.max(0, Number(sampleIndex) || 0) / Math.max(1, safeSampleRate / clockRate))
    : 0;
  const seed = nodeGraphModuleScopeAdvanceNoiseSeed(
    nodeGraphModuleScopeStableSeed(nodeGraphModuleScopeNoiseSeedKey(nodeId, seedValue)),
    holdIndex + 1,
  );
  return nodeGraphModuleScopeNoiseSeedToSample(seed);
}

function nodeGraphModuleScopeLinearToDb(value) {
  const amplitude = Math.abs(Number(value) || 0);
  return amplitude > 0.000001 ? 20 * Math.log10(amplitude) : -Infinity;
}

function nodeGraphModuleScopeFormatDb(value) {
  return Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${value.toFixed(1)} dB` : "-inf dB";
}

function nodeGraphModuleScopeBufferStats(buffer) {
  if (!buffer?.length) {
    return {
      peak: 0,
      peakDb: -Infinity,
      rms: 0,
      rmsDb: -Infinity,
    };
  }
  let peak = 0;
  let sumSquares = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    const sample = Number(buffer[index]) || 0;
    const magnitude = Math.abs(sample);
    peak = Math.max(peak, magnitude);
    sumSquares += sample * sample;
  }
  const rms = Math.sqrt(sumSquares / buffer.length);
  return {
    peak,
    peakDb: nodeGraphModuleScopeLinearToDb(peak),
    rms,
    rmsDb: nodeGraphModuleScopeLinearToDb(rms),
  };
}

function renderNodeGraphModuleScopeAnalyzer(slot, buffer = null) {
  const analyzer = slot?.scopeElement?.querySelector?.(".node-module-scope-analyzer");
  if (!analyzer) {
    return;
  }
  analyzer.classList.toggle("gain-scope-analyzer", slot?.type === "gain");
  const metrics = buffer?.nodeGraphScopeAnalyzer;
  if (!metrics) {
    analyzer.hidden = true;
    analyzer.textContent = "";
    return;
  }
  analyzer.hidden = false;
  const rows = [
    ["gain", metrics.gainDb],
    metrics.inputRmsDb === undefined ? null : ["in", metrics.inputRmsDb],
    ["pk", metrics.peakDb],
    ["rms", metrics.rmsDb],
  ].filter(Boolean);
  analyzer.replaceChildren(
    ...rows.map(([label, value]) => {
      const item = document.createElement("span");
      item.dataset.scopeMetric = label;
      item.textContent = `${label} ${nodeGraphModuleScopeFormatDb(value)}`;
      return item;
    }),
  );
}

function nodeGraphModuleScopeOfflineSourceFrequency(nodeId, nodeMap = nodeGraphModuleScopeNodeMap(), visited = new Set()) {
  if (!nodeId || visited.has(nodeId)) {
    return 0;
  }
  visited.add(nodeId);
  const node = nodeMap.get(nodeId);
  if (!node) {
    return 0;
  }
  if (node.type === "osc") {
    const baseFrequency = Math.max(0, nodeGraphModuleScopeNodeParam(node, "frequency", 0));
    const pitchInput = clampNodeSliderValue(
      nodeGraphModuleScopeConnectionsTo(node.id, "0.1V/Oct")
        .reduce((sum, connection) => sum + nodeGraphModuleScopeOfflineSignalSample(
          { nodeMap },
          connection.sourceNode,
          0,
          0,
          connection.sourcePort,
          1,
        ), 0),
      -1,
      1,
    );
    return Math.max(0, baseFrequency * (2 ** (pitchInput / 0.1)));
  }
  if (node.type === "gain" || node.type === "bias") {
    return Math.max(
      0,
      ...nodeGraphModuleScopeConnectionsTo(node.id, "In")
        .map((connection) => nodeGraphModuleScopeOfflineSourceFrequency(connection.sourceNode, nodeMap, visited)),
    );
  }
  return 0;
}

function updateNodeGraphModuleClockLed(slot) {
  if (slot?.type !== "clock" || !slot.scopeElement) {
    return;
  }
  const led = slot.scopeElement.querySelector(".node-clock-led");
  if (!led) {
    return;
  }
  const dt = clampNodeSliderValue(Number(nodeGraphModuleScopeState.animationDeltaSeconds) || (1 / 60), 1 / 240, 1 / 15);
  let state = nodeGraphModuleScopeState.clockLedStates.get(slot.nodeId);
  if (!state) {
    state = { brightness: 0 };
    nodeGraphModuleScopeState.clockLedStates.set(slot.nodeId, state);
  }

  const buffer = nodeGraphModuleScopeState.buffers.get(slot.nodeId);
  const latestSample = buffer?.length ? Number(buffer[buffer.length - 1]) || 0 : 0;
  const target = clampNodeSliderValue(Math.abs(latestSample), 0, 1);
  const tau = target > state.brightness ? 0.004 : 0.085;
  const coefficient = tau <= 0 ? 1 : 1 - Math.exp(-dt / tau);
  state.brightness = clampNodeSliderValue(
    (Number(state.brightness) || 0) + (target - (Number(state.brightness) || 0)) * coefficient,
    0,
    1,
  );
  const glow = Math.pow(state.brightness, 0.55);
  led.style.setProperty("--node-clock-led-brightness", state.brightness.toFixed(4));
  led.style.setProperty("--node-clock-led-glow", glow.toFixed(4));
  led.dataset.ledState = state.brightness > 0.08 ? "on" : "off";
}

function nodeGraphModuleScopeOfflineSignalSample(context, nodeId, localTime, sampleIndex, port = "Out", depth = 0) {
  if (!context || !nodeId || depth > 16) {
    return 0;
  }
  const node = context.nodeMap.get(nodeId);
  if (!node) {
    return 0;
  }
  if (node.type === "osc") {
    const waveformByPort = {
      Saw: 0,
      Square: 1,
      Tri: 2,
      Sine: 3,
    };
    const waveform = Object.hasOwn(waveformByPort, port)
      ? waveformByPort[port]
      : nodeGraphModuleScopeNodeParam(node, "waveform", 0);
    const baseFrequency = Math.max(0, nodeGraphModuleScopeNodeParam(node, "frequency", 0));
    const pitchInput = clampNodeSliderValue(
      nodeGraphModuleScopeConnectionsTo(node.id, "0.1V/Oct")
        .reduce((sum, connection) => sum + nodeGraphModuleScopeOfflineSignalSample(
          context,
          connection.sourceNode,
          localTime,
          sampleIndex,
          connection.sourcePort,
          depth + 1,
        ), 0),
      -1,
      1,
    );
    const frequency = Math.max(0, baseFrequency * (2 ** (pitchInput / 0.1)));
    const phase = wrapNodeSliderValue(nodeGraphModuleScopeNodeParam(node, "phase", 0), 0, 1);
    const level = nodeGraphModuleScopeNodeParam(node, "level", 0.5);
    return nodeGraphModuleScopeOfflineOscillatorSample(waveform, phase + localTime * frequency) * level;
  }
  if (node.type === "additiveOsc") {
    const baseFrequency = Math.max(0, nodeGraphModuleScopeNodeParam(node, "frequency", 0));
    const pitchInput = clampNodeSliderValue(
      nodeGraphModuleScopeConnectionsTo(node.id, "0.1V/Oct")
        .reduce((sum, connection) => sum + nodeGraphModuleScopeOfflineSignalSample(
          context,
          connection.sourceNode,
          localTime,
          sampleIndex,
          connection.sourcePort,
          depth + 1,
        ), 0),
      -1,
      1,
    );
    const frequency = Math.max(0, baseFrequency * (2 ** (pitchInput / 0.1)));
    const phase = wrapNodeSliderValue(nodeGraphModuleScopeNodeParam(node, "phase", 0), 0, 1);
    return nodeGraphAdditiveOscillatorSample(
      null,
      node.id,
      (phase + localTime * frequency) * Math.PI * 2,
      {
        frequency,
        harmonics: nodeGraphModuleScopeNodeParam(node, "harmonics", 32),
        level: nodeGraphModuleScopeNodeParam(node, "level", 0.35),
        modA: nodeGraphModuleScopeNodeParam(node, "modA", 0.5),
        waveform: nodeGraphModuleScopeNodeParam(node, "waveform", 1),
      },
      Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100,
    );
  }
  if (node.type === "noise") {
    const level = clampNodeSliderValue(nodeGraphModuleScopeNodeParam(node, "level", 0.5), 0, 1);
    const seedValue = nodeGraphModuleScopeNodeParam(node, "seed", 1);
    const speed = nodeGraphModuleScopeNodeParam(node, "speed", 1);
    const sampleRate = Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100;
    return nodeGraphModuleScopeNoiseHoldSample(node.id, seedValue, speed, sampleIndex, sampleRate) * level;
  }
  const input = nodeGraphModuleScopeConnectionsTo(node.id, "In")
    .reduce((sum, connection) => sum + nodeGraphModuleScopeOfflineSignalSample(
      context,
      connection.sourceNode,
      localTime,
      sampleIndex,
      connection.sourcePort,
      depth + 1,
    ), 0);
  if (node.type === "gain") {
    return input * nodeGraphModuleScopeNodeParam(node, "amount", 1);
  }
  if (node.type === "bias") {
    return input + nodeGraphModuleScopeNodeParam(node, "offset", 0);
  }
  return 0;
}

function nodeGraphModuleScopeOfflineOscillatorSample(waveform, phaseCycle) {
  const cycle = wrapNodeSliderValue(phaseCycle, 0, 1);
  switch (Math.round(Number(waveform) || 0)) {
    case 1:
      return cycle < 0.5 ? 1 : -1;
    case 2:
      return cycle < 0.5 ? (cycle * 4 - 1) : (3 - cycle * 4);
    case 3:
      return Math.sin(cycle * Math.PI * 2);
    case 4:
      return Math.tanh(
        Math.sin((cycle * 17.13 + 0.17) * Math.PI * 2) * 0.62 +
        Math.sin((cycle * 37.71 + 0.41) * Math.PI * 2) * 0.38 +
        Math.sin((cycle * 73.19 + 0.73) * Math.PI * 2) * 0.24,
      );
    case 0:
    default:
      return 1 - cycle * 2;
  }
}

function nodeGraphModuleScopeOscillatorPhasor(slot, frequency, cycles, modelTime = nodeGraphModuleScopeModelFrameTime(slot)) {
  const nodeId = String(slot?.nodeId || "");
  const now = Math.max(0, Number(modelTime) || 0);
  const safeFrequency = Math.max(0, Number(frequency) || 0);
  const safeCycles = Math.max(1e-6, Number(cycles) || 1);
  let phasor = nodeGraphModuleScopeState.oscillatorPhasors.get(nodeId);
  if (!phasor) {
    phasor = {
      lastTime: now,
      previousSweep: 0,
      renderTime: -1,
      signal: 0,
      sweep: 0,
      sweepDelta: 0,
    };
    nodeGraphModuleScopeState.oscillatorPhasors.set(nodeId, phasor);
  }
  if (phasor.renderTime === now) {
    return phasor;
  }

  const dt = clampNodeSliderValue(now - (Number(phasor.lastTime) || now), 0, 0.25);
  const previousSweep = Number(phasor.sweep) || 0;
  phasor.previousSweep = previousSweep;
  phasor.sweepDelta = 0;
  if (dt > 0 && safeFrequency > 0) {
    const cycleDelta = safeFrequency * dt;
    const sweepDelta = cycleDelta / safeCycles;
    phasor.signal = wrapNodeSliderValue((Number(phasor.signal) || 0) + cycleDelta, 0, 1);
    phasor.sweep = wrapNodeSliderValue(previousSweep + sweepDelta, 0, 1);
    phasor.sweepDelta = sweepDelta;
  }
  phasor.lastTime = now;
  phasor.renderTime = now;
  return phasor;
}

function nodeGraphModuleScopeOfflineOscillatorBuffer(slot) {
  if (slot?.type !== "osc") {
    return null;
  }
  const node = nodeGraphModuleScopeNodeForSlot(slot);
  if (!node) {
    return null;
  }
  const waveform = nodeGraphModuleScopeNodeParam(node, "waveform", 0);
  const baseFrequency = Math.max(0, nodeGraphModuleScopeNodeParam(node, "frequency", 0));
  const nodeMap = nodeGraphModuleScopeNodeMap();
  const pitchInput = clampNodeSliderValue(
    nodeGraphModuleScopeConnectionsTo(node.id, "0.1V/Oct")
      .reduce((sum, connection) => sum + nodeGraphModuleScopeOfflineSignalSample(
        { nodeMap },
        connection.sourceNode,
        0,
        0,
        connection.sourcePort,
        1,
      ), 0),
    -1,
    1,
  );
  const frequency = Math.max(0, baseFrequency * (2 ** (pitchInput / 0.1)));
  const phase = wrapNodeSliderValue(nodeGraphModuleScopeNodeParam(node, "phase", 0), 0, 1);
  const level = nodeGraphModuleScopeNodeParam(node, "level", 0.5);
  const settings = nodeGraphModuleScopeSetting(slot.nodeId);
  const requestedCycles = settings.cycles > 0 ? settings.cycles : nodeGraphModuleScopeDefaultSettings.cycles;
  const visibleCycles = requestedCycles;
  const sweepCycles = visibleCycles;
  const frequencyMoving = frequency > 0;
  const frozenKey = [
    waveform,
    frequency.toFixed(6),
    phase.toFixed(6),
    level.toFixed(6),
    visibleCycles.toFixed(6),
    settings.oscillatorTraceMode,
  ].join(":");
  const phasor = nodeGraphModuleScopeOscillatorPhasor(
    slot,
    frequency,
    sweepCycles,
    nodeGraphModuleScopeModelFrameTime(slot),
  );
  const sweepPhase = frequencyMoving && sweepCycles > 0 ? Number(phasor.sweep) || 0 : 0;
  if (!frequencyMoving) {
    const frozenBuffer = nodeGraphModuleScopeState.oscillatorFrozenBuffers.get(slot.nodeId);
    if (frozenBuffer?.nodeGraphScopeFrozenKey === frozenKey) {
      return frozenBuffer;
    }
  }
  const windowStartPhase = settings.oscillatorTraceMode === "window"
    ? phase + (Number(phasor.signal) || 0) - sweepPhase * visibleCycles
    : phase;
  const frames = 2048;
  const buffer = new Float32Array(frames);
  for (let index = 0; index < frames; index += 1) {
    const progress = index / Math.max(1, frames - 1);
    const phaseCycle = windowStartPhase + progress * visibleCycles;
    buffer[index] = clampNodeSliderValue(
      nodeGraphModuleScopeOfflineOscillatorSample(waveform, phaseCycle) * level,
      -1,
      1,
    );
  }
  buffer.nodeGraphScopeDrawFullWindow = true;
  buffer.nodeGraphScopeDrawProgress = 1;
  buffer.nodeGraphScopeDrawStartProgress = 0;
  buffer.nodeGraphScopeDrawWrap = false;
  buffer.nodeGraphScopeUseFullWindow = true;
  buffer.nodeGraphScopeFrozenKey = frozenKey;
  if (!frequencyMoving) {
    nodeGraphModuleScopeState.oscillatorFrozenBuffers.set(slot.nodeId, buffer);
  }
  return buffer;
}

function nodeGraphModuleScopeOfflineAdditiveOscillatorBuffer(slot) {
  if (slot?.type !== "additiveOsc") {
    return null;
  }
  const node = nodeGraphModuleScopeNodeForSlot(slot);
  if (!node) {
    return null;
  }
  const baseFrequency = Math.max(0, nodeGraphModuleScopeNodeParam(node, "frequency", 0));
  const nodeMap = nodeGraphModuleScopeNodeMap();
  const pitchInput = clampNodeSliderValue(
    nodeGraphModuleScopeConnectionsTo(node.id, "0.1V/Oct")
      .reduce((sum, connection) => sum + nodeGraphModuleScopeOfflineSignalSample(
        { nodeMap },
        connection.sourceNode,
        0,
        0,
        connection.sourcePort,
        1,
      ), 0),
    -1,
    1,
  );
  const frequency = Math.max(0, baseFrequency * (2 ** (pitchInput / 0.1)));
  const sampleRate = Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100;
  const harmonicCount = Math.max(
    1,
    Math.min(nodeGraphAdditiveHardMaxHarmonics, Math.round(nodeGraphModuleScopeNodeParam(node, "harmonics", 32))),
  );
  const dampingCurve = nodeGraphAdditiveDampingCurveValue(nodeGraphModuleScopeNodeParam(node, "dampingCurve", 0));
  const waveform = nodeGraphModuleScopeNodeParam(node, "waveform", 1);
  const modA = nodeGraphModuleScopeNodeParam(node, "modA", 0.5);
  const cacheKey = [
    slot.nodeId,
    frequency.toFixed(6),
    harmonicCount,
    waveform,
    modA.toFixed(6),
    dampingCurve.toFixed(6),
    Math.round(sampleRate),
  ].join(":");
  const cached = nodeGraphModuleScopeState.additiveHarmonicProfiles.get(slot.nodeId);
  if (cached?.key === cacheKey) {
    return cached.buffer;
  }
  const amplitudes = new Float32Array(harmonicCount);
  let peak = 0;
  for (let harmonic = 1; harmonic <= harmonicCount; harmonic += 1) {
    const partial = nodeGraphAdditiveWaveformHarmonic(waveform, harmonic, modA);
    const amplitude = Math.abs(Number(partial.amplitude) || 0) *
      nodeGraphAdditiveHarmonicDamping(harmonic, frequency, sampleRate, dampingCurve);
    amplitudes[harmonic - 1] = amplitude;
    peak = Math.max(peak, amplitude);
  }
  const buffer = new Float32Array(harmonicCount);
  for (let index = 0; index < harmonicCount; index += 1) {
    buffer[index] = peak > 0 ? amplitudes[index] / peak : 0;
  }
  buffer.nodeGraphScopeSpectrum = true;
  buffer.nodeGraphScopeDrawFullWindow = true;
  buffer.nodeGraphScopeDrawProgress = 1;
  buffer.nodeGraphScopeMinPointSpacingPx = 1;
  buffer.nodeGraphScopeVisualPointLimit = Math.min(32768, Math.max(2, harmonicCount * 2));
  buffer.nodeGraphScopeUseFullWindow = true;
  buffer.nodeGraphScopePeriodSamples = 0;
  buffer.nodeGraphScopeSourceFrequency = frequency;
  buffer.nodeGraphScopeAnalyzer = {
    curve: dampingCurve,
    harmonicCount,
    peak,
  };
  nodeGraphModuleScopeState.additiveHarmonicProfiles.set(slot.nodeId, { buffer, key: cacheKey });
  return buffer;
}

function nodeGraphModuleScopeOfflineNoiseBuffer(slot) {
  if (slot?.type !== "noise") {
    return null;
  }
  const node = nodeGraphModuleScopeNodeForSlot(slot);
  if (!node) {
    return null;
  }
  const level = clampNodeSliderValue(nodeGraphModuleScopeNodeParam(node, "level", 0.5), 0, 1);
  const seedValue = nodeGraphModuleScopeNodeParam(node, "seed", 1);
  const speed = nodeGraphModuleScopeNodeParam(node, "speed", 1);
  const sampleRate = Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100;
  const startSample = 0;
  const frames = 2048;
  const buffer = new Float32Array(frames);
  for (let index = 0; index < frames; index += 1) {
    buffer[index] = clampNodeSliderValue(
      nodeGraphModuleScopeNoiseHoldSample(slot.nodeId, seedValue, speed, startSample + index, sampleRate) * level,
      -1,
      1,
    );
  }
  buffer.nodeGraphScopeDrawProgress = 1;
  buffer.nodeGraphScopeMinPointSpacingPx = 0.5;
  buffer.nodeGraphScopeVisualPointLimit = 16384;
  buffer.nodeGraphScopeUseFullWindow = true;
  return buffer;
}

function nodeGraphModuleScopeOfflineStereoNoiseXyBuffer(slot) {
  if (slot?.type !== "stereoNoise") {
    return null;
  }
  const node = nodeGraphModuleScopeNodeForSlot(slot);
  if (!node) {
    return null;
  }
  const level = clampNodeSliderValue(nodeGraphModuleScopeNodeParam(node, "level", 0.5), 0, 1);
  const sampleRate = Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100;
  const startSample = Math.max(0, Math.floor(nodeGraphModuleScopeModelFrameTime(slot) * sampleRate));
  const frames = 640;
  const stride = 8;
  const x = new Float32Array(frames);
  const y = new Float32Array(frames);
  let leftSeed = nodeGraphModuleScopeAdvanceNoiseSeed(
    nodeGraphModuleScopeStableSeed(`${slot.nodeId}:left`),
    startSample,
  );
  let rightSeed = nodeGraphModuleScopeAdvanceNoiseSeed(
    nodeGraphModuleScopeStableSeed(`${slot.nodeId}:right`),
    startSample,
  );
  for (let index = 0; index < frames; index += 1) {
    leftSeed = nodeGraphModuleScopeAdvanceNoiseSeed(leftSeed, stride);
    rightSeed = nodeGraphModuleScopeAdvanceNoiseSeed(rightSeed, stride);
    x[index] = clampNodeSliderValue(nodeGraphModuleScopeNoiseSeedToSample(leftSeed) * level, -1, 1);
    y[index] = clampNodeSliderValue(nodeGraphModuleScopeNoiseSeedToSample(rightSeed) * level, -1, 1);
  }
  return {
    length: frames,
    nodeGraphScopeDrawProgress: 1,
    nodeGraphScopeUseFullWindow: true,
    nodeGraphScopeVisualPointLimit: frames,
    nodeGraphScopeXy: true,
    x,
    y,
  };
}

function nodeGraphModuleScopeOfflineGainAnalyzerBuffer(slot) {
  if (slot?.type !== "gain") {
    return null;
  }
  const node = nodeGraphModuleScopeNodeForSlot(slot);
  if (!node || !nodeGraphModuleScopeConnectionsTo(node.id, "In").length) {
    return null;
  }
  const settings = nodeGraphModuleScopeSetting(slot.nodeId);
  const sampleRate = Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100;
  const nodeMap = nodeGraphModuleScopeNodeMap();
  const sourceFrequency = nodeGraphModuleScopeOfflineSourceFrequency(node.id, nodeMap);
  const cycles = (settings.cycles > 0 ? settings.cycles : nodeGraphModuleScopeDefaultSettings.cycles) * 4;
  const windowSeconds = sourceFrequency > 0
    ? cycles / sourceFrequency
    : Math.max(0.005, (settings.timeMs || nodeGraphModuleScopeDefaultSettings.timeMs) / 1000);
  const time = nodeGraphModuleScopeModelFrameTime(slot);
  const startTime = sourceFrequency > 0 ? 0 : time;
  const frames = 2048;
  const buffer = new Float32Array(frames);
  const inputBuffer = new Float32Array(frames);
  const context = { nodeMap };
  const amount = nodeGraphModuleScopeNodeParam(node, "amount", 1);
  const inputConnections = nodeGraphModuleScopeConnectionsTo(node.id, "In");
  for (let index = 0; index < frames; index += 1) {
    const progress = index / Math.max(1, frames - 1);
    const localTime = startTime + progress * windowSeconds;
    const sampleIndex = Math.floor(localTime * sampleRate);
    inputBuffer[index] = inputConnections.reduce((sum, connection) => sum + nodeGraphModuleScopeOfflineSignalSample(
      context,
      connection.sourceNode,
      localTime,
      sampleIndex,
      connection.sourcePort,
      1,
    ), 0);
    buffer[index] = inputBuffer[index] * amount;
  }
  const inputStats = nodeGraphModuleScopeBufferStats(inputBuffer);
  buffer.nodeGraphScopeDrawProgress = 1;
  buffer.nodeGraphScopeAnalyzer = {
    gainDb: nodeGraphModuleScopeLinearToDb(amount),
    inputPeakDb: inputStats.peakDb,
    inputRmsDb: inputStats.rmsDb,
    ...nodeGraphModuleScopeBufferStats(buffer),
  };
  buffer.nodeGraphScopePeriodSamples = sourceFrequency > 0 ? sampleRate / sourceFrequency : 0;
  buffer.nodeGraphScopeSourceFrequency = sourceFrequency;
  buffer.nodeGraphScopeSyncBuffer = buffer;
  return buffer;
}

function nodeGraphModuleScopeDisplayBuffer(slot, capturedBuffer = null) {
  return nodeGraphModuleScopeOfflineOscillatorBuffer(slot) ||
    nodeGraphModuleScopeOfflineAdditiveOscillatorBuffer(slot) ||
    nodeGraphModuleScopeOfflineNoiseBuffer(slot) ||
    nodeGraphModuleScopeOfflineStereoNoiseXyBuffer(slot) ||
    nodeGraphModuleScopeOfflineGainAnalyzerBuffer(slot) ||
    capturedBuffer;
}

function pushNodeGraphLiveModuleScopeSamples(nodeId, values) {
  const id = String(nodeId || "");
  if (!id) {
    return;
  }
  const frameCapacity = Math.max(32, nodeGraphModuleScopeState.frames || nodeGraphModuleScopeState.liveFrameCapacity);
  let buffer = nodeGraphModuleScopeState.buffers.get(id);
  if (!buffer || buffer.length !== frameCapacity) {
    buffer = new Float32Array(frameCapacity);
    nodeGraphModuleScopeState.buffers.set(id, buffer);
  }
  const samples = Array.isArray(values) || ArrayBuffer.isView(values)
    ? [...values].map(nodeGraphModuleScopeScalarValue)
    : [nodeGraphModuleScopeScalarValue(values)];
  const count = Math.min(buffer.length, samples.length);
  if (count <= 0) {
    return;
  }
  if (count < buffer.length) {
    buffer.copyWithin(0, count);
  }
  const start = samples.length - count;
  for (let index = 0; index < count; index += 1) {
    buffer[buffer.length - count + index] = samples[start + index] || 0;
  }
}

function pushNodeGraphLiveModuleScopeSnapshot(values, options = {}) {
  if (!values) {
    return;
  }
  const patchFingerprint = String(options.patchFingerprint || nodeGraphPatchFingerprint());
  if (nodeGraphModuleScopeState.mode !== "live") {
    beginNodeGraphLiveModuleScopeCapture({
      nodes: [],
      order: values instanceof Map ? [...values.keys()] : values.map?.((entry) => entry?.[0]) || [],
      patchFingerprint,
    });
  }
  if (nodeGraphModuleScopeState.patchFingerprint !== patchFingerprint) {
    updateNodeGraphLiveModuleScopeFingerprint(patchFingerprint);
  }
  if (Number.isFinite(Number(options.sampleRate)) && Number(options.sampleRate) > 0) {
    nodeGraphModuleScopeState.sampleRate = Number(options.sampleRate);
  }
  const entries = values instanceof Map ? values.entries() : values;
  for (const entry of entries || []) {
    if (!entry) {
      continue;
    }
    pushNodeGraphLiveModuleScopeSamples(entry[0], entry[1]);
  }
  scheduleNodeGraphModuleScopeDraw();
}

function captureNodeGraphLiveModuleScopeFrame(runtime, sampleRate) {
  if (!runtime?.nodeOutputs?.size) {
    return;
  }
  const interval = Math.max(1, Math.floor((Number(sampleRate) || nodeGraphMvp.sampleRate || 44100) / 30));
  runtime.scopeBuffers ||= new Map();
  for (const nodeId of runtime.order || runtime.nodeOutputs.keys()) {
    if (!runtime.nodeOutputs.has(nodeId)) {
      continue;
    }
    const samples = runtime.scopeBuffers.get(nodeId) || [];
    samples.push(nodeGraphModuleScopeScalarValue(runtime.nodeOutputs.get(nodeId)));
    runtime.scopeBuffers.set(nodeId, samples);
  }
  runtime.scopeCounter = (runtime.scopeCounter || 0) + 1;
  if (runtime.scopeCounter < interval) {
    return;
  }
  runtime.scopeCounter = 0;
  pushNodeGraphLiveModuleScopeSnapshot(runtime.scopeBuffers, {
    patchFingerprint: nodeGraphPatchFingerprint(),
    sampleRate,
  });
  runtime.scopeBuffers = new Map();
}

function nodeGraphModuleScopeBuffersCurrent() {
  if (nodeGraphModuleScopeHasModelDisplay()) {
    return true;
  }
  if (!nodeGraphModuleScopeState.buffers.size) {
    return false;
  }
  const patch = nodeGraphMvp?.patch;
  if (nodeGraphModuleScopeState.mode === "live") {
    return Boolean(nodeGraphMvp?.live?.node);
  }
  return nodeGraphModuleScopeState.patchFingerprint === nodeGraphPatchFingerprint()
    && nodeGraphModuleScopeState.monitorFingerprint === nodeGraphModuleScopeMonitorFingerprint(
      nodeGraphModuleScopeCaptureMonitors(patch),
    );
}

function clearNodeGraphModuleScopeCanvas() {
  const canvas = nodeGraphModuleScopeCanvas();
  if (!canvas) {
    return;
  }
  if (nodeGraphModuleScopeState.renderer?.kind === "webgl") {
    const gl = nodeGraphModuleScopeState.renderer.gl;
    gl.viewport(0, 0, canvas.width, canvas.height);
    for (const target of nodeGraphModuleScopeState.renderer.phosphorTargets || []) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    nodeGraphModuleScopeState.renderer.phosphorPrimed = false;
    return;
  }
  canvas.width = canvas.width;
}

function nodeGraphModuleScopeTracesOff() {
  const value = Number(nodeGraphMvp?.visualControls?.scopeTracesOff) || 0;
  return value > 0.5;
}

function nodeGraphModuleScopeCircuitRunning() {
  const live = nodeGraphMvp?.live || {};
  return Boolean(live.outputEnabled && live.node && live.context);
}

function nodeGraphModuleScopePaused() {
  const visualPause = Number(nodeGraphMvp?.visualControls?.scopePaused) || 0;
  return visualPause > 0.5 || (!nodeGraphModuleScopeHasModelDisplay() && !nodeGraphModuleScopeCircuitRunning());
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
    if (nodeGraphModuleScopeState.renderer?.canvas === canvas) {
      resizeNodeGraphModuleScopePhosphorTargets(nodeGraphModuleScopeState.renderer);
    }
  }
  if (canvas.height !== height) {
    canvas.height = height;
    if (nodeGraphModuleScopeState.renderer?.canvas === canvas) {
      resizeNodeGraphModuleScopePhosphorTargets(nodeGraphModuleScopeState.renderer);
    }
  }
  return true;
}

function createNodeGraphModuleScopeShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("module scope shader compile failed", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createNodeGraphModuleScopeProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = createNodeGraphModuleScopeShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createNodeGraphModuleScopeShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
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
    console.warn("module scope shader link failed", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function createNodeGraphModuleScopeTexture(gl, width, height) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    Math.max(1, width),
    Math.max(1, height),
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  return texture;
}

function createNodeGraphModuleScopeFramebuffer(gl, texture) {
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  return framebuffer;
}

function resizeNodeGraphModuleScopePhosphorTargets(renderer) {
  const { canvas, gl } = renderer;
  if (renderer.targetWidth === canvas.width && renderer.targetHeight === canvas.height) {
    return true;
  }
  for (const target of renderer.phosphorTargets || []) {
    if (target.framebuffer) {
      gl.deleteFramebuffer(target.framebuffer);
    }
    if (target.texture) {
      gl.deleteTexture(target.texture);
    }
  }
  renderer.phosphorTargets = [0, 1].map(() => {
    const texture = createNodeGraphModuleScopeTexture(gl, canvas.width, canvas.height);
    return {
      framebuffer: createNodeGraphModuleScopeFramebuffer(gl, texture),
      texture,
    };
  });
  renderer.phosphorReadIndex = 0;
  renderer.phosphorPrimed = false;
  renderer.targetWidth = canvas.width;
  renderer.targetHeight = canvas.height;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return renderer.phosphorTargets.every((target) => target.framebuffer && target.texture);
}

function createNodeGraphModuleScopeWebGlRenderer(canvas) {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
  }) || canvas.getContext("experimental-webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
  });
  if (!gl) {
    return null;
  }

  const colorProgram = createNodeGraphModuleScopeProgram(gl, `
    attribute vec2 aPosition;
    void main() {
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `, `
    precision mediump float;
    uniform vec4 uColor;
    void main() {
      gl_FragColor = uColor;
    }
  `);
  const textureProgram = createNodeGraphModuleScopeProgram(gl, `
    attribute vec2 aPosition;
    attribute vec2 aTexCoord;
    varying vec2 vTexCoord;
    void main() {
      vTexCoord = aTexCoord;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `, `
    precision mediump float;
    uniform float uDecayFast;
    uniform float uDecaySlow;
    uniform float uFloorFade;
    uniform sampler2D uTexture;
    uniform int uMode;
    varying vec2 vTexCoord;
    void main() {
      vec4 color = texture2D(uTexture, vTexCoord);
      if (uMode == 1) {
        float energy = max(max(color.r, color.g), color.b);
        float bright = smoothstep(0.12, 0.86, energy);
        float decay = mix(uDecaySlow, uDecayFast, bright);
        color.rgb = max(color.rgb * decay - vec3(uFloorFade), vec3(0.0));
        color.a = max(max(color.r, color.g), color.b);
      }
      gl_FragColor = color;
    }
  `);
  const beamProgram = createNodeGraphModuleScopeProgram(gl, `
    attribute vec2 aPosition;
    attribute float aPointAge;
    uniform vec2 uCanvasSize;
    uniform float uSize;
    varying float vPointAge;
    void main() {
      vPointAge = aPointAge;
      vec2 clip = vec2(
        (aPosition.x / uCanvasSize.x) * 2.0 - 1.0,
        1.0 - (aPosition.y / uCanvasSize.y) * 2.0
      );
      gl_PointSize = clamp(uSize, 1.0, 192.0);
      gl_Position = vec4(clip, 0.0, 1.0);
    }
  `, `
    precision highp float;
    uniform vec3 uColor;
    uniform float uIntensity;
    uniform float uSize;
    uniform sampler2D uDotTexture;
    uniform bool uUseDotTexture;
    varying float vPointAge;
    void main() {
      vec2 centered = gl_PointCoord * 2.0 - 1.0;
      float radiusSquared = dot(centered, centered);
      if (radiusSquared > 1.0) {
        discard;
      }
      float gaussian = exp(-radiusSquared * 3.6);
      float core = smoothstep(1.0, 0.0, radiusSquared);
      float afterglow = mix(0.58, 1.0, smoothstep(0.0, 1.0, vPointAge));
      vec4 dotSample = uUseDotTexture ? texture2D(uDotTexture, gl_PointCoord) : vec4(1.0);
      vec3 traceColor = uUseDotTexture ? dotSample.rgb : uColor;
      float textureAlpha = uUseDotTexture ? dotSample.a : 1.0;
      float alpha = clamp((gaussian * 0.82 + core * 0.18) * textureAlpha * afterglow * uIntensity, 0.0, 0.46);
      gl_FragColor = vec4(traceColor * alpha, alpha);
    }
  `);
  if (!colorProgram || !textureProgram || !beamProgram) {
    if (colorProgram) {
      gl.deleteProgram(colorProgram);
    }
    if (textureProgram) {
      gl.deleteProgram(textureProgram);
    }
    if (beamProgram) {
      gl.deleteProgram(beamProgram);
    }
    return null;
  }

  const renderer = {
    beamBuffer: gl.createBuffer(),
    beamCanvasSizeLocation: gl.getUniformLocation(beamProgram, "uCanvasSize"),
    beamColorLocation: gl.getUniformLocation(beamProgram, "uColor"),
    beamIntensityLocation: gl.getUniformLocation(beamProgram, "uIntensity"),
    beamUseDotTextureLocation: gl.getUniformLocation(beamProgram, "uUseDotTexture"),
    beamDotTextureLocation: gl.getUniformLocation(beamProgram, "uDotTexture"),
    beamPointAgeLocation: gl.getAttribLocation(beamProgram, "aPointAge"),
    beamPositionLocation: gl.getAttribLocation(beamProgram, "aPosition"),
    beamProgram,
    beamSizeLocation: gl.getUniformLocation(beamProgram, "uSize"),
    canvas,
    colorLocation: gl.getUniformLocation(colorProgram, "uColor"),
    colorPositionBuffer: gl.createBuffer(),
    colorPositionLocation: gl.getAttribLocation(colorProgram, "aPosition"),
    colorProgram,
    gl,
    kind: "webgl",
    phosphorPrimed: false,
    phosphorReadIndex: 0,
    phosphorTargets: [],
    quadBuffer: gl.createBuffer(),
    targetHeight: 0,
    targetWidth: 0,
    textureDecayFastLocation: gl.getUniformLocation(textureProgram, "uDecayFast"),
    textureDecaySlowLocation: gl.getUniformLocation(textureProgram, "uDecaySlow"),
    textureFloorFadeLocation: gl.getUniformLocation(textureProgram, "uFloorFade"),
    textureModeLocation: gl.getUniformLocation(textureProgram, "uMode"),
    texturePositionLocation: gl.getAttribLocation(textureProgram, "aPosition"),
    textureProgram,
    textureSamplerLocation: gl.getUniformLocation(textureProgram, "uTexture"),
    textureTexCoordLocation: gl.getAttribLocation(textureProgram, "aTexCoord"),
  };
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  resizeNodeGraphModuleScopePhosphorTargets(renderer);
  return renderer;
}

function nodeGraphModuleScopeRenderer(canvas) {
  const current = nodeGraphModuleScopeState.renderer;
  if (current?.canvas === canvas) {
    return current;
  }
  const renderer = createNodeGraphModuleScopeWebGlRenderer(canvas);
  nodeGraphModuleScopeState.renderer = renderer;
  document.getElementById("nodeGraphWorkspace")
    ?.classList.toggle("module-scopes-webgl-unavailable", !renderer);
  return renderer;
}

function nodeGraphModuleScopeThreshold(buffer, start = 0, end = buffer.length) {
  let min = Infinity;
  let max = -Infinity;
  for (let index = Math.max(0, start); index < Math.min(buffer.length, end); index += 1) {
    const value = Number(buffer[index]) || 0;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min < 1e-5) {
    return null;
  }
  return (min + max) * 0.5;
}

function nodeGraphModuleScopeRisingCrossings(buffer, threshold, start = 1, end = buffer.length) {
  const crossings = [];
  const first = Math.max(1, Math.floor(start));
  const limit = Math.min(buffer.length, Math.ceil(end));
  for (let index = first; index < limit; index += 1) {
    const previous = Number(buffer[index - 1]) || 0;
    const current = Number(buffer[index]) || 0;
    if (previous <= threshold && current > threshold) {
      const delta = current - previous;
      const fraction = Math.abs(delta) > 1e-12
        ? clampNodeSliderValue((threshold - previous) / delta, 0, 1)
        : 0;
      crossings.push((index - 1) + fraction);
    }
  }
  return crossings;
}

function nodeGraphModuleScopeMedianPeriod(crossings) {
  if (!Array.isArray(crossings) || crossings.length < 2) {
    return null;
  }
  const distances = [];
  for (let index = 1; index < crossings.length; index += 1) {
    const distance = crossings[index] - crossings[index - 1];
    if (distance >= 2) {
      distances.push(distance);
    }
  }
  if (!distances.length) {
    return null;
  }
  distances.sort((a, b) => a - b);
  const periodSamples = distances[Math.floor(distances.length / 2)];
  return Number.isFinite(periodSamples) && periodSamples > 0 ? periodSamples : null;
}

function nodeGraphModuleScopeLowpassSyncTrace(buffer, start, end, periodSamples = 0) {
  const first = Math.max(0, Math.floor(start));
  const limit = Math.min(buffer.length, Math.ceil(end));
  if (limit - first < 3) {
    return null;
  }
  const threshold = nodeGraphModuleScopeThreshold(buffer, first, limit);
  if (threshold === null) {
    return null;
  }
  const sampleRate = Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100;
  const fundamental = periodSamples > 0 ? sampleRate / periodSamples : 120;
  const cutoff = clampNodeSliderValue(fundamental * 4, 20, sampleRate * 0.45);
  const alpha = clampNodeSliderValue(1 - Math.exp((-2 * Math.PI * cutoff) / Math.max(1, sampleRate)), 0.001, 1);
  const trace = new Float32Array(limit - first);
  let y1 = (Number(buffer[first]) || 0) - threshold;
  let y2 = y1;
  let y3 = y1;
  let y4 = y1;
  for (let index = first; index < limit; index += 1) {
    const input = (Number(buffer[index]) || 0) - threshold;
    y1 += (input - y1) * alpha;
    y2 += (y1 - y2) * alpha;
    y3 += (y2 - y3) * alpha;
    y4 += (y3 - y4) * alpha;
    trace[index - first] = y4;
  }
  return {
    start: first,
    threshold,
    trace,
  };
}

function nodeGraphModuleScopeTraceRisingCrossings(trace, start = 1, end = trace?.length || 0, offset = 0) {
  return nodeGraphModuleScopeRisingCrossings(trace || [], 0, start, end)
    .map((crossing) => crossing + offset);
}

function nodeGraphModuleScopeSyncBuffer(buffer) {
  return buffer?.nodeGraphScopeSyncBuffer?.length === buffer?.length
    ? buffer.nodeGraphScopeSyncBuffer
    : buffer;
}

function nodeGraphModuleScopeEstimatedCycle(buffer) {
  const syncBuffer = nodeGraphModuleScopeSyncBuffer(buffer);
  const hintedPeriodSamples = Number(buffer?.nodeGraphScopePeriodSamples);
  if (syncBuffer?.length && Number.isFinite(hintedPeriodSamples) && hintedPeriodSamples > 0) {
    const searchStart = Math.max(0, syncBuffer.length - Math.min(syncBuffer.length, 8192));
    return {
      periodSamples: hintedPeriodSamples,
      threshold: nodeGraphModuleScopeThreshold(syncBuffer, searchStart, syncBuffer.length),
    };
  }
  const searchStart = Math.max(0, syncBuffer.length - Math.min(syncBuffer.length, 8192));
  const threshold = nodeGraphModuleScopeThreshold(syncBuffer, searchStart, syncBuffer.length);
  if (threshold === null) {
    return null;
  }
  const crossings = nodeGraphModuleScopeRisingCrossings(syncBuffer, threshold, searchStart + 1, syncBuffer.length);
  const rawPeriodSamples = nodeGraphModuleScopeMedianPeriod(crossings);
  if (!rawPeriodSamples) {
    return null;
  }
  const syncTrace = nodeGraphModuleScopeLowpassSyncTrace(syncBuffer, searchStart, syncBuffer.length, rawPeriodSamples);
  const syncCrossings = nodeGraphModuleScopeTraceRisingCrossings(syncTrace?.trace, 1, syncTrace?.trace?.length || 0, searchStart);
  const periodSamples = nodeGraphModuleScopeMedianPeriod(syncCrossings) || rawPeriodSamples;
  return { periodSamples, threshold };
}

function nodeGraphModuleScopeTriggeredStart(syncBuffer, cycleEstimate, visibleSamples) {
  const periodSamples = Number(cycleEstimate?.periodSamples) || 0;
  if (!syncBuffer?.length || !Number.isFinite(periodSamples) || periodSamples <= 0) {
    return null;
  }
  const searchSpan = Math.min(
    syncBuffer.length,
    Math.max(visibleSamples + periodSamples * 6, 1024),
  );
  const searchStart = Math.max(1, syncBuffer.length - Math.ceil(searchSpan));
  const searchEnd = syncBuffer.length;
  const syncTrace = nodeGraphModuleScopeLowpassSyncTrace(
    syncBuffer,
    searchStart,
    searchEnd,
    periodSamples,
  );
  let crossings = nodeGraphModuleScopeTraceRisingCrossings(
    syncTrace?.trace,
    1,
    syncTrace?.trace?.length || 0,
    syncTrace?.start || 0,
  );
  if (!crossings.length && cycleEstimate.threshold !== null) {
    crossings = nodeGraphModuleScopeRisingCrossings(
      syncBuffer,
      cycleEstimate.threshold,
      searchStart,
      searchEnd,
    );
  }
  for (let index = crossings.length - 1; index >= 0; index -= 1) {
    const crossing = crossings[index];
    const start = crossing - visibleSamples;
    if (Number.isFinite(start) && start >= 0 && crossing < syncBuffer.length - 1) {
      return start;
    }
  }
  return null;
}

function nodeGraphModuleScopeVisibleSamples(buffer, settings, cycleEstimate) {
  if (settings.cycles === 0) {
    return buffer.length;
  }
  if (cycleEstimate?.periodSamples) {
    return Math.min(buffer.length, Math.max(8, cycleEstimate.periodSamples * settings.cycles));
  }
  const sampleRate = Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100;
  const cycleRatio = Math.max(
    0.001,
    (Number(settings.cycles) || nodeGraphModuleScopeDefaultSettings.cycles) /
      Math.max(0.001, nodeGraphModuleScopeDefaultSettings.cycles),
  );
  return settings.timeMs > 0
    ? Math.min(buffer.length, Math.max(8, Math.round((settings.timeMs / 1000) * sampleRate * cycleRatio)))
    : buffer.length;
}

function nodeGraphModuleScopeBufferView(buffer, slot) {
  const settings = nodeGraphModuleScopeSetting(slot?.nodeId || "");
  if (buffer?.nodeGraphScopeUseFullWindow) {
    return {
      end: buffer.length,
      gain: settings.gain,
      offset: settings.offset,
      start: 0,
    };
  }
  const cycleEstimate = settings.sync
    ? nodeGraphModuleScopeEstimatedCycle(buffer)
    : null;
  const visibleSamples = nodeGraphModuleScopeVisibleSamples(buffer, settings, cycleEstimate);
  const syncBuffer = nodeGraphModuleScopeSyncBuffer(buffer);
  const defaultStart = Math.max(0, buffer.length - visibleSamples);
  let start = defaultStart;
  if (settings.sync && cycleEstimate && visibleSamples < buffer.length) {
    const triggeredStart = nodeGraphModuleScopeTriggeredStart(syncBuffer, cycleEstimate, visibleSamples);
    if (triggeredStart !== null) {
      start = triggeredStart;
    } else {
      const searchStart = Math.max(1, defaultStart - Math.round(cycleEstimate.periodSamples * 2));
      const searchEnd = Math.min(buffer.length, defaultStart + Math.round(cycleEstimate.periodSamples * 2));
      const fallbackCrossings = nodeGraphModuleScopeRisingCrossings(
        syncBuffer,
        cycleEstimate.threshold,
        searchStart,
        searchEnd,
      );
      if (fallbackCrossings.length) {
        start = fallbackCrossings.reduce((best, crossing) =>
          Math.abs(crossing - defaultStart) < Math.abs(best - defaultStart) ? crossing : best);
      }
    }
  }
  const rawPanCycles = Number(settings.pan) || 0;
  const panCycles = settings.sync && cycleEstimate
    ? Math.round(rawPanCycles)
    : rawPanCycles;
  const panSamples = panCycles
    ? (cycleEstimate?.periodSamples || visibleSamples) * panCycles
    : 0;
  start = clampNodeSliderValue(start - panSamples, 0, Math.max(0, buffer.length - visibleSamples));
  return {
    end: Math.min(buffer.length, start + visibleSamples),
    gain: settings.gain,
    offset: settings.offset,
    start,
  };
}

function nodeGraphModuleScopeInterpolatedSample(buffer, position) {
  const samplePosition = clampNodeSliderValue(Number(position) || 0, 0, Math.max(0, buffer.length - 1));
  const leftIndex = Math.floor(samplePosition);
  const rightIndex = Math.min(buffer.length - 1, leftIndex + 1);
  const blend = samplePosition - leftIndex;
  const left = Number(buffer[leftIndex]) || 0;
  const right = Number(buffer[rightIndex]) || left;
  return left + (right - left) * blend;
}

function nodeGraphModuleScopeBufferValue(buffer, position, view) {
  return clampNodeSliderValue((nodeGraphModuleScopeInterpolatedSample(buffer, position) * view.gain) + view.offset, -1, 1);
}

function nodeGraphModuleScopeMixColor(left, right, amount) {
  const mix = clampNodeSliderValue(Number(amount) || 0, 0, 1);
  return [
    left[0] + (right[0] - left[0]) * mix,
    left[1] + (right[1] - left[1]) * mix,
    left[2] + (right[2] - left[2]) * mix,
  ];
}

function nodeGraphModuleScopeTraceColors(setting) {
  const base = nodeGraphScopeHexColorToRgb(
    nodeGraphNormalizeScopeTraceColor("#3de0ff"),
  );
  const halo = nodeGraphModuleScopeMixColor(base, [0, 0, 0], 0.55);
  return {
    core: base,
    halo,
  };
}

function nodeGraphModuleScopeZoomScale() {
  const zoom = typeof nodeGraphZoom === "function"
    ? nodeGraphZoom()
    : Number(nodeGraphMvp?.zoom);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

function nodeGraphModuleScopeUnzoomedLength(value, zoomScale = nodeGraphModuleScopeZoomScale()) {
  const length = Number(value);
  const zoom = Number(zoomScale);
  if (!Number.isFinite(length) || length <= 0) {
    return 1;
  }
  if (!Number.isFinite(zoom) || zoom <= 0) {
    return length;
  }
  return Math.max(1, length / zoom);
}

function nodeGraphModuleScopeRenderedSampleWidth(rect, zoomScale = nodeGraphModuleScopeZoomScale()) {
  const width = Number(rect?.width);
  const sampleWidth = Number(rect?.sampleWidth);
  const zoom = Number(zoomScale);
  const renderedWidth = Number.isFinite(width) && width > 0 ? width : 0;
  const zoomedSampleWidth = Number.isFinite(sampleWidth) && sampleWidth > 0 && Number.isFinite(zoom) && zoom > 0
    ? sampleWidth * zoom
    : 0;
  return Math.max(1, renderedWidth, zoomedSampleWidth);
}

function nodeGraphModuleScopePhosphorFrameReady(slot) {
  const key = String(slot?.nodeId || "__default");
  const fps = normalizeNodeGraphModuleScopeFramesPerSecond(nodeGraphMvp?.moduleScopeFramesPerSecond ?? 60);
  const now = Math.max(0, Number(nodeGraphModuleScopeState.animationTime) || 0);
  const state = nodeGraphModuleScopeState.phosphorFrame || {
    key: "",
    lastUpdate: 0,
  };
  if (state.key !== key || !Number.isFinite(Number(state.lastUpdate))) {
    nodeGraphModuleScopeState.phosphorFrame = {
      key,
      lastUpdate: now,
    };
    return true;
  }
  const tick = nodeGraphModuleScopeAdvanceFixedFrameClock(state, now, fps);
  if (!tick.ready) {
    return false;
  }
  nodeGraphModuleScopeState.phosphorFrame = {
    key,
    lastUpdate: tick.lastUpdate,
  };
  return true;
}

function nodeGraphModuleScopeBufferProgressRanges(buffer) {
  const drawProgress = Number.isFinite(Number(buffer?.nodeGraphScopeDrawProgress))
    ? clampNodeSliderValue(Number(buffer.nodeGraphScopeDrawProgress), 0.002, 1)
    : 1;
  if (buffer?.nodeGraphScopeDrawFullWindow) {
    return [[0, 1]];
  }
  const startProgress = Number(buffer?.nodeGraphScopeDrawStartProgress);
  if (!Number.isFinite(startProgress)) {
    return [[0, drawProgress]];
  }
  const start = clampNodeSliderValue(startProgress, 0, 1);
  if (buffer?.nodeGraphScopeDrawWrap) {
    return [
      [start, 1],
      [0, drawProgress],
    ].filter(([from, to]) => to - from > 0.001);
  }
  const end = Math.max(start + 0.002, drawProgress);
  return [[start, clampNodeSliderValue(end, 0.002, 1)]];
}

function nodeGraphModuleScopeBufferSegmentPoints(buffer, rect, canvas, pixelRatio, slot, startProgress, endProgress) {
  const points = [];
  if (!buffer?.length || rect.width <= 1 || rect.height <= 1) {
    return points;
  }
  const start = clampNodeSliderValue(Number(startProgress) || 0, 0, 1);
  const end = clampNodeSliderValue(Number(endProgress) || 0, 0, 1);
  const drawSpan = end - start;
  if (drawSpan <= 0.001) {
    return points;
  }
  const view = nodeGraphModuleScopeBufferView(buffer, slot);
  const visibleSamples = Math.max(1, view.end - view.start);
  const spectrumMode = buffer?.nodeGraphScopeSpectrum === true;
  const midY = rect.top + rect.height * (spectrumMode ? 0.92 : 0.5);
  const halfHeight = Math.max(1, rect.height * (spectrumMode ? 0.82 : 0.42));
  const sampleWidth = nodeGraphModuleScopeRenderedSampleWidth(rect);
  const minPointSpacingPx = clampNodeSliderValue(Number(buffer.nodeGraphScopeMinPointSpacingPx) || 0.5, 0.25, 32);
  const visualPointLimit = Math.max(2, Math.min(32768, Math.floor(Number(buffer.nodeGraphScopeVisualPointLimit) || 32768)));
  const pointCount = Math.max(2, Math.min(
    visualPointLimit,
    Math.ceil((sampleWidth * drawSpan) / minPointSpacingPx),
  ));
  for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
    const progress = start + ((pointIndex + 0.5) / pointCount) * drawSpan;
    const samplePosition = view.start + progress * visibleSamples;
    const x = rect.left + progress * rect.width;
    const value = spectrumMode
      ? clampNodeSliderValue(nodeGraphModuleScopeInterpolatedSample(buffer, samplePosition), 0, 1)
      : nodeGraphModuleScopeBufferValue(buffer, samplePosition, view);
    const y = midY - value * halfHeight;
    points.push(
      ((x * pixelRatio) / canvas.width) * 2 - 1,
      1 - ((y * pixelRatio) / canvas.height) * 2,
    );
  }
  return points;
}

function nodeGraphModuleScopeBufferPoints(buffer, rect, canvas, pixelRatio, slot) {
  const range = nodeGraphModuleScopeBufferProgressRanges(buffer)[0] || [0, 1];
  return nodeGraphModuleScopeBufferSegmentPoints(buffer, rect, canvas, pixelRatio, slot, range[0], range[1]);
}

function nodeGraphModuleScopeCenteredSquareRect(rect) {
  const size = Math.max(1, Math.min(Number(rect?.width) || 0, Number(rect?.height) || 0));
  return {
    height: size,
    left: (Number(rect?.left) || 0) + ((Number(rect?.width) || size) - size) * 0.5,
    top: (Number(rect?.top) || 0) + ((Number(rect?.height) || size) - size) * 0.5,
    width: size,
  };
}

function nodeGraphModuleScopeXyPoints(buffer, rect, canvas, pixelRatio, slot) {
  const points = [];
  if (!buffer?.nodeGraphScopeXy || !buffer.x?.length || !buffer.y?.length || rect.width <= 1 || rect.height <= 1) {
    return points;
  }
  const settings = nodeGraphModuleScopeSetting(slot?.nodeId || "");
  const gain = Number.isFinite(Number(settings.gain))
    ? clampNodeSliderValue(Number(settings.gain), 0.01, 100)
    : 1;
  const length = Math.min(buffer.x.length, buffer.y.length);
  const pointLimit = Math.max(2, Math.min(length, Math.floor(Number(buffer.nodeGraphScopeVisualPointLimit) || length)));
  const step = Math.max(1, Math.ceil(length / pointLimit));
  const square = nodeGraphModuleScopeCenteredSquareRect(rect);
  const centerX = square.left + square.width * 0.5;
  const centerY = square.top + square.height * 0.5;
  const radius = Math.max(1, square.width * 0.44);
  for (let index = 0; index < length; index += step) {
    const x = centerX + clampNodeSliderValue((Number(buffer.x[index]) || 0) * gain, -1, 1) * radius;
    const y = centerY - clampNodeSliderValue((Number(buffer.y[index]) || 0) * gain, -1, 1) * radius;
    points.push(
      ((x * pixelRatio) / canvas.width) * 2 - 1,
      1 - ((y * pixelRatio) / canvas.height) * 2,
    );
  }
  return points;
}

function nodeGraphModuleScopePixelPoints(points, canvas) {
  const pixelPoints = [];
  for (let index = 0; index + 1 < points.length; index += 2) {
    pixelPoints.push(
      ((points[index] + 1) * 0.5) * canvas.width,
      ((1 - points[index + 1]) * 0.5) * canvas.height,
    );
  }
  return pixelPoints;
}

function nodeGraphModuleScopeBeamVertices(points, canvas) {
  const pixelPoints = nodeGraphModuleScopePixelPoints(points, canvas);
  const vertices = [];
  const segmentCount = Math.max(1, (pixelPoints.length / 2) - 1);
  const corners = [0, 1, 2, 2, 1, 3];
  for (let index = 0; index + 3 < pixelPoints.length; index += 2) {
    const x1 = pixelPoints[index];
    const y1 = pixelPoints[index + 1];
    const x2 = pixelPoints[index + 2];
    const y2 = pixelPoints[index + 3];
    const lengthPx = Math.hypot(x2 - x1, y2 - y1);
    if (lengthPx < 0.001) {
      continue;
    }
    const segmentProgress = (index / 2) / segmentCount;
    for (const corner of corners) {
      vertices.push(x1, y1, x2, y2, corner, segmentProgress);
    }
  }
  return vertices;
}

function nodeGraphModuleScopeXyBeamVertices(points, canvas, sparkSizePx = 2) {
  const pixelPoints = nodeGraphModuleScopePixelPoints(points, canvas);
  const vertices = [];
  const radius = clampNodeSliderValue(Number(sparkSizePx) || 2, 1, 10) * 0.5;
  for (let index = 0; index + 1 < pixelPoints.length; index += 2) {
    const x = pixelPoints[index];
    const y = pixelPoints[index + 1];
    vertices.push(...nodeGraphModuleScopeBeamVertices([
      (((x - radius) / canvas.width) * 2) - 1,
      1 - ((y / canvas.height) * 2),
      (((x + radius) / canvas.width) * 2) - 1,
      1 - ((y / canvas.height) * 2),
    ], canvas));
  }
  return vertices;
}

function nodeGraphModuleScopeDotVertices(points, canvas, ageStart = 0, ageEnd = 1) {
  const pixelPoints = nodeGraphModuleScopePixelPoints(points, canvas);
  const vertices = [];
  const count = Math.max(1, (pixelPoints.length / 2) - 1);
  const start = clampNodeSliderValue(Number(ageStart) || 0, 0, 1);
  const end = clampNodeSliderValue(Number(ageEnd) || 0, 0, 1);
  for (let index = 0; index + 1 < pixelPoints.length; index += 2) {
    const progress = (index / 2) / count;
    const age = start + (end - start) * progress;
    vertices.push(pixelPoints[index], pixelPoints[index + 1], clampNodeSliderValue(age, 0, 1));
  }
  return vertices;
}

function nodeGraphModuleScopeBufferDotVertices(buffer, rect, canvas, pixelRatio, slot) {
  const vertices = [];
  const xyPoints = nodeGraphModuleScopeXyPoints(buffer, rect, canvas, pixelRatio, slot);
  if (xyPoints.length >= 4) {
    vertices.push(...nodeGraphModuleScopeDotVertices(xyPoints, canvas, 0.72, 1));
    return vertices;
  }
  for (const [start, end] of nodeGraphModuleScopeBufferProgressRanges(buffer)) {
    const points = nodeGraphModuleScopeBufferSegmentPoints(buffer, rect, canvas, pixelRatio, slot, start, end);
    if (points.length >= 2) {
      vertices.push(...nodeGraphModuleScopeDotVertices(points, canvas, start, end));
    }
  }
  return vertices;
}

function nodeGraphModuleScopeBurnDecaySettings(settings) {
  const masterBurn = typeof normalizeNodeGraphModuleScopeBurn === "function"
    ? normalizeNodeGraphModuleScopeBurn(nodeGraphMvp?.moduleScopeBurn ?? 0.5)
    : 0.5;
  const burn = clampNodeSliderValue((Number(settings?.screenBurn) || 0) * masterBurn, 0, 1);
  if (burn <= 0) {
    return {
      fast: 0,
      floor: 1,
      slow: 0,
    };
  }
  const fast = 0.72 + burn * 0.2;
  const slow = 0.86 + burn * 0.12;
  const floor = 0.006 + (1 - burn) * 0.035;
  return {
    fast,
    floor,
    slow,
  };
}

function nodeGraphModuleScopeBloomEnabled() {
  return Boolean(nodeGraphMvp?.scopeBloomEnabled);
}

function nodeGraphModuleScopeTraceBrightness(slot, settings) {
  const brightness = nodeGraphModuleScopeDefaultSettings.brightness;
  return clampNodeSliderValue(brightness, 0, 16);
}

function nodeGraphModuleScopeTraceLineThickness(slot, settings) {
  const masterLineThickness = normalizeNodeGraphModuleScopeLineThickness(
    nodeGraphMvp?.moduleScopeLineThickness ?? 2,
  );
  const lineThickness = nodeGraphModuleScopeDefaultSettings.lineThickness;
  return clampNodeSliderValue(lineThickness * masterLineThickness, 0.25, 32);
}

function nodeGraphModuleScopeTraceBurn(settings) {
  const masterBurn = typeof normalizeNodeGraphModuleScopeBurn === "function"
    ? normalizeNodeGraphModuleScopeBurn(nodeGraphMvp?.moduleScopeBurn ?? 0.5)
    : 0.5;
  return clampNodeSliderValue((Number(settings?.screenBurn) || 0) * masterBurn, 0, 1);
}

function invalidateNodeGraphModuleScopeTraceImageTexture() {
  const state = nodeGraphModuleScopeState.traceImageTexture;
  state.dataUrl = "";
  state.generatedKey = "";
  state.image = null;
}

function nodeGraphModuleScopeGeneratedDotTextureData(
  core1SizeValue,
  core1BrightnessValue,
  size = 64,
  core1ColorValue = "#ffffff",
  core2SizeValue = nodeGraphMvp?.moduleScopeDotCore2Size,
  core2BrightnessValue = nodeGraphMvp?.moduleScopeDotCore2Brightness,
  core2ColorValue = "#ff0000",
  lineThicknessValue = nodeGraphMvp?.moduleScopeLineThickness,
) {
  const core1Size = normalizeNodeGraphModuleScopeDotCoreSize(core1SizeValue, 0.5);
  const core1Brightness = normalizeNodeGraphModuleScopeDotCoreBrightness(core1BrightnessValue, 2);
  const core1Color = nodeGraphScopeHexColorToRgb(
    normalizeNodeGraphModuleScopeDotCoreColor(core1ColorValue ?? "#ffffff", "#ffffff"),
  );
  const core2Size = normalizeNodeGraphModuleScopeDotCoreSize(core2SizeValue, 4);
  const core2Brightness = normalizeNodeGraphModuleScopeDotCoreBrightness(core2BrightnessValue, 0.45);
  const core2Color = nodeGraphScopeHexColorToRgb(
    normalizeNodeGraphModuleScopeDotCoreColor(core2ColorValue ?? "#ff0000", "#ff0000"),
  );
  const lineThickness = normalizeNodeGraphModuleScopeLineThickness(lineThicknessValue ?? 2);
  const finalCore1Size = core1Size * lineThickness;
  const finalCore2Size = core2Size * lineThickness;
  const pixels = new Uint8Array(size * size * 4);
  const center = (size - 1) * 0.5;
  const dotDiameterPx = Math.max(1, core1Size, core2Size);
  const core1Radius = clampNodeSliderValue(finalCore1Size * 0.5, 0.005, 20);
  const core2Radius = clampNodeSliderValue(finalCore2Size * 0.5, 0.005, 20);
  const core1Falloff = 2.6 / Math.max(0.0001, core1Radius * core1Radius);
  const core2Falloff = 1.15 / Math.max(0.0001, core2Radius * core2Radius);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = ((x - center) / center) * dotDiameterPx * 0.5;
      const dy = ((y - center) / center) * dotDiameterPx * 0.5;
      const distanceSquared = dx * dx + dy * dy;
      const core1Energy = Math.exp(-distanceSquared * core1Falloff) * core1Brightness;
      const core2Energy = Math.exp(-distanceSquared * core2Falloff) * core2Brightness;
      const energy = clampNodeSliderValue(core1Energy + core2Energy, 0, 1);
      const colorEnergy = Math.max(0.0001, core1Energy + core2Energy);
      const core1Mix = core1Energy / colorEnergy;
      const core2Mix = core2Energy / colorEnergy;
      const red = clampNodeSliderValue(core1Color[0] * core1Mix + core2Color[0] * core2Mix, 0, 1);
      const green = clampNodeSliderValue(core1Color[1] * core1Mix + core2Color[1] * core2Mix, 0, 1);
      const blue = clampNodeSliderValue(core1Color[2] * core1Mix + core2Color[2] * core2Mix, 0, 1);
      const alpha = Math.round(energy * 255);
      const index = (y * size + x) * 4;
      pixels[index] = Math.round(red * 255);
      pixels[index + 1] = Math.round(green * 255);
      pixels[index + 2] = Math.round(blue * 255);
      pixels[index + 3] = alpha;
    }
  }
  return pixels;
}

function nodeGraphModuleScopeGeneratedDotTexture(renderer) {
  const state = nodeGraphModuleScopeState.traceImageTexture;
  const core1Size = normalizeNodeGraphModuleScopeDotCoreSize(nodeGraphMvp?.moduleScopeDotCore1Size ?? 0.5, 0.5);
  const core1Brightness = normalizeNodeGraphModuleScopeDotCoreBrightness(nodeGraphMvp?.moduleScopeDotCore1Brightness ?? 2, 2);
  const core1Color = normalizeNodeGraphModuleScopeDotCoreColor(nodeGraphMvp?.moduleScopeDotCore1Color ?? "#ffffff", "#ffffff");
  const core2Size = normalizeNodeGraphModuleScopeDotCoreSize(nodeGraphMvp?.moduleScopeDotCore2Size ?? 4, 4);
  const core2Brightness = normalizeNodeGraphModuleScopeDotCoreBrightness(nodeGraphMvp?.moduleScopeDotCore2Brightness ?? 0.45, 0.45);
  const core2Color = normalizeNodeGraphModuleScopeDotCoreColor(nodeGraphMvp?.moduleScopeDotCore2Color ?? "#ff0000", "#ff0000");
  const lineThickness = normalizeNodeGraphModuleScopeLineThickness(nodeGraphMvp?.moduleScopeLineThickness ?? 2);
  const key = `generated:${core1Size.toFixed(3)}:${core1Brightness.toFixed(3)}:${core1Color}:${core2Size.toFixed(3)}:${core2Brightness.toFixed(3)}:${core2Color}:${lineThickness.toFixed(3)}`;
  if (state.generatedKey === key && state.texture) {
    return state.texture;
  }
  const { gl } = renderer;
  if (!state.texture) {
    state.texture = gl.createTexture();
  }
  state.dataUrl = "";
  state.generatedKey = key;
  state.image = null;
  gl.bindTexture(gl.TEXTURE_2D, state.texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    64,
    64,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    nodeGraphModuleScopeGeneratedDotTextureData(
      core1Size,
      core1Brightness,
      64,
      core1Color,
      core2Size,
      core2Brightness,
      core2Color,
      lineThickness,
    ),
  );
  return state.texture;
}

function nodeGraphModuleScopeTraceImageTexture(renderer) {
  const dataUrl = typeof nodeGraphTraceImageDataUrl === "function" ? nodeGraphTraceImageDataUrl() : "";
  const state = nodeGraphModuleScopeState.traceImageTexture;
  if (!dataUrl) {
    return nodeGraphModuleScopeGeneratedDotTexture(renderer);
  }
  const { gl } = renderer;
  state.generatedKey = "";
  if (state.dataUrl === dataUrl && state.texture && state.image?.complete) {
    return state.texture;
  }
  if (state.dataUrl !== dataUrl) {
    state.dataUrl = dataUrl;
    state.image = new Image();
    state.image.onload = () => {
      if (state.dataUrl !== dataUrl) {
        return;
      }
      if (!state.texture) {
        state.texture = gl.createTexture();
      }
      gl.bindTexture(gl.TEXTURE_2D, state.texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, state.image);
      scheduleNodeGraphModuleScopeDraw();
    };
    state.image.src = dataUrl;
  }
  return state.image?.complete ? state.texture : null;
}

function nodeGraphModuleScopeDotSizeScale() {
  const core1Size = normalizeNodeGraphModuleScopeDotCoreSize(nodeGraphMvp?.moduleScopeDotCore1Size ?? 0.5, 0.5);
  const core2Size = normalizeNodeGraphModuleScopeDotCoreSize(nodeGraphMvp?.moduleScopeDotCore2Size ?? 4, 4);
  const lineThickness = normalizeNodeGraphModuleScopeLineThickness(nodeGraphMvp?.moduleScopeLineThickness ?? 2);
  return clampNodeSliderValue(Math.max(core1Size, core2Size) * lineThickness, 0.01, 40);
}

function drawNodeGraphModuleScopeBufferWebGl(renderer, rect, buffer, pixelRatio, slot, options = {}) {
  const { canvas, gl } = renderer;
  const vertices = nodeGraphModuleScopeBufferDotVertices(buffer, rect, canvas, pixelRatio, slot);
  if (vertices.length < 3) {
    return;
  }
  gl.scissor(
    Math.max(0, Math.floor(rect.left * pixelRatio)),
    Math.max(0, Math.floor(canvas.height - ((rect.top + rect.height) * pixelRatio))),
    Math.max(1, Math.ceil(rect.width * pixelRatio)),
    Math.max(1, Math.ceil(rect.height * pixelRatio)),
  );
  gl.useProgram(renderer.beamProgram);
  gl.uniform2f(renderer.beamCanvasSizeLocation, canvas.width, canvas.height);
  const traceThicknessPx = Math.max(1, Number(options.thicknessPx) || 1);
  const dotThicknessPx = Math.max(1, traceThicknessPx * nodeGraphModuleScopeDotSizeScale()) * pixelRatio;
  gl.uniform1f(renderer.beamSizeLocation, dotThicknessPx);
  const intensity = Number(options.intensity);
  gl.uniform1f(renderer.beamIntensityLocation, Number.isFinite(intensity) ? Math.max(0, intensity) : 0.1);
  const color = Array.isArray(options.color) ? options.color : [0.7, 1, 0.9];
  gl.uniform3f(renderer.beamColorLocation, color[0], color[1], color[2]);
  const dotTexture = nodeGraphModuleScopeTraceImageTexture(renderer);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, dotTexture);
  gl.uniform1i(renderer.beamDotTextureLocation, 0);
  gl.uniform1i(renderer.beamUseDotTextureLocation, dotTexture ? 1 : 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.beamBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
  gl.vertexAttribPointer(renderer.beamPositionLocation, 2, gl.FLOAT, false, 12, 0);
  gl.enableVertexAttribArray(renderer.beamPositionLocation);
  gl.vertexAttribPointer(renderer.beamPointAgeLocation, 1, gl.FLOAT, false, 12, 8);
  gl.enableVertexAttribArray(renderer.beamPointAgeLocation);
  gl.drawArrays(gl.POINTS, 0, vertices.length / 3);
}

function drawNodeGraphModuleScopeTexturedQuad(renderer, texture, mode = 0, decay = {}) {
  const { canvas, gl } = renderer;
  gl.useProgram(renderer.textureProgram);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(renderer.textureSamplerLocation, 0);
  gl.uniform1i(renderer.textureModeLocation, mode);
  const decayFast = Number(decay.fast);
  const decaySlow = Number(decay.slow);
  const decayFloor = Number(decay.floor);
  gl.uniform1f(renderer.textureDecayFastLocation, Number.isFinite(decayFast) ? decayFast : 0.94);
  gl.uniform1f(renderer.textureDecaySlowLocation, Number.isFinite(decaySlow) ? decaySlow : 0.985);
  gl.uniform1f(renderer.textureFloorFadeLocation, Number.isFinite(decayFloor) ? decayFloor : 0.004);
  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 0, 0,
    1, -1, 1, 0,
    -1, 1, 0, 1,
    1, 1, 1, 1,
  ]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(renderer.texturePositionLocation, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(renderer.texturePositionLocation);
  gl.vertexAttribPointer(renderer.textureTexCoordLocation, 2, gl.FLOAT, false, 16, 8);
  gl.enableVertexAttribArray(renderer.textureTexCoordLocation);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function nodeGraphModuleScopeScissorRect(gl, canvas, rect, pixelRatio = window.devicePixelRatio || 1) {
  const left = Math.max(0, Math.floor((Number(rect?.left) || 0) * pixelRatio));
  const top = Math.max(0, Math.floor((Number(rect?.top) || 0) * pixelRatio));
  const right = Math.min(canvas.width, Math.ceil(left + Math.max(1, (Number(rect?.width) || 0) * pixelRatio)));
  const bottom = Math.min(canvas.height, Math.ceil(top + Math.max(1, (Number(rect?.height) || 0) * pixelRatio)));
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  gl.scissor(left, Math.max(0, canvas.height - bottom), width, height);
}

function nodeGraphModuleScopeShouldDecaySlot(slot, buffer, settings) {
  if (nodeGraphModuleScopeTraceBurn(settings) <= 0) {
    return true;
  }
  const isFrequencyResetOscillator =
    slot?.type === "osc" &&
    settings?.oscillatorTraceMode !== "window" &&
    !buffer?.nodeGraphScopeXy;
  if (!isFrequencyResetOscillator) {
    return true;
  }
  return Boolean(buffer?.nodeGraphScopeDrawWrap || buffer?.nodeGraphScopeDrawFullWindow);
}

function nodeGraphModuleScopeDecayRegions(items) {
  return (items || [])
    .filter((item) => nodeGraphModuleScopeShouldDecaySlot(item.slot, item.buffer, item.settings))
    .map((item) => ({
      rect: item.scopeRect,
      settings: item.settings,
    }));
}

function drawNodeGraphModuleScopePhosphorFade(renderer, settings = nodeGraphModuleScopeDefaultSettings, regions = null) {
  const { canvas, gl } = renderer;
  if (!resizeNodeGraphModuleScopePhosphorTargets(renderer) || renderer.phosphorTargets.length < 2) {
    return null;
  }
  const masterBurn = typeof normalizeNodeGraphModuleScopeBurn === "function"
    ? normalizeNodeGraphModuleScopeBurn(nodeGraphMvp?.moduleScopeBurn ?? 0.5)
    : 0.5;
  const read = renderer.phosphorTargets[renderer.phosphorReadIndex];
  const writeIndex = 1 - renderer.phosphorReadIndex;
  const write = renderer.phosphorTargets[writeIndex];
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.disable(gl.SCISSOR_TEST);
  gl.disable(gl.BLEND);
  gl.bindFramebuffer(gl.FRAMEBUFFER, write.framebuffer);
  if (masterBurn <= 0) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    renderer.phosphorPrimed = true;
  } else if (!renderer.phosphorPrimed) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    renderer.phosphorPrimed = true;
  } else if (Array.isArray(regions)) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (regions.length) {
      const pixelRatio = window.devicePixelRatio || 1;
      gl.enable(gl.SCISSOR_TEST);
      for (const region of regions) {
        nodeGraphModuleScopeScissorRect(gl, canvas, region.rect, pixelRatio);
        drawNodeGraphModuleScopeTexturedQuad(
          renderer,
          read.texture,
          1,
          nodeGraphModuleScopeBurnDecaySettings(region.settings),
        );
      }
      gl.disable(gl.SCISSOR_TEST);
    }
  } else {
    drawNodeGraphModuleScopeTexturedQuad(
      renderer,
      read.texture,
      1,
      nodeGraphModuleScopeBurnDecaySettings(settings),
    );
  }
  renderer.phosphorReadIndex = writeIndex;
  return write;
}

function compositeNodeGraphModuleScopePhosphor(renderer) {
  const { canvas, gl } = renderer;
  const target = renderer.phosphorTargets[renderer.phosphorReadIndex];
  if (!target) {
    return;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.disable(gl.SCISSOR_TEST);
  gl.disable(gl.BLEND);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  drawNodeGraphModuleScopeTexturedQuad(renderer, target.texture, 0);
}

function drawNodeGraphModuleScopes() {
  const canvas = nodeGraphModuleScopeCanvas();
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (nodeGraphMvp.moduleOscilloscopesVisible === false) {
    return;
  }
  if (!canvas || !workspace || !nodeGraphModuleScopeBuffersCurrent()) {
    return;
  }
  setNodeGraphModuleScopesEnabled(true);
  if (!syncNodeGraphModuleScopeCanvas()) {
    return;
  }
  const renderer = nodeGraphModuleScopeRenderer(canvas);
  if (!renderer) {
    setNodeGraphModuleScopesEnabled(false);
    return;
  }
  if (nodeGraphModuleScopeTracesOff()) {
    if (!nodeGraphModuleScopeState.scopeTracesOffActive) {
      clearNodeGraphModuleScopeCanvas();
    }
    nodeGraphModuleScopeState.scopeTracesOffActive = true;
    scheduleNodeGraphModuleScopeDraw();
    return;
  }
  nodeGraphModuleScopeState.scopeTracesOffActive = false;
  if (nodeGraphModuleScopePaused()) {
    nodeGraphModuleScopeState.animationLastTime = (performance.now?.() || Date.now()) / 1000;
    return;
  }
  const animationTime = (performance.now?.() || Date.now()) / 1000;
  const previousAnimationTime = Number(nodeGraphModuleScopeState.animationLastTime) || animationTime;
  nodeGraphModuleScopeState.animationDeltaSeconds = clampNodeSliderValue(
    animationTime - previousAnimationTime,
    1 / 240,
    1 / 15,
  );
  nodeGraphModuleScopeState.animationLastTime = animationTime;
  nodeGraphModuleScopeState.animationTime = animationTime;
  const pixelRatio = window.devicePixelRatio || 1;
  const workspaceRect = workspace.getBoundingClientRect();
  const gl = renderer.gl;
  const visibleItems = nodeGraphModuleScopeSlots()
    .map((slot) => {
      const buffer = nodeGraphModuleScopeDisplayBuffer(
        slot,
        nodeGraphModuleScopeState.buffers.get(slot.nodeId),
      );
      if (!buffer) {
        renderNodeGraphModuleScopeAnalyzer(slot, null);
        return null;
      }
      const rect = slot.scopeElement.getBoundingClientRect();
      const zoomScale = nodeGraphModuleScopeZoomScale();
      return {
        buffer,
        rect,
        scopeRect: {
          height: rect.height,
          left: rect.left - workspaceRect.left,
          sampleHeight: nodeGraphModuleScopeUnzoomedLength(rect.height, zoomScale),
          sampleWidth: nodeGraphModuleScopeUnzoomedLength(rect.width, zoomScale),
          top: rect.top - workspaceRect.top,
          width: rect.width,
        },
        settings: nodeGraphModuleScopeSetting(slot.nodeId),
        slot,
      };
    })
    .filter(Boolean);
  const firstVisibleSlot = visibleItems[0]?.slot;
  const decayRegions = nodeGraphModuleScopeDecayRegions(visibleItems);
  if (!nodeGraphModuleScopePhosphorFrameReady(firstVisibleSlot)) {
    scheduleNodeGraphModuleScopeDraw();
    return;
  }
  drawNodeGraphModuleScopePhosphorFade(
    renderer,
    nodeGraphModuleScopeSetting(firstVisibleSlot?.nodeId || ""),
    decayRegions,
  );
  gl.bindFramebuffer(gl.FRAMEBUFFER, renderer.phosphorTargets[renderer.phosphorReadIndex]?.framebuffer || null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ONE, gl.ONE);
  for (const item of visibleItems) {
    const { buffer, scopeRect, settings: scopeSettings, slot } = item;
    updateNodeGraphModuleClockLed(slot);
    renderNodeGraphModuleScopeAnalyzer(slot, buffer);
    const colors = nodeGraphModuleScopeTraceColors(scopeSettings);
    gl.enable(gl.SCISSOR_TEST);
    const bloomEnabled = nodeGraphModuleScopeBloomEnabled();
    const burn = bloomEnabled ? nodeGraphModuleScopeTraceBurn(scopeSettings) : 0;
    const brightness = nodeGraphModuleScopeTraceBrightness(slot, scopeSettings);
    const lineThickness = nodeGraphModuleScopeTraceLineThickness(slot, scopeSettings);
    const zoomScale = nodeGraphModuleScopeZoomScale();
    if (bloomEnabled) {
      drawNodeGraphModuleScopeBufferWebGl(renderer, scopeRect, buffer, pixelRatio, slot, {
        color: colors.halo,
        intensity: (0.028 + burn * 0.016) * brightness,
        thicknessPx: 3.25 * zoomScale,
      });
    }
    drawNodeGraphModuleScopeBufferWebGl(renderer, scopeRect, buffer, pixelRatio, slot, {
      color: colors.core,
      intensity: (0.18 + (bloomEnabled ? burn * 0.08 : 0)) * brightness,
      thicknessPx: 1.25 * zoomScale,
    });
  }
  gl.disable(gl.SCISSOR_TEST);
  gl.disable(gl.BLEND);
  compositeNodeGraphModuleScopePhosphor(renderer);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  if (nodeGraphModuleScopeHasModelDisplay()) {
    scheduleNodeGraphModuleScopeDraw();
  }
}

function scheduleNodeGraphModuleScopeDraw() {
  if (nodeGraphMvp?.moduleOscilloscopesVisible === false || nodeGraphModuleScopePaused()) {
    return;
  }
  if (nodeGraphModuleScopeState.drawFrame) {
    return;
  }
  nodeGraphModuleScopeState.drawFrame = window.requestAnimationFrame(() => {
    nodeGraphModuleScopeState.drawFrame = 0;
    drawNodeGraphModuleScopes();
  });
}
