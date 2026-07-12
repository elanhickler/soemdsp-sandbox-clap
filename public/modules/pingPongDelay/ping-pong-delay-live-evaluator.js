// Registers the offline/render-time dispatch handler for pingPongDelay into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.pingPongDelay = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.pingPongDelayStates.get(nodeId) || createNodeGraphPingPongDelayState();
  runtime.pingPongDelayStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  return nodeGraphPingPongDelaySample(
    state,
    mixInput(nodeId) + mixInput(nodeId, "Left") + mixInput(nodeId, "Right"),
    {
      feedback: read("feedback", 0.35),
      level: read("level", 1),
      mix: read("mix", 0.35),
      offsetMs: read("offsetMs", 0),
      timeDenominator: read("timeDenominator", 4),
      timeNumerator: read("timeNumerator", 1),
      timingMode: read("timingMode", 0),
    },
    sampleRate,
    runtime,
    nodeId,
  );
};
