// Final chunk of the Blob-assembled AudioWorklet module: registers the
// processor class defined in node-live-audio-worklet-core.js. Must be
// concatenated LAST (after core + any per-module chunks) so registerProcessor
// sees a fully-populated moduleEvaluators registry.
registerProcessor("node-live-audio-processor", NodeLiveAudioProcessor);
