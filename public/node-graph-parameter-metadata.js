function nodeGraphDefaultParamsForType(type) {
  const params = {};
  for (const parameter of nodeGraphModuleDefinitions[type]?.parameters || []) {
    const value = Number(parameter.defaultValue);
    params[parameter.key] = Number.isFinite(value) ? value : 0;
  }
  return params;
}

function nodeGraphModuleOutputPorts(type) {
  const definition = nodeGraphModuleDefinitions[type];
  if (!definition) {
    return [];
  }
  return [
    ...(definition.outputs || []),
    ...(definition.parameters || []).map((parameter) => parameter.key),
  ];
}

const nodeGraphCodeblockDefaultCode = "Out1 = In1;";
const nodeGraphCodeblockPortNamePattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const nodeGraphCodeblockShadowedGlobals = Object.freeze([
  "window",
  "document",
  "fetch",
  "Function",
  "eval",
  "globalThis",
  "self",
]);
const nodeGraphCodeblockReservedNames = Object.freeze(new Set([
  ...nodeGraphCodeblockShadowedGlobals,
  "arguments",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "null",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]));

function nodeGraphCodeblockIdentifierIsValid(name) {
  const value = String(name || "").trim();
  return nodeGraphCodeblockPortNamePattern.test(value) &&
    !nodeGraphCodeblockReservedNames.has(value);
}

function normalizeNodeGraphCodeblockPortList(value, fallbackPrefix = "In") {
  const raw = Array.isArray(value)
    ? value
    : String(value ?? "").split(/[\s,]+/);
  const ports = [];
  const seen = new Set();
  for (const item of raw) {
    const name = String(item || "").trim();
    if (!nodeGraphCodeblockIdentifierIsValid(name) || seen.has(name)) {
      continue;
    }
    seen.add(name);
    ports.push(name.slice(0, 32));
  }
  if (!ports.length) {
    ports.push(`${fallbackPrefix}1`);
  }
  return ports;
}

function normalizeNodeGraphCodeblock(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const inputs = normalizeNodeGraphCodeblockPortList(source.inputs, "In");
  const reserved = new Set(inputs);
  const rawOutputs = normalizeNodeGraphCodeblockPortList(source.outputs, "Out");
  const outputs = rawOutputs.filter((port) => !reserved.has(port));
  if (!outputs.length) {
    let index = 1;
    let name = "Out1";
    while (reserved.has(name)) {
      index += 1;
      name = `Out${index}`;
    }
    outputs.push(name);
  }
  return {
    code: String(source.code ?? nodeGraphCodeblockDefaultCode),
    inputs,
    outputs,
  };
}

function nodeGraphPatchNodeInputPorts(node) {
  const patchNode = typeof node === "string" ? nodeGraphPatchNode(node) : node;
  if (patchNode?.type === "codeblock") {
    return normalizeNodeGraphCodeblock(patchNode.codeblock).inputs;
  }
  return nodeGraphModuleDefinitions[patchNode?.type]?.inputs || [];
}

function nodeGraphPatchNodeOutputPorts(node) {
  const patchNode = typeof node === "string" ? nodeGraphPatchNode(node) : node;
  if (patchNode?.type === "codeblock") {
    return normalizeNodeGraphCodeblock(patchNode.codeblock).outputs;
  }
  return nodeGraphModuleOutputPorts(patchNode?.type);
}

function nodeGraphParameterOutputPort(type, port) {
  return nodeGraphModuleDefinitions[type]?.parameters?.find(
    (parameter) => parameter.key === port,
  ) || null;
}

function normalizeNodeGraphMetadataChoices(value, fallback = []) {
  const choices = Array.isArray(value)
    ? value
    : String(value ?? "").split(",");
  const normalized = choices
    .map((choice) => String(choice).trim())
    .filter(Boolean);
  return normalized.length ? normalized : [...fallback];
}

function nodeGraphDefaultMetadataMaxDigits(kind = "decimal") {
  return normalizeNodeMetadataKind(kind) === "frequency" ? 5 : 3;
}

function normalizeNodeGraphMetadataMaxDigits(value, kind = "decimal") {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return nodeGraphDefaultMetadataMaxDigits(kind);
  }
  return Math.max(0, Math.min(12, Math.round(number)));
}

function nodeGraphInferParameterMetadataKind(parameter = {}) {
  const explicitKind = normalizeNodeMetadataKind(parameter.kind);
  if (explicitKind && explicitKind !== "decimal") {
    return explicitKind;
  }
  const label = String(parameter.label || parameter.key || "").toLowerCase();
  const unit = String(parameter.unit || "").toLowerCase();
  return unit === "hz" || label.includes("frequency") ? "frequency" : explicitKind;
}

