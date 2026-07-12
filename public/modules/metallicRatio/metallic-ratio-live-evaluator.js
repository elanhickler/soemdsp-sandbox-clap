// Registers the offline/render-time dispatch handler for metallicRatio into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.metallicRatio = ({ runtime, node, frame, frames, frameValues }) => nodeGraphMetallicRatioSample(
  readNodeGraphLiveEffectiveParam(runtime, node, "index", 1, frame, frames, frameValues),
);
