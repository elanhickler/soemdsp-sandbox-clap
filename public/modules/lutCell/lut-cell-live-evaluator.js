// Registers the offline/render-time dispatch handler for lutCell into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.lutCell = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput, hasInput, sampleRate }) => {
  const state = runtime.lutCellStates.get(nodeId) || createNodeGraphLutCellState();
  runtime.lutCellStates.set(nodeId, state);
  const read = (key, fallback) => readNodeGraphLiveEffectiveParam(runtime, node, key, fallback, frame, frames, frameValues);
  return nodeGraphLutCellSample(state, {
    a: mixInput(nodeId, "A"),
    hasAInput: hasInput(nodeId, "A"),
    b: mixInput(nodeId, "B"),
    c: mixInput(nodeId, "C"),
    d: mixInput(nodeId, "D"),
    clock: mixInput(nodeId, "Clock"),
    hasClockInput: hasInput(nodeId, "Clock"),
    truthTable: read("truthTable", 27030),
    sampleRate,
  });
};
