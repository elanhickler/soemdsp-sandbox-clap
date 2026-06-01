function positionNodeMetadataPopover(popover, x, y, remember = false) {
  const margin = 12;
  popover.hidden = false;
  const rect = popover.getBoundingClientRect();
  const left = Math.max(margin, Math.min(window.innerWidth - rect.width - margin, x));
  const top = Math.max(margin, Math.min(window.innerHeight - rect.height - margin, y));
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  if (remember) {
    nodeGraphMvp.metadataPopoverPosition = { left, top };
    syncNodeGraphPatchWindowPosition("metadata", { left, top });
  }
}

function syncNodeGraphPatchWindowPosition(key, position) {
  const normalizedPosition = normalizeNodeGraphWindowPosition(position);
  if (key === "metadata") {
    nodeGraphMvp.metadataPopoverPosition = normalizedPosition;
  } else if (key === "moduleActions") {
    nodeGraphMvp.moduleActionWindowPosition = normalizedPosition;
  }
}

function beginNodeMetadataPopoverDrag(event) {
  if (event.button > 0) {
    return;
  }

  const popover = document.getElementById("nodeParameterMetadataPopover");
  if (popover.hidden) {
    return;
  }

  const rect = popover.getBoundingClientRect();
  nodeGraphMvp.metadataDragging = {
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

function dragNodeMetadataPopover(event) {
  const drag = nodeGraphMvp.metadataDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }

  positionNodeMetadataPopover(
    document.getElementById("nodeParameterMetadataPopover"),
    event.clientX - drag.offsetX,
    event.clientY - drag.offsetY,
    true,
  );
  event.preventDefault();
}

function endNodeMetadataPopoverDrag(event) {
  const drag = nodeGraphMvp.metadataDragging;
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
  nodeGraphMvp.metadataDragging = null;
}

function fillNodeMetadataPopover(slider) {
  populateNodeMetadataKindChoices();
  const metadata = nodeSliderMetadata(slider);
  document.getElementById("metadataPopoverTitle").textContent = nodeSliderDebugPath(slider);
  document.getElementById("metadataMinValue").value = formatNodeSliderCompactNumber(metadata.min);
  document.getElementById("metadataMidValue").value = formatNodeSliderCompactNumber(metadata.mid);
  document.getElementById("metadataMaxValue").value = formatNodeSliderCompactNumber(metadata.max);
  document.getElementById("metadataDefaultValue").value =
    formatNodeSliderCompactNumber(metadata.def);
  document.getElementById("metadataStepValue").value = formatNodeMetadataStep(metadata.step);
  document.getElementById("metadataMaxDigitsValue").value =
    String(normalizeNodeGraphMetadataMaxDigits(metadata.maxDigits, metadata.kind));
  document.getElementById("metadataKindValue").value = normalizeNodeMetadataKind(metadata.kind);
  document.getElementById("metadataUnitValue").value = metadata.unit;
  document.getElementById("metadataChoicesValue").value =
    formatNodeMetadataChoices(metadata.choices);
  document.getElementById("metadataDisplayChoicesValue").checked = metadata.displayChoices;
  document.getElementById("metadataDivideChoicesValue").checked = metadata.divideChoicesVisibly;
  document.getElementById("metadataLinearSmoothingValue").checked = metadata.linearSmoothing;
  document.getElementById("metadataNonlinearSliderValue").checked = metadata.nonlinearSlider;
  document.getElementById("metadataShowSignValue").checked = metadata.showSign;
  document.getElementById("metadataWraparoundValue").checked = metadata.wraparound;
  syncNodeMetadataMidVisibility();
  document.getElementById("metadataSetDefaultButton").classList.remove("armed");
}

function openNodeMetadataPopover(event, readout) {
  event.preventDefault();
  event.stopPropagation();
  const slider = document.getElementById(readout.dataset.sliderTarget);
  if (!slider) {
    return;
  }

  nodeGraphMvp.metadataEditorTarget = slider.id;
  fillNodeMetadataPopover(slider);
  const savedPosition = nodeGraphMvp.metadataPopoverPosition;
  positionNodeMetadataPopover(
    document.getElementById("nodeParameterMetadataPopover"),
    savedPosition?.left ?? event.clientX,
    savedPosition?.top ?? event.clientY,
  );
}

function closeNodeMetadataPopover() {
  const popover = document.getElementById("nodeParameterMetadataPopover");
  popover.hidden = true;
  if (nodeGraphMvp.metadataDragging?.handle) {
    nodeGraphMvp.metadataDragging.handle.classList.remove("dragging");
  }
  nodeGraphMvp.metadataDragging = null;
  nodeGraphMvp.metadataEditorTarget = null;
}

function readNodeMetadataEditorValues(slider) {
  const current = nodeSliderMetadata(slider);
  let min = parseNodeMetadataNumber(document.getElementById("metadataMinValue").value, current.min);
  let max = parseNodeMetadataNumber(document.getElementById("metadataMaxValue").value, current.max);
  if (min > max) {
    [min, max] = [max, min];
  }
  const stepInput = document.getElementById("metadataStepValue").value.trim();
  const kind = normalizeNodeMetadataKind(document.getElementById("metadataKindValue").value);
  return {
    def: parseNodeMetadataNumber(document.getElementById("metadataDefaultValue").value, current.def),
    kind,
    max,
    maxDigits: normalizeNodeGraphMetadataMaxDigits(
      document.getElementById("metadataMaxDigitsValue").value,
      kind,
    ),
    mid: parseNodeMetadataNumber(document.getElementById("metadataMidValue").value, current.mid),
    min,
    choices: parseNodeMetadataChoices(document.getElementById("metadataChoicesValue").value),
    displayChoices: document.getElementById("metadataDisplayChoicesValue").checked,
    divideChoicesVisibly: document.getElementById("metadataDivideChoicesValue").checked,
    linearSmoothing: document.getElementById("metadataLinearSmoothingValue").checked,
    nonlinearSlider: document.getElementById("metadataNonlinearSliderValue").checked,
    step: stepInput.toLowerCase() === "any"
      ? 0
      : Math.max(0, parseNodeMetadataNumber(stepInput, current.step)),
    showSign: document.getElementById("metadataShowSignValue").checked,
    wraparound: document.getElementById("metadataWraparoundValue").checked,
    unit: document.getElementById("metadataUnitValue").value.trim(),
  };
}

function applyNodeMetadataEditor() {
  const slider = document.getElementById(nodeGraphMvp.metadataEditorTarget);
  if (!slider) {
    return;
  }

  setNodeSliderMetadata(slider, readNodeMetadataEditorValues(slider));
  syncNodeGraphPatchMetadataFromSlider(slider, {
    status: "metadata synced",
  });
  markNodeGraphRenderPending();
}

function setNodeMetadataDefaultsFromKind() {
  const slider = document.getElementById(nodeGraphMvp.metadataEditorTarget);
  if (!slider) {
    return;
  }
  const kind = normalizeNodeMetadataKind(document.getElementById("metadataKindValue").value);
  const template = nodeMetadataKindTemplates[kind] || nodeMetadataKindTemplates.decimal;
  const choices = template.choices || [];
  if (Number.isFinite(Number(template.min))) {
    document.getElementById("metadataMinValue").value = String(template.min);
  }
  if (Number.isFinite(Number(template.mid))) {
    document.getElementById("metadataMidValue").value = String(template.mid);
  }
  if (Number.isFinite(Number(template.max))) {
    document.getElementById("metadataMaxValue").value = String(template.max);
  }
  document.getElementById("metadataUnitValue").value = template.unit;
  document.getElementById("metadataMaxDigitsValue").value =
    String(normalizeNodeGraphMetadataMaxDigits(template.maxDigits, kind));
  document.getElementById("metadataChoicesValue").value = formatNodeMetadataChoices(choices);
  document.getElementById("metadataDisplayChoicesValue").checked = Boolean(template.displayChoices);
  document.getElementById("metadataDivideChoicesValue").checked = Boolean(template.divideChoicesVisibly);
  document.getElementById("metadataLinearSmoothingValue").checked = template.linearSmoothing !== false;
  document.getElementById("metadataNonlinearSliderValue").checked = Boolean(template.nonlinearSlider);
  document.getElementById("metadataShowSignValue").checked = Boolean(template.showPlusMinus);
  document.getElementById("metadataWraparoundValue").checked = Boolean(template.wraparound);
  syncNodeMetadataMidVisibility();
  applyNodeMetadataEditor();
  document.getElementById("metadataSetDefaultButton").classList.remove("armed");
}

function handleNodeMetadataKindChange() {
  applyNodeMetadataEditor();
  document.getElementById("metadataSetDefaultButton").classList.add("armed");
}

function handleNodeMetadataEditorInput() {
  if (!nodeGraphMvp.metadataEditorTarget) {
    return;
  }
  syncNodeMetadataMidVisibility();
  applyNodeMetadataEditor();
}
