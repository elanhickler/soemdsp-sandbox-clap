// Registers the offline/render-time dispatch handler for valueSlider into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.valueSlider = ({ runtime, node, frame, frames, frameValues }) => {
  const offset = readNodeGraphLiveEffectiveParam(
    runtime,
    node,
    "offset",
    0,
    frame,
    frames,
    frameValues,
  );
  return { Bias: offset, Out: offset, offset };
};
