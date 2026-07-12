// Registers the offline/render-time dispatch handler for macroKnob and
// bipolarKnob into nodeGraphLiveModuleEvaluators (declared in
// node-graph-live-frame-evaluator.js) -- both types share one implementation,
// same as the original combined if-branch. Extracted from the inline
// if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.macroKnob = ({ runtime, node, frame, frames, frameValues }) => {
  const knobValue = readNodeGraphLiveEffectiveParam(
    runtime,
    node,
    "value",
    0,
    frame,
    frames,
    frameValues,
  );
  return { Out: knobValue, value: knobValue };
};
nodeGraphLiveModuleEvaluators.bipolarKnob = nodeGraphLiveModuleEvaluators.macroKnob;
