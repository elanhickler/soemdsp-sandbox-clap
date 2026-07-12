// Registers the offline/render-time dispatch handler for vactrolEnvelopeSeries
// and vactrolEnvelopeCustom into nodeGraphLiveModuleEvaluators (declared in
// node-graph-live-frame-evaluator.js) -- both types share one implementation,
// same as the original combined if-branch. Extracted from the inline
// if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.vactrolEnvelopeSeries = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.vactrolEnvelopeStates.get(nodeId) || createNodeGraphVactrolEnvelopeState();
  runtime.vactrolEnvelopeStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  const isSeries = node?.type === "vactrolEnvelopeSeries";
  const seriesSpec = isSeries ? nodeGraphVactrolSeriesSpec(read("part", 2)) : null;
  return nodeGraphVactrolEnvelopeSample(
    state,
    mixInput(nodeId, "Light"),
    {
      attack: isSeries ? seriesSpec.attack : read("attack", 0.01),
      curve: read("curve", 1),
      darkCurrent: read("darkCurrent", 0),
      lightOffset: read("lightOffset", 0),
      release: isSeries ? seriesSpec.release : read("release", 0.1),
      sensitivity: read("sensitivity", 1),
    },
    sampleRate,
    runtime,
    nodeId,
  );
};
nodeGraphLiveModuleEvaluators.vactrolEnvelopeCustom = nodeGraphLiveModuleEvaluators.vactrolEnvelopeSeries;
