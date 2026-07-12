// Registers the offline/render-time dispatch handler for papoulisFilter into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.papoulisFilter = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.papoulisFilterStates.get(nodeId) || createNodeGraphPapoulisFilterState();
  runtime.papoulisFilterStates.set(nodeId, state);
  return nodeGraphPapoulisFilterSample(
    state,
    mixInput(nodeId),
    readNodeGraphLiveEffectiveParam(runtime, node, "cutoff", 1000, frame, frames, frameValues),
    sampleRate,
  );
};
