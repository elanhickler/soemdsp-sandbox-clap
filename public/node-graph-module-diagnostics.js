// Module Diagnostics: a purely informational failure-reporting popup,
// modeled on node-graph-ear-protection.js's fault-latch shape but for a
// different job. Ear Protection mutes audio and stops playback because a
// signal is dangerously loud; this reports when a module quietly fails to
// do its job at all (native WASM didn't load, a native call threw, or a
// wired/reachable node is stuck outputting nothing/NaN) -- it never mutes
// or stops anything, it just tells the user, in detail, what broke and why,
// instead of leaving them with silence and no explanation (see the
// keplerBouwkamp "no audio" report this was built to prevent recurring).

const nodeGraphModuleDiagnosticsSilenceWindowSeconds = 3;

function nodeGraphModuleDiagnosticsState() {
  if (!nodeGraphMvp.moduleDiagnostics) {
    nodeGraphMvp.moduleDiagnostics = {
      faults: [],
      serial: 0,
      silenceTracking: new Map(),
    };
  }
  return nodeGraphMvp.moduleDiagnostics;
}

function nodeGraphModuleDiagnosticsIsTripped() {
  return nodeGraphModuleDiagnosticsState().faults.length > 0;
}

function nodeGraphModuleFaultKey(details = {}) {
  return `${details.kind || "fault"}:${details.moduleName || details.nodeId || details.moduleType || "unknown"}`;
}

function nodeGraphModuleDiagnosticsFaultDetail(details = {}) {
  const label = details.label || nodeGraphNodeLabels?.[details.moduleType] || details.moduleType || details.moduleName || "A module";
  if (details.kind === "native-load") {
    return `${label} failed to load its native engine (${details.status || "unknown status"})${details.message ? `: ${details.message}` : ""}. It may be running a slower fallback, or not running at all.`;
  }
  if (details.kind === "native-exception") {
    return `${label} threw an error while running (${details.message || "no message"}). It has fallen back to its JS implementation, or stopped producing output.`;
  }
  if (details.kind === "silent-node") {
    return `${label} is wired to Output but has produced no valid signal for ${nodeGraphModuleDiagnosticsSilenceWindowSeconds}+ seconds (reason: ${details.reason || "bad values"}). Check its parameters -- if this persists, it may be a genuine bug.`;
  }
  return `${label} reported an unspecified issue.`;
}

function nodeGraphRecordModuleFault(details = {}) {
  const key = nodeGraphModuleFaultKey(details);
  const state = nodeGraphModuleDiagnosticsState();
  const existing = state.faults.find((fault) => fault.key === key);
  const detail = nodeGraphModuleDiagnosticsFaultDetail(details);
  if (existing) {
    existing.detail = detail;
    existing.count = (existing.count || 1) + 1;
    existing.lastSeen = Date.now();
  } else {
    state.serial += 1;
    state.faults.push({
      count: 1,
      detail,
      firstSeen: Date.now(),
      key,
      kind: details.kind || "fault",
      lastSeen: Date.now(),
      serial: state.serial,
    });
  }
  nodeGraphApplyModuleDiagnosticsFaultUi();
  return true;
}

function nodeGraphClearModuleFault(key) {
  const state = nodeGraphModuleDiagnosticsState();
  const index = state.faults.findIndex((fault) => fault.key === key);
  if (index === -1) {
    return false;
  }
  state.faults.splice(index, 1);
  nodeGraphApplyModuleDiagnosticsFaultUi();
  return true;
}

function closeNodeGraphModuleDiagnosticsFaultUi() {
  const fault = document.getElementById("nodeModuleDiagnosticsFault");
  if (fault) {
    fault.hidden = true;
  }
  document.body?.classList.remove("node-module-diagnostics-tripped");
}

function nodeGraphResetModuleDiagnosticsFault() {
  const state = nodeGraphModuleDiagnosticsState();
  state.faults = [];
  closeNodeGraphModuleDiagnosticsFaultUi();
}

