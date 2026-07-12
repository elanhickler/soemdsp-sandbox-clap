// Registers the offline/render-time dispatch handler for passiveFilter into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.passiveFilter = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.passiveFilterStates.get(nodeId) || createNodeGraphStereoFilterState(createNodeGraphPassiveFilterState);
  runtime.passiveFilterStates.set(nodeId, state);
  const passiveMode = readNodeGraphLiveEffectiveParam(runtime, node, "mode", 0, frame, frames, frameValues);
  const passiveLowFrequency = readNodeGraphLiveEffectiveParam(runtime, node, "lowFrequency", 200, frame, frames, frameValues);
  const passiveHighFrequency = readNodeGraphLiveEffectiveParam(runtime, node, "highFrequency", 1000, frame, frames, frameValues);
  const passiveMono = mixInput(nodeId);
  return {
    Out: nodeGraphPassiveFilterSample(state.mono, passiveMono, passiveMode, passiveLowFrequency, passiveHighFrequency, sampleRate, runtime, `${nodeId}:mono`),
    Left: nodeGraphPassiveFilterSample(state.left, mixInput(nodeId, "Left") + passiveMono, passiveMode, passiveLowFrequency, passiveHighFrequency, sampleRate, runtime, `${nodeId}:left`),
    Right: nodeGraphPassiveFilterSample(state.right, mixInput(nodeId, "Right") + passiveMono, passiveMode, passiveLowFrequency, passiveHighFrequency, sampleRate, runtime, `${nodeId}:right`),
  };
};
