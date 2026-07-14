// Registers the offline/render-time dispatch handler for aliasSine into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Follows the same extraction pattern as pulseExplosion's live evaluator.
nodeGraphLiveModuleEvaluators.aliasSine = ({ runtime, node, nodeId, frame, frames, frameValues }) => {
  const state = runtime.aliasSineStates.get(nodeId) || createNodeGraphAliasSineState();
  runtime.aliasSineStates.set(nodeId, state);
  return nodeGraphAliasSineSample(
    state,
    readNodeGraphLiveEffectiveParam(runtime, node, "normFreq", 0.1, frame, frames, frameValues),
    readNodeGraphLiveEffectiveParam(runtime, node, "level", 1, frame, frames, frameValues),
    runtime,
    nodeId,
  );
};
