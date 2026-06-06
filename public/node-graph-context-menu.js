function closeNodeSceneContextMenu() {
  const menu = document.getElementById("nodeSceneContextMenu");
  menu.hidden = true;
  if (nodeGraphMvp.moduleActionDragging?.handle) {
    nodeGraphMvp.moduleActionDragging.handle.classList.remove("dragging");
  }
  nodeGraphMvp.moduleActionDragging = null;
  nodeGraphMvp.sceneContextPoint = null;
  nodeGraphMvp.sceneContextTargetNode = null;
  nodeGraphMvp.sceneContextTargetWire = null;
}

function closeNodeScopeContextMenu() {
  const menu = document.getElementById("nodeScopeContextMenu");
  if (menu) {
    menu.hidden = true;
  }
  if (nodeGraphMvp.scopeContextDragging?.handle) {
    nodeGraphMvp.scopeContextDragging.handle.classList.remove("dragging");
  }
  nodeGraphMvp.scopeContextDragging = null;
  nodeGraphMvp.scopeContextTargetNode = null;
  renderNodeGraphSceneScopeControls();
}

function closeNodeGlobalScopeMenu() {
  const menu = document.getElementById("nodeGlobalScopeMenu");
  if (menu) {
    menu.hidden = true;
  }
  if (nodeGraphMvp.globalScopeDragging?.handle) {
    nodeGraphMvp.globalScopeDragging.handle.classList.remove("dragging");
  }
  nodeGraphMvp.globalScopeDragging = null;
  closeNodeScopeContextMenu();
  renderNodeGraphModuleScopeBrightnessControl();
}

function positionNodeSceneContextMenu(menu, x, y, remember = false) {
  const margin = 12;
  menu.hidden = false;
  const rect = menu.getBoundingClientRect();
  const left = Math.max(margin, Math.min(window.innerWidth - rect.width - margin, x));
  const top = Math.max(margin, Math.min(window.innerHeight - rect.height - margin, y));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  if (remember) {
    nodeGraphMvp.moduleActionWindowPosition = { left, top };
    syncNodeGraphPatchWindowPosition("moduleActions", { left, top });
  }
}

function positionNodeSceneContextMenuAtSavedOr(menu, x, y) {
  const savedPosition = nodeGraphMvp.moduleActionWindowPosition;
  const hasSavedPosition =
    Number.isFinite(Number(savedPosition?.left)) &&
    Number.isFinite(Number(savedPosition?.top));
  positionNodeSceneContextMenu(
    menu,
    hasSavedPosition ? savedPosition.left : x,
    hasSavedPosition ? savedPosition.top : y,
    !hasSavedPosition,
  );
}

function positionNodeScopeContextMenuAtSavedOr(menu, x, y) {
  const savedPosition = nodeGraphMvp.scopeContextWindowPosition;
  const hasSavedPosition =
    Number.isFinite(Number(savedPosition?.left)) &&
    Number.isFinite(Number(savedPosition?.top));
  positionNodeSceneContextMenu(
    menu,
    hasSavedPosition ? savedPosition.left : x,
    hasSavedPosition ? savedPosition.top : y,
    false,
  );
  if (!hasSavedPosition) {
    nodeGraphMvp.scopeContextWindowPosition = {
      left: Number.parseFloat(menu.style.left) || menu.getBoundingClientRect().left,
      top: Number.parseFloat(menu.style.top) || menu.getBoundingClientRect().top,
    };
  }
}

function positionNodeGlobalScopeMenuAtSavedOr(menu, x, y) {
  const savedPosition = nodeGraphMvp.globalScopeWindowPosition;
  const hasSavedPosition =
    Number.isFinite(Number(savedPosition?.left)) &&
    Number.isFinite(Number(savedPosition?.top));
  positionNodeSceneContextMenu(
    menu,
    hasSavedPosition ? savedPosition.left : x,
    hasSavedPosition ? savedPosition.top : y,
    false,
  );
  if (!hasSavedPosition) {
    nodeGraphMvp.globalScopeWindowPosition = {
      left: Number.parseFloat(menu.style.left) || menu.getBoundingClientRect().left,
      top: Number.parseFloat(menu.style.top) || menu.getBoundingClientRect().top,
    };
  }
}

function openNodeGlobalScopeMenu() {
  const menu = document.getElementById("nodeGlobalScopeMenu");
  const button = document.getElementById("nodeGlobalScopeMenuButton");
  if (!menu || !button) {
    return;
  }
  nodeGraphMvp.scopeContextTargetNode = null;
  const rect = button.getBoundingClientRect();
  positionNodeGlobalScopeMenuAtSavedOr(menu, rect.left, rect.bottom + 8);
  renderNodeGraphSceneScopeControls();
  renderNodeGraphModuleScopeBrightnessControl();
}

