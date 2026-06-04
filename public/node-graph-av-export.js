const nodeGraphVideoExportState = {
  exporting: false,
  recorder: null,
  chunks: [],
  timeout: 0,
};

function nodeGraphVideoExportSupported() {
  return Boolean(
    window.MediaRecorder &&
    window.AudioContext &&
    document.createElement("canvas").captureStream,
  );
}

function nodeGraphVideoExportMimeType() {
  const candidates = [
    "video/webm",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
}

function nodeGraphVideoExportRendered() {
  const rendered = nodeGraphMvp.rendered;
  const leftSamples = rendered?.leftSamples || rendered?.samples;
  if (!rendered?.frames || !leftSamples?.length) {
    return null;
  }
  return rendered;
}

function nodeGraphRenderedExportReady() {
  return Boolean(nodeGraphVideoExportRendered());
}

function nodeGraphVideoExportDurationSeconds() {
  const input = document.getElementById("nodeVideoExportSecondsValue");
  const rendered = nodeGraphVideoExportRendered();
  const renderedDuration = Number(rendered?.durationSeconds) || 0;
  const requested = Number(input?.value);
  const fallback = renderedDuration || 2;
  const seconds = Number.isFinite(requested) && requested > 0 ? requested : fallback;
  return Math.max(0.25, Math.min(60, seconds));
}

function setNodeGraphVideoExportStatus(text, className = "pill") {
  const status = document.getElementById("nodeVisualOutputStatus");
  if (!status) {
    return;
  }
  status.textContent = text;
  status.className = className;
}

function setNodeGraphVideoExportReady(ready, title = "") {
  const button = document.getElementById("nodeExportVisualVideoButton");
  if (!button) {
    return;
  }
  button.disabled = !ready;
  button.title = title || (ready
    ? "Export rendered visual output and rendered audio to WebM"
    : "Render a sample before exporting video");
}

function setNodeGraphVideoExportDiagnostic(key, value) {
  const button = document.getElementById("nodeExportVisualVideoButton");
  if (button) {
    button.dataset[key] = String(value);
  }
}

function nodeGraphRenderedDownloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function nodeGraphRenderedExportFileName(extension, fingerprint = "") {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "")
    .replace("T", "-");
  const suffix = fingerprint ? `-${fingerprint}` : "";
  return `soundemote-render-${stamp}${suffix}.${extension}`;
}

function setNodeGraphRenderedExportButtonsReady(ready) {
  for (const id of [
    "nodeRenderWavButton",
    "nodeRenderMp4Button",
    "nodeRenderOggButton",
    "nodeRenderFlacButton",
    "nodeRenderMp4AltButton",
    "nodeRenderMp4VideoOnlyButton",
  ]) {
    const button = document.getElementById(id);
    if (button) {
      button.disabled = !ready || nodeGraphVideoExportState.exporting;
    }
  }
}

function syncNodeGraphVideoExportControls() {
  const rendered = nodeGraphVideoExportRendered();
  const input = document.getElementById("nodeVideoExportSecondsValue");
  const supported = nodeGraphVideoExportSupported();
  if (typeof syncNodeGraphVisualOutputResolutionControls === "function") {
    syncNodeGraphVisualOutputResolutionControls();
  }
  if (input && rendered?.durationSeconds) {
    const current = Number(input.value);
    if (!Number.isFinite(current) || current <= 0) {
      input.value = String(Math.min(60, Math.max(0.25, rendered.durationSeconds)).toFixed(2));
    }
  }
  const ready = Boolean(rendered);
  setNodeGraphRenderedExportButtonsReady(ready);
  if (!supported) {
    setNodeGraphVideoExportReady(false, "This browser does not support MediaRecorder canvas video export");
    return;
  }
  setNodeGraphVideoExportReady(ready && !nodeGraphVideoExportState.exporting);
}

function nodeGraphVideoExportFileName(fingerprint = "") {
  return nodeGraphRenderedExportFileName("webm", fingerprint);
}

