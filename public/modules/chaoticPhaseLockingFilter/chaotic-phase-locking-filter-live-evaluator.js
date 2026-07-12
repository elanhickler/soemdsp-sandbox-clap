// Registers the offline/render-time dispatch handler for chaoticPhaseLockingFilter
// into nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.chaoticPhaseLockingFilter = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.chaoticPhaseLockingFilterStates.get(nodeId) || createNodeGraphStereoFilterState(createNodeGraphChaoticPhaseLockingFilterState);
  runtime.chaoticPhaseLockingFilterStates.set(nodeId, state);
  const chaoticPhaseLockingParams = {
    chaos: readNodeGraphLiveEffectiveParam(runtime, node, "chaos", 1, frame, frames, frameValues),
    frequency: readNodeGraphLiveEffectiveParam(runtime, node, "frequency", 0.5, frame, frames, frameValues),
    resonance: readNodeGraphLiveEffectiveParam(runtime, node, "resonance", 0.2, frame, frames, frameValues),
  };
  const chaoticPhaseLockingMono = mixInput(nodeId);
  return {
    Out: nodeGraphChaoticPhaseLockingFilterSample(state.mono, chaoticPhaseLockingMono, chaoticPhaseLockingParams, sampleRate, runtime, `${nodeId}:mono`),
    Left: nodeGraphChaoticPhaseLockingFilterSample(state.left, mixInput(nodeId, "Left") + chaoticPhaseLockingMono, chaoticPhaseLockingParams, sampleRate, runtime, `${nodeId}:left`),
    Right: nodeGraphChaoticPhaseLockingFilterSample(state.right, mixInput(nodeId, "Right") + chaoticPhaseLockingMono, chaoticPhaseLockingParams, sampleRate, runtime, `${nodeId}:right`),
  };
};
