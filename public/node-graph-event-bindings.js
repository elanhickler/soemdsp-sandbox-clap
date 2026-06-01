async function bindNodeGraphMvpEvents() {
  bindNodeGraphHelpAndPaletteEvents();
  bindNodeGraphWorkspaceInteractionEvents();
  document.addEventListener("keydown", handleNodeGraphKeydown);
  bindNodeGraphRenderLiveControlEvents();
  bindNodeGraphHeaderControlEvents();
  await bindNodeGraphUiDevSettingsEvents();
  bindNodeGraphSettingsFormEvents();
  bindNodeGraphSceneMenuEvents();
  bindNodeGraphSliderDragEvents();
}