function nodeGraphParameterDefinitionMetadata(parameter) {
  if (!parameter) {
    return null;
  }
  const min = Number(parameter.min);
  const max = Number(parameter.max);
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) && max >= safeMin ? max : safeMin + 1;
  const mid = Number(parameter.mid);
  const def = Number(parameter.defaultValue);
  const step = Number(parameter.step);
  const safeMid = clampNodeSliderValue(Number.isFinite(mid) ? mid : (safeMin + safeMax) / 2, safeMin, safeMax);
  const kind = nodeGraphInferParameterMetadataKind(parameter);
  return {
    choices: normalizeNodeGraphMetadataChoices(parameter.choices || []),
    def: clampNodeSliderValue(Number.isFinite(def) ? def : safeMin, safeMin, safeMax),
    displayChoices: Boolean(parameter.displayChoices),
    divideChoicesVisibly: Object.hasOwn(parameter, "divideChoicesVisibly")
      ? Boolean(parameter.divideChoicesVisibly)
      : Boolean(parameter.choices?.length),
    kind,
    linearSmoothing: parameter.linearSmoothing !== false,
    max: safeMax,
    maxDigits: normalizeNodeGraphMetadataMaxDigits(parameter.maxDigits, kind),
    mid: safeMid,
    min: safeMin,
    nonlinearSlider: Object.hasOwn(parameter, "nonlinearSlider")
      ? Boolean(parameter.nonlinearSlider)
      : Math.abs(safeMid - (safeMin + safeMax) / 2) > Number.EPSILON,
    showSign: Boolean(parameter.showSign),
    step: Number.isFinite(step) && step > 0 ? step : 0,
    unit: parameter.unit ?? "",
    wraparound: Boolean(parameter.wraparound),
  };
}

function normalizeNodeMetadataKindTemplate(template = {}, kind = "decimal") {
  const choices = normalizeNodeGraphMetadataChoices(template.choices || []);
  const min = Number(template.min);
  const max = Number(template.max);
  const mid = Number(template.mid);
  const hasRange = Number.isFinite(min) && Number.isFinite(max) && max > min;
  const nonlinearSlider = Object.hasOwn(template, "nonlinearSlider")
    ? Boolean(template.nonlinearSlider)
    : hasRange && Number.isFinite(mid) && Math.abs(mid - (min + max) / 2) > Number.EPSILON;
  return {
    ...template,
    choices,
    divideChoicesVisibly: Object.hasOwn(template, "divideChoicesVisibly")
      ? Boolean(template.divideChoicesVisibly)
      : Boolean(choices.length),
    maxDigits: normalizeNodeGraphMetadataMaxDigits(template.maxDigits, kind),
    nonlinearSlider,
  };
}

function nodeGraphDefaultParamMetaForType(type) {
  const metadata = {};
  for (const parameter of nodeGraphModuleDefinitions[type]?.parameters || []) {
    metadata[parameter.key] = nodeGraphParameterDefinitionMetadata(parameter);
  }
  return metadata;
}

function normalizeNodeGraphPatchParameterMetadata(type, key, metadata = {}) {
  const parameter = nodeGraphModuleDefinitions[type]?.parameters?.find(
    (candidate) => candidate.key === key,
  );
  const fallback = nodeGraphParameterDefinitionMetadata(parameter);
  if (!fallback) {
    return null;
  }
  const source = metadata && typeof metadata === "object" ? metadata : {};
  let min = Number(Object.hasOwn(source, "min") ? source.min : fallback.min);
  let max = Number(Object.hasOwn(source, "max") ? source.max : fallback.max);
  if (!Number.isFinite(min)) {
    min = fallback.min;
  }
  if (!Number.isFinite(max)) {
    max = fallback.max;
  }
  if (min > max) {
    [min, max] = [max, min];
  }
  if (max <= min) {
    max = min + 1;
  }
  const mid = Number(Object.hasOwn(source, "mid") ? source.mid : fallback.mid);
  const def = Number(Object.hasOwn(source, "def") ? source.def : fallback.def);
  const step = Number(Object.hasOwn(source, "step") ? source.step : fallback.step);
  const kind = normalizeNodeMetadataKind(source.kind || fallback.kind);
  const choices = normalizeNodeGraphMetadataChoices(
    Object.hasOwn(source, "choices") ? source.choices : fallback.choices,
    fallback.choices,
  );
  return {
    choices,
    def: clampNodeSliderValue(Number.isFinite(def) ? def : fallback.def, min, max),
    displayChoices: Object.hasOwn(source, "displayChoices")
      ? Boolean(source.displayChoices)
      : fallback.displayChoices,
    divideChoicesVisibly: Object.hasOwn(source, "divideChoicesVisibly")
      ? Boolean(source.divideChoicesVisibly)
      : Boolean(fallback.divideChoicesVisibly || (choices.length && fallback.displayChoices)),
    kind,
    linearSmoothing: Object.hasOwn(source, "linearSmoothing")
      ? Boolean(source.linearSmoothing)
      : fallback.linearSmoothing,
    max,
    maxDigits: normalizeNodeGraphMetadataMaxDigits(
      Object.hasOwn(source, "maxDigits") ? source.maxDigits : fallback.maxDigits,
      kind,
    ),
    mid: clampNodeSliderValue(Number.isFinite(mid) ? mid : fallback.mid, min, max),
    min,
    nonlinearSlider: Object.hasOwn(source, "nonlinearSlider")
      ? Boolean(source.nonlinearSlider)
      : fallback.nonlinearSlider,
    showSign: Object.hasOwn(source, "showSign") ? Boolean(source.showSign) : fallback.showSign,
    step: Number.isFinite(step) && step > 0 ? step : 0,
    unit: String(Object.hasOwn(source, "unit") ? source.unit ?? "" : fallback.unit),
    wraparound: Object.hasOwn(source, "wraparound")
      ? Boolean(source.wraparound)
      : fallback.wraparound,
  };
}
