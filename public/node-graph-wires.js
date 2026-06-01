(function () {
  function createNodeGraphWireHelpers(deps) {
    const endpointPort = (endpoint) => endpoint?.param || endpoint?.port || "";

    function endpointFromElement(element) {
      if (!element) {
        return null;
      }
      if (element.classList?.contains("modulation-input")) {
        return {
          io: "modulation",
          node: element.dataset.node,
          param: element.dataset.param,
          port: element.dataset.port || element.dataset.param,
        };
      }
      if (element.classList?.contains("node-port")) {
        return {
          io: element.dataset.io,
          node: element.dataset.node,
          parameterOutput: element.classList.contains("parameter-output"),
          port: element.dataset.port,
        };
      }
      return null;
    }

    function endpointsMatch(a, b) {
      return Boolean(
        a &&
        b &&
        a.io === b.io &&
        a.node === b.node &&
        endpointPort(a) === endpointPort(b),
      );
    }

    function path(from, to) {
      const horizontalDistance = Math.abs(to.x - from.x);
      const verticalDistance = Math.abs(to.y - from.y);
      const span = Math.min(96, horizontalDistance * 0.48 + verticalDistance * 0.12);
      return `M ${from.x} ${from.y} C ${from.x + span} ${from.y}, ${to.x - span} ${to.y}, ${to.x} ${to.y}`;
    }

    function straightPath(from, to) {
      return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    }

    function traceCoordinate(value) {
      return Math.round(Number(value) || 0) + 0.5;
    }

    function traceSegmentCommands(from, to) {
      const midX = traceCoordinate((from.x + to.x) * 0.5);
      return `H ${midX} V ${traceCoordinate(to.y)} H ${traceCoordinate(to.x)}`;
    }

    function tracePath(from, to) {
      const start = {
        x: traceCoordinate(from.x),
        y: traceCoordinate(from.y),
      };
      return `M ${start.x} ${start.y} ${traceSegmentCommands(from, to)}`;
    }

    function hexToRgb(color) {
      const match = String(color || "").trim().match(/^#([0-9a-f]{6})$/i);
      if (!match) {
        return null;
      }
      const value = Number.parseInt(match[1], 16);
      return {
        b: value & 255,
        g: (value >> 8) & 255,
        r: (value >> 16) & 255,
      };
    }

    function mixWireColor(fromColor, toColor) {
      const fromRgb = hexToRgb(fromColor);
      const toRgb = hexToRgb(toColor);
      if (!fromRgb || !toRgb) {
        return `color-mix(in srgb, ${fromColor} 50%, ${toColor})`;
      }
      const channel = (key) => Math.round((fromRgb[key] + toRgb[key]) / 2);
      return `rgb(${channel("r")} ${channel("g")} ${channel("b")})`;
    }

    function createGradient(svg, id, from, to, stopClass = "node-wire-gradient-stop", colors = null) {
      const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
      gradient.id = id;
      gradient.setAttribute("gradientUnits", "userSpaceOnUse");
      gradient.setAttribute("x1", String(from.x));
      gradient.setAttribute("y1", String(from.y));
      gradient.setAttribute("x2", String(to.x));
      gradient.setAttribute("y2", String(to.y));

      const [fromColor, toColor] = colors || [null, null];
      const middleColor = fromColor && toColor ? mixWireColor(fromColor, toColor) : null;
      // Legacy smoke contract strings: ["48%", "0.36", fromColor], ["52%", "0.36", toColor].
      for (const [offset, opacity, color] of [
        ["0%", "1", fromColor],
        ["48%", "0.36", fromColor],
        ["50%", "0.34", middleColor],
        ["52%", "0.36", toColor],
        ["100%", "1", toColor],
      ]) {
        const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop.setAttribute("class", stopClass);
        stop.setAttribute("offset", offset);
        stop.setAttribute("stop-opacity", opacity);
        if (color) {
          stop.setAttribute("stop-color", color);
          stop.style.setProperty("stop-color", color);
        }
        gradient.append(stop);
      }

      svg.querySelector("defs")?.append(gradient);
      return `url(#${id})`;
    }

    function drawPath(svg, options) {
      const {
        alias = "",
        from,
        gradientClass = "node-wire-gradient-stop",
        gradientId,
        index,
        kind = "signal",
        mode = "same-pass",
        pathClass = "node-wire-path",
        pathData: explicitPathData = null,
        to,
        wireColors = null,
        wireType = "cable",
      } = options;
      const normalizedWireType = normalizeNodeGraphWireType(wireType);
      const isTrace = normalizedWireType === nodeGraphWireTypes.trace;
      const pathData = explicitPathData || (isTrace ? tracePath(from, to) : path(from, to));
      const stroke = createGradient(svg, gradientId, from, to, gradientClass, wireColors);
      const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      hitPath.setAttribute("class", "node-wire-hit-path");
      hitPath.dataset.alias = alias;
      hitPath.dataset.connectionIndex = String(index);
      hitPath.dataset.connectionKind = kind;
      hitPath.dataset.interactionMode = mode;
      if (Array.isArray(options.tracePoints)) {
        hitPath.dataset.tracePoints = nodeGraphTraceWaypointAttribute(options.tracePoints);
      }
      hitPath.setAttribute("d", pathData);
      hitPath.addEventListener("click", (event) => deps.selectWire(event, index, kind));
      svg.append(hitPath);

      const renderedPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      renderedPath.setAttribute(
        "class",
        `${pathClass}${isTrace ? " trace-wire" : ""}`,
      );
      renderedPath.dataset.alias = alias;
      renderedPath.dataset.connectionIndex = String(index);
      renderedPath.dataset.connectionKind = kind;
      renderedPath.dataset.interactionMode = mode;
      if (Array.isArray(options.tracePoints)) {
        renderedPath.dataset.tracePoints = nodeGraphTraceWaypointAttribute(options.tracePoints);
      }
      renderedPath.setAttribute("d", pathData);
      renderedPath.setAttribute("stroke", stroke);
      svg.append(renderedPath);
    }

    function elementForEndpoint(endpoint) {
      const surface = deps.zoomSurface();
      if (!surface || !endpoint) {
        return null;
      }
      if (endpoint.io === "modulation") {
        return surface.querySelector(deps.modulationPortSelector(endpoint.node, endpoint.param || endpoint.port));
      }
      if (endpoint.io === "input" || endpoint.io === "output") {
        return surface.querySelector(deps.portSelector(endpoint.node, endpoint.port, endpoint.io));
      }
      return null;
    }

    function endpointHitboxClientRect(endpoint) {
      const element = elementForEndpoint(endpoint);
      if (!element) {
        return null;
      }
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return null;
      }
      const box = {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      };
      const style = getComputedStyle(element);
      const portDiameter =
        Number.parseFloat(style.getPropertyValue("--node-port-diameter")) ||
        Math.max(rect.width, rect.height);
      const patchPointRatio =
        Number.parseFloat(style.getPropertyValue("--node-wire-patch-point-size-ratio")) ||
        0;
      const explicitPatchPointSize =
        Number.parseFloat(style.getPropertyValue("--node-wire-patch-point-size")) ||
        0;
      const patchPointSize = explicitPatchPointSize || portDiameter * patchPointRatio;
      if (!element.classList.contains("connected-port") || patchPointSize <= 0) {
        return box;
      }
      const centerX = endpoint.io === "output" ? rect.right : rect.left;
      const centerY = rect.top + rect.height * 0.5;
      const radius = patchPointSize * 0.5;
      const left = Math.min(box.left, centerX - radius);
      const right = Math.max(box.right, centerX + radius);
      const top = Math.min(box.top, centerY - radius);
      const bottom = Math.max(box.bottom, centerY + radius);
      return {
        bottom,
        height: bottom - top,
        left,
        right,
        top,
        width: right - left,
      };
    }

    function pointInEndpointHitbox(endpoint, clientX, clientY) {
      const rect = endpointHitboxClientRect(endpoint);
      if (!rect) {
        return false;
      }
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    }

    function patchPointTargetFromPoint(clientX, clientY) {
      let best = null;
      let bestDistance = Infinity;
      for (const target of document.querySelectorAll(".node-port, .node-param-port.modulation-input")) {
        const endpoint = endpointFromElement(target);
        const rect = endpointHitboxClientRect(endpoint);
        const elementRect = target.getBoundingClientRect();
        if (
          !rect ||
          clientX < rect.left ||
          clientX > rect.right ||
          clientY < rect.top ||
          clientY > rect.bottom
        ) {
          continue;
        }
        const centerX = endpoint.io === "output" ? elementRect.right : elementRect.left;
        const centerY = elementRect.top + elementRect.height * 0.5;
        const distance = Math.hypot(clientX - centerX, clientY - centerY);
        if (distance < bestDistance) {
          best = target;
          bestDistance = distance;
        }
      }
      return best;
    }

    function connectEndpoints(a, b, options = {}) {
      if (!a || !b || endpointsMatch(a, b)) {
        return false;
      }
      const reversedOptions = () => ({
        ...options,
        tracePoints: normalizeNodeGraphTracePoints(options.tracePoints).reverse(),
      });
      if (a.io === "output" && b.io === "input") {
        return deps.connectPorts(a.node, a.port, b.node, b.port, options);
      }
      if (a.io === "input" && b.io === "output") {
        return deps.connectPorts(b.node, b.port, a.node, a.port, reversedOptions());
      }
      if (a.io === "output" && b.io === "modulation") {
        return deps.connectModulation(a.node, a.port, b.node, b.param, options);
      }
      if (a.io === "modulation" && b.io === "output") {
        return deps.connectModulation(b.node, b.port, a.node, a.param, reversedOptions());
      }
      return false;
    }

    function endpointsAreDuplicate(a, b) {
      if (!a || !b) {
        return false;
      }
      const patch = deps.patch();
      if (a.io === "output" && b.io === "input") {
        return patch.connections.some(
          (connection) =>
            connection.sourceNode === a.node &&
            connection.sourcePort === a.port &&
            connection.destinationNode === b.node &&
            connection.destinationPort === b.port,
        );
      }
      if (a.io === "input" && b.io === "output") {
        return patch.connections.some(
          (connection) =>
            connection.sourceNode === b.node &&
            connection.sourcePort === b.port &&
            connection.destinationNode === a.node &&
            connection.destinationPort === a.port,
        );
      }
      if (a.io === "output" && b.io === "modulation") {
        return patch.modulations.some(
          (modulation) =>
            modulation.sourceNode === a.node &&
            modulation.sourcePort === a.port &&
            modulation.destinationNode === b.node &&
            modulation.destinationParam === b.param,
        );
      }
      if (a.io === "modulation" && b.io === "output") {
        return patch.modulations.some(
          (modulation) =>
            modulation.sourceNode === b.node &&
            modulation.sourcePort === b.port &&
            modulation.destinationNode === a.node &&
            modulation.destinationParam === a.param,
        );
      }
      return false;
    }

    function endpointsAreParameterAudioMismatch(a, b) {
      return Boolean(
        a &&
        b &&
        ((a.io === "modulation" && b.io === "input") ||
          (a.io === "input" && b.io === "modulation")),
      );
    }

    function endpointsShareNode(a, b) {
      return Boolean(a && b && a.node === b.node);
    }

    function endpointsShouldBurst(a, b) {
      if (endpointsShareNode(a, b)) {
        return false;
      }
      return Boolean(
        a &&
        b &&
        (((a.io === "output" && b.io === "output") ||
          (a.io === "input" && b.io === "input")) ||
          endpointsAreParameterAudioMismatch(a, b) ||
          endpointsAreDuplicate(a, b)),
      );
    }

    function dropTargetFromPoint(clientX, clientY) {
      return patchPointTargetFromPoint(clientX, clientY);
    }

    function endpointPoint(endpoint, fallbackElement = null) {
      if (!endpoint) {
        return null;
      }
      if (endpoint.io === "modulation") {
        return deps.modulationPortCenter(endpoint.node, endpoint.param || endpoint.port);
      }
      if (endpoint.io === "input" || endpoint.io === "output") {
        return deps.portCenter(endpoint.node, endpoint.port, endpoint.io);
      }
      const visual = fallbackElement || null;
      if (visual) {
        return deps.elementCenter(visual);
      }
      return null;
    }

    return {
      connectEndpoints,
      createGradient,
      dropTargetFromPoint,
      drawPath,
      dragVisualElement: (element) => element || null,
      endpointFromElement,
      endpointPoint,
      endpointsAreParameterAudioMismatch,
      endpointsMatch,
      endpointsShouldBurst,
      patchPointTargetFromPoint,
      path,
      pointInEndpointHitbox,
      straightPath,
      tracePath,
    };
  }

  function createNodeGraphWireInteractionController(deps) {
    const { helpers, state } = deps;
    let hoveredPatchPoint = null;

    function setHoveredPatchPoint(target) {
      if (hoveredPatchPoint === target) {
        return;
      }
      hoveredPatchPoint?.classList.remove("patch-point-hover");
      hoveredPatchPoint = target || null;
      hoveredPatchPoint?.classList.add("patch-point-hover");
    }

    function clearHover() {
      setHoveredPatchPoint(null);
    }

    function clearDragClass(dragging) {
      dragging?.visualElement?.classList?.remove("dragging");
    }

    function cancelManualTrace() {
      if (!state.manualTrace) {
        return false;
      }
      clearDragClass(state.manualTrace);
      state.manualTrace = null;
      deps.drawWires();
      deps.setHelp("");
      return true;
    }

    function beginManualTrace(event, port) {
      const endpoint = helpers.endpointFromElement(port);
      if (!endpoint || !helpers.pointInEndpointHitbox(endpoint, event.clientX, event.clientY)) {
        return false;
      }
      const visualPort = helpers.dragVisualElement(port);
      state.manualTrace = {
        endpoint,
        from: helpers.endpointPoint(endpoint, port),
        points: [],
        to: deps.clientPoint(event),
        visualElement: visualPort,
      };
      visualPort?.classList.add("dragging");
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      deps.setHelp("Trace mode: click empty space to place trace points, click a compatible patch point to finish. Escape, right click, middle click, or plain click outside cancels.");
      deps.drawWires();
      return true;
    }

    function handleManualTracePointerDown(event) {
      const trace = state.manualTrace;
      if (!trace) {
        return false;
      }
      const eventTarget = event.target instanceof Element ? event.target : null;
      if (event.button !== 0) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        cancelManualTrace();
        return true;
      }

      const target = helpers.dropTargetFromPoint(event.clientX, event.clientY);
      const targetEndpoint = helpers.endpointFromElement(target);
      if (targetEndpoint) {
        const tracePoints = normalizeNodeGraphTracePoints(trace.points);
        const endpointPoint = helpers.endpointPoint(targetEndpoint, target) || deps.clientPoint(event);
        nodeGraphTraceAppendFinalApproachPoint(trace.from, tracePoints, endpointPoint);
        const cleanedTracePoints = nodeGraphTraceCleanFinalDestinationPoints(
          trace.from,
          tracePoints,
          endpointPoint,
        );
        const connected = helpers.connectEndpoints(trace.endpoint, targetEndpoint, {
          replaceDuplicate: true,
          tracePoints: cleanedTracePoints,
          wireType: nodeGraphWireTypes.trace,
        });
        clearDragClass(trace);
        state.manualTrace = null;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        if (connected) {
          deps.setHelp("Trace connected.");
          deps.drawWires();
          return true;
        }
        if (helpers.endpointsShouldBurst(trace.endpoint, targetEndpoint)) {
          const from = trace.from;
          const to = helpers.endpointPoint(targetEndpoint, target) || deps.clientPoint(event);
          deps.drawWires();
          animateDestroyedWire(from, to);
          deps.burstZap(from);
          deps.burstZap(to);
        } else {
          deps.drawWires();
        }
        return true;
      }

      if (eventTarget?.closest?.(".dsp-node, .node-slider-readout, input, textarea, select")) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        cancelManualTrace();
        return true;
      }

      nodeGraphTraceAppendSingleMovePoint(trace.from, trace.points, deps.clientPoint(event));
      trace.to = nodeGraphTraceLastPoint(trace.from, trace.points) || deps.clientPoint(event);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      deps.drawWires();
      return true;
    }

    function animateDestroyedWire(from, to) {
      const svg = deps.svg();
      if (!svg || !from || !to) {
        return;
      }
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("class", "node-wire-path destroyed");
      path.setAttribute("d", helpers.straightPath(from, to));
      path.addEventListener("animationend", () => path.remove(), { once: true });
      svg.append(path);
    }

    function beginWireDragFromElement(event, port) {
      if (event.button !== 0) {
        return;
      }
      if (state.manualTrace) {
        handleManualTracePointerDown(event);
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        beginManualTrace(event, port);
        return;
      }
      if (event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const endpoint = helpers.endpointFromElement(port);
      if (!endpoint) {
        return;
      }
      const visualPort = helpers.dragVisualElement(port);
      if (!helpers.pointInEndpointHitbox(endpoint, event.clientX, event.clientY)) {
        return;
      }
      state.dragging = {
        endpoint,
        from: helpers.endpointPoint(endpoint, port),
        to: deps.clientPoint(event),
        visualElement: visualPort,
      };
      visualPort?.classList.add("dragging");
      port.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      deps.drawWires();
    }

    function beginWireDrag(event) {
      beginWireDragFromElement(event, event.currentTarget);
    }

    function beginPatchPointWireDrag(event) {
      if (state.manualTrace) {
        handleManualTracePointerDown(event);
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      if (
        event.button !== 0 ||
        state.dragging ||
        target?.closest?.(".node-port, .node-param-port.modulation-input, .node-slider-readout, input, textarea, select")
      ) {
        return;
      }
      const patchPoint = helpers.patchPointTargetFromPoint(event.clientX, event.clientY);
      if (!patchPoint) {
        return;
      }
      if (event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      beginWireDragFromElement(event, patchPoint);
    }

    function dragWire(event) {
      if (state.manualTrace) {
        state.manualTrace.to = deps.clientPoint(event);
        deps.drawWires();
        return;
      }
      if (!state.dragging) {
        return;
      }

      state.dragging.to = deps.clientPoint(event);
      deps.drawWires();
    }

    function endWireDrag(event) {
      if (!state.dragging) {
        return;
      }
      const dragging = state.dragging;
      const target = helpers.dropTargetFromPoint(event.clientX, event.clientY);
      const targetEndpoint = helpers.endpointFromElement(target);
      clearDragClass(dragging);
      state.dragging = null;

      const connected = helpers.connectEndpoints(dragging.endpoint, targetEndpoint);

      if (!connected) {
        if (helpers.endpointsShouldBurst(dragging.endpoint, targetEndpoint)) {
          const from = dragging.from;
          const to =
            helpers.endpointPoint(targetEndpoint, target) ||
            deps.clientPoint(event);
          deps.drawWires();
          animateDestroyedWire(from, to);
          deps.burstZap(from);
          deps.burstZap(to);
          if (helpers.endpointsAreParameterAudioMismatch(dragging.endpoint, targetEndpoint)) {
            deps.setHelp("Audio inputs take signal wires. Drop parameter wires on parameter modulation inputs.");
          }
          return;
        }
        deps.drawWires();
      }
    }

    function handlePatchPointHover(event) {
      if (state.sliderDragging) {
        setHoveredPatchPoint(null);
        return;
      }
      const workspace = deps.workspace();
      const target = event.target instanceof Element ? event.target : null;
      if (!workspace?.contains(target)) {
        setHoveredPatchPoint(null);
        return;
      }
      const directTarget = target.closest?.(".node-port, .node-param-port.modulation-input");
      if (directTarget) {
        setHoveredPatchPoint(directTarget);
        return;
      }
      setHoveredPatchPoint(
        helpers.patchPointTargetFromPoint(event.clientX, event.clientY),
      );
    }

    return {
      beginPatchPointWireDrag,
      beginWireDrag,
      cancelManualTrace,
      clearHover,
      dragWire,
      endWireDrag,
      handlePatchPointHover,
    };
  }

  window.createNodeGraphWireHelpers = createNodeGraphWireHelpers;
  window.createNodeGraphWireInteractionController = createNodeGraphWireInteractionController;
}());
