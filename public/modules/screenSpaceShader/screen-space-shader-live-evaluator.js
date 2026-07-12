// Registers the offline/render-time dispatch handler for screenSpaceShader
// into nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.screenSpaceShader = ({ runtime, node, nodeId, mixInput, sampleRate }) => nodeGraphScreenSpaceShaderSample(
  node,
  (port) => mixInput(nodeId, port),
  runtime,
  nodeId,
  sampleRate,
);
