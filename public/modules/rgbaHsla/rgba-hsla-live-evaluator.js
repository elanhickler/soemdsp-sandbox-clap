// Registers the offline/render-time dispatch handler for rgbaHsla into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.rgbaHsla = ({ runtime, nodeId, mixInput, sampleRate }) => {
  const rgbRed = nodeGraphVisualControlIntensity(mixInput(nodeId, "Red"), runtime, nodeId, "rgba hsla red");
  const rgbGreen = nodeGraphVisualControlIntensity(mixInput(nodeId, "Green"), runtime, nodeId, "rgba hsla green");
  const rgbBlue = nodeGraphVisualControlIntensity(mixInput(nodeId, "Blue"), runtime, nodeId, "rgba hsla blue");
  const hue = nodeGraphVisualControlIntensity(mixInput(nodeId, "Hue"), runtime, nodeId, "rgba hsla hue");
  const saturation = nodeGraphVisualControlIntensity(mixInput(nodeId, "Saturation"), runtime, nodeId, "rgba hsla saturation");
  const lightness = nodeGraphVisualControlIntensity(mixInput(nodeId, "Lightness"), runtime, nodeId, "rgba hsla lightness");
  const hslMix = nodeGraphVisualControlIntensity(mixInput(nodeId, "HSL Mix"), runtime, nodeId, "rgba hsla hsl mix");
  const hslRgb = nodeGraphVisualHslToRgb(hue, saturation, lightness);
  const red = nodeGraphSmoothVisualControl(runtime, "red", rgbRed * (1 - hslMix) + hslRgb[0] * hslMix, sampleRate);
  const green = nodeGraphSmoothVisualControl(runtime, "green", rgbGreen * (1 - hslMix) + hslRgb[1] * hslMix, sampleRate);
  const blue = nodeGraphSmoothVisualControl(runtime, "blue", rgbBlue * (1 - hslMix) + hslRgb[2] * hslMix, sampleRate);
  const alpha = nodeGraphSmoothVisualControl(
    runtime,
    "screenDim",
    nodeGraphVisualControlIntensity(mixInput(nodeId, "Alpha"), runtime, nodeId, "rgba hsla alpha"),
    sampleRate,
  );
  return { Alpha: alpha, Blue: blue, Green: green, Red: red };
};
