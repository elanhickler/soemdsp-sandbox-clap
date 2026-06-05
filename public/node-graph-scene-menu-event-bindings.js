function bindNodeGraphSceneElementEvent(id, eventName, handler, options = undefined) {
  const element = document.getElementById(id);
  if (!element || typeof handler !== "function") {
    return;
  }
  element.addEventListener(eventName, handler, options);
}

function bindNodeGraphSceneMenuEvents() {
  bindNodeGraphSceneElementEvent("nodeModuleShopView", "click", handleNodeGraphModuleStoreClick);
  bindNodeGraphSceneElementEvent("nodeModuleDepartmentView", "click", handleNodeGraphModuleStoreClick);
  bindNodeGraphSceneElementEvent("nodeGraphWorkspace", "pointerdown", beginNodeGraphGraphNodeDrag, true);
  document.addEventListener("pointermove", dragNodeGraphGraphNode);
  document.addEventListener("pointerup", endNodeGraphGraphNodeDrag);
  document.addEventListener("pointercancel", endNodeGraphGraphNodeDrag);
  bindNodeGraphSceneElementEvent("nodeSceneDeleteModule", "click", deleteNodeGraphSelectionFromContext);
  document
    .querySelectorAll("#nodeSceneWireTypeControl [data-wire-type]")
    .forEach((button) => {
      button.addEventListener("click", () => setSelectedNodeGraphWireType(button.dataset.wireType));
    });
  bindNodeGraphSceneElementEvent("nodeSceneCopyModule", "click", copyNodeGraphModuleFromContext);
  bindNodeGraphSceneElementEvent("nodeSceneAddToGroup", "click", saveNodeGraphSelectionAsModuleGroup);
  bindNodeGraphSceneElementEvent("nodeSceneAddToUi", "click", addNodeGraphModuleToUiFromContext);
  bindNodeGraphSceneElementEvent("nodeSceneWidthDecrease", "click", () => adjustNodeGraphModuleWidthFromContext(-1));
  bindNodeGraphSceneElementEvent("nodeSceneWidthIncrease", "click", () => adjustNodeGraphModuleWidthFromContext(1));
  document
    .querySelectorAll("#nodeGlobalScopeMenu [data-scope-control]")
    .forEach((button) => {
      button.addEventListener("click", handleNodeGraphSceneScopeControlClick);
    });
  document
    .querySelectorAll("#nodeGlobalScopeMenu [data-scope-input]")
    .forEach((input) => {
      input.addEventListener("change", handleNodeGraphSceneScopeNumericInput);
      input.addEventListener("keydown", handleNodeGraphSceneScopeNumericKeydown);
      input.addEventListener("dblclick", beginNodeGraphScopeNumberEdit);
      input.addEventListener("pointerdown", beginNodeGraphScopeNumberDrag);
      input.addEventListener("lostpointercapture", endNodeGraphScopeNumberDrag);
    });
  document.addEventListener("pointermove", dragNodeGraphScopeNumber);
  document.addEventListener("pointerup", endNodeGraphScopeNumberDrag);
  document.addEventListener("pointercancel", endNodeGraphScopeNumberDrag);
  document.addEventListener("pointermove", dragNodeScopeContextMenu);
  document.addEventListener("pointerup", endNodeScopeContextMenuDrag);
  document.addEventListener("pointercancel", endNodeScopeContextMenuDrag);
  document.addEventListener("pointermove", dragNodeGlobalScopeMenu);
  document.addEventListener("pointerup", endNodeGlobalScopeMenuDrag);
  document.addEventListener("pointercancel", endNodeGlobalScopeMenuDrag);
  bindNodeGraphSceneElementEvent("nodeSceneTextBoxHeightDecrease", "click", () => adjustNodeGraphTextBoxHeightFromContext(-1));
  bindNodeGraphSceneElementEvent("nodeSceneTextBoxHeightIncrease", "click", () => adjustNodeGraphTextBoxHeightFromContext(1));
  bindNodeGraphSceneElementEvent("nodeSceneTextBoxTextSizeDecrease", "click", () =>
    adjustNodeGraphTextBoxTextSizeFromContext(-nodeGraphTextBoxTextSizeLimits.stepPercent));
  bindNodeGraphSceneElementEvent("nodeSceneTextBoxTextSizeIncrease", "click", () =>
    adjustNodeGraphTextBoxTextSizeFromContext(nodeGraphTextBoxTextSizeLimits.stepPercent));
  bindNodeGraphSceneElementEvent("nodeSceneAliasInput", "input", () => setNodeGraphModuleAliasFromContext({ record: false }));
  bindNodeGraphSceneElementEvent("nodeSceneAliasInput", "change", () => setNodeGraphModuleAliasFromContext({ record: true }));
  bindNodeGraphSceneElementEvent("nodeSceneToggleButtons", "click", toggleNodeGraphModuleButtonsFromContext);
  bindNodeGraphSceneElementEvent("nodeSceneToggleTitle", "click", toggleNodeGraphModuleTitleFromContext);
  bindNodeGraphSceneElementEvent("nodeSceneImageLoad", "click", loadNodeGraphImageFromContext);
  bindNodeGraphSceneElementEvent("nodeSceneImageSave", "click", saveNodeGraphImageFromContext);
  bindNodeGraphSceneElementEvent("nodeSceneImageRefresh", "click", refreshNodeGraphImageFromContext);
  bindNodeGraphSceneElementEvent("nodeSceneImageFileInput", "change", handleNodeGraphImageFileInputChange);
  bindNodeGraphSceneElementEvent("nodeSceneTextBoxSingleLine", "click", () => setNodeGraphTextBoxModeFromContext("singleLine"));
  bindNodeGraphSceneElementEvent("nodeSceneTextBoxMultiline", "click", () => setNodeGraphTextBoxModeFromContext("multiline"));
  bindNodeGraphSceneElementEvent("nodeSceneTextBoxTextInput", "input", () => setNodeGraphTextBoxTextFromContext({ record: false }));
  bindNodeGraphSceneElementEvent("nodeSceneTextBoxTextInput", "change", () => setNodeGraphTextBoxTextFromContext({ record: true }));
  bindNodeGraphSceneElementEvent("nodeSceneCodeblockApplyPorts", "click", applyNodeGraphCodeblockPortsFromContext);
  bindNodeGraphSceneElementEvent("nodeSceneCodeblockSource", "input", () => setNodeGraphCodeblockSourceFromContext({ record: false }));
  bindNodeGraphSceneElementEvent("nodeSceneCodeblockSource", "change", () => setNodeGraphCodeblockSourceFromContext({ record: true }));
  bindNodeGraphSceneElementEvent("nodeSceneGraphCursorX", "input", () => setNodeGraphGraphCursorFromContext({ record: false }));
  bindNodeGraphSceneElementEvent("nodeSceneGraphCursorX", "change", () => setNodeGraphGraphCursorFromContext({ record: true }));
  bindNodeGraphSceneElementEvent("nodeSceneGraphNodeIndex", "change", selectNodeGraphGraphNodeFromContext);
  bindNodeGraphSceneElementEvent("nodeSceneGraphNodeX", "input", () => setNodeGraphGraphNodeFromContext({ record: false }));
  bindNodeGraphSceneElementEvent("nodeSceneGraphNodeX", "change", () => setNodeGraphGraphNodeFromContext({ record: true }));
  bindNodeGraphSceneElementEvent("nodeSceneGraphNodeY", "input", () => setNodeGraphGraphNodeFromContext({ record: false }));
  bindNodeGraphSceneElementEvent("nodeSceneGraphNodeY", "change", () => setNodeGraphGraphNodeFromContext({ record: true }));
  bindNodeGraphSceneElementEvent("nodeSceneGraphNodeContour", "input", () => setNodeGraphGraphNodeFromContext({ record: false }));
  bindNodeGraphSceneElementEvent("nodeSceneGraphNodeContour", "change", () => setNodeGraphGraphNodeFromContext({ record: true }));
  bindNodeGraphSceneElementEvent("nodeSceneGraphNodeShape", "change", () => setNodeGraphGraphNodeFromContext({ record: true }));
  bindNodeGraphSceneElementEvent("nodeSceneGraphNodeList", "click", handleNodeGraphGraphNodeListClick);
  bindNodeGraphSceneElementEvent("nodeSceneGraphNodeList", "change", handleNodeGraphGraphNodeListChange);
  bindNodeGraphSceneElementEvent("nodeSceneGraphAddNode", "click", addNodeGraphGraphNodeFromContext);
  bindNodeGraphSceneElementEvent("nodeSceneGraphRemoveNode", "click", removeNodeGraphGraphNodeFromContext);
  bindNodeGraphSceneElementEvent("nodeSceneGraphReset", "click", resetNodeGraphGraphFromContext);
  bindNodeGraphSceneElementEvent("nodeSceneTextBoxAlignLeft", "click", () => setNodeGraphTextBoxHorizontalAlignFromContext("left"));
  bindNodeGraphSceneElementEvent("nodeSceneTextBoxAlignCenter", "click", () => setNodeGraphTextBoxHorizontalAlignFromContext("center"));
  bindNodeGraphSceneElementEvent("nodeSceneTextBoxAlignRight", "click", () => setNodeGraphTextBoxHorizontalAlignFromContext("right"));
  bindNodeGraphSceneElementEvent("nodeSceneTextBoxVerticalAlign", "input", () => setNodeGraphTextBoxVerticalAlignFromContext({ record: false }));
  bindNodeGraphSceneElementEvent("nodeSceneTextBoxVerticalAlign", "change", () => setNodeGraphTextBoxVerticalAlignFromContext({ record: true }));
  bindNodeGraphSceneElementEvent("nodeSceneCloseMenu", "click", closeNodeSceneContextMenu);
  bindNodeGraphSceneElementEvent("nodeSceneDragHandle", "pointerdown", beginNodeSceneContextMenuDrag);
}
