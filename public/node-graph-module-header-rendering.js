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
