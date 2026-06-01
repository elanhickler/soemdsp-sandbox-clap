function bindNodeGraphHeaderControlEvents() {
  document.getElementById("nodeDeleteButton").addEventListener("click", deleteSelectedNodeGraphItem);
  document.getElementById("nodeUndoButton").addEventListener("click", undoNodeGraphPatch);
  document.getElementById("nodeRedoButton").addEventListener("click", redoNodeGraphPatch);
  document.getElementById("nodeGridToggleButton").addEventListener("click", toggleNodeGraphGridVisibility);
  document.getElementById("nodeTooltipToggleButton").addEventListener("click", toggleNodeGraphTooltipVisibility);
  document.getElementById("nodeUserUiSettingsButton").addEventListener("click", toggleNodeUserUiSettings);
  document
    .getElementById("nodeUserUiSettingsSaveDefault")
    .addEventListener("click", handleSaveNodeUserUiSettingsDefaultClick);
  document.getElementById("nodeUserUiSettingsClose").addEventListener("click", () => setNodeUserUiSettingsVisible(false));
  document
    .getElementById("nodeUserUiSettingsDragHandle")
    .addEventListener("pointerdown", beginNodeUserUiSettingsDrag);
  document
    .getElementById("nodeUserUiSettingsHeading")
    .addEventListener("pointerdown", beginNodeUserUiSettingsDrag);
  document.getElementById("nodeSliderAmountToggleButton").addEventListener("click", toggleNodeGraphSliderAmount);
  document.getElementById("nodeSliderPositionToggleButton").addEventListener("click", toggleNodeGraphSliderPosition);
  document
    .getElementById("nodeZoomOutButton")
    .addEventListener("click", () => zoomNodeGraphBy(-nodeGraphZoomLimits.step));
  document
    .getElementById("nodeZoomResetButton")
    .addEventListener("click", handleNodeGraphZoomResetClick);
  document
    .getElementById("nodeZoomResetButton")
    .addEventListener("dblclick", beginNodeGraphZoomInput);
  document
    .getElementById("nodeZoomInButton")
    .addEventListener("click", () => zoomNodeGraphBy(nodeGraphZoomLimits.step));
  document
    .getElementById("nodeSettingsViewButton")
    .addEventListener("click", () => {
      const settingsVisible = !document.getElementById("nodeSettingsView").hidden;
      setNodeGraphViewMode(settingsVisible ? "modular" : "settings");
    });
  document
    .getElementById("nodeModularViewButton")
    .addEventListener("click", () => setNodeGraphViewMode("modular"));
  document
    .getElementById("nodeModularOnlyViewButton")
    .addEventListener("click", () => setNodeGraphViewMode("modular-only"));
  document
    .getElementById("nodeSnapGridViewButton")
    .addEventListener("click", handleNodeGraphSnapGridButtonClick);
  document
    .getElementById("nodeModularOnlyBackButton")
    .addEventListener("click", () => setNodeGraphViewMode("modular"));
  document
    .getElementById("nodeSettingsScriptViewButton")
    .addEventListener("click", () => setNodeGraphViewMode("script"));
  document.getElementById("nodePatchScript").addEventListener("input", handleNodePatchScriptInput);
  document.getElementById("copyNodeGraphScriptButton").addEventListener("click", copyNodeGraphScriptToClipboard);
  document.getElementById("downloadNodeGraphScriptButton").addEventListener("click", saveNodeGraphScript);
  document.getElementById("pasteNodeGraphScriptButton").addEventListener("click", pasteNodeGraphScriptFromClipboard);
  document.getElementById("updateDefaultPresetButton").addEventListener("click", handleUpdateDefaultNodeGraphPresetClick);
  document.getElementById("loadNodeGraphScriptButton").addEventListener("click", loadNodeGraphScript);
  document.getElementById("nodeSettingsSaveScriptButton").addEventListener("click", saveNodeGraphScript);
}
