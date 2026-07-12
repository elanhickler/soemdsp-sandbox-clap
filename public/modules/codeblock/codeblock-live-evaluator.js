// Registers the offline/render-time dispatch handler for codeblock into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.codeblock = ({ runtime, node, frame, frames, mixInput, sampleRate }) => nodeGraphEvaluateCodeblock(runtime, node, mixInput, sampleRate, frame, frames);
