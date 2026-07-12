// Registers the offline/render-time dispatch handler for transport into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.transport = ({ runtime, node, nodeId, frame, frames, frameValues, sampleRate }) => {
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  return nodeGraphTransportSample(
    {
      amplitude: read("amplitude", 1),
      divisions: read("divisions", 0),
    },
    Number.isFinite(runtime.absoluteFrame) ? runtime.absoluteFrame : frame,
    sampleRate,
    runtime,
    nodeId,
  );
};
