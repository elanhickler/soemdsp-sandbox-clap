// Registers the offline/render-time dispatch handler for audioPlayer into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.audioPlayer = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const readParam = (key, fallback) => readNodeGraphLiveEffectiveParam(
    runtime,
    node,
    key,
    fallback,
    frame,
    frames,
    frameValues,
  );
  return nodeGraphAudioPlayerSample(
    runtime,
    node,
    nodeId,
    (port) => mixInput(nodeId, port),
    readParam,
    sampleRate,
  );
};
