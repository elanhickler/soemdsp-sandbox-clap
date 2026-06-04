function bindNodeGraphSceneMenuEvents() {
  document
    .getElementById("nodeModuleShopView")
    .addEventListener("click", handleNodeGraphModuleStoreClick);
  document
    .getElementById("nodeModuleDepartmentView")
    .addEventListener("click", handleNodeGraphModuleStoreClick);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointerdown", beginNodeGraphGraphNodeDrag, true);
  document.addEventListener("pointermove", dragNodeGraphGraphNode);
  document.addEventListener("pointerup", endNodeGraphGraphNodeDrag);
  document.addEventListener("pointercancel", endNodeGraphGraphNodeDrag);
  document
    .getElementById("nodeSceneDeleteModule")
    .addEventListener("click", deleteNodeGraphSelectionFromContext);
  document
    .querySelectorAll("#nodeSceneWireTypeControl [data-wire-type]")
    .forEach((button) => {
      button.addEventListener("click", () => setSelectedNodeGraphWireType(button.dataset.wireType));
    });
  document
    .getElementById("nodeSceneCopyModule")
    .addEventListener("click", copyNodeGraphModuleFromContext);
  document
    .getElementById("nodeSceneAddToGroup")
    .addEventListener("click", saveNodeGraphSelectionAsModuleGroup);
  document
    .getElementById("nodeSceneAddToUi")
    .addEventListener("click", addNodeGraphModuleToUiFromContext);
  document
    .getElementById("nodeSceneWidthDecrease")
    .addEventListener("click", () => adjustNodeGraphModuleWidthFromContext(-1));
  document
    .getElementById("nodeSceneWidthIncrease")
    .addEventListener("click", () => adjustNodeGraphModuleWidthFromContext(1));
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
  document
    .getElementById("nodeSceneTextBoxHeightDecrease")
    .addEventListener("click", () => adjustNodeGraphTextBoxHeightFromContext(-1));
  document
    .getElementById("nodeSceneTextBoxHeightIncrease")
    .addEventListener("click", () => adjustNodeGraphTextBoxHeightFromContext(1));
  document
    .getElementById("nodeSceneTextBoxTextSizeDecrease")
    .addEventListener("click", () =>
      adjustNodeGraphTextBoxTextSizeFromContext(-nodeGraphTextBoxTextSizeLimits.stepPercent));
  document
    .getElementById("nodeSceneTextBoxTextSizeIncrease")
    .addEventListener("click", () =>
      adjustNodeGraphTextBoxTextSizeFromContext(nodeGraphTextBoxTextSizeLimits.stepPercent));
  document
    .getElementById("nodeSceneAliasInput")
    .addEventListener("input", () => setNodeGraphModuleAliasFromContext({ record: false }));
  document
    .getElementById("nodeSceneAliasInput")
    .addEventListener("change", () => setNodeGraphModuleAliasFromContext({ record: true }));
  document
    .getElementById("nodeSceneToggleButtons")
    .addEventListener("click", toggleNodeGraphModuleButtonsFromContext);
  document
    .getElementById("nodeSceneToggleTitle")
    .addEventListener("click", toggleNodeGraphModuleTitleFromContext);
  document
    .getElementById("nodeSceneImageLoad")
    .addEventListener("click", loadNodeGraphImageFromContext);
  document
    .getElementById("nodeSceneImageSave")
    .addEventListener("click", saveNodeGraphImageFromContext);
  document
    .getElementById("nodeSceneImageRefresh")
    .addEventListener("click", refreshNodeGraphImageFromContext);
  document
    .getElementById("nodeSceneImageFileInput")
    .addEventListener("change", handleNodeGraphImageFileInputChange);
  document
    .getElementById("nodeSceneTextBoxSingleLine")
    .addEventListener("click", () => setNodeGraphTextBoxModeFromContext("singleLine"));
  document
    .getElementById("nodeSceneTextBoxMultiline")
    .addEventListener("click", () => setNodeGraphTextBoxModeFromContext("multiline"));
  document
    .getElementById("nodeSceneTextBoxTextInput")
    .addEventListener("input", () => setNodeGraphTextBoxTextFromContext({ record: false }));
  document
    .getElementById("nodeSceneTextBoxTextInput")
    .addEventListener("change", () => setNodeGraphTextBoxTextFromContext({ record: true }));
  document
    .getElementById("nodeSceneCodeblockApplyPorts")
    .addEventListener("click", applyNodeGraphCodeblockPortsFromContext);
  document
    .getElementById("nodeSceneCodeblockSource")
    .addEventListener("input", () => setNodeGraphCodeblockSourceFromContext({ record: false }));
  document
    .getElementById("nodeSceneCodeblockSource")
    .addEventListener("change", () => setNodeGraphCodeblockSourceFromContext({ record: true }));
  document
    .getElementById("nodeSceneGraphCursorX")
    .addEventListener("input", () => setNodeGraphGraphCursorFromContext({ record: false }));
  document
    .getElementById("nodeSceneGraphCursorX")
    .addEventListener("change", () => setNodeGraphGraphCursorFromContext({ record: true }));
  document
    .getElementById("nodeSceneGraphNodeIndex")
    .addEventListener("change", selectNodeGraphGraphNodeFromContext);
  document
    .getElementById("nodeSceneGraphNodeX")
    .addEventListener("input", () => setNodeGraphGraphNodeFromContext({ record: false }));
  document
    .getElementById("nodeSceneGraphNodeX")
    .addEventListener("change", () => setNodeGraphGraphNodeFromContext({ record: true }));
  document
    .getElementById("nodeSceneGraphNodeY")
    .addEventListener("input", () => setNodeGraphGraphNodeFromContext({ record: false }));
  document
    .getElementById("nodeSceneGraphNodeY")
    .addEventListener("change", () => setNodeGraphGraphNodeFromContext({ record: true }));
  document
    .getElementById("nodeSceneGraphNodeContour")
    .addEventListener("input", () => setNodeGraphGraphNodeFromContext({ record: false }));
  document
    .getElementById("nodeSceneGraphNodeContour")
    .addEventListener("change", () => setNodeGraphGraphNodeFromContext({ record: true }));
  document
    .getElementById("nodeSceneGraphNodeShape")
    .addEventListener("change", () => setNodeGraphGraphNodeFromContext({ record: true }));
  document
    .getElementById("nodeSceneGraphNodeList")
    .addEventListener("click", handleNodeGraphGraphNodeListClick);
  document
    .getElementById("nodeSceneGraphNodeList")
    .addEventListener("change", handleNodeGraphGraphNodeListChange);
  document
    .getElementById("nodeSceneGraphAddNode")
    .addEventListener("click", addNodeGraphGraphNodeFromContext);
  document
    .getElementById("nodeSceneGraphRemoveNode")
    .addEventListener("click", removeNodeGraphGraphNodeFromContext);
  document
    .getElementById("nodeSceneGraphReset")
    .addEventListener("click", resetNodeGraphGraphFromContext);
  document
    .getElementById("nodeSceneTextBoxAlignLeft")
    .addEventListener("click", () => setNodeGraphTextBoxHorizontalAlignFromContext("left"));
  document
    .getElementById("nodeSceneTextBoxAlignCenter")
    .addEventListener("click", () => setNodeGraphTextBoxHorizontalAlignFromContext("center"));
  document
    .getElementById("nodeSceneTextBoxAlignRight")
    .addEventListener("click", () => setNodeGraphTextBoxHorizontalAlignFromContext("right"));
  document
    .getElementById("nodeSceneTextBoxVerticalAlign")
    .addEventListener("input", () => setNodeGraphTextBoxVerticalAlignFromContext({ record: false }));
  document
    .getElementById("nodeSceneTextBoxVerticalAlign")
    .addEventListener("change", () => setNodeGraphTextBoxVerticalAlignFromContext({ record: true }));
  document
    .getElementById("nodeSceneCloseMenu")
    .addEventListener("click", closeNodeSceneContextMenu);
  document
    .getElementById("nodeSceneDragHandle")
    .addEventListener("pointerdown", beginNodeSceneContextMenuDrag);
}
