// Registers the offline/render-time dispatch handler for midiOut into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.midiOut = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput }) => {
  const midiInputKey = `${nodeId}.MIDI Number`;
  const hasMidiInput = runtime.inputConnections.has(midiInputKey);
  const midiNumber = Math.max(0, Math.min(127, Math.round(readNodeGraphLiveEffectiveParam(
    runtime,
    node,
    "midiNumber",
    60,
    frame,
    frames,
    frameValues,
  ))));
  const outputMidiNumber = hasMidiInput
    ? Math.max(0, Math.min(127, Math.round(Number(mixInput(nodeId, "MIDI Number")) || 0)))
    : midiNumber;
  return {
    "Full Value": outputMidiNumber,
    Normalized: outputMidiNumber / 127,
  };
};
