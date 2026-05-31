function ensureNodeGraphDragHandle(node) {
  const actions = node.querySelector(".node-header-actions");
  if (!actions || actions.querySelector(".node-drag-handle")) {
    return;
  }

  const handle = document.createElement("button");
  handle.className = "node-drag-handle";
  handle.type = "button";
  handle.setAttribute("aria-label", `Move ${nodeGraphNodeDisplayName(node.dataset.node)} module`);
  nodeGraphApplyTooltip(handle, "module.move");
  handle.innerHTML = "&#x2725;";
  actions.prepend(handle);
}

function attachNodeGraphNodeEvents(node) {
  ensureNodeGraphDragHandle(node);
  node.querySelector(".node-drag-handle")?.addEventListener("pointerdown", beginNodeGraphNodeDrag);
  node.querySelector(".node-header-title-row")?.addEventListener("pointerdown", beginNodeGraphNodeDrag);
  node.querySelector(".node-bypass-button")?.addEventListener("click", toggleNodeGraphModuleBypass);
  node.querySelector(".node-action-button")?.addEventListener("click", openNodeModuleActionMenu);
  node.addEventListener("pointermove", dragNodeGraphNode);
  node.addEventListener("pointerup", endNodeGraphNodeDrag);
  node.addEventListener("pointercancel", endNodeGraphNodeDrag);
  node.addEventListener("lostpointercapture", endNodeGraphNodeDrag);
  for (const port of node.querySelectorAll(".node-port")) {
    port.addEventListener("pointerdown", nodeGraphWireInteractions.beginWireDrag);
  }
  for (const port of node.querySelectorAll(".node-param-port.modulation-input")) {
    port.addEventListener("pointerdown", nodeGraphWireInteractions.beginWireDrag);
  }
  for (const slider of node.querySelectorAll('input[type="range"]')) {
    createNodeSliderReadout(slider);
    slider.addEventListener("input", () => {
      syncNodeSliderReadout(slider);
      syncNodeGraphPatchParameterFromSlider(slider);
      syncNodeGraphGhostSliders();
      markNodeGraphRenderPending();
      scheduleNodeGraphLiveParameterSync();
    });
  }
}

function createNodeGraphPort(node, type, port, io) {
  const button = document.createElement("button");
  button.className = `node-port ${io}`;
  button.type = "button";
  button.dataset.node = node;
  button.dataset.port = port;
  button.dataset.io = io;
  button.dataset.alias = nodeGraphLabel(node, port);
  const label = `${nodeGraphNodeLabels[type]} ${io} port ${port}`;
  button.setAttribute("aria-label", label);
  return button;
}

function createNodeGraphIoColumn(node, type, ports, io) {
  if (!ports?.length) {
    return null;
  }

  const column = document.createElement("div");
  column.className = `node-io-column ${io}`;
  for (const port of ports) {
    const row = document.createElement("div");
    row.className = `node-io-row ${io}`;
    row.dataset.node = node;
    row.dataset.port = port;
    row.dataset.io = io;
    row.dataset.alias = nodeGraphLabel(node, port);
    row.setAttribute(
      "aria-label",
      `${nodeGraphNodeLabels[type]} ${io} port ${port} interaction area`,
    );
    const label = document.createElement("span");
    label.className = "node-io-label";
    label.textContent = port;
    if (io === "input") {
      row.append(createNodeGraphPort(node, type, port, io), label);
    } else {
      row.append(label, createNodeGraphPort(node, type, port, io));
    }
    column.append(row);
  }
  return column;
}

function createNodeParameterModulationPort(node, type, parameter) {
  const button = document.createElement("button");
  button.className = "node-param-port modulation-input";
  button.type = "button";
  button.dataset.node = node;
  button.dataset.param = parameter.key;
  button.dataset.port = parameter.key;
  button.dataset.io = "modulation";
  button.dataset.alias = `${nodeGraphNodeDisplayName(node)}.${parameter.key} mod`;
  const label = `${nodeGraphNodeLabels[type]} ${parameter.label} modulation input`;
  button.setAttribute("aria-label", label);
  return button;
}

