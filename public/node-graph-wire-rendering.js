function nodeGraphSelfTraceModuleRect(nodeId) {
  const surface = nodeGraphZoomSurface();
  const node = nodeGraphNodeElement(nodeId);
  if (!surface || !node) {
    return null;
  }
  const surfaceRect = surface.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  const zoom = nodeGraphZoom();
  const titleRowRect = node.querySelector(".node-header-title-row")?.getBoundingClientRect();
  const titleBottom = titleRowRect
    ? (titleRowRect.bottom - surfaceRect.top) / zoom
    : (nodeRect.top - surfaceRect.top) / zoom;
  return {
    bottom: (nodeRect.bottom - surfaceRect.top) / zoom,
    left: (nodeRect.left - surfaceRect.left) / zoom,
    right: (nodeRect.right - surfaceRect.left) / zoom,
    titleBottom,
    top: (nodeRect.top - surfaceRect.top) / zoom,
  };
}

function nodeGraphSelfTracePoints(wire, from, to) {
  const sourceNode = wire?.sourceNode;
  const destinationNode = wire?.destinationNode;
  if (!sourceNode || sourceNode !== destinationNode) {
    return [];
  }
  const rect = nodeGraphSelfTraceModuleRect(sourceNode);
  if (!rect) {
    return [];
  }
  const distance = Math.max(nodeGraphGridWidth(), nodeGraphGridHeight()) * 0.75;
  const centerX = (rect.left + rect.right) * 0.5;
  const fromDirection = from.x < centerX ? -1 : 1;
  const toDirection = to.x < centerX ? -1 : 1;
  const outX = from.x + fromDirection * distance;
  const destinationSideX = to.x + toDirection * distance;
  const aboveY = Math.max(0.5, rect.top - distance);
  const belowTitleY = Math.max(to.y, rect.titleBottom + 0.5);
  return [
    { x: outX, y: from.y },
    { x: outX, y: aboveY },
    { x: destinationSideX, y: aboveY },
    { x: destinationSideX, y: belowTitleY },
  ];
}

function nodeGraphManualTracePathOptions(wire, from, to) {
  const wireType = normalizeNodeGraphWireType(wire?.wireType);
  if (wireType !== nodeGraphWireTypes.trace) {
    return { wireType };
  }
  const manualTracePoints = normalizeNodeGraphTracePoints(wire?.tracePoints);
  const tracePoints = manualTracePoints.length
    ? manualTracePoints
    : nodeGraphSelfTracePoints(wire, from, to);
  return {
    pathData: nodeGraphTracePathFromPoints(from, tracePoints, to),
    tracePoints,
    wireType,
  };
}

