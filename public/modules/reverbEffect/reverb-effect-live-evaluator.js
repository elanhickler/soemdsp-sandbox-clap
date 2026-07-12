// Registers the offline/render-time dispatch handler for reverbEffect into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.reverbEffect = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, hasInput, sampleRate }) => {
  const state = runtime.reverbEffectStates.get(nodeId) || createNodeGraphSabrinaReverbState();
  runtime.reverbEffectStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  const leftInput = mixInput(nodeId, "Left");
  const rightInput = hasInput(nodeId, "Right") ? mixInput(nodeId, "Right") : leftInput;
  return nodeGraphSabrinaReverbSample(
    state,
    leftInput,
    rightInput,
    {
      delaySize: read("delaySize", 0.02),
      diffusionAmount: read("diffusionAmount", 0.70),
      diffusionSize: read("diffusionSize", 0.35),
      lfoAmplitude: read("lfoAmplitude", 0.07),
      lfoBaseSpeed: read("lfoBaseSpeed", 0.83),
      lfoVariation: read("lfoVariation", 0.001),
      mix: read("mix", 0.43),
      recycle: read("recycle", 0.70),
      seed: read("seed", 0),
    },
    sampleRate,
    runtime,
    nodeId,
  );
};