function createNodeParameterOutputPort(node, type, parameter) {
  const button = document.createElement("button");
  button.className = "node-param-port parameter-output node-port output";
  button.type = "button";
  button.dataset.node = node;
  button.dataset.param = parameter.key;
  button.dataset.port = parameter.key;
  button.dataset.io = "output";
  button.dataset.alias = `${nodeGraphNodeDisplayName(node)}.${parameter.key} slider`;
  const label = `${nodeGraphNodeLabels[type]} ${parameter.label} slider output`;
  button.setAttribute("aria-label", label);
  return button;
}

function createNodeGraphParameter(node, type, parameter) {
  const row = document.createElement("div");
  row.className = "node-parameter-row";
  row.dataset.param = parameter.key;
  row.append(createNodeParameterModulationPort(node, type, parameter));

  const label = document.createElement("label");
  label.className = "node-parameter-control";
  label.dataset.paramLabel = parameter.label;
  label.setAttribute("aria-label", parameter.label);
  const input = document.createElement("input");
  const legacyIds = {
    "bias.offset": "nodeBiasAmount",
    "gain.amount": "nodeGainAmount",
    "noise.level": "nodeNoiseLevel",
    "osc.frequency": "nodeOscFrequency",
    "osc.level": "nodeOscLevel",
    "osc.phase": "nodeOscPhase",
    "osc.waveform": "nodeOscWaveform",
  };
  input.id = legacyIds[`${node}.${parameter.key}`] || `node-${node}-${parameter.key}`;
  input.dataset.param = parameter.key;
  input.type = "range";
  input.min = parameter.min;
  input.max = parameter.max;
  input.step = "any";
  input.value = parameter.defaultValue;
  input.dataset.step = parameter.step;
  input.dataset.mid = parameter.mid;
  input.dataset.default = parameter.defaultValue;
  input.dataset.kind = parameter.kind || "decimal";
  input.dataset.unit = parameter.unit ?? "";
  input.dataset.choices = formatNodeMetadataChoices(parameter.choices || []);
  input.dataset.displayChoices = parameter.displayChoices ? "true" : "false";
  input.dataset.divideChoicesVisibly = parameter.divideChoicesVisibly ? "true" : "false";
  input.dataset.linearSmoothing = parameter.linearSmoothing === false ? "false" : "true";
  input.dataset.nonlinearSlider = nodeGraphParameterDefinitionMetadata(parameter)?.nonlinearSlider ? "true" : "false";
  input.dataset.showSign = parameter.showSign ? "true" : "false";
  input.dataset.wraparound = parameter.wraparound ? "true" : "false";
  input.setAttribute("aria-label", `${nodeGraphNodeLabels[type]} ${parameter.label}`);
  label.append(input);
  row.append(label);
  row.append(createNodeParameterOutputPort(node, type, parameter));
  return row;
}

