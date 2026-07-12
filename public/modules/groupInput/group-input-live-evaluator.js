// Registers the offline/render-time dispatch handler for groupInput into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.groupInput = ({ runtime, nodeId }) => ({
  Out: Number(runtime.externalGroupInputs?.get(nodeId)) || 0,
});