function toggleNodeGlobalScopeMenu() {
  const menu = document.getElementById("nodeGlobalScopeMenu");
  if (!menu || menu.hidden) {
    openNodeGlobalScopeMenu();
  } else {
    closeNodeGlobalScopeMenu();
  }
}

function beginNodeSceneContextMenuDrag(event) {
  if (event.button > 0) {
    return;
  }

  const menu = document.getElementById("nodeSceneContextMenu");
  if (menu.hidden) {
    return;
  }

  const rect = menu.getBoundingClientRect();
  nodeGraphMvp.moduleActionDragging = {
    handle: event.currentTarget,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    pointerId: event.pointerId ?? null,
  };
  event.currentTarget.classList.add("dragging");
  if (event.pointerId !== undefined) {
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  event.preventDefault();
}

function dragNodeSceneContextMenu(event) {
  const drag = nodeGraphMvp.moduleActionDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }

  positionNodeSceneContextMenu(
    document.getElementById("nodeSceneContextMenu"),
    event.clientX - drag.offsetX,
    event.clientY - drag.offsetY,
    true,
  );
  event.preventDefault();
}

function endNodeSceneContextMenuDrag(event) {
  const drag = nodeGraphMvp.moduleActionDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }

  drag.handle.classList.remove("dragging");
  if (event.pointerId !== undefined && drag.handle.hasPointerCapture?.(event.pointerId)) {
    drag.handle.releasePointerCapture(event.pointerId);
  }
  nodeGraphMvp.moduleActionDragging = null;
}

function beginNodeScopeContextMenuDrag(event) {
  if (event.button > 0) {
    return;
  }

  const menu = document.getElementById("nodeGlobalScopeMenu");
  if (!menu || menu.hidden) {
    return;
  }

  const rect = menu.getBoundingClientRect();
  nodeGraphMvp.scopeContextDragging = {
    handle: event.currentTarget,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    pointerId: event.pointerId ?? null,
  };
  event.currentTarget.classList.add("dragging");
  if (event.pointerId !== undefined) {
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  event.preventDefault();
  event.stopPropagation();
}

function beginNodeGlobalScopeMenuDrag(event) {
  if (event.button > 0) {
    return;
  }
  const menu = document.getElementById("nodeGlobalScopeMenu");
  if (!menu || menu.hidden) {
    return;
  }
  const rect = menu.getBoundingClientRect();
  nodeGraphMvp.globalScopeDragging = {
    handle: event.currentTarget,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    pointerId: event.pointerId ?? null,
  };
  event.currentTarget.classList.add("dragging");
  if (event.pointerId !== undefined) {
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  event.preventDefault();
  event.stopPropagation();
}

function dragNodeGlobalScopeMenu(event) {
  const drag = nodeGraphMvp.globalScopeDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }
  const menu = document.getElementById("nodeGlobalScopeMenu");
  positionNodeSceneContextMenu(
    menu,
    event.clientX - drag.offsetX,
    event.clientY - drag.offsetY,
    false,
  );
  nodeGraphMvp.globalScopeWindowPosition = {
    left: Number.parseFloat(menu.style.left) || menu.getBoundingClientRect().left,
    top: Number.parseFloat(menu.style.top) || menu.getBoundingClientRect().top,
  };
  event.preventDefault();
}

function endNodeGlobalScopeMenuDrag(event) {
  const drag = nodeGraphMvp.globalScopeDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }
  drag.handle.classList.remove("dragging");
  if (event.pointerId !== undefined && drag.handle.hasPointerCapture?.(event.pointerId)) {
    drag.handle.releasePointerCapture(event.pointerId);
  }
  nodeGraphMvp.globalScopeDragging = null;
}

function dragNodeScopeContextMenu(event) {
  const drag = nodeGraphMvp.scopeContextDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }

  const menu = document.getElementById("nodeScopeContextMenu");
  positionNodeSceneContextMenu(
    menu,
    event.clientX - drag.offsetX,
    event.clientY - drag.offsetY,
    false,
  );
  nodeGraphMvp.scopeContextWindowPosition = {
    left: Number.parseFloat(menu.style.left) || menu.getBoundingClientRect().left,
    top: Number.parseFloat(menu.style.top) || menu.getBoundingClientRect().top,
  };
  event.preventDefault();
}

function endNodeScopeContextMenuDrag(event) {
  const drag = nodeGraphMvp.scopeContextDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }

  drag.handle.classList.remove("dragging");
  if (event.pointerId !== undefined && drag.handle.hasPointerCapture?.(event.pointerId)) {
    drag.handle.releasePointerCapture(event.pointerId);
  }
  nodeGraphMvp.scopeContextDragging = null;
}

