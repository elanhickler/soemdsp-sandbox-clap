// Registers the offline/render-time dispatch handler for sampleHold into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.sampleHold = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, hasInput, sampleRate }) => {
  const state = runtime.sampleHoldStates.get(nodeId) || createNodeGraphStereoSampleHoldState();
  runtime.sampleHoldStates.set(nodeId, state);
  const sampleHoldTrigger = mixInput(nodeId, "Trigger");
  const sampleHoldThreshold = readNodeGraphLiveEffectiveParam(runtime, node, "threshold", 0, frame, frames, frameValues);
  const sampleHoldFrequency = readNodeGraphLiveEffectiveParam(runtime, node, "sampleFrequency", 0, frame, frames, frameValues);
  const sampleHoldMonoHasIn = hasInput(nodeId, "In");
  const sampleHoldMono = mixInput(nodeId, "In");
  return {
    Out: nodeGraphSampleHoldSample(state.mono, sampleHoldMono, sampleHoldTrigger, sampleHoldThreshold, sampleHoldFrequency, sampleRate, sampleHoldMonoHasIn, runtime, `${nodeId}:mono`),
    Left: nodeGraphSampleHoldSample(state.left, mixInput(nodeId, "Left") + sampleHoldMono, sampleHoldTrigger, sampleHoldThreshold, sampleHoldFrequency, sampleRate, sampleHoldMonoHasIn || hasInput(nodeId, "Left"), runtime, `${nodeId}:left`),
    Right: nodeGraphSampleHoldSample(state.right, mixInput(nodeId, "Right") + sampleHoldMono, sampleHoldTrigger, sampleHoldThreshold, sampleHoldFrequency, sampleRate, sampleHoldMonoHasIn || hasInput(nodeId, "Right"), runtime, `${nodeId}:right`),
  };
};
