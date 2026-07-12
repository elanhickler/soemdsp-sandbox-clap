// Registers the offline/render-time dispatch handler for clockDivider into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.clockDivider = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.clockDividerStates.get(nodeId) || createNodeGraphTriggerDividerState();
  runtime.clockDividerStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  const division = Math.max(1, Math.min(64, Math.round(read("division", 2))));
  const sourceRate = nodeGraphOfflineIncomingClockRate(nodeId);
  const pulseTime = sourceRate > 0
    ? clampNodeSliderValue(read("duty", 0.5), 0.01, 1) * division / sourceRate
    : 0.01;
  return nodeGraphTriggerDividerSample(
    state,
    mixInput(nodeId, "Clock"),
    mixInput(nodeId, "Reset"),
    {
      division,
      level: read("level", 1),
      pulseTime,
      threshold: read("threshold", 0),
    },
    sampleRate,
    runtime,
    nodeId,
  );
};
