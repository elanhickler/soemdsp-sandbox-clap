// Registers the offline/render-time dispatch handler for yellowjacketFilter into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.yellowjacketFilter = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.yellowjacketFilterStates.get(nodeId) || createNodeGraphStereoFilterState(createNodeGraphYellowjacketFilterState);
  runtime.yellowjacketFilterStates.set(nodeId, state);
  const yellowjacketParams = {
    chaos: readNodeGraphLiveEffectiveParam(runtime, node, "chaos", 0, frame, frames, frameValues),
    frequency: readNodeGraphLiveEffectiveParam(runtime, node, "frequency", 0.5, frame, frames, frameValues),
    resonance: readNodeGraphLiveEffectiveParam(runtime, node, "resonance", 0.2, frame, frames, frameValues),
  };
  const yellowjacketMono = mixInput(nodeId);
  return {
    Out: nodeGraphYellowjacketFilterSample(state.mono, yellowjacketMono, yellowjacketParams, sampleRate, runtime, `${nodeId}:mono`),
    Left: nodeGraphYellowjacketFilterSample(state.left, mixInput(nodeId, "Left") + yellowjacketMono, yellowjacketParams, sampleRate, runtime, `${nodeId}:left`),
    Right: nodeGraphYellowjacketFilterSample(state.right, mixInput(nodeId, "Right") + yellowjacketMono, yellowjacketParams, sampleRate, runtime, `${nodeId}:right`),
  };
};
