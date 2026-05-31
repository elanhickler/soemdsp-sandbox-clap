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
  if (options.deferUi) {
    return;
  }
  syncNodeGraphScriptView(options.status || "parameter synced", true);
  renderNodeGraphExecutionPlanDebug();
  syncNodeGraphGhostSliders();
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
  const value = choiceIndex ?? Number(normalizedValue);
  if (!Number.isFinite(value)) {
    syncNodeSliderReadout(slider);
    return;
  }

  slider.value = String(normalizeNodeSliderValue(slider, value));
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
  slider.value = String(
    normalizeNodeSliderValue(slider, value),
  );
  syncNodeSliderReadout(slider);
  syncNodeGraphPatchParameterFromSlider(slider, { deferUi: true });
  syncNodeGraphGhostSliders();
  markNodeGraphRenderPending();
  scheduleNodeGraphLiveParameterSync();
}

function nodeSliderSegmentValueFromPointer(slider, surface, clientX) {
  const choices = parseNodeMetadataChoices(slider.dataset.choices);
  if (!choices.length) {
    return null;
  }
  const rect = surface.getBoundingClientRect();
  const progress = clampNodeSliderValue((clientX - rect.left) / Math.max(1, rect.width), 0, 0.999999);
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

function clearNodeSliderDotCursor() {
  document.body.classList.remove("node-slider-dragging");
  document.body.style.removeProperty("--node-slider-cursor-x");
  document.body.style.removeProperty("--node-slider-cursor-y");
}

function nodeSliderValueFromPointer(slider, surface, clientX) {
  const rect = surface.getBoundingClientRect();
  const travel = clampNodeSliderValue(
    (clientX - rect.left) / Math.max(1, rect.width),
    0,
    1,
  );
  return nodeSliderValueFromTravel(slider, travel);
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

function beginNodeSliderDrag(event) {
  if (nodeGraphMvp.sliderDragging || event.button > 0 || event.detail > 1) {
    return;
  }

  const surface = event.currentTarget;
  const slider = document.getElementById(surface.dataset.sliderTarget);
  if (!slider) {
    return;
  }

  const rect = surface.getBoundingClientRect();
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
    width: Math.max(1, rect.width),
  };
  surface.classList.add("value-dragging");
  document.body.classList.add("node-slider-dragging");
  updateNodeSliderDotCursor(event);
  if (event.pointerId !== undefined) {
    surface.setPointerCapture(event.pointerId);
  }
  event.preventDefault();
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
    const travelDelta = ((horizontalDelta + verticalDelta) / drag.width) * drag.fineScale;
    setNodeSliderValue(
      drag.slider,
      quantizeNodeSliderDragValue(
        drag.slider,
        nodeSliderValueFromTravel(drag.slider, drag.startTravel + travelDelta),
      ),
    );
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
