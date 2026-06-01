function bindNodeGraphSceneMenuEvents() {
  for (const button of document.querySelectorAll("[data-context-module]")) {
    button.addEventListener("click", addNodeGraphModuleFromContext);
  }
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
    .getElementById("nodeSceneWidthDecrease")
    .addEventListener("click", () => adjustNodeGraphModuleWidthFromContext(-1));
  document
    .getElementById("nodeSceneWidthIncrease")
    .addEventListener("click", () => adjustNodeGraphModuleWidthFromContext(1));
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
