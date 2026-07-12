// Registers the offline/render-time dispatch handler for helmholtzPitch into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.helmholtzPitch = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, hasInput, sampleRate }) => {
  const state = runtime.helmholtzStates?.get(nodeId) || createNodeGraphHelmholtzState();
  if (runtime.helmholtzStates) runtime.helmholtzStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  return nodeGraphHelmholtzSample(
    state,
    mixInput(nodeId, "In"),
    {
      windowSize: read("windowSize", 512),
      threshold: read("threshold", 0.93),
    },
    hasInput(nodeId, "In"),
    sampleRate,
    runtime,
    nodeId,
  );
};
