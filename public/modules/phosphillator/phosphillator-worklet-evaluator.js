NodeLiveAudioProcessor.prototype.unpackPhosphorDrawSampleXY = function unpackPhosphorDrawSampleXY(sample) {
    if (!this.phosphorDrawSampleView) {
      const buffer = new ArrayBuffer(8);
      this.phosphorDrawSampleView = {
        f64: new Float64Array(buffer),
        f32: new Float32Array(buffer),
      };
    }
    const view = this.phosphorDrawSampleView;
    view.f64[0] = sample;
    return { x: view.f32[0], y: view.f32[1] };
  };

NodeLiveAudioProcessor.prototype.createPhosphillatorPlaybackState = function createPhosphillatorPlaybackState() {
    return { lastReset: false, phase: 0 };
  };

NodeLiveAudioProcessor.prototype.phosphillatorDecodedPath = function phosphillatorDecodedPath(nodeId, node) {
    const points = node?.drawnPath?.points;
    if (!Array.isArray(points) || points.length < 2) {
      this.phosphillatorDecodedPathCache.delete(nodeId);
      return null;
    }
    const cached = this.phosphillatorDecodedPathCache.get(nodeId);
    if (cached && cached.pointsRef === points) {
      return cached;
    }
    const decodedX = new Float32Array(points.length);
    const decodedY = new Float32Array(points.length);
    for (let i = 0; i < points.length; i += 1) {
      const unpacked = this.unpackPhosphorDrawSampleXY(points[i]);
      decodedX[i] = unpacked.x;
      decodedY[i] = unpacked.y;
    }
    const decoded = { count: points.length, decodedX, decodedY, pointsRef: points };
    this.phosphillatorDecodedPathCache.set(nodeId, decoded);
    return decoded;
  };

NodeLiveAudioProcessor.prototype.phosphillatorLoopSample = function phosphillatorLoopSample(decoded, phase) {
    const n = decoded.count;
    const index = (((phase % 1) + 1) % 1) * n;
    const i0 = Math.floor(index) % n;
    const i1 = (i0 + 1) % n;
    const t = index - Math.floor(index);
    return {
      x: decoded.decodedX[i0] + (decoded.decodedX[i1] - decoded.decodedX[i0]) * t,
      y: decoded.decodedY[i0] + (decoded.decodedY[i1] - decoded.decodedY[i0]) * t,
    };
  };

NodeLiveAudioProcessor.prototype.phosphillatorPlaybackSample = function phosphillatorPlaybackSample(state, node, nodeId, cvInput, frequency, phaseOffset, reset, rate) {
    const resetActive = Number(reset) > 0.5;
    if (resetActive && !state.lastReset) {
      state.phase = 0;
    }
    state.lastReset = resetActive;
    const pitchedFrequency = Math.max(0, Number(frequency) * (2 ** ((Number(cvInput) || 0) / 0.1)));
    const safeRate = Math.max(1, Number(rate) || 1);
    state.phase = (((state.phase + pitchedFrequency / safeRate) % 1) + 1) % 1;
    const decoded = this.phosphillatorDecodedPath(nodeId, node);
    if (!decoded) {
      return { X: 0, Y: 0 };
    }
    const effectivePhase = (((state.phase + (Number(phaseOffset) || 0)) % 1) + 1) % 1;
    const point = this.phosphillatorLoopSample(decoded, effectivePhase);
    return { X: point.x, Y: point.y };
  };

