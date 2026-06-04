function nodeGraphPatchTimingValue(key) {
  return normalizeNodeGraphPatchTiming(nodeGraphMvp?.patch?.timing)[key];
}

function syncNodeGraphHeaderTimingWidgets() {
  const timing = normalizeNodeGraphPatchTiming(nodeGraphMvp?.patch?.timing);
  for (const input of document.querySelectorAll(".node-header-timing-input")) {
    const key = input.dataset.timingField;
    if (Object.hasOwn(timing, key)) {
      input.value = String(timing[key]);
    }
  }
}

function updateNodeGraphPatchTimingFromHeader(input) {
  const key = input?.dataset?.timingField;
  if (!key) {
    return;
  }
  const current = normalizeNodeGraphPatchTiming(nodeGraphMvp.patch.timing);
  const next = normalizeNodeGraphPatchTiming({
    ...current,
    [key]: input.value,
  });
  if (
    current.tempoBpm === next.tempoBpm &&
    current.timeSignatureNumerator === next.timeSignatureNumerator &&
    current.timeSignatureDenominator === next.timeSignatureDenominator
  ) {
    input.value = String(next[key]);
    return;
  }
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  patch.timing = next;
  commitNodeGraphPatch(patch, {
    markPending: false,
    status: "timing synced",
  });
}

function bindNodeGraphHeaderTimingWidgets(root = document) {
  for (const input of root.querySelectorAll(".node-header-timing-input")) {
    if (input.dataset.timingBound === "true") {
      continue;
    }
    input.dataset.timingBound = "true";
    input.addEventListener("change", () => updateNodeGraphPatchTimingFromHeader(input));
    input.addEventListener("blur", () => updateNodeGraphPatchTimingFromHeader(input));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        updateNodeGraphPatchTimingFromHeader(input);
        input.blur();
      }
      event.stopPropagation();
    });
    input.addEventListener("pointerdown", (event) => event.stopPropagation());
  }
}

function createNodeGraphHeaderTimingInput(key, label, options = {}) {
  const field = document.createElement("label");
  field.className = "node-header-timing-field";
  field.setAttribute("aria-label", label);

  const caption = document.createElement("span");
  caption.textContent = label;
  field.append(caption);

  const input = document.createElement("input");
  input.className = "node-header-timing-input";
  input.dataset.timingField = key;
  input.inputMode = "numeric";
  input.min = String(options.min ?? 1);
  input.max = String(options.max ?? 32);
  input.step = String(options.step ?? 1);
  input.type = "number";
  input.value = String(nodeGraphPatchTimingValue(key));
  field.append(input);

  return field;
}

function createNodeGraphHeaderTimingWidgets() {
  const group = document.createElement("div");
  group.className = "node-header-timing-widgets";
  group.setAttribute("aria-label", "Patch timing");
  group.append(
    createNodeGraphHeaderTimingInput("tempoBpm", "BPM", { max: 320 }),
    createNodeGraphHeaderTimingInput("timeSignatureNumerator", "Beats"),
    createNodeGraphHeaderTimingInput("timeSignatureDenominator", "Unit"),
  );
  return group;
}

function renderNodeGraphPatchTimingControls() {
  const host = document.getElementById("nodePatchTimingControls");
  if (!host) {
    return;
  }
  if (!host.querySelector(".node-header-timing-widgets")) {
    host.replaceChildren(createNodeGraphHeaderTimingWidgets());
  }
  bindNodeGraphHeaderTimingWidgets(host);
  syncNodeGraphHeaderTimingWidgets();
}

function createNodeGraphModuleHeader(type, node, definition) {
  const header = document.createElement("div");
  header.className = "dsp-node-header";
  const titleRow = document.createElement("div");
  titleRow.className = "node-header-title-row";
  nodeGraphApplyTooltip(titleRow, "module.move", {}, { title: false });
  const titleText = document.createElement("span");
  titleText.className = "node-header-title";
  titleText.textContent = nodeGraphPatchNodeTitle({ id: node, type });
  titleRow.append(titleText);
  header.append(titleRow);

  const actionRow = document.createElement("div");
  actionRow.className = "node-header-actions";
  const handle = document.createElement("button");
  handle.className = "node-drag-handle";
  handle.type = "button";
  handle.setAttribute("aria-label", `Move ${nodeGraphNodeLabels[type]} module`);
  nodeGraphApplyTooltip(handle, "module.move", {}, { title: false });
  handle.innerHTML = "&#x2725;";
  actionRow.append(handle);
  const orderBadge = document.createElement("span");
  orderBadge.className = "node-execution-order-badge";
  orderBadge.dataset.executionState = "inactive";
  orderBadge.textContent = "--";
  orderBadge.setAttribute("aria-label", `${nodeGraphNodeLabels[type]} execution order inactive`);
  nodeGraphApplyTooltip(orderBadge, "module.executionTitleInactive", {}, { title: false });
  actionRow.append(orderBadge);
  if (definition.output) {
    const bypassButton = document.createElement("button");
    bypassButton.className = "node-bypass-button";
    bypassButton.type = "button";
    bypassButton.dataset.node = node;
    bypassButton.textContent = nodeGraphBypassGlyph(false);
    bypassButton.setAttribute("aria-label", "Toggle live OUTPUT from Output module");
    bypassButton.setAttribute("aria-pressed", "true");
    nodeGraphApplyTooltip(bypassButton, "module.outputToggle", {}, { title: false });
    actionRow.append(bypassButton);
  }
  if (!definition.output && !definition.layoutOnly) {
    const bypassButton = document.createElement("button");
    bypassButton.className = "node-bypass-button";
    bypassButton.type = "button";
    bypassButton.dataset.node = node;
    bypassButton.textContent = nodeGraphBypassGlyph(false);
    bypassButton.setAttribute("aria-label", `Bypass ${nodeGraphNodeLabels[type]} module`);
    bypassButton.setAttribute("aria-pressed", "false");
    nodeGraphApplyTooltip(bypassButton, "module.bypass", {}, { title: false });
    actionRow.append(bypassButton);
  }
  const actionButton = document.createElement("button");
  actionButton.className = "node-action-button";
  actionButton.type = "button";
  actionButton.dataset.node = node;
  actionButton.setAttribute("aria-label", `${nodeGraphNodeLabels[type]} module actions`);
  nodeGraphApplyTooltip(actionButton, "module.actionsTitle", {}, { title: false });
  actionButton.textContent = "\u2699";
  actionRow.append(actionButton);
  header.append(actionRow);

  return header;
}
