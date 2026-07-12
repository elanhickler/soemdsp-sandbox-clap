// Registers the offline/render-time dispatch handlers for wireBreak, wireConnect,
// wireDisconnect, and windowReopen into nodeGraphLiveModuleEvaluators (declared
// in node-graph-live-frame-evaluator.js). Extracted from the inline if/else-if
// branches that used to live in that file. Small, standalone editor-event
// pulse types -- grouped into one file since each is a single-line pass-through.
nodeGraphLiveModuleEvaluators.wireBreak = ({ runtime }) => nodeGraphWireBreakEventSample(runtime);
nodeGraphLiveModuleEvaluators.wireConnect = ({ runtime }) => nodeGraphWireConnectEventSample(runtime);
nodeGraphLiveModuleEvaluators.wireDisconnect = ({ runtime }) => nodeGraphWireDisconnectEventSample(runtime);
nodeGraphLiveModuleEvaluators.windowReopen = ({ runtime }) => nodeGraphWindowReopenEventSample(runtime);
