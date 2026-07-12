// Registers the offline/render-time dispatch handler for pluckEnvelope into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.pluckEnvelope = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.pluckEnvelopeStates.get(nodeId) || createNodeGraphPluckEnvelopeState();
  runtime.pluckEnvelopeStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  return nodeGraphPluckEnvelopeSample(
    state,
    mixInput(nodeId, "Trigger"),
    mixInput(nodeId, "Release"),
    {
      attackFeedback: read("attackFeedback", 0.002),
      autoReleaseTime: read("autoReleaseTime", 0.08),
      decay: read("decay", 0.35),
      decayModCurve: read("decayModCurve", 0),
      decayModEnd: read("decayModEnd", 0.55),
      decayModFrequency: read("decayModFrequency", 1.5),
      decayModStart: read("decayModStart", 0.08),
      delayTime: read("delayTime", 0),
      endingDecay: read("endingDecay", 0.8),
      level: read("level", 1),
      releaseFeedback: read("releaseFeedback", 0.35),
      velocity: read("velocity", 1),
      velocitySensitivity: read("velocitySensitivity", 0),
    },
    sampleRate,
    runtime,
    nodeId,
  );
};
