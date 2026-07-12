// Registers the offline/render-time dispatch handler for piSpigotNoise into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.piSpigotNoise = ({ runtime, node, nodeId, frame, frames, frameValues }) => {
  const state = runtime.piSpigotNoiseStates.get(nodeId) || createNodeGraphPiSpigotNoiseState();
  runtime.piSpigotNoiseStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  return nodeGraphPiSpigotNoiseSample(
    state,
    {
      seedLeft: read("seedLeft", 0),
      seedRight: read("seedRight", 0.5),
      color: read("color", 0),
      smoothing: read("smoothing", 0),
      level: read("level", 1),
    },
    runtime,
    nodeId,
  );
};
