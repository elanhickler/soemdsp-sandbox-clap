async function initNodeGraphMvp() {
  installNodeGraphDebugApi();
  configureNodeGraphDefaultPresetButton();
  await loadNodeGraphTooltips();
  await bindNodeGraphMvpEvents();
  nodeGraphMvp.defaultPatch = await loadNodeGraphDefaultPresetPatch();
  commitNodeGraphPatch(cloneNodeGraphPatch(nodeGraphMvp.defaultPatch), {
    markPending: false,
    record: false,
    status: "script synced",
  });
  resetNodeGraphStartupView();
  recordNodeGraphHistory();
  markNodeGraphRenderPending();
  applyNodeGraphZoom();
  renderNodeGraphGridToggle();
  bindNodeGraphMacroControlModuleEvents();
  bindNodeGraphKeyboardControllerModuleEvents();
  bindNodeGraphMetadataPopoverEvents();
  renderNodeGraphMacroControls();
  renderNodeGraphKeyboardControllerModules();
  renderNodeGraphModuleVisibilityToggles();
  renderNodeGraphPatchTimingControls();
  renderNodeGraphVisibilityMenuButton();
  renderNodeGraphModuleScopeBrightnessControl();
  renderNodeGraphSnapGridButton();
  renderNodeGraphTooltipToggle();
  renderNodeGraphSliderVisibilityToggles();
  renderNodeGraphSliderLayout();
  ensureNodeGraphStartupModulesVisible();
  loadNodeMetadataKindTemplates();
  refreshNodeGraphLiveInputDevices();
  refreshNodeGraphLiveMicrophonePermissionState();
  navigator.mediaDevices?.addEventListener?.("devicechange", refreshNodeGraphLiveInputDevices);
}

function clearNodeGraphStartupPatchRecoveryStorage() {
  try {
    window.localStorage?.removeItem?.(nodeGraphDefaultPresetStorageKey);
  } catch {}
}

function ensureNodeGraphStartupModulesVisible() {
  const container = document.getElementById("nodeGraphNodes");
  if (!container || container.querySelector(".dsp-node")) {
    return;
  }
  clearNodeGraphStartupPatchRecoveryStorage();
  commitNodeGraphPatch(cloneNodeGraphPatch(nodeGraphDefaultPatch), {
    markPending: false,
    record: false,
    status: "startup default restored",
  });
}
