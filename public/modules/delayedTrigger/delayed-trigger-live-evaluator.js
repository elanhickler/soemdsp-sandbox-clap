// Registers the offline/render-time dispatch handler for delayedTrigger into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.delayedTrigger = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.delayedTriggerStates.get(nodeId) || createNodeGraphDelayedTriggerState();
  runtime.delayedTriggerStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  return nodeGraphDelayedTriggerSample(
    state,
    mixInput(nodeId, "Trigger"),
    mixInput(nodeId, "Reset"),
    {
      delay: read("delay", 0.1),
      level: read("level", 1),
      pulseTime: read("pulseTime", 0.01),
      threshold: read("threshold", 0),
    },
    sampleRate,
    runtime,
    nodeId,
  );
};