function createNodeGraphModuleElement(type, node) {
  const definition = nodeGraphModuleDefinitions[type];
  const article = document.createElement("article");
  article.className = `dsp-node${definition.output ? " output-node" : ""}${definition.layout === "textBox" ? " text-box-layout" : ""}`;
  article.dataset.node = node;
  article.dataset.nodeType = type;
  article.style.setProperty("--node-grid-width-units", String(nodeGraphModuleGridWidthUnits(type)));
  article.style.setProperty("--node-grid-height-units", String(nodeGraphModuleGridHeightUnits(type)));

  const header = document.createElement("div");
  header.className = "dsp-node-header";
  const titleRow = document.createElement("div");
  titleRow.className = "node-header-title-row";
  nodeGraphApplyTooltip(titleRow, "module.move");
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
  nodeGraphApplyTooltip(handle, "module.move");
  handle.innerHTML = "&#x2725;";
  actionRow.append(handle);
  const orderBadge = document.createElement("span");
  orderBadge.className = "node-execution-order-badge";
  orderBadge.dataset.executionState = "inactive";
  orderBadge.textContent = "--";
  orderBadge.setAttribute("aria-label", `${nodeGraphNodeLabels[type]} execution order inactive`);
  nodeGraphApplyTooltip(orderBadge, "module.executionTitleInactive");
  actionRow.append(orderBadge);
  if (definition.output) {
    const bypassButton = document.createElement("button");
    bypassButton.className = "node-bypass-button";
    bypassButton.type = "button";
    bypassButton.dataset.node = node;
    bypassButton.textContent = nodeGraphBypassGlyph(false);
    bypassButton.setAttribute("aria-label", "Toggle live OUTPUT from Output module");
    bypassButton.setAttribute("aria-pressed", "true");
    nodeGraphApplyTooltip(bypassButton, "module.outputToggle");
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
    nodeGraphApplyTooltip(bypassButton, "module.bypass");
    actionRow.append(bypassButton);
  }
  const actionButton = document.createElement("button");
  actionButton.className = "node-action-button";
  actionButton.type = "button";
  actionButton.dataset.node = node;
  actionButton.setAttribute("aria-label", `${nodeGraphNodeLabels[type]} module actions`);
  nodeGraphApplyTooltip(actionButton, "module.actionsTitle");
  actionButton.textContent = "\u2699";
  actionRow.append(actionButton);
  header.append(actionRow);

  article.append(header);

  if (definition.layout === "textBox") {
    article.append(createNodeGraphTextBoxBody(node));
  } else {
    const ioSection = document.createElement("div");
    ioSection.className = "dsp-node-io-section";
    const inputColumn = createNodeGraphIoColumn(node, type, definition.inputs, "input");
    const outputColumn = createNodeGraphIoColumn(node, type, definition.outputs, "output");
    if (inputColumn) {
      ioSection.append(inputColumn);
    } else {
      ioSection.append(document.createElement("div"));
    }
    if (outputColumn) {
      ioSection.append(outputColumn);
    } else {
      ioSection.append(document.createElement("div"));
    }
    article.append(ioSection);
  }

  if (type === "audioInput") {
    const stateBadge = document.createElement("div");
    stateBadge.className = "node-live-input-state-badge";
    stateBadge.dataset.micState = "off";
    stateBadge.textContent = "mic off";
    article.append(stateBadge);
  }

  if (definition.parameters?.length) {
    const body = document.createElement("div");
    body.className = "dsp-node-body";

    for (const parameter of definition.parameters) {
      body.append(createNodeGraphParameter(node, type, parameter));
    }
    article.append(body);
  }

  attachNodeGraphNodeEvents(article);
  return article;
}

function registerExistingNodeGraphNodes() {
  nodeGraphMvp.activeNodes = new Set();
  for (const node of document.querySelectorAll(".dsp-node")) {
    node.dataset.nodeType ||= node.dataset.node;
    nodeGraphMvp.activeNodes.add(node.dataset.node);
    attachNodeGraphNodeEvents(node);
  }
}

function toggleNodeGraphModuleBypass(event) {
  if (!nodeGraphScriptReadyForGraphAction("bypass")) {
    return;
  }
  const button = event.currentTarget;
  const node = button.closest(".dsp-node");
  const nodeId = node?.dataset.node;
  if (nodeId === "output") {
    toggleNodeGraphLiveOutput();
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (!nodeId || !nodeGraphMvp.activeNodes.has(nodeId)) {
    return;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const bypassed = new Set(patch.bypassedNodes || []);
  if (bypassed.has(nodeId)) {
    bypassed.delete(nodeId);
  } else {
    bypassed.add(nodeId);
  }
  patch.bypassedNodes = [...bypassed];
  commitNodeGraphPatch(patch, {
    status: bypassed.has(nodeId) ? "module bypassed" : "module active",
  });
  event.preventDefault();
  event.stopPropagation();
}
