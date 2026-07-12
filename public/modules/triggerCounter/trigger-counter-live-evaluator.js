// Registers the offline/render-time dispatch handler for triggerCounter into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.triggerCounter = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.triggerCounterStates.get(nodeId) || createNodeGraphTriggerCounterState();
  runtime.triggerCounterStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  return nodeGraphTriggerCounterSample(
    state,
    mixInput(nodeId, "Trigger"),
    mixInput(nodeId, "Reset"),
    {
      countMax: read("countMax", 8),
      increment: read("increment", 1),
      level: read("level", 1),
      pulseTime: read("pulseTime", 0.01),
      threshold: read("threshold", 0),
    },
    sampleRate,
    runtime,
    nodeId,
  );
};
