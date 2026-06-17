function nodeGraphModuleBodyRowCount(type) {
  const definition = nodeGraphModuleDefinitions[type];
  return definition?.parameters?.length || 0;
}

function nodeGraphModuleVisibleBodyRowCount(type) {
  return nodeGraphModuleBodyRowCount(type);
}

const nodeGraphModuleWidthLimits = Object.freeze({
  maxGu: 18,
  minGu: 4,
});

const nodeGraphModuleHeightLimits = Object.freeze({
  maxGu: 24,
  minGu: 1,
});

function nodeGraphModuleWidthLimitsForType(type) {
  if (nodeGraphModuleDefinitions[type]?.layout === "led") {
    return { ...nodeGraphModuleWidthLimits, minGu: 1 };
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "knobWidget") {
    return { ...nodeGraphModuleWidthLimits, minGu: 2 };
  }
  return nodeGraphModuleWidthLimits;
}

function nodeGraphModuleHeightLimitsForType(type) {
  if (nodeGraphModuleDefinitions[type]?.layout === "knobWidget") {
    return { ...nodeGraphModuleHeightLimits, minGu: 2 };
  }
  return nodeGraphModuleHeightLimits;
}

const nodeGraphTextBoxHeightLimits = Object.freeze({
  maxGu: 24,
  minGu: 1,
});

function nodeGraphPatchNodeLayout(node) {
  const patchNode = typeof node === "string" ? nodeGraphPatchNode(node) : node;
  const fallback = nodeGraphModuleDefinitions[patchNode?.type]?.layout;
  if (patchNode?.type === "canvas" && typeof normalizeNodeGraphCanvasScript === "function") {
    const layout = normalizeNodeGraphCanvasScript(patchNode.canvasScript).layout;
    return layout === "oscilloscope" ? "visualScope" : fallback;
  }
  return fallback;
}

function nodeGraphModuleTypeHasHideableOscilloscope(type) {
  const layout = nodeGraphModuleDefinitions[type]?.layout;
  return Boolean(nodeGraphModuleDefinitions[type]) && ![
    "canvas",
    "clapPlugin",
    "filterCurve",
    "graph",
    "image",
    "keyboardController",
    "knobWidget",
    "led",
    "macroControls",
    "moduleHome",
    "moduleShop",
    "pitchModWheel",
    "screenSpaceShader",
    "sliderWidget",
    "speakerProtection",
    "textBox",
    "visualScope",
  ].includes(layout);
}

function nodeGraphPatchNodeHasHideableOscilloscope(node) {
  const patchNode = typeof node === "string" ? nodeGraphPatchNode(node) : node;
  const layout = nodeGraphPatchNodeLayout(patchNode);
  if (layout && layout !== nodeGraphModuleDefinitions[patchNode?.type]?.layout) {
    return false;
  }
  return nodeGraphModuleTypeHasHideableOscilloscope(patchNode?.type);
}

function nodeGraphPatchNodeCanvasScriptGridUnits(node) {
  const patchNode = typeof node === "string" ? nodeGraphPatchNode(node) : node;
  if (patchNode?.type !== "canvas" || typeof normalizeNodeGraphCanvasScript !== "function") {
    return null;
  }
  const script = normalizeNodeGraphCanvasScript(patchNode.canvasScript);
  return {
    heightGu: Number.isFinite(Number(script.gridHeightGu)) ? Number(script.gridHeightGu) : null,
    widthGu: Number.isFinite(Number(script.gridWidthGu)) ? Number(script.gridWidthGu) : null,
  };
}

function nodeGraphDefaultModuleGridWidthUnits(type) {
  if (nodeGraphModuleDefinitions[type]?.layout === "led") {
    return 1;
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "knobWidget") {
    return 4;
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "sliderWidget") {
    return 6;
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "visualScope") {
    return 7;
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "graph") {
    return 14;
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "filterCurve") {
    return 8;
  }
  return 7;
}

function normalizeNodeGraphModuleWidthUnits(type, widthGu) {
  const fallback = nodeGraphDefaultModuleGridWidthUnits(type);
  const limits = nodeGraphModuleWidthLimitsForType(type);
  const value = Math.round(Number(widthGu));
  return Number.isFinite(value)
    ? Math.max(limits.minGu, Math.min(limits.maxGu, value))
    : fallback;
}

function nodeGraphModuleGridWidthUnits(type) {
  return nodeGraphDefaultModuleGridWidthUnits(type);
}

