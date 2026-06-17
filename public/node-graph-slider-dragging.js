function syncNodeGraphPatchMetadataFromSlider(slider, options = {}) {
  const node = slider?.closest(".dsp-node")?.dataset.node;
  const key = slider?.dataset.param;
  if (!node || !key) {
    return;
  }
  const patchNode = nodeGraphMvp.patch.nodes.find((candidate) => candidate.id === node);
  if (!patchNode) {
    return;
  }
  patchNode.paramMeta = {
    ...(patchNode.paramMeta || {}),
    [key]: normalizeNodeGraphPatchParameterMetadata(
      patchNode.type,
      key,
      nodeSliderMetadata(slider),
    ),
  };
  patchNode.params = {
    ...(patchNode.params || {}),
    [key]: normalizeNodeGraphPatchParameter(
      patchNode.type,
      key,
      nodeGraphReadNodeNumber(node, key),
      patchNode.paramMeta[key],
    ),
  };
  syncNodeGraphScriptView(options.status || "metadata synced", true);
  renderNodeGraphExecutionPlanDebug();
  syncNodeGraphFilterCurveDisplays();
  scheduleNodeGraphLiveParameterSync();
  if (options.record) {
    recordNodeGraphHistory();
  } else {
    renderNodeGraphHistoryControls();
  }
}

function syncNodeGraphPatchParameterFromSlider(slider, options = {}) {
  const node = slider?.closest(".dsp-node")?.dataset.node;
  const key = slider?.dataset.param;
  if (!node || !key) {
    return;
  }
  const patchNode = nodeGraphMvp.patch.nodes.find((candidate) => candidate.id === node);
  if (!patchNode) {
    return;
  }
  patchNode.paramMeta = {
    ...(patchNode.paramMeta || {}),
    [key]: normalizeNodeGraphPatchParameterMetadata(
      patchNode.type,
      key,
      patchNode.paramMeta?.[key] || nodeSliderMetadata(slider),
    ),
  };
  patchNode.params = {
    ...(patchNode.params || {}),
    [key]: normalizeNodeGraphPatchParameter(
      patchNode.type,
      key,
      nodeGraphReadNodeNumber(node, key),
      patchNode.paramMeta[key],
    ),
  };
  if (
    nodeGraphModuleIsGraphType(patchNode.type) &&
    typeof nodeGraphGraphEndpointYLockEnabledForNode === "function" &&
    typeof nodeGraphGraphWithLockedEndpointY === "function" &&
    nodeGraphGraphEndpointYLockEnabledForNode(patchNode)
  ) {
    patchNode.graph = nodeGraphGraphWithLockedEndpointY(patchNode.graph);
  }
  if (options.deferUi) {
    return;
  }
  syncNodeGraphScriptView(options.status || "parameter synced", true);
  renderNodeGraphExecutionPlanDebug();
  syncNodeGraphGhostSliders();
  syncNodeGraphFilterCurveDisplays();
  if (nodeGraphModuleIsGraphType(patchNode.type) && typeof syncNodeGraphGraphDisplaysForNode === "function") {
    syncNodeGraphGraphDisplaysForNode(node, patchNode);
  }
  if (options.record) {
    recordNodeGraphHistory();
  } else {
    renderNodeGraphHistoryControls();
  }
}

function updateNodeSliderCurrentValue(slider, rawValue) {
  if (!slider) {
    return;
  }

  const normalizedValue = String(rawValue).trim();
  const choiceIndex = nodeSliderChoiceIndexFromText(slider, normalizedValue);
  const value = choiceIndex ?? parseNodeSliderMathExpression(normalizedValue);
  if (!Number.isFinite(value)) {
    syncNodeSliderReadout(slider);
    return;
  }

  const unboundedMin = slider.dataset.unboundedMin === "true";
  const unboundedMax = slider.dataset.unboundedMax === "true";
  const min = Number(slider.min);
  const max = Number(slider.max);
  if ((unboundedMin && Number.isFinite(min) && value < min) || (unboundedMax && Number.isFinite(max) && value > max)) {
    slider.dataset.unboundedValue = String(value);
    slider.value = String(normalizeNodeSliderValue(slider, value));
  } else {
    delete slider.dataset.unboundedValue;
    slider.value = String(normalizeNodeSliderValue(slider, value));
  }
  syncNodeSliderReadout(slider);
  syncNodeGraphPatchParameterFromSlider(slider, {
    record: true,
    status: "parameter changed",
  });
  if (nodeGraphMvp.metadataEditorTarget === slider.id) {
    fillNodeMetadataPopover(slider);
  }
  markNodeGraphRenderPending();
  scheduleNodeGraphLiveParameterSync();
}

