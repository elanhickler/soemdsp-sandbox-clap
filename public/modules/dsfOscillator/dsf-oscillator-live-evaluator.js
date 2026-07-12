// Registers the offline/render-time dispatch handler for dsfOscillator into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.dsfOscillator = ({ runtime, node, nodeId, frame, frames, frameValues, sampleRate }) => {
  const state = runtime.dsfOscillatorStates.get(nodeId) || createNodeGraphDsfOscillatorState();
  runtime.dsfOscillatorStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  return nodeGraphDsfOscillatorSample(state, {
    frequencyHz: Math.max(0, read("frequency", 100)),
    sampleRate,
    waveform: read("waveform", 1),
    morph: read("morph", 1),
    pulseWidth: read("pulseWidth", 0.5),
    blend: read("blend", 0.5),
    level: read("level", 1),
  });
};
