// Registers the offline/render-time dispatch handler for randomWalk into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.randomWalk = ({ runtime, node, nodeId, frame, frames, frameValues, sampleRate }) => {
  const state = runtime.randomWalkStates.get(nodeId) || createNodeGraphRandomWalkState();
  runtime.randomWalkStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  return nodeGraphRandomWalkSample(
    state,
    {
      frequency: read("frequency", 2),
      jitter: read("jitter", 0.25),
      level: read("level", 1),
      method: read("method", 3),
      seed: read("seed", 1),
    },
    sampleRate,
    runtime,
    nodeId,
  );
};
