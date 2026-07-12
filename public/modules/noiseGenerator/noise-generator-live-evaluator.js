// Registers the offline/render-time dispatch handler for noiseGenerator into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.noiseGenerator = ({ runtime, node, nodeId, frame, frames, frameValues }) => {
  const state = runtime.noiseGeneratorStates.get(nodeId) || createNodeGraphNoiseGeneratorState();
  runtime.noiseGeneratorStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  return nodeGraphNoiseGeneratorSample(
    state,
    {
      deviation: read("deviation", 0.5),
      level: read("level", 1),
      mean: read("mean", 0),
      mode: read("mode", 0),
      seed: read("seed", 1),
    },
    runtime,
    nodeId,
  );
};