function nodeGraphPatchNodeGridWidthUnits(node) {
  const scriptGrid = nodeGraphPatchNodeCanvasScriptGridUnits(node);
  if (scriptGrid?.widthGu) {
    return normalizeNodeGraphModuleWidthUnits(node?.type, scriptGrid.widthGu);
  }
  return normalizeNodeGraphModuleWidthUnits(node?.type, node?.widthGu);
}

function normalizeNodeGraphModuleHeightUnits(type, heightGu, ui = {}) {
  const fallback = nodeGraphModuleGridHeightUnitsForUi(type, ui);
  const limits = nodeGraphModuleHeightLimitsForType(type);
  const value = Math.round(Number(heightGu));
  return Number.isFinite(value)
    ? Math.max(limits.minGu, Math.min(limits.maxGu, value))
    : fallback;
}

function normalizeNodeGraphTextBoxHeightUnits(heightGu) {
  return normalizeNodeGraphModuleHeightUnits("textBox", heightGu);
}

function nodeGraphModuleSliderBodyHeightGu(type) {
  const rows = nodeGraphModuleVisibleBodyRowCount(type);
  if (rows <= 0) {
    return 0;
  }
  return (
    rows * nodeGraphModuleLayout.sliderRowHeightGu +
    Math.max(0, rows - 1) * nodeGraphModuleLayout.bodyRowGapGu
  );
}

function nodeGraphModuleIoRowCount(type) {
  const definition = nodeGraphModuleDefinitions[type];
  return Math.max(
    definition?.inputs?.length || 0,
    definition?.outputs?.length || 0,
    1,
  );
}

function nodeGraphModuleIoSectionHeightGu(type) {
  const rows = nodeGraphModuleIoRowCount(type);
  const rowHeight = rows * nodeGraphModuleLayout.ioRowHeightGu;
  const gapHeight = Math.max(0, rows - 1) * nodeGraphModuleLayout.ioRowGapGu;
  return Math.max(
    nodeGraphModuleLayout.ioSectionMinHeightGu,
    rowHeight + gapHeight + nodeGraphModuleLayout.ioPaddingYGu,
  );
}

function nodeGraphModuleRequiredHeightUnits(type) {
  return nodeGraphModuleRequiredHeightUnitsForUi(type);
}

function nodeGraphModuleHeaderHeightUnits(ui = {}) {
  const normalizedUi = normalizeNodeGraphPatchNodeUi(ui);
  if (normalizedUi.buttonsHidden && normalizedUi.titleHidden) {
    return 0;
  }
  if (normalizedUi.buttonsHidden) {
    return nodeGraphModuleLayout.headerTitleRowHeightGu;
  }
  if (normalizedUi.titleHidden) {
    return nodeGraphModuleLayout.headerHeightGu - nodeGraphModuleLayout.headerTitleRowHeightGu;
  }
  return nodeGraphModuleLayout.headerHeightGu;
}

