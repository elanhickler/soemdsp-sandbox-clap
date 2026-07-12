// Registers the offline/render-time dispatch handler for slewLimiter into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.slewLimiter = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.slewLimiterStates.get(nodeId) || createNodeGraphStereoSlewLimiterState();
  runtime.slewLimiterStates.set(nodeId, state);
  const slewUpTime = readNodeGraphLiveEffectiveParam(runtime, node, "upTime", 0.05, frame, frames, frameValues);
  const slewDownTime = readNodeGraphLiveEffectiveParam(runtime, node, "downTime", 0.20, frame, frames, frameValues);
  const slewMono = mixInput(nodeId);
  return {
    Out: nodeGraphSlewLimiterSample(state.mono, slewMono, slewUpTime, slewDownTime, sampleRate, runtime, nodeId),
    Left: nodeGraphSlewLimiterSample(state.left, mixInput(nodeId, "Left") + slewMono, slewUpTime, slewDownTime, sampleRate, runtime, nodeId),
    Right: nodeGraphSlewLimiterSample(state.right, mixInput(nodeId, "Right") + slewMono, slewUpTime, slewDownTime, sampleRate, runtime, nodeId),
  };
};