function drawNodeGraphWires() {
  const workspace = nodeGraphZoomSurface();
  const svg = document.getElementById("nodeWireSvg");
  if (!workspace || !svg) {
    return;
  }
  updateNodeGraphGridHeatmap();
  const plan = compileNodeGraphExecutionPlan();
  const feedbackSets = nodeGraphFeedbackIdentitySets(plan);
  const activeNodeIds = nodeGraphActiveNodeIds(plan);

  const graphRect = nodeGraphGraphRect();
  svg.setAttribute("viewBox", `0 0 ${graphRect.width} ${graphRect.height}`);
  svg.replaceChildren();
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  svg.append(defs);

  for (const node of workspace.querySelectorAll(".dsp-node")) {
    node.classList.remove("connected");
  }
  for (const port of workspace.querySelectorAll(".node-port, .node-param-port")) {
    port.classList.remove("connected-port");
  }

  for (const [index, connection] of nodeGraphMvp.connections.entries()) {
    if (
      !nodeGraphMvp.activeNodes.has(connection.sourceNode) ||
      !nodeGraphMvp.activeNodes.has(connection.destinationNode) ||
      !nodeGraphPatchNodeIsVisible(connection.sourceNode) ||
      !nodeGraphPatchNodeIsVisible(connection.destinationNode)
    ) {
      continue;
    }

    const from = nodeGraphPortCenter(connection.sourceNode, connection.sourcePort, "output");
    const to = nodeGraphPortCenter(
      connection.destinationNode,
      connection.destinationPort,
      "input",
    );
    const isFeedback = feedbackSets.signal.has(nodeGraphSignalWireIdentity(connection));
    const isInactive = !nodeGraphSignalConnectionIsActive(connection, activeNodeIds);
    const isBypassed = nodeGraphWireTouchesBypassed(connection, plan);
    const mode = isBypassed ? "bypassed" : isInactive ? "inactive" : isFeedback ? "state-read" : "same-pass";
    nodeGraphWireHelpers.drawPath(svg, {
      alias: `${nodeGraphLabel(connection.sourceNode, connection.sourcePort)} -> ${nodeGraphLabel(
        connection.destinationNode,
        connection.destinationPort,
      )}`,
      from,
      gradientId: `node-wire-gradient-${index}`,
      index,
      kind: "signal",
      mode,
      pathClass: [
        "node-wire-path",
        isFeedback ? "state-read" : "",
        isInactive ? "inactive-wire" : "",
      ].filter(Boolean).join(" "),
      to,
      wireType: connection.wireType,
      wireColors: [
        nodeGraphPortWireColor(connection.sourceNode, connection.sourcePort, "output"),
        nodeGraphPortWireColor(connection.destinationNode, connection.destinationPort, "input"),
      ],
      ...nodeGraphManualTracePathOptions(connection, from, to),
    });

    nodeGraphNodeElement(connection.sourceNode)?.classList.add("connected");
    nodeGraphNodeElement(connection.destinationNode)?.classList.add("connected");
    markNodeGraphPortConnected(connection.sourceNode, connection.sourcePort, "output");
    markNodeGraphPortConnected(connection.destinationNode, connection.destinationPort, "input");
  }

  for (const [index, modulation] of nodeGraphMvp.modulations.entries()) {
    if (
      !nodeGraphMvp.activeNodes.has(modulation.sourceNode) ||
      !nodeGraphMvp.activeNodes.has(modulation.destinationNode) ||
      !nodeGraphPatchNodeIsVisible(modulation.sourceNode) ||
      !nodeGraphPatchNodeIsVisible(modulation.destinationNode)
    ) {
      continue;
    }

    const from = nodeGraphPortCenter(modulation.sourceNode, modulation.sourcePort, "output");
    const to = nodeGraphModulationPortCenter(
      modulation.destinationNode,
      modulation.destinationParam,
    );
    const isFeedback = feedbackSets.modulation.has(nodeGraphModulationWireIdentity(modulation));
    const isInactive = !nodeGraphModulationIsActive(modulation, activeNodeIds);
    const isBypassed = nodeGraphWireTouchesBypassed(modulation, plan);
    const mode = isBypassed ? "bypassed" : isInactive ? "inactive" : isFeedback ? "state-read" : "same-pass";
    nodeGraphWireHelpers.drawPath(svg, {
      alias: `${nodeGraphLabel(modulation.sourceNode, modulation.sourcePort)} -> ${nodeGraphNodeDisplayName(
        modulation.destinationNode,
      )}.${modulation.destinationParam} mod`,
      from,
      gradientClass: "node-modulation-wire-gradient-stop",
      gradientId: `node-modulation-wire-gradient-${index}`,
      index,
      kind: "modulation",
      mode,
      pathClass: [
        "node-wire-path",
        "node-modulation-wire-path",
        isInactive ? "inactive-wire" : "",
      ].filter(Boolean).join(" "),
      to,
      wireType: modulation.wireType,
      wireColors: [
        nodeGraphPortWireColor(modulation.sourceNode, modulation.sourcePort, "output"),
        nodeGraphPortWireColor(modulation.destinationNode, modulation.destinationParam, "modulation"),
      ],
      ...nodeGraphManualTracePathOptions(modulation, from, to),
    });

    nodeGraphNodeElement(modulation.sourceNode)?.classList.add("connected");
    nodeGraphNodeElement(modulation.destinationNode)?.classList.add("connected");
    markNodeGraphPortConnected(modulation.sourceNode, modulation.sourcePort, "output");
    markNodeGraphModulationPortConnected(modulation.destinationNode, modulation.destinationParam);
  }

  syncNodeGraphMonitorIndicators();

  if (nodeGraphMvp.dragging) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const stroke = nodeGraphWireHelpers.createGradient(
      svg,
      "node-wire-gradient-temp",
      nodeGraphMvp.dragging.from,
      nodeGraphMvp.dragging.to,
      "node-wire-gradient-stop",
      [
        nodeGraphPortWireColor(
          nodeGraphMvp.dragging.endpoint.node,
          nodeGraphMvp.dragging.endpoint.port,
          nodeGraphMvp.dragging.endpoint.io,
        ),
        "rgba(243, 241, 236, 0.44)",
      ],
    );
    path.setAttribute("class", "node-wire-path temp");
    path.setAttribute("stroke", stroke);
    path.setAttribute(
      "d",
      nodeGraphWireHelpers.path(nodeGraphMvp.dragging.from, nodeGraphMvp.dragging.to),
    );
    svg.append(path);
  }

  if (nodeGraphMvp.manualTrace) {
    const trace = nodeGraphMvp.manualTrace;
    const previewPoint = nodeGraphTraceSingleMovePoint(trace.from, trace.points, trace.to);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const stroke = nodeGraphWireHelpers.createGradient(
      svg,
      "node-wire-gradient-manual-trace",
      trace.from,
      trace.to,
      "node-wire-gradient-stop",
      [
        nodeGraphPortWireColor(trace.endpoint.node, trace.endpoint.port, trace.endpoint.io),
        "rgba(243, 241, 236, 0.44)",
      ],
    );
    path.setAttribute("class", "node-wire-path trace-wire temp");
    path.setAttribute("stroke", stroke);
    path.dataset.tracePoints = nodeGraphTraceWaypointAttribute(trace.points);
    path.setAttribute("d", nodeGraphTracePathFromPoints(trace.from, trace.points, previewPoint));
    svg.append(path);
  }

  renderNodeGraphSelection();
  scheduleNodeGraphModuleScopeDraw();
}

