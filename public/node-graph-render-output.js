function nodeGraphRenderPendingSummary() {
  try {
    return nodeGraphValidate().scheduleText;
  } catch (_error) {
    return "waiting for render";
  }
}

function renderedNodeGraphWavBlob(rendered) {
  return nodeGraphRenderedWavBlob(rendered, nodeGraphMvp.sampleRate);
}

function nodeGraphOutputClipCountText(count = 0) {
  return count === 1 ? "1 clip" : `${count} clips`;
}

function nodeGraphClampOutputSample(value) {
  return Math.max(
    -nodeGraphOutputClipLimit,
    Math.min(nodeGraphOutputClipLimit, value),
  );
}

function nodeGraphOutputSampleClipped(value) {
  return value < -nodeGraphOutputClipLimit || value > nodeGraphOutputClipLimit;
}

function nodeGraphTemporaryPrefilterForResample(samples, sourceRate, outputRate) {
  if (!samples?.length || !Number.isFinite(sourceRate) || !Number.isFinite(outputRate) || sourceRate <= outputRate) {
    return samples;
  }
  const radius = Math.max(1, Math.min(12, Math.ceil(sourceRate / outputRate)));
  const filtered = new Float32Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    let sum = 0;
    let weightSum = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const sampleIndex = Math.max(0, Math.min(samples.length - 1, index + offset));
      const weight = radius + 1 - Math.abs(offset);
      sum += samples[sampleIndex] * weight;
      weightSum += weight;
    }
    filtered[index] = weightSum > 0 ? sum / weightSum : samples[index];
  }
  return filtered;
}

function nodeGraphResampleLinear(samples, outputFrames) {
  const frames = Math.max(1, Math.floor(Number(outputFrames)));
  if (!samples?.length) {
    return new Float32Array(frames);
  }
  if (samples.length === frames) {
    return new Float32Array(samples);
  }
  if (frames === 1) {
    return new Float32Array([samples[0]]);
  }
  const resampled = new Float32Array(frames);
  const scale = (samples.length - 1) / (frames - 1);
  for (let frame = 0; frame < frames; frame += 1) {
    const position = frame * scale;
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(samples.length - 1, leftIndex + 1);
    const blend = position - leftIndex;
    resampled[frame] = samples[leftIndex] * (1 - blend) + samples[rightIndex] * blend;
  }
  return resampled;
}

function nodeGraphResampleRenderedChannel(samples, sourceRate, outputRate, outputFrames) {
  const filtered = nodeGraphTemporaryPrefilterForResample(samples, sourceRate, outputRate);
  return nodeGraphResampleLinear(filtered, outputFrames);
}

function setNodeGraphAudioStats(peak = 0, rms = 0, details = {}) {
  const audioStats = document.getElementById("nodeAudioStats");
  if (!audioStats) {
    return;
  }
  const frames = Number(details.frames) || 0;
  const sampleRate = Number(details.sampleRate) || nodeGraphMvp.sampleRate;
  const engineSampleRate = Number(details.engineSampleRate) || sampleRate;
  const oversamplingRatio = Number(details.oversamplingRatio) || 1;
  const stateReadCount = Number(details.stateReadCount) || 0;
  const clipCount = Number(details.clipCount) || 0;
  const durationSeconds = frames > 0 && sampleRate > 0 ? frames / sampleRate : 0;
  const clipText = clipCount ? ` / ${nodeGraphOutputClipCountText(clipCount)}` : "";
  audioStats.textContent = `peak ${peak.toFixed(3)} / rms ${rms.toFixed(3)}${clipText}`;
  audioStats.className = `pill ${clipCount ? "warn" : ""}`.trim();
  audioStats.dataset.renderClips = String(clipCount);
  audioStats.dataset.renderFrames = String(frames);
  audioStats.dataset.renderSampleRate = String(sampleRate);
  audioStats.dataset.renderEngineSampleRate = String(engineSampleRate);
  audioStats.dataset.renderOversamplingRatio = String(oversamplingRatio);
  audioStats.dataset.renderDuration = durationSeconds.toFixed(3);
  audioStats.dataset.renderStateReads = String(stateReadCount);
  const stateReadText = stateReadCount ? ` / ${nodeGraphStateReadText(stateReadCount)}` : "";
  const clipTitle = clipCount ? ` / ${nodeGraphOutputClipCountText(clipCount)}` : "";
  audioStats.title = frames > 0
    ? `Rendered sample: ${frames} frames / ${durationSeconds.toFixed(3)}s / ${sampleRate} Hz output / ${nodeGraphFormatSampleRate(engineSampleRate)} engine / ${nodeGraphFormatOversamplingRatio(oversamplingRatio)}${stateReadText}${clipTitle}`
    : "Rendered sample unavailable";
}

function markNodeGraphRenderPending(summary = "") {
  stopNodeGraphRenderedPlayback();
  nodeGraphMvp.rendered = null;
  clearNodeGraphModuleScopeBuffers();
  clearNodeGraphRenderedAudioElement();
  labelPrimaryAudioTitle("Render Sample creates preview audio here", false);
  document.getElementById("nodeGraphRenderStatus").textContent = "render pending";
  document.getElementById("nodeGraphRenderStatus").className = "pill warn";
  setNodeGraphAudioStats();
  const outputSummary = document.getElementById("nodeOutputSummary");
  if (outputSummary) {
    outputSummary.textContent = summary || nodeGraphRenderPendingSummary();
  }
  renderNodeGraphExecutionPlanDebug();
  drawNodeRenderedAudio();
}

