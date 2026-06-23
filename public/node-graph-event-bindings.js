async function bindNodeGraphMvpEventGroup(label, binder) {
  try {
    await binder();
    return true;
  } catch (error) {
    console.error(`Node graph event binding failed: ${label}`, error);
    document.documentElement.dataset.nodeGraphEventBindingError = label;
    document.documentElement.dataset.nodeGraphEventBindingErrorMessage = error?.message || String(error);
    return false;
  }
}

async function bindNodeGraphMvpEvents() {
  await bindNodeGraphMvpEventGroup("help", bindNodeGraphHelpAndPaletteEvents);
  await bindNodeGraphMvpEventGroup("workspace", bindNodeGraphWorkspaceInteractionEvents);
  await bindNodeGraphMvpEventGroup("keyboard", () => {
    bindNodeGraphFloatingWindowLockHandles();
    document.addEventListener("keydown", handleNodeGraphFloatingWindowKeyboardNudge, true);
    document.addEventListener("keyup", handleNodeGraphFloatingWindowKeyboardRelease, true);
    document.addEventListener("keydown", handleNodeGraphKeydown);
  });
  await bindNodeGraphMvpEventGroup("scene-menu", bindNodeGraphSceneMenuEvents);
  await bindNodeGraphMvpEventGroup("header", bindNodeGraphHeaderControlEvents);
  await bindNodeGraphMvpEventGroup("render-live", bindNodeGraphRenderLiveControlEvents);
  await bindNodeGraphMvpEventGroup("ui-view", bindNodeGraphUiViewEvents);
  await bindNodeGraphMvpEventGroup("ui-dev", bindNodeGraphUiDevSettingsEvents);
  await bindNodeGraphMvpEventGroup("settings", bindNodeGraphSettingsFormEvents);
  await bindNodeGraphMvpEventGroup("sliders", bindNodeGraphSliderDragEvents);
}
