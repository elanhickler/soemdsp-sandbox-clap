// videoscope has no per-sample dispatch entry (it's a visualSink, audio flows
// into it via the generic bufferedInputs -> visualInputBuffers path already
// handled by the core class). All bespoke work here happens once per scope
// snapshot tick (~30fps, from postModuleScopeSnapshot): drain whatever fresh
// A/B samples arrived since the last tick into the native ring buffer/trigger
// via soemdsp_videoscope_push, then query column min/max (and, in XY mode,
// raw point pairs) for the display. There is no JS fallback -- the .cpp has
// none, so a native failure just disables the module until reload.

NodeLiveAudioProcessor.prototype.createVideoscopeState = function createVideoscopeState() {
  return {
    nativeHandle: 0,
    pushedFrameA: 0,
    pushedFrameB: 0,
  };
};

NodeLiveAudioProcessor.prototype.videoscopeExtractFreshSamples = function videoscopeExtractFreshSamples(buf, lastFrame) {
  if (!buf?.buffer?.length) {
    return { newLastFrame: lastFrame, samples: null };
  }
  const length = Math.min(Number(buf.length) || 0, buf.capacity || buf.buffer.length);
  const absoluteFrame = Math.max(0, Math.floor(Number(buf.absoluteFrame) || 0));
  const freshCount = lastFrame > 0
    ? Math.max(0, absoluteFrame - lastFrame)
    : Math.min(length, Math.ceil((Number(this.engineSampleRate) || sampleRate || 44100) / 30));
  const count = Math.min(length, freshCount);
  if (count <= 0) {
    return { newLastFrame: absoluteFrame, samples: null };
  }
  const ordered = new Float32Array(count);
  const start = ((Number(buf.writeIndex) || 0) - count + buf.capacity) % buf.capacity;
  for (let index = 0; index < count; index += 1) {
    ordered[index] = buf.buffer[(start + index) % buf.capacity] || 0;
  }
  return { newLastFrame: absoluteFrame, samples: ordered };
};

NodeLiveAudioProcessor.prototype.videoscopeCollectDisplayData = function videoscopeCollectDisplayData(nodeId, state, dataPorts) {
  if (!this.nativeVideoscopeReady || !this.nativeVideoscope) {
    return;
  }
  const bufA = this.visualInputBuffers.get(`${nodeId}:A`);
  const bufB = this.visualInputBuffers.get(`${nodeId}:B`);
  if (!bufA?.buffer?.length && !bufB?.buffer?.length) {
    return;
  }
  const node = this.nodes.get(nodeId);
  const params = node?.params || {};
  const triggerLevel = this.safeFilterNumber(params.triggerLevel, 0) ?? 0;
  const triggerSource = Math.round(this.clampValue(this.safeFilterNumber(params.triggerSource, 0) ?? 0, 0, 1));
  const triggerPolarity = Math.round(this.clampValue(this.safeFilterNumber(params.triggerPolarity, 0) ?? 0, 0, 1));
  const timeDivSamples = Math.round(this.clampValue(this.safeFilterNumber(params.timeDivSamples, 512) ?? 512, 8, 8192));
  const freeze = Math.round(this.clampValue(this.safeFilterNumber(params.freeze, 0) ?? 0, 0, 1));
  const mode = Math.round(this.clampValue(this.safeFilterNumber(params.mode, 1) ?? 1, 0, 2));
  const columns = Math.round(this.clampValue(this.safeFilterNumber(params.columns, 200) ?? 200, 16, 512));

  try {
    if (!state.nativeHandle) {
      state.nativeHandle = this.nativeVideoscope.soemdsp_videoscope_create();
    }
    if (!state.nativeHandle) {
      return;
    }
    const freshA = this.videoscopeExtractFreshSamples(bufA, state.pushedFrameA);
    const freshB = this.videoscopeExtractFreshSamples(bufB, state.pushedFrameB);
    state.pushedFrameA = freshA.newLastFrame;
    state.pushedFrameB = freshB.newLastFrame;
    const samplesA = freshA.samples;
    const samplesB = freshB.samples;
    const count = Math.min(samplesA?.length || 0, samplesB?.length || 0);
    for (let index = 0; index < count; index += 1) {
      this.nativeVideoscope.soemdsp_videoscope_push(
        state.nativeHandle,
        samplesA[index],
        samplesB[index],
        triggerLevel,
        triggerSource,
        triggerPolarity,
        timeDivSamples,
        freeze,
      );
    }
    const windowSize = this.nativeVideoscope.soemdsp_videoscope_window_size(state.nativeHandle) | 0;
    if (windowSize <= 0) {
      return;
    }
    if (mode === 2) {
      const xyCount = Math.min(windowSize, 2048);
      const xyA = new Float32Array(xyCount);
      const xyB = new Float32Array(xyCount);
      for (let index = 0; index < xyCount; index += 1) {
        xyA[index] = this.nativeVideoscope.soemdsp_videoscope_xy_a(state.nativeHandle, index);
        xyB[index] = this.nativeVideoscope.soemdsp_videoscope_xy_b(state.nativeHandle, index);
      }
      dataPorts.push([nodeId, "XyA", xyA]);
      dataPorts.push([nodeId, "XyB", xyB]);
      return;
    }
    const colMinA = new Float32Array(columns);
    const colMaxA = new Float32Array(columns);
    const colMinB = new Float32Array(columns);
    const colMaxB = new Float32Array(columns);
    for (let col = 0; col < columns; col += 1) {
      colMinA[col] = this.nativeVideoscope.soemdsp_videoscope_column_min(state.nativeHandle, 0, col, columns);
      colMaxA[col] = this.nativeVideoscope.soemdsp_videoscope_column_max(state.nativeHandle, 0, col, columns);
      colMinB[col] = this.nativeVideoscope.soemdsp_videoscope_column_min(state.nativeHandle, 1, col, columns);
      colMaxB[col] = this.nativeVideoscope.soemdsp_videoscope_column_max(state.nativeHandle, 1, col, columns);
    }
    dataPorts.push([nodeId, "ColMinA", colMinA]);
    dataPorts.push([nodeId, "ColMaxA", colMaxA]);
    dataPorts.push([nodeId, "ColMinB", colMinB]);
    dataPorts.push([nodeId, "ColMaxB", colMaxB]);
  } catch (error) {
    this.nativeVideoscopeReady = false;
    state.nativeHandle = 0;
    this.port.postMessage({
      type: "nativeModuleStatus",
      name: "videoscope",
      status: "disabled",
      message: String(error?.message || error || "native Videoscope failed"),
    });
  }
};