function nodeGraphModuleRequiredHeightUnitsForUi(type, ui = {}) {
  if (nodeGraphModuleDefinitions[type]?.layout === "led") {
    return 1;
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "knobWidget") {
    return 4;
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "textBox") {
    return nodeGraphModuleHeaderHeightUnits(ui) + nodeGraphModuleLayout.textBoxBodyMinGu;
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "image") {
    return (
      nodeGraphModuleHeaderHeightUnits(ui) +
      nodeGraphModuleLayout.moduleScopeHeightGu +
      nodeGraphModuleIoSectionHeightGu(type) +
      nodeGraphModuleLayout.fitCushionGu
    );
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "canvas") {
    return (
      nodeGraphModuleHeaderHeightUnits(ui) +
      nodeGraphModuleLayout.moduleScopeHeightGu * 1.5 +
      nodeGraphModuleIoSectionHeightGu(type) +
      nodeGraphModuleLayout.fitCushionGu +
      nodeGraphModuleLayout.moduleGridInsetGu * 2
    );
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "visualScope") {
    return (
      nodeGraphModuleHeaderHeightUnits(ui) +
      nodeGraphModuleGridWidthUnits(type) +
      nodeGraphModuleIoSectionHeightGu(type) +
      nodeGraphModuleLayout.fitCushionGu
    );
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "graph") {
    return (
      nodeGraphModuleHeaderHeightUnits(ui) +
      nodeGraphModuleLayout.moduleScopeHeightGu * 4 +
      nodeGraphModuleIoSectionHeightGu(type) +
      nodeGraphModuleSliderBodyHeightGu(type) +
      nodeGraphModuleLayout.fitCushionGu +
      nodeGraphModuleLayout.moduleGridInsetGu * 2
    );
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "sliderWidget") {
    return (
      nodeGraphModuleHeaderHeightUnits(ui) +
      nodeGraphModuleLayout.moduleScopeHeightGu +
      nodeGraphModuleIoSectionHeightGu(type) +
      nodeGraphModuleLayout.fitCushionGu +
      nodeGraphModuleLayout.moduleGridInsetGu * 2
    );
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "keyboardController") {
    return nodeGraphModuleHeaderHeightUnits(ui) + 12 + nodeGraphModuleIoSectionHeightGu(type);
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "macroControls") {
    return nodeGraphModuleHeaderHeightUnits(ui) + 5 + nodeGraphModuleIoSectionHeightGu(type);
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "pitchModWheel") {
    return nodeGraphModuleHeaderHeightUnits(ui) + 5 + nodeGraphModuleIoSectionHeightGu(type);
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "filterCurve") {
    return (
      nodeGraphModuleHeaderHeightUnits(ui) +
      nodeGraphModuleLayout.moduleScopeHeightGu * 1.5 +
      nodeGraphModuleIoSectionHeightGu(type) +
      nodeGraphModuleSliderBodyHeightGu(type) +
      nodeGraphModuleLayout.fitCushionGu +
      nodeGraphModuleLayout.moduleGridInsetGu * 2
    );
  }
  const moduleScopeHeightGu = normalizeNodeGraphPatchNodeUi(ui).oscilloscopeHidden && nodeGraphModuleTypeHasHideableOscilloscope(type)
    ? 0
    : nodeGraphModuleLayout.moduleScopeHeightGu;
  return (
    nodeGraphModuleHeaderHeightUnits(ui) +
    moduleScopeHeightGu +
    nodeGraphModuleIoSectionHeightGu(type) +
    nodeGraphModuleSliderBodyHeightGu(type) +
    nodeGraphModuleLayout.fitCushionGu +
    nodeGraphModuleLayout.moduleGridInsetGu * 2
  );
}

function nodeGraphModuleGridHeightUnits(type) {
  return nodeGraphModuleGridHeightUnitsForUi(type);
}

function nodeGraphModuleGridHeightUnitsForUi(type, ui = {}) {
  if (nodeGraphModuleDefinitions[type]?.layout === "led") {
    return 1;
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "knobWidget") {
    return 4;
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "textBox") {
    return Math.ceil(nodeGraphModuleRequiredHeightUnitsForUi(type, ui));
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "image") {
    return Math.ceil(nodeGraphModuleRequiredHeightUnitsForUi(type, ui));
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "canvas") {
    return Math.ceil(nodeGraphModuleRequiredHeightUnitsForUi(type, ui));
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "visualScope") {
    return Math.ceil(nodeGraphModuleRequiredHeightUnitsForUi(type, ui));
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "graph") {
    return Math.ceil(nodeGraphModuleRequiredHeightUnitsForUi(type, ui));
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "sliderWidget") {
    return Math.ceil(nodeGraphModuleRequiredHeightUnitsForUi(type, ui));
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "filterCurve") {
    return Math.ceil(nodeGraphModuleRequiredHeightUnitsForUi(type, ui));
  }
  const headerReduction = nodeGraphModuleLayout.headerHeightGu - nodeGraphModuleHeaderHeightUnits(ui);
  const roughGridUnits = 4 + nodeGraphModuleVisibleBodyRowCount(type) * 1.25 - headerReduction;
  const requiredGridUnits = nodeGraphModuleRequiredHeightUnitsForUi(type, ui);
  const defaultGridUnits = Math.ceil(Math.max(roughGridUnits, requiredGridUnits));
  return type === "audioPlayer"
    ? Math.min(nodeGraphModuleHeightLimits.maxGu, defaultGridUnits + 4)
    : defaultGridUnits;
}

function nodeGraphPatchNodeGridHeightUnits(node) {
  const scriptGrid = nodeGraphPatchNodeCanvasScriptGridUnits(node);
  if (scriptGrid?.heightGu) {
    return normalizeNodeGraphModuleHeightUnits(node?.type, scriptGrid.heightGu);
  }
  const effectiveUi = normalizeNodeGraphPatchNodeUi({
    ...node?.ui,
    buttonsHidden: node?.ui?.buttonsHidden || nodeGraphMvp.moduleButtonsVisible === false,
  });
  if (Object.hasOwn(node || {}, "heightGu")) {
    return normalizeNodeGraphModuleHeightUnits(node.type, node.heightGu, effectiveUi);
  }
  return nodeGraphModuleGridHeightUnitsForUi(node?.type, effectiveUi);
}
