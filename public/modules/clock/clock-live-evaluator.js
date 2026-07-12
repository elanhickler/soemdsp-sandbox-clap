// Registers the offline/render-time dispatch handler for clock into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.clock = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.clockStates.get(nodeId) || createNodeGraphClockState();
  runtime.clockStates.set(nodeId, state);
  return nodeGraphClockSample(
    state,
    mixInput(nodeId, "Reset"),
    readNodeGraphLiveEffectiveParam(runtime, node, "phase", 0, frame, frames, frameValues),
    readNodeGraphLiveEffectiveParam(runtime, node, "rate", 2, frame, frames, frameValues),
    readNodeGraphLiveEffectiveParam(runtime, node, "duty", 0.5, frame, frames, frameValues),
    readNodeGraphLiveEffectiveParam(runtime, node, "level", 1, frame, frames, frameValues),
    sampleRate,
    runtime,
    nodeId,
  );
};