function setNodeSliderValue(slider, value) {
  delete slider.dataset.unboundedValue;
  slider.value = String(
    normalizeNodeSliderValue(slider, value),
  );
  syncNodeSliderReadout(slider);
  syncNodeGraphPatchParameterFromSlider(slider, { deferUi: true });
  syncNodeGraphFilterCurveDisplays();
  syncNodeGraphGhostSliders();
  markNodeGraphRenderPending();
  scheduleNodeGraphLiveParameterSync();
  if (typeof scheduleNodeGraphModuleScopeDraw === "function") {
    scheduleNodeGraphModuleScopeDraw();
  }
}

function nodeSliderSegmentValueFromPointer(slider, surface, clientX) {
  const choices = parseNodeMetadataChoices(slider.dataset.choices);
  if (!choices.length) {
    return null;
  }
  const rect = surface.getBoundingClientRect();
  const width = Math.max(1, nodeSliderElementLayoutWidth(surface));
  const scale = nodeSliderElementVisualScale(surface);
  const progress = clampNodeSliderValue(((clientX - rect.left) / scale) / width, 0, 0.999999);
  const index = Math.min(choices.length - 1, Math.floor(progress * choices.length));
  return Number(slider.min) + index;
}

function setNodeChoiceSliderFromPointer(slider, surface, clientX) {
  const value = nodeSliderSegmentValueFromPointer(slider, surface, clientX);
  if (!Number.isFinite(value)) {
    return false;
  }
  setNodeSliderValue(slider, value);
  return true;
}

function updateNodeSliderDotCursor(event) {
  if (!event) {
    return;
  }
  document.body.style.setProperty("--node-slider-cursor-x", `${event.clientX}px`);
  document.body.style.setProperty("--node-slider-cursor-y", `${event.clientY}px`);
}

function syncNodeSliderHiddenMouseClass() {
  document.body.classList.toggle(
    "node-hide-mouse-while-dragging",
    Boolean(nodeGraphMvp.sliderDragging) && nodeGraphMvp.hideMouseWhileDragging !== false,
  );
}

function clearNodeSliderDotCursor() {
  document.body.classList.remove("node-hide-mouse-while-dragging");
  document.body.classList.remove("node-slider-dragging");
  document.body.style.removeProperty("--node-slider-cursor-x");
  document.body.style.removeProperty("--node-slider-cursor-y");
}

function nodeSliderValueFromPointer(slider, surface, clientX) {
  return nodeSliderValueFromPointerTravel(slider, nodeSliderTravelFromPointer(slider, surface, clientX));
}

function nodeSliderFineTuneScale(event) {
  if (event.ctrlKey && event.shiftKey) {
    return 0.001;
  }
  if (event.shiftKey) {
    return 0.01;
  }
  if (event.ctrlKey) {
    return 0.1;
  }
  return 1;
}

function nodeSliderKeyboardStep(slider, event) {
  const choices = parseNodeMetadataChoices(slider?.dataset?.choices || "");
  if (
    nodeSliderShouldDisplayChoices(slider) &&
    nodeSliderShouldDivideChoicesVisibly(slider) &&
    choices.length > 0
  ) {
    return 1;
  }
  const declaredStep = Number(slider?.dataset?.step);
  if (Number.isFinite(declaredStep) && declaredStep > 0) {
    return declaredStep * (event.shiftKey ? 10 : 1) * (event.ctrlKey || event.metaKey ? 0.1 : 1);
  }
  const min = Number(slider?.min);
  const max = Number(slider?.max);
  const range = Number.isFinite(max - min) && max > min ? max - min : 1;
  return range * (event.shiftKey ? 0.1 : 0.01) * (event.ctrlKey || event.metaKey ? 0.1 : 1);
}

function stepNodeSliderFromKeyboard(event) {
  const surface = event.currentTarget?.classList?.contains("node-slider-readout")
    ? event.currentTarget
    : event.target?.closest?.(".node-slider-readout");
  const slider = document.getElementById(surface?.dataset?.sliderTarget || "");
  if (!surface || !slider) {
    return false;
  }

  const keySteps = {
    ArrowDown: -1,
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: 1,
    PageDown: -10,
    PageUp: 10,
  };
  const min = Number(slider.min);
  const max = Number(slider.max);
  const current = Number(slider.value);
  let nextValue = current;
  if (event.key === "Home") {
    nextValue = min;
  } else if (event.key === "End") {
    nextValue = max;
  } else if (Object.hasOwn(keySteps, event.key)) {
    nextValue = current + keySteps[event.key] * nodeSliderKeyboardStep(slider, event);
  } else {
    return false;
  }

  setNodeSliderValue(slider, quantizeNodeSliderDragValue(slider, nextValue));
  syncNodeGraphPatchParameterFromSlider(slider, {
    record: true,
    status: "parameter changed",
  });
  event.preventDefault();
  event.stopPropagation();
  return true;
}

