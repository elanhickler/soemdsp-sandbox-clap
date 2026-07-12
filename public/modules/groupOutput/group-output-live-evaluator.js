// Registers the offline/render-time dispatch handler for groupOutput into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.groupOutput = ({ nodeId, mixInput }) => ({
  Out: mixInput(nodeId, "In"),
});
