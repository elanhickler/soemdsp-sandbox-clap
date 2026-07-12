// Registers the offline/render-time dispatch handler for delayEffect into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.delayEffect = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.delayEffectStates.get(nodeId) || createNodeGraphStereoDelayEffectState();
  runtime.delayEffectStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  const delayParams = {
    feedback: read("feedback", 0.25),
    level: read("level", 1),
    mix: read("mix", 0.35),
    mode: read("mode", 0),
    modAmount: read("modAmount", 0.02),
    modRate: read("modRate", 0.1),
    modVariation: read("modVariation", 0),
    time: read("time", 0.18),
  };
  const delayMono = mixInput(nodeId);
  const monoResult = nodeGraphDelayEffectSample(state.mono, delayMono, delayParams, sampleRate, runtime, `${nodeId}:mono`);
  const leftResult = nodeGraphDelayEffectSample(state.left, mixInput(nodeId, "Left") + delayMono, delayParams, sampleRate, runtime, `${nodeId}:left`);
  const rightResult = nodeGraphDelayEffectSample(state.right, mixInput(nodeId, "Right") + delayMono, delayParams, sampleRate, runtime, `${nodeId}:right`);
  return {
    Out: monoResult.Out,
    Left: leftResult.Out,
    Right: rightResult.Out,
    Wet: monoResult.Wet,
  };
};
