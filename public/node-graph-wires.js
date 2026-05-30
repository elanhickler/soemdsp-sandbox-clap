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

    function signalWireEndpoints(connection) {
      return {
        destination: {
          io: "input",
          node: connection.destinationNode,
          port: connection.destinationPort,
        },
        source: {
          io: "output",
          node: connection.sourceNode,
          port: connection.sourcePort,
        },
      };
    }

    function modulationWireEndpoints(modulation) {
      return {
        destination: {
          io: "modulation",
          node: modulation.destinationNode,
          param: modulation.destinationParam,
          port: modulation.destinationParam,
        },
        source: {
          io: "output",
          node: modulation.sourceNode,
          port: modulation.sourcePort,
        },
      };
    }

    function pickupFromCandidate(endpoint, kind, index, wire) {
      const endpoints = kind === "modulation"
        ? modulationWireEndpoints(wire)
        : signalWireEndpoints(wire);
      if (endpointsMatch(endpoint, endpoints.source)) {
        return {
          anchorEndpoint: endpoints.destination,
          index,
          kind,
          pickedEndpoint: endpoints.source,
          wire: { ...wire },
        };
      }
      if (endpointsMatch(endpoint, endpoints.destination)) {
        return {
          anchorEndpoint: endpoints.source,
          index,
          kind,
          pickedEndpoint: endpoints.destination,
          wire: { ...wire },
        };
      }
      return null;
    }

    function findPickup(endpoint) {
      if (!endpoint) {
        return null;
      }

      const selectedWire = deps.wireFromSelection();
      if (selectedWire) {
        const selectedPickup = pickupFromCandidate(
          endpoint,
          selectedWire.kind,
          selectedWire.index,
          selectedWire.wire,
        );
        if (selectedPickup) {
          return selectedPickup;
        }
      }

      const patch = deps.patch();
      const signalCandidates = () =>
        (patch.connections || [])
          .map((wire, index) => pickupFromCandidate(endpoint, "signal", index, wire))
          .find(Boolean);
      const modulationCandidates = () =>
        (patch.modulations || [])
          .map((wire, index) => pickupFromCandidate(endpoint, "modulation", index, wire))
          .find(Boolean);

      if (endpoint.io === "input") {
        return signalCandidates() || null;
      }
      if (endpoint.io === "modulation") {
        return modulationCandidates() || null;
      }
      if (endpoint.parameterOutput) {
        return null;
      }
      return null;
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
      if (endpoint.io === "modulation") {
        const row = element.closest(".node-parameter-row");
        const outputPort = row?.querySelector(".node-param-port.parameter-output");
        const rowRect = row?.getBoundingClientRect();
        const outputRect = outputPort?.getBoundingClientRect();
        if (rowRect && rowRect.width > 0 && rowRect.height > 0) {
          const right = outputRect ? Math.max(rowRect.left, outputRect.left) : rowRect.right;
          return {
            bottom: rowRect.bottom,
            height: rowRect.height,
            left: rowRect.left,
            right,
            top: rowRect.top,
            width: right - rowRect.left,
          };
        }
      }

      const hitElement = element.classList.contains("node-param-port")
        ? element
        : element.closest(".node-io-row") || element;
      const rect = hitElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return null;
      }
      return {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
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
        if (
          !rect ||
          clientX < rect.left ||
          clientX > rect.right ||
          clientY < rect.top ||
          clientY > rect.bottom
        ) {
          continue;
        }
        const centerX = rect.left + rect.width * 0.5;
        const centerY = rect.top + rect.height * 0.5;
        const distance = Math.hypot(clientX - centerX, clientY - centerY);
        if (distance < bestDistance) {
          best = target;
          bestDistance = distance;
        }
      }
      return best;
    }

    function connectEndpoints(a, b) {
      if (!a || !b || endpointsMatch(a, b)) {
        return false;
      }
      if (a.io === "output" && b.io === "input") {
        return deps.connectPorts(a.node, a.port, b.node, b.port);
      }
      if (a.io === "input" && b.io === "output") {
        return deps.connectPorts(b.node, b.port, a.node, a.port);
      }
      if (a.io === "output" && b.io === "modulation") {
        return deps.connectModulation(a.node, a.port, b.node, b.param);
      }
      if (a.io === "modulation" && b.io === "output") {
        return deps.connectModulation(b.node, b.port, a.node, a.param);
      }
      return false;
    }

    function recordFromEndpoints(a, b) {
      if (!a || !b || endpointsMatch(a, b)) {
        return null;
      }
      if (a.io === "output" && b.io === "input") {
        return {
          kind: "signal",
          wire: {
            destinationNode: b.node,
            destinationPort: b.port,
            sourceNode: a.node,
            sourcePort: a.port,
          },
        };
      }
      if (a.io === "input" && b.io === "output") {
        return {
          kind: "signal",
          wire: {
            destinationNode: a.node,
            destinationPort: a.port,
            sourceNode: b.node,
            sourcePort: b.port,
          },
        };
      }
      if (a.io === "output" && b.io === "modulation") {
        return {
          kind: "modulation",
          wire: {
            destinationNode: b.node,
            destinationParam: b.param,
            sourceNode: a.node,
            sourcePort: a.port,
          },
        };
      }
      if (a.io === "modulation" && b.io === "output") {
        return {
          kind: "modulation",
          wire: {
            destinationNode: a.node,
            destinationParam: a.param,
            sourceNode: b.node,
            sourcePort: b.port,
          },
        };
      }
      return null;
    }

    function patchHasWire(patch, kind, wire) {
      if (kind === "modulation") {
        return (patch.modulations || []).some(
          (modulation) =>
            modulation.sourceNode === wire.sourceNode &&
            modulation.sourcePort === wire.sourcePort &&
            modulation.destinationNode === wire.destinationNode &&
            modulation.destinationParam === wire.destinationParam,
        );
      }
      return patch.connections.some(
        (connection) =>
          connection.sourceNode === wire.sourceNode &&
          connection.sourcePort === wire.sourcePort &&
          connection.destinationNode === wire.destinationNode &&
          connection.destinationPort === wire.destinationPort,
      );
    }

    function removeWireFromPatch(patch, pickup) {
      if (pickup.kind === "modulation") {
        patch.modulations = (patch.modulations || []).filter((modulation, index) =>
          index !== pickup.index ||
          modulation.sourceNode !== pickup.wire.sourceNode ||
          modulation.sourcePort !== pickup.wire.sourcePort ||
          modulation.destinationNode !== pickup.wire.destinationNode ||
          modulation.destinationParam !== pickup.wire.destinationParam);
        return;
      }
      patch.connections = patch.connections.filter((connection, index) =>
        index !== pickup.index ||
        connection.sourceNode !== pickup.wire.sourceNode ||
        connection.sourcePort !== pickup.wire.sourcePort ||
        connection.destinationNode !== pickup.wire.destinationNode ||
        connection.destinationPort !== pickup.wire.destinationPort);
    }

    function dropPickedWire(dragging, targetEndpoint) {
      const pickup = dragging?.pickup;
      if (!pickup) {
        return false;
      }
      if (endpointsMatch(targetEndpoint, pickup.pickedEndpoint)) {
        deps.drawWires();
        return true;
      }

      const dragAnchorEndpoint = pickup.anchorEndpoint || dragging.endpoint;
      const record = recordFromEndpoints(dragAnchorEndpoint, targetEndpoint);
      if (!record) {
        deps.drawWires();
        return true;
      }

      const patch = deps.clonePatch(deps.patch());
      removeWireFromPatch(patch, pickup);
      if (patchHasWire(patch, record.kind, record.wire)) {
        deps.drawWires();
        return true;
      }
      if (record.kind === "modulation") {
        patch.modulations.push(record.wire);
      } else {
        patch.connections.push(record.wire);
      }
      deps.commitPatch(patch, {
        status: record.kind === "modulation" ? "modulation reconnected" : "wire reconnected",
      });
      deps.setSelection({
        type: "wire",
        kind: record.kind,
        index: record.kind === "modulation" ? patch.modulations.length - 1 : patch.connections.length - 1,
      });
      return true;
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

    function endpointsShouldBurst(a, b) {
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
      dropPickedWire,
      dropTargetFromPoint,
      dragVisualElement: (element) => element || null,
      endpointFromElement,
      endpointPoint,
      endpointsAreParameterAudioMismatch,
      endpointsMatch,
      endpointsShouldBurst,
      findPickup,
      patchPointTargetFromPoint,
      pointInEndpointHitbox,
    };
  }

  window.createNodeGraphWireHelpers = createNodeGraphWireHelpers;
}());