function configureNodeSceneContextMenu(mode) {
  const menu = document.getElementById("nodeSceneContextMenu");
  const title = menu.querySelector(".scene-context-title");
  const copyButton = document.getElementById("nodeSceneCopyModule");
  const addToGroupButton = document.getElementById("nodeSceneAddToGroup");
  const addToUiButton = document.getElementById("nodeSceneAddToUi");
  const deleteButton = document.getElementById("nodeSceneDeleteModule");
  const closeButton = document.getElementById("nodeSceneCloseMenu");
  const selectedModule = document.getElementById("nodeSceneSelectedModule");
  const wireTypeControl = document.getElementById("nodeSceneWireTypeControl");
  const wireTypeButtons = [...wireTypeControl.querySelectorAll("[data-wire-type]")];
  const aliasControl = document.getElementById("nodeSceneAliasControl");
  const aliasInput = document.getElementById("nodeSceneAliasInput");
  const widthControls = document.getElementById("nodeSceneWidthControls");
  const widthDecrease = document.getElementById("nodeSceneWidthDecrease");
  const widthIncrease = document.getElementById("nodeSceneWidthIncrease");
  const widthValue = document.getElementById("nodeSceneWidthValue");
  const textBoxHeightControls = document.getElementById("nodeSceneTextBoxHeightControls");
  const textBoxHeightDecrease = document.getElementById("nodeSceneTextBoxHeightDecrease");
  const textBoxHeightIncrease = document.getElementById("nodeSceneTextBoxHeightIncrease");
  const textBoxHeightValue = document.getElementById("nodeSceneTextBoxHeightValue");
  const textBoxTextSizeControls = document.getElementById("nodeSceneTextBoxTextSizeControls");
  const textBoxTextSizeDecrease = document.getElementById("nodeSceneTextBoxTextSizeDecrease");
  const textBoxTextSizeIncrease = document.getElementById("nodeSceneTextBoxTextSizeIncrease");
  const textBoxTextSizeValue = document.getElementById("nodeSceneTextBoxTextSizeValue");
  const textBoxTextControls = document.getElementById("nodeSceneTextBoxTextControls");
  const textBoxTextInput = document.getElementById("nodeSceneTextBoxTextInput");
  const codeblockControls = document.getElementById("nodeSceneCodeblockControls");
  const codeblockInputs = document.getElementById("nodeSceneCodeblockInputs");
  const codeblockOutputs = document.getElementById("nodeSceneCodeblockOutputs");
  const codeblockSource = document.getElementById("nodeSceneCodeblockSource");
  const codeblockStatus = document.getElementById("nodeSceneCodeblockStatus");
  const graphControls = document.getElementById("nodeSceneGraphControls");
  const graphCursorX = document.getElementById("nodeSceneGraphCursorX");
  const graphNodeIndex = document.getElementById("nodeSceneGraphNodeIndex");
  const graphPreviousNode = document.getElementById("nodeSceneGraphPreviousNode");
  const graphNextNode = document.getElementById("nodeSceneGraphNextNode");
  const graphNodeX = document.getElementById("nodeSceneGraphNodeX");
  const graphNodeY = document.getElementById("nodeSceneGraphNodeY");
  const graphNodeContour = document.getElementById("nodeSceneGraphNodeContour");
  const graphNodeShape = document.getElementById("nodeSceneGraphNodeShape");
  const graphNodeList = document.getElementById("nodeSceneGraphNodeList");
  const graphRemoveNode = document.getElementById("nodeSceneGraphRemoveNode");
  const graphHeightControls = document.getElementById("nodeSceneGraphHeightControls");
  const graphHeightDecrease = document.getElementById("nodeSceneGraphHeightDecrease");
  const graphHeightIncrease = document.getElementById("nodeSceneGraphHeightIncrease");
  const graphHeightValue = document.getElementById("nodeSceneGraphHeightValue");
  const toggleButtonsButton = document.getElementById("nodeSceneToggleButtons");
  const toggleTitleButton = document.getElementById("nodeSceneToggleTitle");
  const imageControls = document.getElementById("nodeSceneImageControls");
  const imageLoad = document.getElementById("nodeSceneImageLoad");
  const imageSave = document.getElementById("nodeSceneImageSave");
  const imageRefresh = document.getElementById("nodeSceneImageRefresh");
  const ledControls = document.getElementById("nodeSceneLedControls");
  const ledColor = document.getElementById("nodeSceneLedColor");
  const textBoxControls = document.getElementById("nodeSceneTextBoxControls");
  const textBoxSingleLine = document.getElementById("nodeSceneTextBoxSingleLine");
  const textBoxMultiline = document.getElementById("nodeSceneTextBoxMultiline");
  const textBoxHorizontalAlignControls = document.getElementById("nodeSceneTextBoxHorizontalAlignControls");
  const textBoxAlignLeft = document.getElementById("nodeSceneTextBoxAlignLeft");
  const textBoxAlignCenter = document.getElementById("nodeSceneTextBoxAlignCenter");
  const textBoxAlignRight = document.getElementById("nodeSceneTextBoxAlignRight");
  const textBoxVerticalAlignControls = document.getElementById("nodeSceneTextBoxVerticalAlignControls");
  const textBoxVerticalAlign = document.getElementById("nodeSceneTextBoxVerticalAlign");
  const textBoxVerticalAlignValue = document.getElementById("nodeSceneTextBoxVerticalAlignValue");
  const moduleMode = mode === "module";
  const wireMode = mode === "wire";
  menu.dataset.mode = mode;
  const targetNodeId = moduleMode ? nodeGraphModuleActionTargetNodeId() : null;
  if (targetNodeId) {
    nodeGraphMvp.sceneContextTargetNode = targetNodeId;
  }
  const targetNode = targetNodeId ? nodeGraphPatchNode(targetNodeId) : null;
  const selectedNodeIds = nodeGraphSelectedNodeIds();
  const selectedWire = wireMode ? nodeGraphWireFromSelection(nodeGraphMvp.selected) : null;
  const canDelete = wireMode
    ? Boolean(selectedWire)
    : moduleMode && (
      targetNode
        ? nodeGraphNodeCanBeDeleted(targetNode)
        : [...selectedNodeIds].some((id) => {
          const node = nodeGraphPatchNode(id);
          return nodeGraphMvp.activeNodes.has(id) && nodeGraphNodeCanBeDeleted(node);
        })
    );
  const canCopy = moduleMode && targetNode?.type !== "output";
  const canGroup = moduleMode && nodeGraphModuleGroupSelection().length > 0;
  const widthGu = targetNode ? nodeGraphPatchNodeGridWidthUnits(targetNode) : 0;
  const heightGu = targetNode ? nodeGraphPatchNodeGridHeightUnits(targetNode) : 0;
  const targetNodeUi = normalizeNodeGraphPatchNodeUi(targetNode?.ui);
  const buttonsHidden = targetNodeUi.buttonsHidden || nodeGraphMvp.moduleButtonsVisible === false;
  const titleHidden = targetNodeUi.titleHidden;
  const textBoxLayout = normalizeNodeGraphTextBoxLayout(targetNode?.layout);
  const textBoxMode = textBoxLayout.textMode;
  title.textContent = wireMode ? "WIRE ACTIONS" : "ACTIONS";
  menu.setAttribute("aria-label", wireMode ? "Wire actions" : "Module actions");
  copyButton.hidden = !moduleMode;
  addToGroupButton.hidden = !moduleMode;
  if (addToUiButton) {
    addToUiButton.hidden = !(moduleMode && targetNode?.type === "graph");
  }
  deleteButton.hidden = !(moduleMode || wireMode);
  selectedModule.hidden = !(moduleMode || wireMode);
  wireTypeControl.hidden = !wireMode;
  aliasControl.hidden = !moduleMode;
  widthControls.hidden = !moduleMode;
  const canResizeHeight = moduleMode && ["graph", "textBox", "valueSlider"].includes(targetNode?.type);
  textBoxHeightControls.hidden = !canResizeHeight || targetNode?.type === "graph";
  graphHeightControls.hidden = !(moduleMode && targetNode?.type === "graph");
  textBoxTextSizeControls.hidden = !(moduleMode && targetNode?.type === "textBox");
  textBoxTextControls.hidden = !(moduleMode && targetNode?.type === "textBox");
  codeblockControls.hidden = !(moduleMode && targetNode?.type === "codeblock");
  graphControls.hidden = !(moduleMode && targetNode?.type === "graph");
  toggleButtonsButton.hidden = !moduleMode;
  toggleTitleButton.hidden = !moduleMode;
  imageControls.hidden = !(moduleMode && targetNode?.type === "image");
  ledControls.hidden = !(moduleMode && targetNode?.type === "led");
  textBoxControls.hidden = !(moduleMode && targetNode?.type === "textBox");
  textBoxHorizontalAlignControls.hidden = !(moduleMode && targetNode?.type === "textBox");
  textBoxVerticalAlignControls.hidden = !(moduleMode && targetNode?.type === "textBox");
  closeButton.hidden = false;
  if (moduleMode) {
    selectedModule.querySelector("span").textContent = selectedNodeIds.size > 1 ? "selected modules" : "selected module";
    selectedModule.querySelector("strong").textContent = targetNode
      ? `${nodeGraphNodeDisplayName(targetNode.id)} (${targetNode.id})`
      : selectedNodeIds.size > 1
        ? `${selectedNodeIds.size} modules`
        : "none";
    aliasInput.disabled = !targetNode;
    aliasInput.value = targetNode ? normalizeNodeGraphPatchNodeAlias(targetNode.alias) : "";
    aliasInput.placeholder = targetNode ? nodeGraphDefaultNodeTitle(targetNode.type, targetNode.id) : "module title alias";
    aliasInput.title = nodeGraphTooltipText("actions.moduleAlias");
    copyButton.disabled = !canCopy;
    copyButton.title = canCopy
      ? nodeGraphTooltipText("actions.copyModule")
      : targetNode
        ? nodeGraphTooltipText("actions.copyUnavailableOutput")
        : nodeGraphTooltipText("actions.copyUnavailableOneModule");
    addToGroupButton.disabled = !canGroup;
    addToGroupButton.title = canGroup
      ? "Save the selected circuit as a reusable group preset."
      : "Select one or more modules to save a group.";
    if (addToUiButton) {
      const canAddToUi = targetNode?.type === "graph";
      const uiItems = normalizeNodeGraphPatchUiItems(nodeGraphMvp.patch.uiItems);
      const alreadyAddedToUi = canAddToUi && uiItems.some((item) => item.sourceNodeId === targetNode.id);
      addToUiButton.disabled = !canAddToUi;
      addToUiButton.querySelector("span").textContent = alreadyAddedToUi ? "Open UI Graph" : "Add Graph UI";
      addToUiButton.title = alreadyAddedToUi
        ? "Open this graph's UI editor."
        : "Add this graph as a large editor in the UI view.";
    }
    deleteButton.disabled = !canDelete;
    deleteButton.title = canDelete
      ? nodeGraphTooltipText("actions.deleteModule")
      : targetNode
        ? nodeGraphTooltipText("actions.deleteUnavailableOutput")
        : nodeGraphTooltipText("actions.deleteUnavailableOneModule");
    widthValue.textContent = `${widthGu} gu`;
    widthDecrease.disabled = !targetNode || widthGu <= nodeGraphModuleWidthLimits.minGu;
    widthDecrease.title = nodeGraphTooltipText("actions.widthDecrease");
    widthIncrease.disabled = !targetNode || widthGu >= nodeGraphModuleWidthLimits.maxGu;
    widthIncrease.title = nodeGraphTooltipText("actions.widthIncrease");
    textBoxHeightValue.textContent = targetNode?.type === "graph" ? `${heightGu} height gu` : `${heightGu} gu high`;
    textBoxHeightDecrease.disabled = !canResizeHeight || heightGu <= nodeGraphModuleHeightLimits.minGu;
    textBoxHeightDecrease.title = nodeGraphTooltipText("actions.textBoxHeightDecrease");
    textBoxHeightIncrease.disabled = !canResizeHeight || heightGu >= nodeGraphModuleHeightLimits.maxGu;
    textBoxHeightIncrease.title = nodeGraphTooltipText("actions.textBoxHeightIncrease");
    graphHeightValue.textContent = `${heightGu} height gu`;
    graphHeightDecrease.disabled = !targetNode || targetNode.type !== "graph" || heightGu <= nodeGraphModuleHeightLimits.minGu;
    graphHeightDecrease.title = "Make this graph module one grid unit shorter.";
    graphHeightIncrease.disabled = !targetNode || targetNode.type !== "graph" || heightGu >= nodeGraphModuleHeightLimits.maxGu;
    graphHeightIncrease.title = "Make this graph module one grid unit taller.";
    textBoxTextSizeValue.textContent = `${textBoxLayout.textSizePercent}% text`;
    textBoxTextSizeDecrease.disabled =
      !targetNode ||
      targetNode.type !== "textBox" ||
      textBoxLayout.textSizePercent <= nodeGraphTextBoxTextSizeLimits.minPercent;
    textBoxTextSizeDecrease.title = nodeGraphTooltipText("actions.textBoxTextSizeDecrease");
    textBoxTextSizeIncrease.disabled =
      !targetNode ||
      targetNode.type !== "textBox" ||
      textBoxLayout.textSizePercent >= nodeGraphTextBoxTextSizeLimits.maxPercent;
    textBoxTextSizeIncrease.title = nodeGraphTooltipText("actions.textBoxTextSizeIncrease");
    toggleButtonsButton.disabled = !targetNode;
    toggleButtonsButton.querySelector("span").textContent = buttonsHidden ? "Show buttons" : "Hide buttons";
    toggleButtonsButton.setAttribute("aria-pressed", buttonsHidden ? "true" : "false");
    toggleButtonsButton.title = nodeGraphTooltipText(buttonsHidden ? "actions.showModuleButtons" : "actions.hideModuleButtons");
    toggleTitleButton.disabled = !targetNode;
    toggleTitleButton.querySelector("span").textContent = titleHidden ? "Show title" : "Hide title";
    toggleTitleButton.setAttribute("aria-pressed", titleHidden ? "true" : "false");
    toggleTitleButton.title = nodeGraphTooltipText(titleHidden ? "actions.showModuleTitle" : "actions.hideModuleTitle");
    if (targetNode?.type === "image") {
      const imageLayout = normalizeNodeGraphImageLayout(targetNode.layout);
      imageLoad.disabled = false;
      imageSave.disabled = !imageLayout.dataUrl;
      imageRefresh.disabled = false;
      imageLoad.title = "Load an image into this patch-local image node.";
      imageSave.title = imageLayout.dataUrl ? "Save this image node's current image." : "Load an image before saving.";
      imageRefresh.title = "Refresh image preview and trace texture.";
    }
    if (targetNode?.type === "led") {
      const led = normalizeNodeGraphLedLayout(targetNode.led);
      ledColor.disabled = false;
      ledColor.value = led.color;
      ledColor.title = "Set this LED's outer rim color. The center uses the bright white dot layer.";
    } else {
      ledColor.disabled = true;
      ledColor.value = nodeGraphLedDefaultColor;
    }
    textBoxSingleLine.setAttribute("aria-pressed", textBoxMode === "singleLine" ? "true" : "false");
    textBoxMultiline.setAttribute("aria-pressed", textBoxMode === "multiline" ? "true" : "false");
    textBoxSingleLine.title = nodeGraphTooltipText("actions.textBoxSingleLine");
    textBoxMultiline.title = nodeGraphTooltipText("actions.textBoxMultiline");
    textBoxTextInput.disabled = !targetNode || targetNode.type !== "textBox";
    textBoxTextInput.value = targetNode?.type === "textBox" ? textBoxLayout.text : "";
    textBoxTextInput.title = nodeGraphTooltipText("actions.textBoxContent");
    if (targetNode?.type === "codeblock") {
      const codeblock = normalizeNodeGraphCodeblock(targetNode.codeblock);
      codeblockInputs.value = codeblock.inputs.join(", ");
      codeblockOutputs.value = codeblock.outputs.join(", ");
      codeblockSource.value = codeblock.code;
      const status = nodeGraphCodeblockCompileStatus(codeblock);
      codeblockStatus.textContent = status.ok ? "code ok" : `compile error: ${status.message}`;
    } else {
      codeblockInputs.value = "";
      codeblockOutputs.value = "";
      codeblockSource.value = "";
      codeblockStatus.textContent = "";
    }
    if (targetNode?.type === "graph") {
      syncNodeGraphGraphControls(targetNode.graph);
      graphCursorX.disabled = false;
      graphNodeIndex.disabled = false;
      graphPreviousNode.disabled = false;
      graphNextNode.disabled = false;
      graphNodeX.disabled = false;
      graphNodeY.disabled = false;
      graphNodeContour.disabled = false;
      graphNodeShape.disabled = false;
      graphCursorX.title = "Move the vertical graph cursor.";
      graphNodeIndex.title = "Choose the graph node to edit.";
      graphPreviousNode.title = "Select the previous graph node.";
      graphNextNode.title = "Select the next graph node.";
      graphNodeX.title = "Set the selected node's x position.";
      graphNodeY.title = "Set the selected node's y value.";
      graphNodeContour.title = "Bend the selected node's outgoing segment.";
      graphNodeShape.title = "Choose the selected node's outgoing curve shape.";
    } else {
      graphCursorX.value = "";
      graphNodeIndex.replaceChildren();
      graphNodeList.replaceChildren();
      graphNodeX.value = "";
      graphNodeY.value = "";
      graphNodeContour.value = "";
      graphNodeShape.value = "rational";
      graphCursorX.disabled = true;
      graphNodeIndex.disabled = true;
      graphPreviousNode.disabled = true;
      graphNextNode.disabled = true;
      graphNodeX.disabled = true;
      graphNodeY.disabled = true;
      graphNodeContour.disabled = true;
      graphNodeShape.disabled = true;
      graphRemoveNode.disabled = true;
    }
    textBoxAlignLeft.setAttribute("aria-pressed", textBoxLayout.horizontalAlign === "left" ? "true" : "false");
    textBoxAlignCenter.setAttribute("aria-pressed", textBoxLayout.horizontalAlign === "center" ? "true" : "false");
    textBoxAlignRight.setAttribute("aria-pressed", textBoxLayout.horizontalAlign === "right" ? "true" : "false");
    textBoxVerticalAlign.disabled = !targetNode || targetNode.type !== "textBox";
    textBoxVerticalAlign.value = String(textBoxLayout.verticalAlignPercent);
    textBoxVerticalAlignValue.textContent = `${textBoxLayout.verticalAlignPercent}%`;
    textBoxVerticalAlign.title = nodeGraphTooltipText("actions.textBoxVerticalPosition");
    textBoxAlignLeft.title = nodeGraphTooltipText("actions.textBoxAlignLeft");
    textBoxAlignCenter.title = nodeGraphTooltipText("actions.textBoxAlignCenter");
    textBoxAlignRight.title = nodeGraphTooltipText("actions.textBoxAlignRight");
  } else if (wireMode) {
    selectedModule.querySelector("span").textContent = selectedWire?.kind === "modulation"
      ? "selected modulation"
      : "selected wire";
    selectedModule.querySelector("strong").textContent = nodeGraphWireSelectionLabel(nodeGraphMvp.selected);
    const selectedWireType = normalizeNodeGraphWireType(selectedWire?.wire?.wireType);
    for (const button of wireTypeButtons) {
      button.disabled = !selectedWire;
      button.setAttribute("aria-pressed", button.dataset.wireType === selectedWireType ? "true" : "false");
      button.title = nodeGraphTooltipText(`actions.wireType.${button.dataset.wireType}`);
    }
    deleteButton.disabled = !canDelete;
    deleteButton.title = canDelete
      ? nodeGraphTooltipText("actions.deleteWire")
      : nodeGraphTooltipText("actions.deleteWireMissing");
    copyButton.disabled = true;
    copyButton.title = nodeGraphTooltipText("actions.copyUnavailableWire");
    addToGroupButton.disabled = true;
    if (addToUiButton) {
      addToUiButton.disabled = true;
      addToUiButton.querySelector("span").textContent = "";
    }
    widthValue.textContent = "";
    widthDecrease.disabled = true;
    widthIncrease.disabled = true;
    textBoxHeightValue.textContent = "";
    textBoxHeightDecrease.disabled = true;
    textBoxHeightIncrease.disabled = true;
    textBoxTextSizeValue.textContent = "";
    textBoxTextSizeDecrease.disabled = true;
    textBoxTextSizeIncrease.disabled = true;
    textBoxTextInput.value = "";
    textBoxTextInput.disabled = true;
    codeblockInputs.value = "";
    codeblockOutputs.value = "";
    codeblockSource.value = "";
    codeblockStatus.textContent = "";
    graphCursorX.value = "";
    graphNodeIndex.replaceChildren();
    graphNodeList.replaceChildren();
    graphNodeX.value = "";
    graphNodeY.value = "";
    graphNodeContour.value = "";
    graphNodeShape.value = "rational";
    graphCursorX.disabled = true;
    graphNodeIndex.disabled = true;
    graphNodeX.disabled = true;
    graphNodeY.disabled = true;
    graphNodeContour.disabled = true;
    graphNodeShape.disabled = true;
    graphRemoveNode.disabled = true;
    textBoxVerticalAlign.value = "50";
    textBoxVerticalAlignValue.textContent = "";
    textBoxVerticalAlign.disabled = true;
    toggleButtonsButton.disabled = true;
    toggleTitleButton.disabled = true;
    imageLoad.disabled = true;
    imageSave.disabled = true;
    imageRefresh.disabled = true;
    ledColor.disabled = true;
    ledColor.value = nodeGraphLedDefaultColor;
  } else {
    selectedModule.querySelector("span").textContent = "selected";
    selectedModule.querySelector("strong").textContent = "none";
    for (const button of wireTypeButtons) {
      button.disabled = true;
      button.setAttribute("aria-pressed", "false");
    }
    copyButton.disabled = true;
    copyButton.title = nodeGraphTooltipText("actions.copyUnavailableModule");
    addToGroupButton.disabled = true;
    if (addToUiButton) {
      addToUiButton.disabled = true;
      addToUiButton.querySelector("span").textContent = "";
    }
    deleteButton.disabled = true;
    deleteButton.title = nodeGraphTooltipText("actions.deleteTitle");
    widthValue.textContent = "";
    widthDecrease.disabled = true;
    widthIncrease.disabled = true;
    textBoxHeightValue.textContent = "";
    textBoxHeightDecrease.disabled = true;
    textBoxHeightIncrease.disabled = true;
    textBoxTextSizeValue.textContent = "";
    textBoxTextSizeDecrease.disabled = true;
    textBoxTextSizeIncrease.disabled = true;
    textBoxTextInput.value = "";
    textBoxTextInput.disabled = true;
    codeblockInputs.value = "";
    codeblockOutputs.value = "";
    codeblockSource.value = "";
    codeblockStatus.textContent = "";
    graphCursorX.value = "";
    graphNodeIndex.replaceChildren();
    graphNodeList.replaceChildren();
    graphNodeX.value = "";
    graphNodeY.value = "";
    graphNodeContour.value = "";
    graphNodeShape.value = "rational";
    graphCursorX.disabled = true;
    graphNodeIndex.disabled = true;
    graphNodeX.disabled = true;
    graphNodeY.disabled = true;
    graphNodeContour.disabled = true;
    graphNodeShape.disabled = true;
    graphRemoveNode.disabled = true;
    textBoxVerticalAlign.value = "50";
    textBoxVerticalAlignValue.textContent = "";
    textBoxVerticalAlign.disabled = true;
    toggleButtonsButton.disabled = true;
    toggleTitleButton.disabled = true;
    imageLoad.disabled = true;
    imageSave.disabled = true;
    imageRefresh.disabled = true;
    ledColor.disabled = true;
    ledColor.value = nodeGraphLedDefaultColor;
  }
}

