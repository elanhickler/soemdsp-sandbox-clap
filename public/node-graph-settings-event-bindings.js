function bindNodeGraphSettingsFormEvents() {
  document
    .getElementById("nodePatchScriptFileInput")
    .addEventListener("change", handleNodeGraphScriptFileLoad);
  document
    .getElementById("nodeUiDevSettingsFileInput")
    .addEventListener("change", handleNodeUiDevSettingsFileLoad);
  for (const field of document.querySelectorAll("[data-patch-info-field]")) {
    field.addEventListener("input", handleNodeGraphSettingsInput);
    field.addEventListener("change", commitNodeGraphSettingsHistory);
  }
  for (const field of document.querySelectorAll("[data-patch-header-info-field]")) {
    field.addEventListener("input", handleNodeGraphHeaderInfoInput);
    field.addEventListener("change", commitNodeGraphSettingsHistory);
  }
  for (const field of document.querySelectorAll("[data-patch-visual-field]")) {
    field.addEventListener("input", handleNodeGraphSettingsInput);
    field.addEventListener("change", commitNodeGraphSettingsHistory);
  }
  for (const field of document.querySelectorAll("[data-patch-audio-field]")) {
    field.addEventListener("input", handleNodeGraphSettingsInput);
    field.addEventListener("change", commitNodeGraphSettingsHistory);
  }
  for (const field of document.querySelectorAll("[data-patch-grid-field]")) {
    field.addEventListener("input", handleNodeGraphSettingsInput);
    field.addEventListener("change", commitNodeGraphSettingsHistory);
  }
  document.getElementById("toggleDebugButton").addEventListener("click", toggleDebugSections);
  document
    .getElementById("nodeParameterMetadataPopover")
    .addEventListener("input", handleNodeMetadataEditorInput);
  document
    .getElementById("metadataKindValue")
    .addEventListener("change", handleNodeMetadataKindChange);
  document
    .getElementById("metadataPopoverClose")
    .addEventListener("click", closeNodeMetadataPopover);
  document
    .getElementById("metadataPopoverDragHandle")
    .addEventListener("pointerdown", beginNodeMetadataPopoverDrag);
  document
    .getElementById("metadataSetDefaultButton")
    .addEventListener("click", setNodeMetadataDefaultsFromKind);
}