function bindNodeGraphModuleDiagnosticsFaultUi() {
  document
    .getElementById("nodeModuleDiagnosticsFaultClose")
    ?.addEventListener("click", nodeGraphResetModuleDiagnosticsFault);
  if (document.documentElement.dataset.nodeModuleDiagnosticsFaultDelegatedClose === "true") {
    return;
  }
  document.documentElement.dataset.nodeModuleDiagnosticsFaultDelegatedClose = "true";
  document.addEventListener("click", (event) => {
    if (event.target?.closest?.("#nodeModuleDiagnosticsFaultClose")) {
      nodeGraphResetModuleDiagnosticsFault();
    }
  });
}

function nodeGraphApplyModuleDiagnosticsFaultUi() {
  const state = nodeGraphModuleDiagnosticsState();
  const fault = document.getElementById("nodeModuleDiagnosticsFault");
  const list = document.getElementById("nodeModuleDiagnosticsFaultList");
  if (!fault || !list) {
    return;
  }
  if (state.faults.length === 0) {
    closeNodeGraphModuleDiagnosticsFaultUi();
    return;
  }
  list.innerHTML = "";
  for (const item of state.faults) {
    const entry = document.createElement("li");
    entry.className = "node-module-diagnostics-fault-entry";
    entry.textContent = item.count > 1 ? `${item.detail} (x${item.count})` : item.detail;
    list.append(entry);
  }
  document.body?.classList.add("node-module-diagnostics-tripped");
  fault.hidden = false;
}

// Native WASM load failure or in-flight exception, reported via the
// worklet's existing "nativeModuleStatus" postMessage (status !== "ready").
function nodeGraphRecordNativeModuleFault(message = {}) {
  const status = String(message.status || "");
  const kind = status === "disabled" ? "native-exception" : "native-load";
  nodeGraphRecordModuleFault({
    kind,
    message: message.message || "",
    moduleName: message.name || "",
    moduleType: message.targetType || "",
    status,
  });
}

// Sustained silence/NaN detection for a reachable, non-bypassed node, fed
// by the worklet's "meter" message (badNumberCount/lastBadValueNodeId).
// Fires once per continuous bad streak, then suppresses until the node
// reports a good value again.
function nodeGraphTrackNodeSilenceWindow(nodeId, isBad, reason = "") {
  if (!nodeId) {
    return;
  }
  let reachableNodes;
  let bypassedNodes;
  try {
    const plan = compileNodeGraphExecutionPlan(nodeGraphMvp.patch);
    reachableNodes = new Set(plan.reachableNodes || []);
    bypassedNodes = new Set(plan.bypassedNodes || []);
  } catch (_error) {
    return;
  }
  if (!reachableNodes.has(nodeId) || bypassedNodes.has(nodeId)) {
    nodeGraphModuleDiagnosticsState().silenceTracking.delete(nodeId);
    nodeGraphClearModuleFault(`silent-node:${nodeId}`);
    return;
  }

  const tracking = nodeGraphModuleDiagnosticsState().silenceTracking;
  const now = Date.now();
  if (!isBad) {
    tracking.delete(nodeId);
    nodeGraphClearModuleFault(`silent-node:${nodeId}`);
    return;
  }

  const entry = tracking.get(nodeId) || { firedFault: false, since: now };
  if (!tracking.has(nodeId)) {
    tracking.set(nodeId, entry);
  }
  const elapsedSeconds = (now - entry.since) / 1000;
  if (!entry.firedFault && elapsedSeconds >= nodeGraphModuleDiagnosticsSilenceWindowSeconds) {
    entry.firedFault = true;
    const node = (nodeGraphMvp.patch?.nodes || []).find((candidate) => candidate.id === nodeId);
    nodeGraphRecordModuleFault({
      kind: "silent-node",
      moduleType: node?.type || "",
      nodeId,
      reason,
    });
  }
}

// The worklet's "meter" message only names a single most-recent bad nodeId
// per tick, not a full per-node good/bad status. When a tick reports zero
// bad values at all, that means every previously-tracked node has recovered
// (the worklet's own badNumberCount resets to 0 each report window), so
// clear everything being tracked.
function nodeGraphClearAllTrackedModuleSilence() {
  const tracking = nodeGraphModuleDiagnosticsState().silenceTracking;
  for (const nodeId of [...tracking.keys()]) {
    tracking.delete(nodeId);
    nodeGraphClearModuleFault(`silent-node:${nodeId}`);
  }
}
