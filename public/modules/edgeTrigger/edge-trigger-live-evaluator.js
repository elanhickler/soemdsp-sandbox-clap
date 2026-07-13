// Registers the offline/render-time dispatch handler for edgeTrigger into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Follows the same extraction pattern as pulseExplosion's live evaluator.
nodeGraphLiveModuleEvaluators.edgeTrigger = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.edgeTriggerStates.get(nodeId) || createNodeGraphEdgeTriggerState();
  runtime.edgeTriggerStates.set(nodeId, state);
  return nodeGraphEdgeTriggerSample(
    state,
    mixInput(nodeId, "Digital In"),
    {
      pulseTime: readNodeGraphLiveEffectiveParam(runtime, node, "pulseTime", 0.01, frame, frames, frameValues),
      triggerLevel: readNodeGraphLiveEffectiveParam(runtime, node, "triggerLevel", 1, frame, frames, frameValues),
      pulseLevel: readNodeGraphLiveEffectiveParam(runtime, node, "pulseLevel", 1, frame, frames, frameValues),
    },
    sampleRate,
    runtime,
    nodeId,
  );
};