function openNodeModuleActionMenu(event) {
  const button = event.currentTarget;
  const node = button.closest(".dsp-node");
  if (!node) {
    return;
  }

  nodeGraphMvp.sceneContextPoint = null;
  closeNodeScopeContextMenu();
  nodeGraphMvp.sceneContextTargetNode = node.dataset.node;
  nodeGraphMvp.sceneContextTargetWire = null;
  configureNodeSceneContextMenu("module");
  const rect = button.getBoundingClientRect();
  positionNodeSceneContextMenuAtSavedOr(
    document.getElementById("nodeSceneContextMenu"),
    rect.right,
    rect.bottom,
  );
  event.preventDefault();
  event.stopPropagation();
}

function openNodeScopeContextMenu(event) {
  const contextScope = event.target.closest?.(".node-module-scope-window, .node-led-face");
  const nodeId = contextScope?.dataset?.node || "";
  if (!nodeId || !nodeGraphPatchNode(nodeId)) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  closeNodeSceneContextMenu();
  nodeGraphMvp.sceneContextPoint = null;
  nodeGraphMvp.sceneContextTargetNode = null;
  nodeGraphMvp.sceneContextTargetWire = null;
  nodeGraphMvp.scopeContextTargetNode = nodeId;
  if (typeof openNodeGraphScopeShaderScript === "function" && openNodeGraphScopeShaderScript(nodeId)) {
    return true;
  }
  renderNodeGraphSceneScopeControls(nodeId);
  positionNodeGlobalScopeMenuAtSavedOr(
    document.getElementById("nodeGlobalScopeMenu"),
    event.clientX,
    event.clientY,
  );
  renderNodeGraphModuleScopeBrightnessControl();
  return true;
}

