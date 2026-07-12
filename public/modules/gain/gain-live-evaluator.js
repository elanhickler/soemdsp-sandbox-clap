// Registers the offline/render-time dispatch handler for gain into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.gain = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput }) => {
  const gainAmount = readNodeGraphLiveEffectiveParam(runtime, node, "amount", 1, frame, frames, frameValues);
  const gainMono = mixInput(nodeId);
  return {
    Out: gainMono * gainAmount,
    Left: (mixInput(nodeId, "Left") + gainMono) * gainAmount,
    Right: (mixInput(nodeId, "Right") + gainMono) * gainAmount,
  };
};
