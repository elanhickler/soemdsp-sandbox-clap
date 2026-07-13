// Registers the offline/render-time dispatch handler for comparator into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Follows the same extraction pattern as pulseExplosion's live evaluator.
nodeGraphLiveModuleEvaluators.comparator = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.comparatorStates.get(nodeId) || createNodeGraphComparatorState();
  runtime.comparatorStates.set(nodeId, state);
  return nodeGraphComparatorSample(
    state,
    mixInput(nodeId, "Signal In"),
    {
      pulseTime: readNodeGraphLiveEffectiveParam(runtime, node, "pulseTime", 0.01, frame, frames, frameValues),
      triggerLevel: readNodeGraphLiveEffectiveParam(runtime, node, "triggerLevel", 0.5, frame, frames, frameValues),
      pulseLevel: readNodeGraphLiveEffectiveParam(runtime, node, "pulseLevel", 1, frame, frames, frameValues),
    },
    sampleRate,
    runtime,
    nodeId,
  );
};
