// Registers the offline/render-time dispatch handler for pll into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.pll = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, hasInput, sampleRate }) => {
  const state = runtime.pllStates?.get(nodeId) || createNodeGraphPllState();
  if (runtime.pllStates) runtime.pllStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  const cvConnected = hasInput(nodeId, "VCO CV In") ? 1 : 0;
  return nodeGraphPllSample(
    state,
    mixInput(nodeId, "Signal In"),
    mixInput(nodeId, "VCO CV In"),
    cvConnected,
    {
      range:  read("range",  1),
      offset: read("offset", 5),
      type:   read("type",   1),
      frequ:  read("frequ",  10),
    },
    sampleRate,
    runtime,
    nodeId,
  );
};
