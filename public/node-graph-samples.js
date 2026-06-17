function normalizeNodeGraphSampleId(value = "") {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_.:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function normalizeNodeGraphSampleReference(sample = {}) {
  const source = sample && typeof sample === "object" ? sample : {};
  const id = normalizeNodeGraphSampleId(source.id);
  const name = String(source.name || id || "Sample").trim().slice(0, 128);
  const dataUrl = String(source.dataUrl || "").trim();
  const sampleRate = Math.max(0, Math.round(Number(source.sampleRate) || 0));
  const channels = Math.max(0, Math.min(64, Math.round(Number(source.channels) || 0)));
  const frames = Math.max(0, Math.round(Number(source.frames) || 0));
  return {
    ...(channels ? { channels } : {}),
    ...(dataUrl ? { dataUrl } : {}),
    ...(frames ? { frames } : {}),
    id,
    name,
    ...(sampleRate ? { sampleRate } : {}),
  };
}

function normalizeNodeGraphPatchSamples(samples = []) {
  if (!Array.isArray(samples)) {
    return [];
  }
  const seen = new Set();
  const normalized = [];
  for (const sample of samples) {
    const reference = normalizeNodeGraphSampleReference(sample);
    if (!reference.id || seen.has(reference.id)) {
      continue;
    }
    seen.add(reference.id);
    normalized.push(reference);
  }
  return normalized.slice(0, 128);
}

function nodeGraphPatchSampleById(sampleId, patch = nodeGraphMvp.patch) {
  const id = normalizeNodeGraphSampleId(sampleId);
  return normalizeNodeGraphPatchSamples(patch?.samples).find((sample) => sample.id === id) || null;
}

function nodeGraphSampleNameForNode(nodeId) {
  const node = nodeGraphPatchNode(nodeId);
  const sample = nodeGraphPatchSampleById(node?.sample?.id);
  return sample?.name || "No sample";
}

function nodeGraphSampleLoadErrorMessage(error, fileName = "audio") {
  const suffix = String(fileName || "")
    .split(".")
    .pop()
    ?.toLowerCase() || "";
  const detail = String(error?.message || error || "").trim();
  const format = suffix ? `.${suffix}` : "this file";
  if (suffix === "ogg" || suffix === "oga" || suffix === "opus") {
    return `could not decode ${format}; try WAV/MP3/FLAC or another OGG codec`;
  }
  return `could not decode ${format}${detail ? `: ${detail}` : ""}`;
}

function nodeGraphSampleStatusElementForNode(nodeId) {
  return [...document.querySelectorAll("[data-sample-status-for-node]")]
    .find((element) => element.dataset.sampleStatusForNode === nodeId) || null;
}

function nodeGraphSampleNameElementForNode(nodeId) {
  return [...document.querySelectorAll("[data-sample-name-for-node]")]
    .find((element) => element.dataset.sampleNameForNode === nodeId) || null;
}

function nodeGraphSamplePhaseElementForNode(nodeId) {
  return [...document.querySelectorAll("[data-sample-phase-for-node]")]
    .find((element) => element.dataset.samplePhaseForNode === nodeId) || null;
}

function nodeGraphSamplePhaseForNode(nodeId) {
  const phase = Number(nodeGraphMvp.sampleRuntimeStatus?.get?.(nodeId)?.phase);
  return Number.isFinite(phase) ? Math.max(0, Math.min(1, phase)) : 0;
}

function nodeGraphSamplePhaseCopyTextForNode(nodeId) {
  return nodeGraphSamplePhaseForNode(nodeId).toPrecision(17);
}

async function copyNodeGraphSamplePhaseForNode(nodeId) {
  const text = nodeGraphSamplePhaseCopyTextForNode(nodeId);
  if (typeof copyTextToClipboard === "function") {
    await copyTextToClipboard(text);
  } else {
    await navigator.clipboard.writeText(text);
  }
  setNodeInteractionHelp(`Copied phase ${text}`);
}

function setNodeGraphSampleStatus(nodeId, message) {
  const statusElement = nodeGraphSampleStatusElementForNode(nodeId);
  if (statusElement) {
    statusElement.textContent = message;
  }
  return message;
}

function nodeGraphSampleRuntimeStatusText(nodeId) {
  const status = nodeGraphMvp.sampleRuntimeStatus?.get?.(nodeId);
  if (!status) {
    return "";
  }
  const samples = Math.max(0, Math.round(Number(status.samples) || 0));
  const peak = Math.max(0, Number(status.peak) || 0);
  const reason = String(status.reason || "").trim();
  if (samples <= 0) {
    return reason || "engine not in live path";
  }
  if (peak > 0.00001) {
    return `engine pk ${peak.toFixed(3)}`;
  }
  return reason || "engine silent";
}

function syncNodeGraphAudioPlayerRuntimeStatus(message = {}) {
  const nodeIds = Array.isArray(message.nodeIds)
    ? message.nodeIds.map((id) => String(id || "")).filter(Boolean)
    : [];
  const primaryNodeId = String(message.nodeId || nodeIds[0] || "");
  const peak = Number(message.peak) || 0;
  const phase = Number(message.phase) || 0;
  const samples = Number(message.samples) || 0;
  const reason = String(message.reason || "").trim();
  const activeIds = new Set(primaryNodeId ? [primaryNodeId] : nodeIds);
  for (const nodeId of nodeIds) {
    nodeGraphMvp.sampleRuntimeStatus?.set?.(nodeId, {
      peak: activeIds.has(nodeId) ? peak : 0,
      phase: activeIds.has(nodeId) ? phase : 0,
      reason: activeIds.has(nodeId) ? reason : "engine not in live path",
      samples: activeIds.has(nodeId) ? samples : 0,
    });
  }
  if (primaryNodeId && !nodeGraphMvp.sampleRuntimeStatus?.has?.(primaryNodeId)) {
    nodeGraphMvp.sampleRuntimeStatus?.set?.(primaryNodeId, { peak, phase, reason, samples });
  }
  for (const nodeId of new Set([...nodeIds, primaryNodeId].filter(Boolean))) {
    syncNodeGraphSampleDisplayForNode(nodeId);
  }
}

function syncNodeGraphSampleDisplayForNode(nodeId) {
  const nameElement = nodeGraphSampleNameElementForNode(nodeId);
  if (nameElement) {
    nameElement.textContent = nodeGraphSampleNameForNode(nodeId);
  }
  const phaseElement = nodeGraphSamplePhaseElementForNode(nodeId);
  if (phaseElement) {
    phaseElement.textContent = nodeGraphSamplePhaseForNode(nodeId).toFixed(4);
  }
  setNodeGraphSampleStatus(nodeId, nodeGraphSampleStatusForNode(nodeId));
}

function stopNodeGraphSampleControlEvent(event) {
  event.stopPropagation();
}

function protectNodeGraphSampleControl(element) {
  for (const eventName of ["pointerdown", "mousedown", "click", "dblclick"]) {
    element.addEventListener(eventName, stopNodeGraphSampleControlEvent);
  }
  return element;
}

function nodeGraphSampleStatusForNode(nodeId) {
  const error = nodeGraphMvp.sampleLoadErrors?.get?.(nodeId);
  if (error) {
    return error;
  }
  const node = nodeGraphPatchNode(nodeId);
  const sample = nodeGraphPatchSampleById(node?.sample?.id);
  if (!sample?.id) {
    return "no audio loaded";
  }
  const cached = nodeGraphMvp.sampleBuffers?.get?.(sample.id);
  const frames = cached?.frames || sample.frames || 0;
  const channels = cached?.channels || sample.channels || 0;
  if (frames && channels) {
    const runtime = nodeGraphSampleRuntimeStatusText(nodeId);
    return `${channels}ch ${frames} frames ready${runtime ? ` / ${runtime}` : ""}`;
  }
  return "audio referenced; reload file if silent";
}

function nodeGraphSampleFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Sample file read failed"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

async function decodeNodeGraphSampleDataUrl(dataUrl, fallbackName = "Sample") {
  const response = await fetch(dataUrl);
  const arrayBuffer = await response.arrayBuffer();
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) {
    throw new Error("Web Audio API unavailable");
  }
  const context = new AudioContextConstructor();
  let audioBuffer = null;
  try {
    audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
  } catch (error) {
    throw new Error(nodeGraphSampleLoadErrorMessage(error, fallbackName));
  } finally {
    await context.close?.();
  }
  const frames = audioBuffer.length;
  const channels = audioBuffer.numberOfChannels;
  const channelData = Array.from({ length: channels }, (_, channel) =>
    new Float32Array(audioBuffer.getChannelData(channel)),
  );
  const mono = new Float32Array(frames);
  for (let channel = 0; channel < channels; channel += 1) {
    const data = channelData[channel];
    for (let frame = 0; frame < frames; frame += 1) {
      mono[frame] += data[frame] / Math.max(1, channels);
    }
  }
  return {
    channelData,
    channels,
    frames,
    name: fallbackName,
    sampleRate: audioBuffer.sampleRate,
    samples: mono,
  };
}

