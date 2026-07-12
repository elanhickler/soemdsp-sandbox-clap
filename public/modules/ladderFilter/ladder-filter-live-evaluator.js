// Registers the offline/render-time dispatch handler for ladderFilter into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.ladderFilter = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.ladderFilterStates.get(nodeId) || createNodeGraphStereoFilterState(createNodeGraphLadderFilterState);
  runtime.ladderFilterStates.set(nodeId, state);
  const ladderParams = {
    frequency: readNodeGraphLiveEffectiveParam(runtime, node, "frequency", 1000, frame, frames, frameValues),
    mode: readNodeGraphLiveEffectiveParam(runtime, node, "mode", 1, frame, frames, frameValues),
    resonance: readNodeGraphLiveEffectiveParam(runtime, node, "resonance", 0.2, frame, frames, frameValues),
    stages: readNodeGraphLiveEffectiveParam(runtime, node, "stages", 4, frame, frames, frameValues),
  };
  const ladderMono = mixInput(nodeId);
  return {
    Out: nodeGraphLadderFilterSample(state.mono, ladderMono, ladderParams, sampleRate, runtime, `${nodeId}:mono`),
    Left: nodeGraphLadderFilterSample(state.left, mixInput(nodeId, "Left") + ladderMono, ladderParams, sampleRate, runtime, `${nodeId}:left`),
    Right: nodeGraphLadderFilterSample(state.right, mixInput(nodeId, "Right") + ladderMono, ladderParams, sampleRate, runtime, `${nodeId}:right`),
  };
};
