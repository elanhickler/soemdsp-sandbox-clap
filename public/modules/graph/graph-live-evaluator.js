// Registers the offline/render-time dispatch handler for graph and graph2
// into nodeGraphLiveModuleEvaluators (declared in
// node-graph-live-frame-evaluator.js). Extracted from the inline
// if/else-if branch that used to live in that file, which matched both
// types via nodeGraphModuleIsGraphType (a layout: "graph" predicate --
// confirmed those are the only two module definitions with that layout).
// graphOutputValue is a per-frame local closure in the evaluator's outer
// scope, threaded through the dispatch call's context bundle since a
// registry function built once can't close over it directly.
function nodeGraphGraphTypeLiveEvaluator({ node, nodeId, graphOutputValue }) {
  return graphOutputValue(node, nodeId);
}
nodeGraphLiveModuleEvaluators.graph = nodeGraphGraphTypeLiveEvaluator;
nodeGraphLiveModuleEvaluators.graph2 = nodeGraphGraphTypeLiveEvaluator;
