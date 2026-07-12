// Registers the offline/render-time dispatch handler for audioInput into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.audioInput = ({ runtime, node, frame, frames, frameValues }) => {
  const input = runtime.externalInput || {};
  const leftChannel = input.left || input.right || null;
  const rightChannel = input.right || input.left || null;
  const left = Number(leftChannel?.[frame]) || 0;
  const right = Number(rightChannel?.[frame]) || left;
  const level = readNodeGraphLiveEffectiveParam(
    runtime,
    node,
    "level",
    1,
    frame,
    frames,
    frameValues,
  );
  return {
    Left: left * level,
    Out: ((left + right) * 0.5) * level,
    Right: right * level,
  };
};
