async function initNodeGraphMvp() {
  installNodeGraphDebugApi();
  configureNodeGraphDefaultPresetButton();
  await loadNodeGraphTooltips();
  await bindNodeGraphMvpEvents();
  nodeGraphMvp.defaultPatch = await loadNodeGraphDefaultPresetPatch();
  const earProtectionRecovery = typeof nodeGraphConsumeEarProtectionPatchRecovery === "function"
    ? nodeGraphConsumeEarProtectionPatchRecovery()
    : null;
  commitNodeGraphPatch(cloneNodeGraphPatch(earProtectionRecovery?.patch || nodeGraphMvp.defaultPatch), {
    markPending: false,
    record: false,
    status: earProtectionRecovery ? "ear protection patch restored" : "script synced",
  });
  resetNodeGraphStartupView();
  recordNodeGraphHistory();
  markNodeGraphRenderPending();
  applyNodeGraphZoom();
  renderNodeGraphGridToggle();
  bindNodeGraphMacroControlsPanelEvents();
  bindNodeGraphMidiKeyboardPanelEvents();
  renderNodeGraphMacroControls();
  renderNodeGraphMidiKeyboardToggle();
  renderNodeGraphModuleVisibilityToggles();
  renderNodeGraphPatchTimingControls();
  renderNodeGraphVisibilityMenuButton();
  renderNodeGraphModuleScopeBrightnessControl();
  renderNodeGraphSnapGridButton();
  renderNodeGraphTooltipToggle();
  renderNodeGraphSliderVisibilityToggles();
  renderNodeGraphSliderLayout();
  loadNodeMetadataKindTemplates();
  refreshNodeGraphLiveInputDevices();
  refreshNodeGraphLiveMicrophonePermissionState();
  navigator.mediaDevices?.addEventListener?.("devicechange", refreshNodeGraphLiveInputDevices);
}
