// Registers the offline/render-time dispatch handler for bloomGlow into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.bloomGlow = ({ runtime, node, nodeId, frame, frames, frameValues, sampleRate }) => {
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  const screenDim = nodeGraphSmoothVisualControl(
    runtime,
    "screenDim",
    read("screenDim", 0),
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
    Bloom: visualBloom,
    Brightness: visualBrightness,
    Dim: screenDim,
    Glow: visualGlow,
  };
};
