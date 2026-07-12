// Registers the offline/render-time dispatch handler for bias into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.bias = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput }) => {
  const biasOffset = readNodeGraphLiveEffectiveParam(runtime, node, "offset", 0, frame, frames, frameValues);
  const biasMono = mixInput(nodeId);
  return {
    Out: biasMono + biasOffset,
    Left: mixInput(nodeId, "Left") + biasMono + biasOffset,
    Right: mixInput(nodeId, "Right") + biasMono + biasOffset,
  };
};
