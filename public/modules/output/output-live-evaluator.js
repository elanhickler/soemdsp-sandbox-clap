// Registers the offline/render-time dispatch handler for output into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.output = ({ nodeId, mixInput }) => {
  const mono = mixInput(nodeId, "Mono");
  const left = mixInput(nodeId, "Left");
  const right = mixInput(nodeId, "Right");
  return {
    Left: mono + left,
    Out: mono + (left + right) * 0.5,
    Right: mono + right,
  };
};
