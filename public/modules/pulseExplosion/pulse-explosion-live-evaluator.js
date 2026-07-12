// Registers the offline/render-time dispatch handler for pulseExplosion into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.pulseExplosion = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.pulseExplosionStates.get(nodeId) || createNodeGraphPulseExplosionState();
  runtime.pulseExplosionStates.set(nodeId, state);
  return nodeGraphPulseExplosionSample(
    state,
    mixInput(nodeId, "Trigger"),
    {
      startTime: readNodeGraphLiveEffectiveParam(runtime, node, "startTime", 0, frame, frames, frameValues),
      centerTime: readNodeGraphLiveEffectiveParam(runtime, node, "centerTime", 0.5, frame, frames, frameValues),
      endTime: readNodeGraphLiveEffectiveParam(runtime, node, "endTime", 1, frame, frames, frameValues),
      timeSpread: readNodeGraphLiveEffectiveParam(runtime, node, "timeSpread", 0.3, frame, frames, frameValues),
      numberOfPulses: readNodeGraphLiveEffectiveParam(runtime, node, "numberOfPulses", 20, frame, frames, frameValues),
      lowAmplitude: readNodeGraphLiveEffectiveParam(runtime, node, "lowAmplitude", 0.3, frame, frames, frameValues),
      highAmplitude: readNodeGraphLiveEffectiveParam(runtime, node, "highAmplitude", 1, frame, frames, frameValues),
      seed: readNodeGraphLiveEffectiveParam(runtime, node, "seed", 0, frame, frames, frameValues),
    },
    sampleRate,
    runtime,
    nodeId,
  );
};
