// Registers the offline/render-time dispatch handler for flowerChildEnvelopeFollower
// into nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.flowerChildEnvelopeFollower = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.flowerChildEnvelopeFollowerStates.get(nodeId) || createNodeGraphFlowerChildEnvelopeFollowerState();
  runtime.flowerChildEnvelopeFollowerStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  return nodeGraphFlowerChildEnvelopeFollowerSample(
    state,
    mixInput(nodeId),
    {
      attack: read("attack", 0.001),
      decay: read("decay", 0.001),
      hold: read("hold", 0.001),
    },
    sampleRate,
    runtime,
    nodeId,
  );
};
