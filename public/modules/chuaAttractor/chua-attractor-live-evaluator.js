// Registers the offline/render-time dispatch handler for chuaAttractor into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.chuaAttractor = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.chuaAttractorStates.get(nodeId) || createNodeGraphChuaAttractorState();
  runtime.chuaAttractorStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  const chua = nodeGraphChuaAttractorSample({
    alpha: read("alpha", 15.6),
    beta: read("beta", 28),
    m0: read("m0", -1.143),
    m1: read("m1", -0.714),
    reset: mixInput(nodeId, "Reset"),
    sampleRate,
    speed: read("speed", 1),
    state,
  });
  const chuaLevel = read("level", 1);
  return {
    X: chua.x * chuaLevel,
    Y: chua.y * chuaLevel,
    Z: chua.z * chuaLevel,
  };
};
