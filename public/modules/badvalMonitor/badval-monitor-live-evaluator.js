// Registers the offline/render-time dispatch handler for badvalMonitor into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.badvalMonitor = ({ runtime, nodeId, mixInput }) => nodeGraphBadValueMonitorSample(mixInput(nodeId), runtime, nodeId);