function openNodeSceneContextMenu(event) {
  if (openNodeScopeContextMenu(event)) {
    return;
  }

  closeNodeScopeContextMenu();
  const contextWire = event.target.closest?.(".node-wire-hit-path, .node-wire-path");
  if (contextWire) {
    const index = Number(contextWire.dataset.connectionIndex);
    const kind = contextWire.dataset.connectionKind || "signal";
    if (Number.isFinite(index)) {
      event.preventDefault();
      event.stopPropagation();
      setNodeGraphSelection({ type: "wire", kind, index });
      nodeGraphMvp.sceneContextPoint = null;
      nodeGraphMvp.sceneContextTargetNode = null;
      nodeGraphMvp.sceneContextTargetWire = { index, kind };
      configureNodeSceneContextMenu("wire");
      positionNodeSceneContextMenuAtSavedOr(
        document.getElementById("nodeSceneContextMenu"),
        event.clientX,
        event.clientY,
      );
    }
    return;
  }

  const contextNode = event.target.closest(".dsp-node");
  if (contextNode) {
    event.preventDefault();
    event.stopPropagation();
    nodeGraphMvp.sceneContextPoint = null;
    nodeGraphMvp.sceneContextTargetNode = contextNode.dataset.node;
    nodeGraphMvp.sceneContextTargetWire = null;
    configureNodeSceneContextMenu("module");
    positionNodeSceneContextMenuAtSavedOr(
      document.getElementById("nodeSceneContextMenu"),
      event.clientX,
      event.clientY,
    );
    return;
  }
  if (event.target.closest(".node-port, .node-param-port, .node-slider-readout")) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const shopPoint = nodeGraphClientPoint(event);
  nodeGraphMvp.sceneContextPoint = shopPoint;
  nodeGraphMvp.sceneContextTargetNode = null;
  nodeGraphMvp.sceneContextTargetWire = null;
  openNodeGraphModuleShop(shopPoint);
}
