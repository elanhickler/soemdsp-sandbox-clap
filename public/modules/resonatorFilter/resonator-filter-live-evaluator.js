// Registers the offline/render-time dispatch handler for resonatorFilter into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.resonatorFilter = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.resonatorFilterStates.get(nodeId) || createNodeGraphStereoFilterState(createNodeGraphResonatorFilterState);
  runtime.resonatorFilterStates.set(nodeId, state);
  const resonatorParams = {
    chaos: readNodeGraphLiveEffectiveParam(runtime, node, "chaos", 0, frame, frames, frameValues),
    frequency: readNodeGraphLiveEffectiveParam(runtime, node, "frequency", 0.5, frame, frames, frameValues),
    mode: readNodeGraphLiveEffectiveParam(runtime, node, "mode", 0, frame, frames, frameValues),
    resonance: readNodeGraphLiveEffectiveParam(runtime, node, "resonance", 0.2, frame, frames, frameValues),
  };
  const resonatorMono = mixInput(nodeId);
  return {
    Out: nodeGraphResonatorFilterSample(state.mono, resonatorMono, resonatorParams, sampleRate, runtime, `${nodeId}:mono`),
    Left: nodeGraphResonatorFilterSample(state.left, mixInput(nodeId, "Left") + resonatorMono, resonatorParams, sampleRate, runtime, `${nodeId}:left`),
    Right: nodeGraphResonatorFilterSample(state.right, mixInput(nodeId, "Right") + resonatorMono, resonatorParams, sampleRate, runtime, `${nodeId}:right`),
  };
};
