// Registers the offline/render-time dispatch handler for stepSequencer into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.stepSequencer = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput }) => {
  const state = runtime.stepSequencerStates.get(nodeId) || createNodeGraphStepSequencerState();
  runtime.stepSequencerStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  return nodeGraphStepSequencerSample(
    state,
    mixInput(nodeId, "Trigger"),
    mixInput(nodeId, "Reset"),
    {
      level: read("level", 1),
      steps: read("steps", 8),
      threshold: read("threshold", 0),
      values: [
        read("step1", 0),
        read("step2", 0.25),
        read("step3", 0.5),
        read("step4", 0.75),
        read("step5", 1),
        read("step6", 0.75),
        read("step7", 0.5),
        read("step8", 0.25),
      ],
    },
    runtime,
    nodeId,
  );
};