async function loadNodeGraphSampleForNode(nodeId, file) {
  if (!file || !nodeId) {
    return;
  }
  setNodeGraphSampleStatus(nodeId, `loading ${file.name || "audio"}...`);
  nodeGraphMvp.sampleLoadErrors?.delete?.(nodeId);
  const dataUrl = await nodeGraphSampleFileToDataUrl(file);
  try {
    await loadNodeGraphSampleDataUrlForNode(nodeId, dataUrl, file.name || "Sample");
  } catch (error) {
    setNodeGraphSampleStatus(nodeId, "browser decode failed; transcoding...");
    const transcoded = await transcodeNodeGraphSampleDataUrl(file.name || "Sample", dataUrl);
    await loadNodeGraphSampleDataUrlForNode(nodeId, transcoded.dataUrl, transcoded.name || file.name || "Sample");
  }
}

async function loadNodeGraphSamplePathForNode(nodeId, path) {
  const sourcePath = String(path || "").trim();
  if (!nodeId || !sourcePath) {
    setNodeGraphSampleStatus(nodeId, "path required");
    return;
  }
  setNodeGraphSampleStatus(nodeId, "loading local path...");
  nodeGraphMvp.sampleLoadErrors?.delete?.(nodeId);
  const response = await fetch("/api/audio-file/data-url", {
    body: JSON.stringify({ path: sourcePath }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok || !payload?.dataUrl) {
    throw new Error(payload?.error || `local path load failed (${response.status})`);
  }
  await loadNodeGraphSampleDataUrlForNode(nodeId, payload.dataUrl, payload.name || sourcePath.split(/[\\/]/).pop() || "Sample");
}

async function transcodeNodeGraphSampleDataUrl(name, dataUrl) {
  const response = await fetch("/api/audio-file/transcode-data-url", {
    body: JSON.stringify({ dataUrl, name }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok || !payload?.dataUrl) {
    throw new Error(payload?.error || `audio transcode failed (${response.status})`);
  }
  return payload;
}

async function loadNodeGraphSampleDataUrlForNode(nodeId, dataUrl, name = "Sample") {
  const decoded = await decodeNodeGraphSampleDataUrl(dataUrl, name || "Sample");
  const id = normalizeNodeGraphSampleId(`sample-${Date.now()}-${name || "clip"}`);
  const sample = normalizeNodeGraphSampleReference({
    channels: decoded.channels,
    dataUrl,
    frames: decoded.frames,
    id,
    name: name || "Sample",
    sampleRate: decoded.sampleRate,
  });
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const samples = normalizeNodeGraphPatchSamples(patch.samples);
  samples.push(sample);
  patch.samples = samples;
  const node = patch.nodes.find((candidate) => candidate.id === nodeId);
  if (node) {
    node.sample = { id };
    node.params = { ...(node.params || {}), sample: samples.length };
  }
  nodeGraphMvp.sampleBuffers?.set?.(id, {
    channelData: decoded.channelData,
    channels: decoded.channels,
    frames: decoded.frames,
    id,
    name: sample.name,
    sampleRate: decoded.sampleRate,
    samples: decoded.samples,
  });
  nodeGraphMvp.sampleLoadErrors?.delete?.(nodeId);
  nodeGraphMvp.sampleRuntimeStatus?.delete?.(nodeId);
  commitNodeGraphPatch(patch, { status: `${sample.name} loaded` });
  syncNodeGraphSampleDisplayForNode(nodeId);
  scheduleNodeGraphLivePlanSync("plan");
}

function createNodeGraphSampleModuleBody(nodeOrId) {
  const nodeId = typeof nodeOrId === "string" ? nodeOrId : nodeOrId?.id;
  const patchNode = nodeGraphPatchNode(nodeId);
  const isMusicPlayer = patchNode?.type === "audioPlayer";
  const body = document.createElement("div");
  body.className = "node-sample-module-body";
  const name = document.createElement("div");
  name.className = "node-sample-name";
  name.dataset.sampleNameForNode = nodeId;
  name.textContent = nodeGraphSampleNameForNode(nodeId);
  const status = document.createElement("div");
  status.className = "node-sample-status";
  status.dataset.sampleStatusForNode = nodeId;
  status.textContent = nodeGraphSampleStatusForNode(nodeId);
  const phase = document.createElement("div");
  phase.className = "node-sample-phase-readout";
  const phaseLabel = document.createElement("span");
  phaseLabel.textContent = "Phase";
  const phaseValue = document.createElement("strong");
  phaseValue.dataset.samplePhaseForNode = nodeId;
  phaseValue.textContent = nodeGraphSamplePhaseForNode(nodeId).toFixed(4);
  const copyPhaseButton = document.createElement("button");
  copyPhaseButton.className = "node-sample-copy-phase-button";
  copyPhaseButton.type = "button";
  copyPhaseButton.textContent = "Copy Phase";
  copyPhaseButton.title = "Copy the current phase as a full precision number";
  protectNodeGraphSampleControl(copyPhaseButton);
  copyPhaseButton.addEventListener("click", () => {
    copyNodeGraphSamplePhaseForNode(nodeId).catch((error) => {
      const message = String(error?.message || error || "copy phase failed");
      setNodeInteractionHelp(message);
      setNodeGraphSampleStatus(nodeId, message);
    });
  });
  phase.append(phaseLabel, phaseValue, copyPhaseButton);
  const inputId = `node-sample-file-input-${normalizeNodeGraphSampleId(nodeId)}`;
  const picker = document.createElement("label");
  picker.className = "node-sample-load-button node-sample-file-picker";
  picker.htmlFor = inputId;
  protectNodeGraphSampleControl(picker);
  const pickerText = document.createElement("span");
  pickerText.textContent = isMusicPlayer ? "Load Music" : "Load Sample";
  const input = document.createElement("input");
  input.id = inputId;
  input.className = "node-sample-file-input";
  input.type = "file";
  input.accept = "audio/*,.wav,.wave,.mp3,.ogg,.oga,.opus,.flac,.m4a,.aac";
  input.title = isMusicPlayer ? "Load music file" : "Load sample file";
  protectNodeGraphSampleControl(input);
  input.addEventListener("click", () => {
    setNodeGraphSampleStatus(nodeId, "file picker opened");
  });
  input.addEventListener("change", () => {
    setNodeGraphSampleStatus(nodeId, "file selection changed");
    const file = input.files?.[0];
    if (!file) {
      setNodeGraphSampleStatus(nodeId, "no file selected");
      return;
    }
    loadNodeGraphSampleForNode(nodeId, file).catch((error) => {
      const message = String(error?.message || error || "load failed");
      nodeGraphMvp.sampleLoadErrors?.set?.(nodeId, message);
      setNodeGraphSampleStatus(nodeId, message);
      setNodeInteractionHelp(`Sample load failed: ${message}`);
    });
  });
  const pathShell = document.createElement("div");
  pathShell.className = "node-sample-path-loader";
  protectNodeGraphSampleControl(pathShell);
  const pathInput = document.createElement("input");
  pathInput.className = "node-sample-path-input";
  pathInput.type = "text";
  pathInput.placeholder = "C:\\path\\music.mp3";
  pathInput.spellcheck = false;
  protectNodeGraphSampleControl(pathInput);
  const pathButton = document.createElement("button");
  pathButton.className = "node-sample-path-button";
  pathButton.type = "button";
  pathButton.textContent = "Load Path";
  protectNodeGraphSampleControl(pathButton);
  pathButton.addEventListener("click", () => {
    loadNodeGraphSamplePathForNode(nodeId, pathInput.value).catch((error) => {
      const message = String(error?.message || error || "path load failed");
      nodeGraphMvp.sampleLoadErrors?.set?.(nodeId, message);
      setNodeGraphSampleStatus(nodeId, message);
      setNodeInteractionHelp(`Sample path load failed: ${message}`);
    });
  });
  pathInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      pathButton.click();
    }
  });
  pathShell.append(pathInput, pathButton);
  picker.append(pickerText);
  body.append(name, status, picker);
  if (isMusicPlayer) {
    body.append(phase);
  }
  body.append(input);
  body.append(pathShell);
  return body;
}

async function nodeGraphDecodedSampleForReference(reference) {
  if (!reference?.dataUrl) {
    return null;
  }
  const decoded = await decodeNodeGraphSampleDataUrl(reference.dataUrl, reference.name);
  return {
    channelData: decoded.channelData,
    channels: decoded.channels,
    frames: decoded.frames,
    id: reference.id,
    name: reference.name,
    sampleRate: decoded.sampleRate,
    samples: decoded.samples,
  };
}

async function nodeGraphRuntimeSamplesForPlan(plan, patch = nodeGraphMvp.patch) {
  const needed = new Set(
    (plan?.nodes || [])
      .filter((node) => node.type === "samplePlayer" || node.type === "sampleLooper" || node.type === "audioPlayer")
      .map((node) => normalizeNodeGraphSampleId(node.sample?.id))
      .filter(Boolean),
  );
  if (!needed.size) {
    return [];
  }
  const samples = [];
  for (const reference of normalizeNodeGraphPatchSamples(patch.samples)) {
    if (!needed.has(reference.id)) {
      continue;
    }
    const decoded = await nodeGraphDecodedSampleForReference(reference);
    if (decoded?.samples?.length) {
      samples.push(decoded);
    }
  }
  return samples;
}

function nodeGraphLiveSampleForReference(reference) {
  const id = normalizeNodeGraphSampleId(reference?.id);
  const cached = id ? nodeGraphMvp.sampleBuffers?.get?.(id) : null;
  if (cached?.samples?.length || cached?.channelData?.length) {
    const channelData = (cached.channelData || []).map((channel) =>
      channel instanceof Float32Array ? channel : new Float32Array(channel || []));
    return {
      channelData,
      channels: cached.channels || channelData.length || 1,
      frames: cached.frames || cached.samples?.length || channelData[0]?.length || 0,
      id,
      name: cached.name || reference.name || id,
      sampleRate: cached.sampleRate || reference.sampleRate || 44100,
      samples: channelData.length
        ? new Float32Array(0)
        : (cached.samples instanceof Float32Array ? cached.samples : new Float32Array(cached.samples || [])),
    };
  }
  return null;
}

function nodeGraphLiveSamplesForPlan(plan, patch = nodeGraphMvp.patch) {
  const needed = new Set(
    (plan?.nodes || [])
      .filter((node) => node.type === "samplePlayer" || node.type === "sampleLooper" || node.type === "audioPlayer")
      .map((node) => normalizeNodeGraphSampleId(node.sample?.id))
      .filter(Boolean),
  );
  return normalizeNodeGraphPatchSamples(patch.samples)
    .filter((reference) => needed.has(reference.id))
    .map((reference) => nodeGraphLiveSampleForReference(reference))
    .filter((sample) => sample?.id && (sample.samples?.length || sample.channelData?.length));
}

async function nodeGraphEnsureLiveSamplesForPlan(plan, patch = nodeGraphMvp.patch) {
  const needed = new Set(
    (plan?.nodes || [])
      .filter((node) => node.type === "samplePlayer" || node.type === "sampleLooper" || node.type === "audioPlayer")
      .map((node) => normalizeNodeGraphSampleId(node.sample?.id))
      .filter(Boolean),
  );
  if (!needed.size) {
    plan.samples = [];
    return plan.samples;
  }
  for (const reference of normalizeNodeGraphPatchSamples(patch.samples)) {
    if (!needed.has(reference.id) || nodeGraphMvp.sampleBuffers?.has?.(reference.id) || !reference.dataUrl) {
      continue;
    }
    const decoded = await nodeGraphDecodedSampleForReference(reference);
    if (!decoded?.samples?.length && !decoded?.channelData?.length) {
      continue;
    }
    nodeGraphMvp.sampleBuffers?.set?.(reference.id, decoded);
  }
  plan.samples = nodeGraphLiveSamplesForPlan(plan, patch);
  return plan.samples;
}