function nodeGraphVideoExportAudioTrack(rendered, durationSeconds) {
  const sampleRate = Number(rendered.sampleRate) || 44100;
  const leftSamples = rendered.leftSamples || rendered.samples;
  const rightSamples = rendered.rightSamples || leftSamples;
  const frames = Math.max(1, Math.min(
    Math.ceil(durationSeconds * sampleRate),
    Math.max(leftSamples?.length || 0, rightSamples?.length || 0),
  ));
  const context = new AudioContext({ sampleRate });
  const destination = context.createMediaStreamDestination();
  const buffer = context.createBuffer(2, frames, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  for (let frame = 0; frame < frames; frame += 1) {
    left[frame] = Math.max(-1, Math.min(1, leftSamples?.[frame] || 0));
    right[frame] = Math.max(-1, Math.min(1, rightSamples?.[frame] || left[frame] || 0));
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(destination);
  return {
    context,
    destination,
    source,
  };
}

function nodeGraphVideoExportSetPlaybackFrame(
  rendered,
  durationSeconds,
  startedAt,
  finished = false,
  canvas = null,
) {
  const elapsedSeconds = finished ? durationSeconds : Math.max(0, (performance.now() - startedAt) / 1000);
  const progress = durationSeconds > 0 ? Math.min(1, elapsedSeconds / durationSeconds) : 0;
  const frames = Math.max(1, rendered.frames || rendered.samples?.length || 1);
  nodeGraphMvp.renderedPlayback = {
    ...nodeGraphMvp.renderedPlayback,
    durationSeconds,
    frame: Math.min(frames - 1, Math.floor(progress * frames)),
    frames,
    playing: !finished,
    progress,
    startPerformanceTime: startedAt,
  };
  drawNodeRenderedVisualOutput({ canvas, updateUi: false });
}

function nodeGraphVideoExportDownload(blob, rendered) {
  nodeGraphRenderedDownloadBlob(blob, nodeGraphVideoExportFileName(rendered?.patchFingerprint));
}

function saveNodeGraphRenderedWav() {
  const rendered = nodeGraphVideoExportRendered();
  if (!rendered) {
    setNodeGraphVideoExportStatus("render first", "pill warn");
    syncNodeGraphVideoExportControls();
    return;
  }
  nodeGraphRenderedDownloadBlob(
    renderedNodeGraphWavBlob(rendered),
    nodeGraphRenderedExportFileName("wav", rendered.patchFingerprint),
  );
  setNodeGraphVideoExportStatus("wav saved", "pill good");
}

function nodeGraphVideoExportMimeForFormat(format, videoOnly = false) {
  if (format === "mp4") {
    const candidates = videoOnly
      ? ["video/mp4;codecs=avc1.42E01E", "video/mp4"]
      : ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4"];
    return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
  }
  if (format === "ogg") {
    const candidates = ["audio/ogg;codecs=opus", "audio/ogg"];
    return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
  }
  return "";
}

function reportNodeGraphRenderedExportUnsupported(format) {
  setNodeGraphVideoExportStatus(`${format} unsupported`, "pill warn");
}

async function exportNodeGraphRenderedOgg() {
  reportNodeGraphRenderedExportUnsupported("ogg");
}

async function exportNodeGraphRenderedFlac() {
  reportNodeGraphRenderedExportUnsupported("flac");
}

async function exportNodeGraphRenderedMp4(options = {}) {
  const mimeType = nodeGraphVideoExportMimeForFormat("mp4", Boolean(options.videoOnly));
  if (!mimeType) {
    reportNodeGraphRenderedExportUnsupported(options.videoOnly ? "mp4 video" : "mp4");
    return;
  }
  return exportNodeGraphVisualOutputWebm({
    ...options,
    extension: "mp4",
    mimeType,
    videoOnly: Boolean(options.videoOnly),
  });
}

async function exportNodeGraphVisualOutputWebm(options = {}) {
  if (nodeGraphVideoExportState.exporting) {
    return;
  }
  const rendered = nodeGraphVideoExportRendered();
  const canvas = createNodeGraphVisualOutputExportCanvas({ includePlaybackCursor: true });
  if (!rendered || !canvas) {
    syncNodeGraphVideoExportControls();
    setNodeGraphVideoExportStatus("render first", "pill warn");
    return;
  }
  if (!nodeGraphVideoExportSupported()) {
    setNodeGraphVideoExportStatus("video unsupported", "pill warn");
    syncNodeGraphVideoExportControls();
    return;
  }

  const durationSeconds = nodeGraphVideoExportDurationSeconds();
  const mimeType = options.mimeType || nodeGraphVideoExportMimeType();
  let audio = null;
  let stream = null;
  let recorder = null;
  let videoTrack = null;
  try {
    const videoStream = canvas.captureStream(0);
    videoTrack = videoStream.getVideoTracks()[0] || null;
    audio = options.videoOnly ? null : nodeGraphVideoExportAudioTrack(rendered, durationSeconds);
    stream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...(audio?.destination.stream.getAudioTracks() || []),
    ]);
    const recorderOptions = mimeType ? { mimeType } : undefined;
    recorder = new MediaRecorder(stream, recorderOptions);
  } catch (error) {
    setNodeGraphVideoExportStatus("export failed", "pill warn");
    syncNodeGraphVideoExportControls();
    console.error("Video export setup failed", error);
    return;
  }
  nodeGraphVideoExportState.exporting = true;
  nodeGraphVideoExportState.recorder = recorder;
  nodeGraphVideoExportState.chunks = [];
  setNodeGraphVideoExportReady(false, "Export in progress");
  setNodeGraphVideoExportStatus("exporting webm", "pill");

  recorder.addEventListener("dataavailable", (event) => {
    setNodeGraphVideoExportDiagnostic("lastChunkSize", event.data?.size || 0);
    if (event.data?.size) {
      nodeGraphVideoExportState.chunks.push(event.data);
      setNodeGraphVideoExportDiagnostic("chunkCount", nodeGraphVideoExportState.chunks.length);
    }
  });

  const startedAt = performance.now();
  let animationFrame = 0;
  const tick = () => {
    if (!nodeGraphVideoExportState.exporting) {
      return;
    }
    nodeGraphVideoExportSetPlaybackFrame(rendered, durationSeconds, startedAt, false, canvas);
    videoTrack?.requestFrame?.();
    animationFrame = window.requestAnimationFrame(tick);
  };

  const cleanup = async () => {
    nodeGraphVideoExportState.exporting = false;
    window.cancelAnimationFrame(animationFrame);
    window.clearTimeout(nodeGraphVideoExportState.timeout);
    stream?.getTracks().forEach((track) => track.stop());
    try {
      audio?.source.disconnect();
    } catch (_error) {
      // A disconnected source is already silent.
    }
    try {
      await audio?.context.close();
    } catch (_error) {
      // Closing an already-closed context is harmless.
    }
    resetNodeGraphRenderedPlaybackCursor(true);
    syncNodeGraphVideoExportControls();
  };

  recorder.addEventListener("stop", async () => {
    const blob = new Blob(nodeGraphVideoExportState.chunks, { type: mimeType || "video/webm" });
    setNodeGraphVideoExportDiagnostic("blobSize", blob.size);
    setNodeGraphVideoExportDiagnostic("blobType", blob.type);
    await cleanup();
    if (!blob.size) {
      if (!options.videoOnly && !options.mimeType) {
        setNodeGraphVideoExportStatus("retry video only", "pill warn");
        window.setTimeout(() => exportNodeGraphVisualOutputWebm({ videoOnly: true }), 80);
        return;
      }
      setNodeGraphVideoExportStatus("export failed", "pill warn");
      return;
    }
    nodeGraphRenderedDownloadBlob(
      blob,
      nodeGraphRenderedExportFileName(options.extension || "webm", rendered?.patchFingerprint),
    );
    setNodeGraphVideoExportStatus(
      options.extension === "mp4"
        ? options.videoOnly ? "mp4 saved video only" : "mp4 saved"
        : options.videoOnly ? "webm saved no audio" : "webm saved",
      "pill good",
    );
  });

  try {
    nodeGraphVideoExportSetPlaybackFrame(rendered, durationSeconds, startedAt, false, canvas);
    videoTrack?.requestFrame?.();
    audio?.context.resume?.().catch(() => {});
    setNodeGraphVideoExportDiagnostic("audioContextState", audio?.context.state || "video-only");
    setNodeGraphVideoExportDiagnostic("mode", options.videoOnly ? "video-only" : "audio-video");
    recorder.start(250);
    setNodeGraphVideoExportDiagnostic("recorderState", recorder.state);
    setNodeGraphVideoExportDiagnostic("videoTrackState", videoTrack?.readyState || "");
    tick();
    audio?.source.start();
    nodeGraphVideoExportState.timeout = window.setTimeout(() => {
      nodeGraphVideoExportSetPlaybackFrame(rendered, durationSeconds, startedAt, true, canvas);
      videoTrack?.requestFrame?.();
      if (recorder.state !== "inactive") {
        recorder.requestData?.();
        recorder.stop();
      }
    }, Math.ceil(durationSeconds * 1000) + 120);
  } catch (error) {
    await cleanup();
    setNodeGraphVideoExportStatus("export failed", "pill warn");
    console.error("Video export failed", error);
  }
}

Object.assign(window, {
  exportNodeGraphRenderedFlac,
  exportNodeGraphRenderedMp4,
  exportNodeGraphRenderedOgg,
  exportNodeGraphVisualOutputWebm,
  saveNodeGraphRenderedWav,
  setNodeGraphVideoExportReady,
  syncNodeGraphVideoExportControls,
});
