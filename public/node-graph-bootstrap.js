async function initNodeGraphMvp() {
  installNodeGraphDebugApi();
  configureNodeGraphDefaultPresetButton();
  await loadNodeGraphTooltips();
  await bindNodeGraphMvpEvents();
  nodeGraphMvp.defaultPatch = await loadNodeGraphDefaultPresetPatch();
  commitNodeGraphPatch(cloneNodeGraphPatch(nodeGraphMvp.defaultPatch), {
    markPending: false,
    record: false,
  });
  recordNodeGraphHistory();
  markNodeGraphRenderPending();
  applyNodeGraphZoom();
  renderNodeGraphGridToggle();
  renderNodeGraphSnapGridButton();
  renderNodeGraphTooltipToggle();
  renderNodeGraphSliderVisibilityToggles();
  renderNodeGraphSliderLayout();
  loadNodeMetadataKindTemplates();
  refreshNodeGraphLiveInputDevices();
  refreshNodeGraphLiveMicrophonePermissionState();
  navigator.mediaDevices?.addEventListener?.("devicechange", refreshNodeGraphLiveInputDevices);
}
