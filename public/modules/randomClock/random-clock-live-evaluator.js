// Registers the offline/render-time dispatch handler for randomClock into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.randomClock = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.randomClockStates.get(nodeId) || createNodeGraphRandomClockState();
  runtime.randomClockStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  return nodeGraphRandomClockSample(
    state,
    mixInput(nodeId, "Reset"),
    {
      duty: read("duty", 0.5),
      level: read("level", 1),
      maxSeconds: read("maxSeconds", 1),
      minSeconds: read("minSeconds", 0.25),
      seed: read("seed", 1),
      threshold: read("threshold", 0),
      triggerTime: read("triggerTime", 0.01),
    },
    sampleRate,
    runtime,
    nodeId,
  );
};
