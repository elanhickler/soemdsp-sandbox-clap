function clearNodeGraphRenderedAudioElement() {
  const audio = document.getElementById("audioPlayer");
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  if (nodeGraphMvp.renderedAudioUrl) {
    URL.revokeObjectURL(nodeGraphMvp.renderedAudioUrl);
    nodeGraphMvp.renderedAudioUrl = "";
  }
}

function syncNodeGraphRenderedAudioElement() {
  const audio = document.getElementById("audioPlayer");
  if (!audio || !nodeGraphMvp.rendered?.samples?.length) {
    clearNodeGraphRenderedAudioElement();
    return;
  }
  if (nodeGraphMvp.renderedAudioUrl) {
    URL.revokeObjectURL(nodeGraphMvp.renderedAudioUrl);
  }
  nodeGraphMvp.renderedAudioUrl = URL.createObjectURL(renderedNodeGraphWavBlob(nodeGraphMvp.rendered));
  audio.src = nodeGraphMvp.renderedAudioUrl;
  audio.load();
  labelPrimaryAudio("rendered-sample.wav", true);
  labelPrimaryAudioTitle("Rendered sample ready", true);
}

function resetNodeGraphRenderedPlaybackCursor(redraw = true) {
  if (nodeGraphMvp.renderedPlayback?.timer) {
    window.clearTimeout(nodeGraphMvp.renderedPlayback.timer);
  }
  nodeGraphMvp.renderedPlayback = {
    durationSeconds: 0,
    frame: null,
    frames: nodeGraphMvp.rendered?.frames || 0,
    playing: false,
    progress: 0,
    startContextTime: 0,
    startPerformanceTime: 0,
    timer: 0,
  };
  if (redraw) {
    drawNodeRenderedVisualOutput();
  }
}

function nodeGraphRenderedPlaybackFrame(maxFrames = 0) {
  const frame = nodeGraphMvp.renderedPlayback?.frame;
  if (!Number.isFinite(frame) || frame < 0 || !maxFrames) {
    return null;
  }
  return Math.max(0, Math.min(maxFrames - 1, Math.round(frame)));
}

function tickNodeGraphRenderedPlaybackCursor() {
  const playback = nodeGraphMvp.renderedPlayback;
  const rendered = nodeGraphMvp.rendered;
  if (!playback?.playing || !rendered?.frames) {
    return;
  }
  const elapsed = Math.max(0, (Date.now() - playback.startPerformanceTime) / 1000);
  const progress = playback.durationSeconds > 0
    ? Math.min(1, elapsed / playback.durationSeconds)
    : 0;
  playback.progress = progress;
  playback.frame = Math.min(rendered.frames - 1, Math.floor(progress * rendered.frames));
  drawNodeRenderedVisualOutput();
  if (progress < 1 && nodeGraphMvp.bufferSource) {
    playback.timer = window.setTimeout(tickNodeGraphRenderedPlaybackCursor, 33);
  } else {
    resetNodeGraphRenderedPlaybackCursor(true);
  }
}

function startNodeGraphRenderedPlaybackCursor() {
  const rendered = nodeGraphMvp.rendered;
  const context = nodeGraphMvp.audioContext;
  if (!rendered?.frames || !context) {
    return;
  }
  resetNodeGraphRenderedPlaybackCursor(false);
  nodeGraphMvp.renderedPlayback = {
    durationSeconds: rendered.durationSeconds || rendered.frames / nodeGraphMvp.sampleRate,
    frame: 0,
    frames: rendered.frames,
    playing: true,
    progress: 0,
    startContextTime: context.currentTime,
    startPerformanceTime: Date.now(),
    timer: window.setTimeout(tickNodeGraphRenderedPlaybackCursor, 33),
  };
  drawNodeRenderedVisualOutput();
}

function stopNodeGraphRenderedPlayback() {
  resetNodeGraphRenderedPlaybackCursor(true);
  const source = nodeGraphMvp.bufferSource;
  if (!source) {
    return;
  }
  nodeGraphMvp.bufferSource = null;
  try {
    source.stop();
  } catch (_error) {
    // Already-ended render playback is harmless.
  }
  try {
    source.disconnect();
  } catch (_error) {
    // A disconnected source is already silent.
  }
}
