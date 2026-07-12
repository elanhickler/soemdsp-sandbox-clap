// Registers the offline/render-time dispatch handler for chromaColor into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.chromaColor = ({ runtime, node, nodeId, frame, frames, frameValues, sampleRate }) => {
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  const chromaHue = nodeGraphSmoothVisualControl(
    runtime,
    "chromaHue",
    read("chromaHue", 0.58),
    sampleRate,
  );
  const chromaSaturation = nodeGraphSmoothVisualControl(
    runtime,
    "chromaSaturation",
    read("chromaSaturation", 0.82),
    sampleRate,
  );
  const chromaLightness = nodeGraphSmoothVisualControl(
    runtime,
    "chromaLightness",
    read("chromaLightness", 0.52),
    sampleRate,
  );
  const chromaAlpha = nodeGraphSmoothVisualControl(
    runtime,
    "chromaAlpha",
    read("chromaAlpha", 0.35),
    sampleRate,
  );
  const chromaDrift = nodeGraphSmoothVisualControl(
    runtime,
    "chromaDrift",
    read("chromaDrift", 0.25),
    sampleRate,
  );
  const chromaSpread = nodeGraphSmoothVisualControl(
    runtime,
    "chromaSpread",
    read("chromaSpread", 0.4),
    sampleRate,
  );
  const visualBrightness = nodeGraphSmoothVisualControl(
    runtime,
    "visualBrightness",
    read("visualBrightness", 0.55),
    sampleRate,
  );
  const visualBloom = nodeGraphSmoothVisualControl(
    runtime,
    "visualBloom",
    read("visualBloom", 0.45),
    sampleRate,
  );
  const visualGlow = nodeGraphSmoothVisualControl(
    runtime,
    "visualGlow",
    read("visualGlow", 0.6),
    sampleRate,
  );
  return {
    Alpha: chromaAlpha,
    Bloom: visualBloom,
    Chroma: chromaSaturation,
    Drift: chromaDrift,
    Glow: visualGlow,
    Hue: chromaHue,
    Light: chromaLightness,
    Spread: chromaSpread,
    TraceBrightness: visualBrightness,
  };
};
