function ensureNodeGraphDragHandle(node) {
  const actions = node.querySelector(".node-header-actions");
  if (!actions || actions.querySelector(".node-drag-handle")) {
    return;
  }

  const handle = document.createElement("button");
  handle.className = "node-drag-handle";
  handle.type = "button";
  handle.setAttribute("aria-label", `Move ${nodeGraphNodeDisplayName(node.dataset.node)} module`);
  nodeGraphApplyTooltip(handle, "module.move", {}, { title: false });
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
    port.addEventListener("pointerdown", toggleNodeGraphMonitorFromPortEvent, true);
    port.addEventListener("pointerdown", nodeGraphWireInteractions.beginWireDrag);
  }
  for (const port of node.querySelectorAll(".node-param-port.modulation-input")) {
    port.addEventListener("pointerdown", toggleNodeGraphMonitorFromPortEvent, true);
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

function createNodeGraphModuleElement(type, node) {
  const definition = nodeGraphModuleDefinitions[type];
  const article = document.createElement("article");
  article.className = `dsp-node${definition.output ? " output-node" : ""}${definition.layout === "textBox" ? " text-box-layout" : ""}`;
  article.dataset.node = node;
  article.dataset.nodeType = type;
  article.style.setProperty("--node-grid-width-units", String(nodeGraphModuleGridWidthUnits(type)));
  article.style.setProperty("--node-grid-height-units", String(nodeGraphModuleGridHeightUnits(type)));

  article.append(createNodeGraphModuleHeader(type, node, definition));
  if (definition.layout === "textBox") {
    article.append(createNodeGraphTextBoxBody(node));
  } else {
    const scopeSection = createNodeGraphModuleScopeSection(node, type);
    article.append(scopeSection);
    registerNodeGraphModuleScopeSlot(article, { nodeId: node, type, scopeElement: scopeSection });

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
    registerNodeGraphModuleScopeSlot(node, {
      nodeId: node.dataset.node,
      scopeElement: node.querySelector(".node-module-scope-window"),
      type: node.dataset.nodeType,
    });
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
