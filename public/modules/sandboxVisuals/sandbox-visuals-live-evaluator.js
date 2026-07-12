// Registers the offline/render-time dispatch handler for sandboxVisuals into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.sandboxVisuals = ({ runtime, nodeId, mixInput, sampleRate }) => {
  const screenShake = nodeGraphSmoothVisualControl(
    runtime,
    "screenShake",
    nodeGraphVisualControlIntensity(mixInput(nodeId, "Shake"), runtime, nodeId, "screen visuals shake"),
    sampleRate,
  );
  const x = nodeGraphSmoothVisualControl(
    runtime,
    "x",
    nodeGraphVisualControlSigned(mixInput(nodeId, "X"), runtime, nodeId, "sandbox visuals x"),
    sampleRate,
    0.045,
    -1,
    1,
  );
  const y = nodeGraphSmoothVisualControl(
    runtime,
    "y",
    nodeGraphVisualControlSigned(mixInput(nodeId, "Y"), runtime, nodeId, "sandbox visuals y"),
    sampleRate,
    0.045,
    -1,
    1,
  );
  const screenDim = nodeGraphSmoothVisualControl(
    runtime,
    "screenDim",
    nodeGraphVisualControlIntensity(mixInput(nodeId, "Dim"), runtime, nodeId, "screen visuals dim"),
    sampleRate,
  );
  const red = nodeGraphSmoothVisualControl(
    runtime,
    "red",
    nodeGraphVisualControlIntensity(mixInput(nodeId, "Red"), runtime, nodeId, "sandbox visuals red"),
    sampleRate,
  );
  const green = nodeGraphSmoothVisualControl(
    runtime,
    "green",
    nodeGraphVisualControlIntensity(mixInput(nodeId, "Green"), runtime, nodeId, "sandbox visuals green"),
    sampleRate,
  );
  const blue = nodeGraphSmoothVisualControl(
    runtime,
    "blue",
    nodeGraphVisualControlIntensity(mixInput(nodeId, "Blue"), runtime, nodeId, "sandbox visuals blue"),
    sampleRate,
  );
  const scopeTracesOff = nodeGraphSmoothVisualControl(
    runtime,
    "scopeTracesOff",
    nodeGraphVisualControlIntensity(mixInput(nodeId, "Scope Off"), runtime, nodeId, "screen visuals scope off"),
    sampleRate,
    0,
  );
  const scopePaused = nodeGraphSmoothVisualControl(
    runtime,
    "scopePaused",
    nodeGraphVisualControlIntensity(mixInput(nodeId, "Pause"), runtime, nodeId, "screen visuals pause"),
    sampleRate,
    0,
  );
  return {
    Blue: blue,
    Green: green,
    Pause: scopePaused,
    Red: red,
    ScopeOff: scopeTracesOff,
    ScreenDim: screenDim,
    ScreenShake: screenShake,
    X: x,
    Y: y,
  };
};