function reanchorNodeSliderDragAtPointer(drag, event) {
  drag.startTravel = nodeSliderTravelFromValue(drag.slider, Number(drag.slider.value));
  drag.startX = event.clientX;
  drag.startY = event.clientY;
}

function beginNodeSliderDrag(event) {
  if (nodeGraphMvp.sliderDragging || event.button > 0 || event.detail > 1) {
    return;
  }

  const surface = event.currentTarget?.classList?.contains("node-slider-readout")
    ? event.currentTarget
    : event.target?.closest?.(".node-slider-readout");
  if (!surface) {
    return;
  }
  const slider = document.getElementById(surface.dataset.sliderTarget);
  if (!slider) {
    return;
  }

  const lane = nodeSliderVisualLane(surface, slider);
  const resetToDefaultOnClick = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
  const pointerMode = event.altKey ? "absolute" : "relative";
  let startTravel = nodeSliderTravelFromValue(slider, Number(slider.value));
  if (pointerMode === "absolute") {
    setNodeSliderValue(
      slider,
      quantizeNodeSliderDragValue(slider, nodeSliderValueFromPointer(slider, surface, event.clientX)),
    );
    startTravel = nodeSliderTravelFromValue(slider, Number(slider.value));
  } else if (!resetToDefaultOnClick && nodeSliderShouldDisplayChoices(slider) && nodeSliderShouldDivideChoicesVisibly(slider)) {
    setNodeChoiceSliderFromPointer(slider, surface, event.clientX);
    startTravel = nodeSliderTravelFromValue(slider, Number(slider.value));
  }
  nodeGraphMvp.sliderDragging = {
    moved: false,
    pointerId: event.pointerId ?? null,
    pointerMode,
    resetToDefaultOnClick,
    slider,
    surface,
    startTravel,
    startX: event.clientX,
    startY: event.clientY,
    fineScale: nodeSliderFineTuneScale(event),
    visualScale: nodeSliderElementVisualScale(surface),
    width: lane.travelWidth,
  };
  surface.classList.add("value-dragging");
  document.body.classList.add("node-slider-dragging");
  syncNodeSliderHiddenMouseClass();
  nodeGraphWireInteractions?.clearHover?.();
  updateNodeSliderDotCursor(event);
  if (event.pointerId !== undefined) {
    surface.setPointerCapture(event.pointerId);
  }
  event.preventDefault();
  event.stopPropagation();
}

function dragNodeSlider(event) {
  const drag = nodeGraphMvp.sliderDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }

  if (drag.pointerMode === "absolute") {
    setNodeSliderValue(
      drag.slider,
      quantizeNodeSliderDragValue(
        drag.slider,
        nodeSliderValueFromPointer(drag.slider, drag.surface, event.clientX),
      ),
    );
  } else {
    const horizontalDelta = event.clientX - drag.startX;
    const verticalDelta = drag.startY - event.clientY;
    if (Math.abs(horizontalDelta) > 1 || Math.abs(verticalDelta) > 1) {
      drag.moved = true;
    }
    const visualTravelWidth = Math.max(1, drag.width * (Number(drag.visualScale) || 1));
    const travelDelta = ((horizontalDelta + verticalDelta) / visualTravelWidth) * drag.fineScale;
    const nextTravel = drag.startTravel + travelDelta;
    setNodeSliderValue(
      drag.slider,
      quantizeNodeSliderDragValue(
        drag.slider,
        nodeSliderValueFromPointerTravel(drag.slider, nextTravel),
      ),
    );
    if (nextTravel <= 0 || nextTravel >= 1) {
      reanchorNodeSliderDragAtPointer(drag, event);
    }
  }
  updateNodeSliderDotCursor(event);
  event.preventDefault();
}

function endNodeSliderDrag(event) {
  const drag = nodeGraphMvp.sliderDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }

  drag.surface.classList.remove("value-dragging");
  clearNodeSliderDotCursor();
  if (event.pointerId !== undefined && drag.surface.hasPointerCapture?.(event.pointerId)) {
    drag.surface.releasePointerCapture(event.pointerId);
  }
  if (drag.resetToDefaultOnClick && !drag.moved) {
    setNodeSliderValue(drag.slider, Number(drag.slider.dataset.default));
  }
  syncNodeGraphPatchParameterFromSlider(drag.slider, {
    record: true,
    status: drag.resetToDefaultOnClick && !drag.moved ? "parameter reset to default" : "parameter changed",
  });
  nodeGraphMvp.sliderDragging = null;
}
