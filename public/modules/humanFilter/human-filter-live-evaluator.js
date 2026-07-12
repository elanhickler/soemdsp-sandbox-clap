// Registers the offline/render-time dispatch handler for humanFilter into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.humanFilter = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.humanFilterStates.get(nodeId) || createNodeGraphStereoFilterState(createNodeGraphHumanFilterState);
  runtime.humanFilterStates.set(nodeId, state);
  const humanFilterParams = {
    chaos: readNodeGraphLiveEffectiveParam(runtime, node, "chaos", 0, frame, frames, frameValues),
    frequency: readNodeGraphLiveEffectiveParam(runtime, node, "frequency", 0.5, frame, frames, frameValues),
    mode: readNodeGraphLiveEffectiveParam(runtime, node, "mode", 0, frame, frames, frameValues),
    resonance: readNodeGraphLiveEffectiveParam(runtime, node, "resonance", 0.2, frame, frames, frameValues),
  };
  const humanFilterMono = mixInput(nodeId);
  return {
    Out: nodeGraphHumanFilterSample(state.mono, humanFilterMono, humanFilterParams, sampleRate, runtime, `${nodeId}:mono`),
    Left: nodeGraphHumanFilterSample(state.left, mixInput(nodeId, "Left") + humanFilterMono, humanFilterParams, sampleRate, runtime, `${nodeId}:left`),
    Right: nodeGraphHumanFilterSample(state.right, mixInput(nodeId, "Right") + humanFilterMono, humanFilterParams, sampleRate, runtime, `${nodeId}:right`),
  };
};
