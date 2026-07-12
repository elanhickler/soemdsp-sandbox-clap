// Registers the offline/render-time dispatch handler for moduleGroup into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.moduleGroup = ({ runtime, node, frame, frames, mixInput, sampleRate }) => nodeGraphEvaluateModuleGroup(runtime, node, mixInput, sampleRate, frame, frames);
