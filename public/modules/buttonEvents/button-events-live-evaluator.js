// Registers the offline/render-time dispatch handler for buttonEvents into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.buttonEvents = ({ runtime }) => ({
  Click: nodeGraphExternalButtonEventPulse(runtime, "click"),
  Hover: nodeGraphExternalButtonEventPulse(runtime, "hover"),
  Down: nodeGraphExternalButtonEventPulse(runtime, "down"),
  Up: nodeGraphExternalButtonEventPulse(runtime, "up"),
  Enter: nodeGraphExternalButtonEventPulse(runtime, "enter"),
  Leave: nodeGraphExternalButtonEventPulse(runtime, "leave"),
});
