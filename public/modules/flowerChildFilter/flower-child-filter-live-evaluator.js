// Registers the offline/render-time dispatch handler for flowerChildFilter into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.flowerChildFilter = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.flowerChildFilterStates.get(nodeId) || createNodeGraphStereoFilterState(createNodeGraphFlowerChildFilterState);
  runtime.flowerChildFilterStates.set(nodeId, state);
  const flowerChildParams = {
    chaos: readNodeGraphLiveEffectiveParam(runtime, node, "chaos", 0, frame, frames, frameValues),
    frequency: readNodeGraphLiveEffectiveParam(runtime, node, "frequency", 0.5, frame, frames, frameValues),
    mode: readNodeGraphLiveEffectiveParam(runtime, node, "mode", 0, frame, frames, frameValues),
    resonance: readNodeGraphLiveEffectiveParam(runtime, node, "resonance", 0.2, frame, frames, frameValues),
  };
  const flowerChildMono = mixInput(nodeId);
  return {
    Out: nodeGraphFlowerChildFilterSample(state.mono, flowerChildMono, flowerChildParams, sampleRate, runtime, `${nodeId}:mono`),
    Left: nodeGraphFlowerChildFilterSample(state.left, mixInput(nodeId, "Left") + flowerChildMono, flowerChildParams, sampleRate, runtime, `${nodeId}:left`),
    Right: nodeGraphFlowerChildFilterSample(state.right, mixInput(nodeId, "Right") + flowerChildMono, flowerChildParams, sampleRate, runtime, `${nodeId}:right`),
  };
};
