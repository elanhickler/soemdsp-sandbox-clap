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

function nodeGraphPortDisplayLabel(type, port, io) {
  const labels = io === "output"
    ? nodeGraphModuleDefinitions[type]?.outputLabels
    : nodeGraphModuleDefinitions[type]?.inputLabels;
  return labels?.[port] || port;
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
    label.textContent = nodeGraphPortDisplayLabel(type, port, io);
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

function createNodeGraphInputPort(node, type, graphInput) {
  const button = document.createElement("button");
  button.className = "node-param-port graph-input";
  button.type = "button";
  button.dataset.node = node;
  button.dataset.graphInput = graphInput;
  button.dataset.port = graphInput;
  button.dataset.io = "graph";
  button.dataset.alias = `${nodeGraphNodeDisplayName(node)}.${graphInput}`;
  button.setAttribute("aria-label", `${nodeGraphNodeLabels[type]} ${graphInput} graph input`);
  return button;
}

function createNodeGraphInputSection(node, type) {
  const graphInputs = nodeGraphModuleGraphInputs(type);
  if (!graphInputs.length) {
    return null;
  }
  const section = document.createElement("div");
  section.className = "dsp-node-graph-input-section";
  for (const graphInput of graphInputs) {
    const row = document.createElement("div");
    row.className = "node-graph-input-row";
    row.dataset.node = node;
    row.dataset.graphInput = graphInput;
    row.dataset.port = graphInput;
    row.dataset.io = "graph";
    row.dataset.alias = `${nodeGraphNodeDisplayName(node)}.${graphInput}`;
    row.setAttribute("aria-label", `${nodeGraphNodeLabels[type]} ${graphInput} graph input interaction area`);
    const label = document.createElement("span");
    label.className = "node-graph-input-label";
    label.textContent = graphInput;
    row.append(createNodeGraphInputPort(node, type, graphInput), label);
    section.append(row);
  }
  return section;
}

function createNodeGraphModuleScopeSection(node, type) {
  const section = document.createElement("div");
  section.className = "node-module-scope-window";
  section.dataset.node = node;
  section.dataset.nodeType = type;
  section.dataset.tooltipKey = "module.scopeWindow";
  section.setAttribute("aria-label", `${nodeGraphNodeDisplayName(node)} scope`);
  if (typeof nodeGraphApplyTooltip === "function") {
    nodeGraphApplyTooltip(section, "module.scopeWindow");
  }

  const surface = document.createElement("div");
  surface.className = "node-module-scope-window-surface";
  section.append(surface);

  const analyzer = document.createElement("div");
  analyzer.className = "node-module-scope-analyzer";
  analyzer.hidden = true;
  section.append(analyzer);
  return section;
}

function createNodeGraphLedFace(node, type) {
  const face = document.createElement("div");
  face.className = "node-led-face";
  face.dataset.node = node;
  face.dataset.nodeType = type;
  face.setAttribute("aria-label", `${nodeGraphNodeDisplayName(node)} LED`);
  face.append(createNodeGraphPort(node, type, "In", "input"));
  return face;
}

function createNodeGraphSliderWidgetBody(node, type) {
  const definition = nodeGraphModuleDefinitions[type];
  const body = document.createElement("div");
  body.className = "node-slider-widget-body";
  const parameter = definition?.parameters?.[0];
  if (parameter) {
    const row = createNodeGraphParameter(node, type, parameter);
    row.classList.add("node-slider-widget-row");
    body.append(row);
  }
  return body;
}

function createNodeGraphParameter(node, type, parameter) {
  const row = document.createElement("div");
  row.className = "node-parameter-row";
  row.dataset.param = parameter.key;
  const constraint = normalizeNodeGraphResourceConstraint(parameter.constraint);
  if (constraint) {
    row.dataset.nodeConstraint = constraint;
  }
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
  const metadata = nodeGraphParameterDefinitionMetadata(parameter);
  input.dataset.step = parameter.step;
  input.dataset.mid = parameter.mid;
  input.dataset.default = parameter.defaultValue;
  input.dataset.kind = metadata?.kind || "decimal";
  input.dataset.maxDigits = String(
    normalizeNodeGraphMetadataMaxDigits(metadata?.maxDigits, metadata?.kind),
  );
  input.dataset.unit = parameter.unit ?? "";
  input.dataset.choices = formatNodeMetadataChoices(parameter.choices || []);
  input.dataset.displayChoices = parameter.displayChoices ? "true" : "false";
  input.dataset.divideChoicesVisibly = parameter.divideChoicesVisibly ? "true" : "false";
  input.dataset.linearSmoothing = parameter.linearSmoothing === false ? "false" : "true";
  input.dataset.nonlinearSlider = metadata?.nonlinearSlider ? "true" : "false";
  input.dataset.showSign = parameter.showSign ? "true" : "false";
  input.dataset.wraparound = parameter.wraparound ? "true" : "false";
  input.setAttribute("aria-label", `${nodeGraphNodeLabels[type]} ${parameter.label}`);
  label.append(input);
  row.append(label);
  row.append(createNodeParameterOutputPort(node, type, parameter));
  return row;
}

function normalizeNodeGraphResourceConstraint(value) {
  const constraint = String(value || "").trim().toLowerCase();
  return ["cpu", "ram", "gpu"].includes(constraint) ? constraint : "";
}
