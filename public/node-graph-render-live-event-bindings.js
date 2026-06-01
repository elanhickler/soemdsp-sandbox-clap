function bindNodeGraphRenderLiveControlEvents() {
  document.getElementById("nodeRenderButton").addEventListener("click", renderNodeGraphAudio);
  document.getElementById("nodeRenderSecondsValue").addEventListener("input", handleNodeGraphRenderSecondsInput);
  document
    .getElementById("nodeRenderSecondsValue")
    .addEventListener("change", () => syncNodeGraphRenderSecondsFromInput({ normalize: true }));
  document.getElementById("nodeCopyRuntimeSketchButton").addEventListener("click", copyNodeGraphRuntimeSketch);
  document.getElementById("nodeCopyExecutionJsonButton").addEventListener("click", copyNodeGraphExecutionJson);
  document.getElementById("nodeSaveVisualOutputButton").addEventListener("click", saveNodeGraphVisualOutputPng);
  document.getElementById("nodeLiveInputButton").addEventListener("click", toggleNodeGraphLiveInput);
  document
    .getElementById("nodeStartMockInputDebugButton")
    .addEventListener("click", () => startNodeGraphMockInputDebug());
  document
    .getElementById("nodeStopMockInputDebugButton")
    .addEventListener("click", stopNodeGraphMockInputDebug);
  document
    .getElementById("nodeLiveInputDeviceSelect")
    .addEventListener("change", handleNodeGraphLiveInputDeviceChange);
  document.getElementById("nodeLiveOutputButton").addEventListener("click", toggleNodeGraphLiveOutput);
}
