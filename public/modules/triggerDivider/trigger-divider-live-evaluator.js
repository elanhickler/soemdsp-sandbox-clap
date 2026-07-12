// Registers the offline/render-time dispatch handler for triggerDivider into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.triggerDivider = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.triggerDividerStates.get(nodeId) || createNodeGraphTriggerDividerState();
  runtime.triggerDividerStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  return nodeGraphTriggerDividerSample(
    state,
    mixInput(nodeId, "Trigger"),
    mixInput(nodeId, "Reset"),
    {
      division: read("division", 2),
      level: read("level", 1),
      pulseTime: read("pulseTime", 0.01),
      threshold: read("threshold", 0),
    },
    sampleRate,
    runtime,
    nodeId,
  );
};
