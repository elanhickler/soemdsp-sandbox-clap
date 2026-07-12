// Registers the offline/render-time dispatch handler for pitchQuantizer into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.pitchQuantizer = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, hasInput }) => {
  const state = runtime.pitchQuantizerStates.get(nodeId) || createNodeGraphPitchQuantizerState();
  runtime.pitchQuantizerStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  return {
    "0.1V/Oct": nodeGraphPitchQuantizerSample(state, {
      hasScaleInput: hasInput(nodeId, "Scale"),
      pitch: mixInput(nodeId, "0.1V/Oct"),
      scaleChoice: read("scale", 1),
      scaleInput: mixInput(nodeId, "Scale"),
    }),
  };
};
