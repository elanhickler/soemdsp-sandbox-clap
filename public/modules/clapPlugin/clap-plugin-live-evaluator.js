// Registers the offline/render-time dispatch handler for clapPlugin into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.clapPlugin = ({ runtime, nodeId, frame }) => {
  const externalOutput = runtime.externalClapOutputs?.get(nodeId);
  if (externalOutput) {
    const absoluteFrame = Number.isFinite(runtime.absoluteFrame) ? runtime.absoluteFrame : frame;
    const value = {};
    for (const [port, samples] of Object.entries(externalOutput)) {
      value[port] = nodeGraphSafeFilterNumber(
        Number(samples?.[absoluteFrame]) || 0,
        runtime,
        nodeId,
        null,
        `CLAP ${port} output`,
      );
    }
    return value;
  }
  return {
    Left: 0,
    Right: 0,
  };
};
