// Registers the offline/render-time dispatch handler for superloveFilter into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.superloveFilter = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.superloveFilterStates.get(nodeId) || createNodeGraphStereoFilterState(createNodeGraphSuperloveFilterState);
  runtime.superloveFilterStates.set(nodeId, state);
  const superloveParams = {
    chaos: readNodeGraphLiveEffectiveParam(runtime, node, "chaos", 0.5, frame, frames, frameValues),
    frequency: readNodeGraphLiveEffectiveParam(runtime, node, "frequency", 0.5, frame, frames, frameValues),
    mode: readNodeGraphLiveEffectiveParam(runtime, node, "mode", 0, frame, frames, frameValues),
    resonance: readNodeGraphLiveEffectiveParam(runtime, node, "resonance", 0.2, frame, frames, frameValues),
  };
  const superloveMono = mixInput(nodeId);
  return {
    Out: nodeGraphSuperloveFilterSample(state.mono, superloveMono, superloveParams, sampleRate, runtime, `${nodeId}:mono`),
    Left: nodeGraphSuperloveFilterSample(state.left, mixInput(nodeId, "Left") + superloveMono, superloveParams, sampleRate, runtime, `${nodeId}:left`),
    Right: nodeGraphSuperloveFilterSample(state.right, mixInput(nodeId, "Right") + superloveMono, superloveParams, sampleRate, runtime, `${nodeId}:right`),
  };
};
