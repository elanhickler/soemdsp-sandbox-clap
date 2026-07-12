// Registers the offline/render-time dispatch handler for shootingStarExplosion
// into nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.shootingStarExplosion = ({ runtime, node, frame, frames, frameValues }) => nodeGraphShootingStarExplosionEventSample(
  runtime,
  readNodeGraphLiveEffectiveParam(runtime, node, "lowRange", 0, frame, frames, frameValues),
  readNodeGraphLiveEffectiveParam(runtime, node, "highRange", 1, frame, frames, frameValues),
);
