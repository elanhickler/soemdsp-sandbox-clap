// Registers the offline/render-time dispatch handler for softClipper into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.softClipper = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput }) => {
  const softClipperCenter = readNodeGraphLiveEffectiveParam(runtime, node, "center", 0, frame, frames, frameValues);
  const softClipperWidth = readNodeGraphLiveEffectiveParam(runtime, node, "width", 2, frame, frames, frameValues);
  const softClipperMono = mixInput(nodeId);
  return {
    Out: nodeGraphSoftClipperSample(softClipperMono, softClipperCenter, softClipperWidth),
    Left: nodeGraphSoftClipperSample(mixInput(nodeId, "Left") + softClipperMono, softClipperCenter, softClipperWidth),
    Right: nodeGraphSoftClipperSample(mixInput(nodeId, "Right") + softClipperMono, softClipperCenter, softClipperWidth),
  };
};
