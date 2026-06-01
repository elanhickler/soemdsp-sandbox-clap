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

const nodeGraphTextBoxHeightLimits = Object.freeze({
  maxGu: 24,
  minGu: 1,
});

function nodeGraphDefaultModuleGridWidthUnits(type) {
  return 7;
}

function normalizeNodeGraphModuleWidthUnits(type, widthGu) {
  const fallback = nodeGraphDefaultModuleGridWidthUnits(type);
  const value = Math.round(Number(widthGu));
  return Number.isFinite(value)
    ? Math.max(nodeGraphModuleWidthLimits.minGu, Math.min(nodeGraphModuleWidthLimits.maxGu, value))
    : fallback;
}

function nodeGraphModuleGridWidthUnits(type) {
  return nodeGraphDefaultModuleGridWidthUnits(type);
}

function nodeGraphPatchNodeGridWidthUnits(node) {
  return normalizeNodeGraphModuleWidthUnits(node?.type, node?.widthGu);
}

function normalizeNodeGraphModuleHeightUnits(type, heightGu, ui = {}) {
  const fallback = nodeGraphModuleGridHeightUnitsForUi(type, ui);
  const value = Math.round(Number(heightGu));
  return Number.isFinite(value)
    ? Math.max(nodeGraphModuleHeightLimits.minGu, Math.min(nodeGraphModuleHeightLimits.maxGu, value))
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
  if (nodeGraphModuleDefinitions[type]?.layout === "textBox") {
    return nodeGraphModuleHeaderHeightUnits(ui) + nodeGraphModuleLayout.textBoxBodyMinGu;
  }
  return (
    nodeGraphModuleHeaderHeightUnits(ui) +
    nodeGraphModuleLayout.moduleScopeHeightGu +
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
  if (nodeGraphModuleDefinitions[type]?.layout === "textBox") {
    return Math.ceil(nodeGraphModuleRequiredHeightUnitsForUi(type, ui));
  }
  const headerReduction = nodeGraphModuleLayout.headerHeightGu - nodeGraphModuleHeaderHeightUnits(ui);
  const roughGridUnits = 4 + nodeGraphModuleVisibleBodyRowCount(type) * 1.25 - headerReduction;
  const requiredGridUnits = nodeGraphModuleRequiredHeightUnitsForUi(type, ui);
  return Math.ceil(Math.max(roughGridUnits, requiredGridUnits));
}

function nodeGraphPatchNodeGridHeightUnits(node) {
  if (Object.hasOwn(node || {}, "heightGu")) {
    return normalizeNodeGraphModuleHeightUnits(node.type, node.heightGu, node.ui);
  }
  return nodeGraphModuleGridHeightUnitsForUi(node?.type, node?.ui);
}