function renderNodeGraphAudio() {
  if (!nodeGraphScriptReadyForGraphAction("render")) {
    markNodeGraphRenderScriptBlocked();
    return;
  }
  stopNodeGraphRenderedPlayback();
  const validation = nodeGraphValidate();
  const renderStatus = document.getElementById("nodeGraphRenderStatus");
  if (!validation.valid) {
    nodeGraphMvp.rendered = null;
    clearNodeGraphModuleScopeBuffers();
    clearNodeGraphRenderedAudioElement();
    labelPrimaryAudioTitle("Fix graph before rendering", false);
    renderStatus.textContent = "render blocked";
    renderStatus.className = "pill warn";
    setNodeGraphAudioStats();
    const outputSummary = document.getElementById("nodeOutputSummary");
    if (outputSummary) {
      outputSummary.textContent = validation.scheduleText;
    }
    renderNodeGraphExecutionPlanDebug();
    drawNodeRenderedAudio();
    return;
  }

  syncNodeGraphRenderSecondsFromInput({ normalize: true });
  const audio = nodeGraphAudioDerivation(nodeGraphMvp.patch);
  const outputSampleRate = audio.outputSampleRate;
  const engineSampleRate = audio.clampedEngineSampleRate;
  const outputFrames = Math.floor(outputSampleRate * nodeGraphMvp.seconds);
  const engineFrames = Math.max(1, Math.round(engineSampleRate * nodeGraphMvp.seconds));
  const patchFingerprint = nodeGraphPatchFingerprint();
  const engineLeftSamples = new Float32Array(engineFrames);
  const engineRightSamples = new Float32Array(engineFrames);
  const plan = nodeGraphBuildLivePlan();
  const stateReadCount = nodeGraphStateReadCount(plan);
  const runtime = createNodeGraphLiveRuntime(plan);
  const scopeCapture = beginNodeGraphRenderedScopeCapture({
    frames: engineFrames,
    patch: nodeGraphMvp.patch,
    patchFingerprint,
    sampleRate: engineSampleRate,
  });
  let clipCount = 0;

  for (let blockStart = 0; blockStart < engineFrames; blockStart += nodeGraphAudioBlockSize) {
    const blockFrames = Math.min(nodeGraphAudioBlockSize, engineFrames - blockStart);
    for (let blockFrame = 0; blockFrame < blockFrames; blockFrame += 1) {
      const frame = blockStart + blockFrame;
      const frameOutput = evaluateNodeGraphPlanFrame(
        runtime,
        engineSampleRate,
        blockFrame,
        blockFrames,
      );
      captureNodeGraphRenderedScopeFrame(
        scopeCapture,
        runtime,
        frameOutput.frameValues,
        frame,
        blockFrame,
        blockFrames,
      );
      if (nodeGraphOutputSampleClipped(frameOutput.left)) {
        clipCount += 1;
      }
      if (nodeGraphOutputSampleClipped(frameOutput.right)) {
        clipCount += 1;
      }
      const left = nodeGraphClampOutputSample(frameOutput.left);
      const right = nodeGraphClampOutputSample(frameOutput.right);
      engineLeftSamples[frame] = left;
      engineRightSamples[frame] = right;
    }
    finishNodeGraphParameterSmoothing(runtime.smoothers);
  }
  finishNodeGraphRenderedScopeCapture(scopeCapture);

  const leftSamples = nodeGraphResampleRenderedChannel(
    engineLeftSamples,
    engineSampleRate,
    outputSampleRate,
    outputFrames,
  );
  const rightSamples = nodeGraphResampleRenderedChannel(
    engineRightSamples,
    engineSampleRate,
    outputSampleRate,
    outputFrames,
  );
  const samples = new Float32Array(outputFrames);
  let peak = 0;
  let squareSum = 0;
  for (let frame = 0; frame < outputFrames; frame += 1) {
    const left = leftSamples[frame] || 0;
    const right = rightSamples[frame] || 0;
    samples[frame] = (left + right) * 0.5;
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
    squareSum += (left * left + right * right) * 0.5;
  }

  const rms = Math.sqrt(squareSum / outputFrames);
  nodeGraphMvp.rendered = {
    channels: 2,
    connectionCount: plan.connections.length,
    durationSeconds: outputFrames / outputSampleRate,
    engineFrames,
    engineSampleRate,
    feedbackConnectionCount: plan.feedbackConnections.length,
    feedbackModulationCount: plan.feedbackModulations.length,
    frames: outputFrames,
    modulationCount: plan.modulations.length,
    nodeCount: plan.nodes.length,
    oversamplingRatio: audio.oversamplingRatio,
    peak,
    leftSamples,
    patchFingerprint,
    rightSamples,
    rms,
    sampleRate: outputSampleRate,
    samples,
    clipCount,
    sourceNodes: validation.sourceNodes,
    stateReadCount,
  };
  syncNodeGraphRenderedAudioElement();
  renderStatus.textContent = "render ready";
  renderStatus.className = "pill good";
  setNodeGraphAudioStats(peak, rms, {
    frames: outputFrames,
    sampleRate: outputSampleRate,
    clipCount,
    engineSampleRate,
    oversamplingRatio: audio.oversamplingRatio,
    stateReadCount,
  });
  renderNodeGraphExecutionPlanDebug();
  const outputSummary = document.getElementById("nodeOutputSummary");
  if (outputSummary) {
    outputSummary.textContent = validation.scheduleText;
  }
  drawNodeRenderedAudio();
}
