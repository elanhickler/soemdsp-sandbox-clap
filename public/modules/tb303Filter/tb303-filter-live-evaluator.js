// Registers the offline/render-time dispatch handler for tb303Filter into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.tb303Filter = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, sampleRate }) => {
  const state = runtime.tb303FilterStates.get(nodeId) || createNodeGraphStereoFilterState(createNodeGraphTb303FilterState);
  runtime.tb303FilterStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  const tb303Params = {
    cutoff: read("cutoff", 1000),
    drive: read("drive", 0),
    mode: read("mode", 4),
    resonance: read("resonance", 0),
  };
  const tb303Mono = mixInput(nodeId);
  return {
    Out: nodeGraphTb303FilterSample(state.mono, tb303Mono, tb303Params, sampleRate, runtime, `${nodeId}:mono`),
    Left: nodeGraphTb303FilterSample(state.left, mixInput(nodeId, "Left") + tb303Mono, tb303Params, sampleRate, runtime, `${nodeId}:left`),
    Right: nodeGraphTb303FilterSample(state.right, mixInput(nodeId, "Right") + tb303Mono, tb303Params, sampleRate, runtime, `${nodeId}:right`),
  };
};
