// Registers the offline/render-time dispatch handler for chordMemory into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.chordMemory = ({ runtime, node, nodeId, mixInput }) => {
  const state = runtime.chordMemoryStates.get(nodeId) || createNodeGraphChordMemoryState();
  runtime.chordMemoryStates.set(nodeId, state);
  return nodeGraphChordMemorySample(state, {
    advance: mixInput(nodeId, "Advance"),
    clear: mixInput(nodeId, "Clear"),
    latch: mixInput(nodeId, "Latch"),
    pitch: mixInput(nodeId, "Pitch"),
  });
};
