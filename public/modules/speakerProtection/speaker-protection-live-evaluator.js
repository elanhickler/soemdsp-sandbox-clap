// Registers the offline/render-time dispatch handler for speakerProtection into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.speakerProtection = ({ runtime, nodeId, mixInput }) => {
  const speakerProtectionMono = mixInput(nodeId);
  return {
    Out: nodeGraphSpeakerProtectionSample(speakerProtectionMono, runtime, nodeId),
    Left: nodeGraphSpeakerProtectionSample(mixInput(nodeId, "Left") + speakerProtectionMono, runtime, nodeId),
    Right: nodeGraphSpeakerProtectionSample(mixInput(nodeId, "Right") + speakerProtectionMono, runtime, nodeId),
  };
};
