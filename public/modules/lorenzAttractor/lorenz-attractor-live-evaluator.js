// Registers the offline/render-time dispatch handler for lorenzAttractor into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.lorenzAttractor = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.lorenzAttractorStates.get(nodeId) || createNodeGraphLorenzAttractorState();
  runtime.lorenzAttractorStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(
    runtime,
    node,
    key,
    fallback,
    frame,
    frames,
    frameValues,
  );
  const lorenz = nodeGraphLorenzAttractorSample({
    beta: read("beta", 8 / 3),
    reset: mixInput(nodeId, "Reset"),
    rho: read("rho", 28),
    rotate: read("rotate", 0),
    sampleRate,
    scale: read("scale", 1),
    sigma: read("sigma", 10),
    speed: read("speed", 1),
    state,
    zDepth: read("zDepth", 0.4),
  });
  const level = read("level", 1);
  return {
    X: lorenz.x * level,
    Y: lorenz.y * level,
    Z: lorenz.z * level,
  };
};