function renderNodeGraphConnectionList() {
  const plan = compileNodeGraphExecutionPlan();
  const validation = {
    issues: plan.issues,
    scheduleText: nodeGraphScheduleText(
      plan.order,
      plan.issues,
      plan.feedbackConnections,
      plan.feedbackModulations,
    ),
    sourceNodes: plan.sourceNodes,
    valid: plan.valid,
  };
  const list = document.getElementById("nodeConnectionList");
  const status = document.getElementById("nodeGraphStatus");
  const source = document.getElementById("nodeGraphSource");
  const validationPill = document.getElementById("nodeGraphValidation");
  const feedbackSets = nodeGraphFeedbackIdentitySets(plan);
  const activeNodeIds = nodeGraphActiveNodeIds(plan);

  list.replaceChildren();
  let renderedWireCount = 0;
  for (const [index, connection] of nodeGraphMvp.connections.entries()) {
    if (
      !nodeGraphMvp.activeNodes.has(connection.sourceNode) ||
      !nodeGraphMvp.activeNodes.has(connection.destinationNode)
    ) {
      continue;
    }

    const item = document.createElement("li");
    item.dataset.connectionRowIndex = String(index);
    item.dataset.connectionRowKind = "signal";
    item.classList.toggle(
      "selected",
      sameNodeGraphSelection(nodeGraphMvp.selected, { type: "wire", kind: "signal", index }),
    );
    item.addEventListener("click", () => setNodeGraphSelection({ type: "wire", kind: "signal", index }));
    const label = document.createElement("span");
    const isFeedback = feedbackSets.signal.has(nodeGraphSignalWireIdentity(connection));
    const isInactive = !nodeGraphSignalConnectionIsActive(connection, activeNodeIds);
    const isBypassed = nodeGraphWireTouchesBypassed(connection, plan);
    label.textContent = `${nodeGraphLabel(connection.sourceNode, connection.sourcePort)} -> ${nodeGraphLabel(
      connection.destinationNode,
      connection.destinationPort,
    )}${isFeedback ? " (state read)" : ""}${isBypassed ? " (bypassed)" : isInactive ? " (inactive)" : ""}`;
    item.classList.toggle("state-read", isFeedback);
    item.classList.toggle("inactive-wire", isInactive);
    const button = document.createElement("button");
    button.className = "disconnect-wire-button";
    button.type = "button";
    button.textContent = "Disconnect";
    button.dataset.connectionIndex = String(index);
    button.dataset.connectionKind = "signal";
    button.setAttribute("aria-label", `Disconnect ${label.textContent}`);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      disconnectNodeGraphConnection(index, "signal");
    });
    item.append(label, button);
    list.append(item);
    renderedWireCount += 1;
  }

  for (const [index, modulation] of nodeGraphMvp.modulations.entries()) {
    if (
      !nodeGraphMvp.activeNodes.has(modulation.sourceNode) ||
      !nodeGraphMvp.activeNodes.has(modulation.destinationNode)
    ) {
      continue;
    }

    const item = document.createElement("li");
    item.dataset.connectionRowIndex = String(index);
    item.dataset.connectionRowKind = "modulation";
    item.classList.toggle(
      "selected",
      sameNodeGraphSelection(nodeGraphMvp.selected, { type: "wire", kind: "modulation", index }),
    );
    item.addEventListener("click", () => setNodeGraphSelection({ type: "wire", kind: "modulation", index }));
    const label = document.createElement("span");
    const isFeedback = feedbackSets.modulation.has(nodeGraphModulationWireIdentity(modulation));
    const isInactive = !nodeGraphModulationIsActive(modulation, activeNodeIds);
    const isBypassed = nodeGraphWireTouchesBypassed(modulation, plan);
    label.textContent = `${nodeGraphLabel(modulation.sourceNode, modulation.sourcePort)} -> ${nodeGraphNodeDisplayName(
      modulation.destinationNode,
    )}.${modulation.destinationParam} mod${isFeedback ? " (state read)" : ""}${isBypassed ? " (bypassed)" : isInactive ? " (inactive)" : ""}`;
    item.classList.toggle("state-read", isFeedback);
    item.classList.toggle("inactive-wire", isInactive);
    const button = document.createElement("button");
    button.className = "disconnect-wire-button";
    button.type = "button";
    button.textContent = "Disconnect";
    button.dataset.connectionIndex = String(index);
    button.dataset.connectionKind = "modulation";
    button.setAttribute("aria-label", `Disconnect ${label.textContent}`);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      disconnectNodeGraphConnection(index, "modulation");
    });
    item.append(label, button);
    list.append(item);
    renderedWireCount += 1;
  }

  if (!renderedWireCount) {
    const item = document.createElement("li");
    item.className = "warn-row";
    item.textContent = "No wires connected";
    list.append(item);
  }

  status.textContent = validation.valid ? "Graph Valid" : "Graph Incomplete";
  status.className = `pill ${validation.valid ? "good" : "warn"}`;
  source.textContent = validation.scheduleText;
  validationPill.textContent = validation.valid
    ? "valid"
    : validation.issues.join(", ");
  validationPill.className = `pill ${validation.valid ? "good" : "warn"}`;

  const renderButton = document.getElementById("nodeRenderButton");
  renderButton.disabled = !validation.valid;
  renderButton.title = validation.valid
    ? "Render current patch sample"
    : `Render blocked: ${validation.issues.join(", ")}`;
  renderNodeGraphExecutionPlanDebug(plan);
  drawNodeGraphWires();
}
