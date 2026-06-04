function bindNodeGraphRenderLiveControlEvents() {
  document.getElementById("nodeRenderButton").addEventListener("click", renderNodeGraphAudio);
  document.getElementById("nodeRenderSecondsValue").addEventListener("input", handleNodeGraphRenderSecondsInput);
  document
    .getElementById("nodeRenderSecondsValue")
    .addEventListener("change", () => syncNodeGraphRenderSecondsFromInput({ normalize: true }));
  document.getElementById("nodeCopyRuntimeSketchButton").addEventListener("click", copyNodeGraphRuntimeSketch);
  document.getElementById("nodeCopyExecutionJsonButton").addEventListener("click", copyNodeGraphExecutionJson);
  document.getElementById("nodeBadValueMonitorButton").addEventListener("click", toggleNodeGraphBadValueMonitor);
  document.getElementById("nodeTripEarProtectionButton")
    .addEventListener("click", () => nodeGraphTripEarProtection({ source: "manual", protectionMuteCount: 1 }));
  document.getElementById("nodeRenderWavButton").addEventListener("click", saveNodeGraphRenderedWav);
  document
    .getElementById("nodeVisualOutputTargetWidthValue")
    .addEventListener("input", syncNodeGraphVisualOutputResolutionControls);
  document
    .getElementById("nodeVisualOutputTargetWidthValue")
    .addEventListener("change", syncNodeGraphVideoExportControls);
  document.getElementById("nodeRenderMp4Button").addEventListener("click", () => exportNodeGraphRenderedMp4());
  document.getElementById("nodeRenderOggButton").addEventListener("click", exportNodeGraphRenderedOgg);
  document.getElementById("nodeRenderFlacButton").addEventListener("click", exportNodeGraphRenderedFlac);
  document.getElementById("nodeRenderMp4AltButton").addEventListener("click", () => exportNodeGraphRenderedMp4());
  document
    .getElementById("nodeRenderMp4VideoOnlyButton")
    .addEventListener("click", () => exportNodeGraphRenderedMp4({ videoOnly: true }));
  document.getElementById("nodeExportVisualVideoButton").addEventListener("click", exportNodeGraphVisualOutputWebm);
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
  renderNodeGraphBadValueMonitorEvidence();
  syncNodeGraphVideoExportControls();
}
