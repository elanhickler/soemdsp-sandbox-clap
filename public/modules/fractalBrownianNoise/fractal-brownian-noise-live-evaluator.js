// Registers the offline/render-time dispatch handler for fractalBrownianNoise
// into nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.fractalBrownianNoise = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.fractalBrownianNoiseStates.get(nodeId) || createNodeGraphFractalBrownianNoiseState();
  runtime.fractalBrownianNoiseStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  return nodeGraphFractalBrownianNoiseVector(
    state,
    {
      frequency: read("frequency", 0.5),
      level: read("level", 1),
      octaves: read("octaves", 4),
      persistence: read("persistence", 0.5),
      scale: read("scale", 1),
      seed: read("seed", 1),
    },
    sampleRate,
    runtime,
    nodeId,
    mixInput(nodeId, "Reset"),
  );
};
