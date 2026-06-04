function normalizeNodeGraphPatchInfo(info = {}) {
  return {
    author: nodeGraphOneLineText(info.author),
    description: String(info.description ?? "").trim(),
    name: nodeGraphOneLineText(info.name),
    tags: nodeGraphOneLineText(info.tags),
  };
}

function normalizeNodeGraphPatchAudio(audio = {}) {
  const targetSampleRate = Number(audio?.targetSampleRate);
  return {
    targetSampleRate: Number.isFinite(targetSampleRate)
      ? Math.max(8000, Math.min(768000, targetSampleRate))
      : 88200,
  };
}

function normalizeNodeGraphPatchTiming(timing = {}) {
  const tempoBpm = Math.round(Number(timing?.tempoBpm));
  const numerator = Math.round(Number(timing?.timeSignatureNumerator));
  const denominator = Math.round(Number(timing?.timeSignatureDenominator));
  return {
    tempoBpm: Number.isFinite(tempoBpm)
      ? Math.max(1, Math.min(320, tempoBpm))
      : 120,
    timeSignatureDenominator: Number.isFinite(denominator)
      ? Math.max(1, Math.min(32, denominator))
      : 4,
    timeSignatureNumerator: Number.isFinite(numerator)
      ? Math.max(1, Math.min(32, numerator))
      : 4,
  };
}

function normalizeNodeGraphPatchGrid(grid = {}) {
  const fallbackSize = Number(grid?.sizePx);
  const fallback = Number.isFinite(fallbackSize) && fallbackSize > 0
    ? fallbackSize
    : nodeGraphGrid.sizePx;
  const width = Number(grid?.widthPx);
  const height = Number(grid?.heightPx);
  const widthPx = Number.isFinite(width) && width > 0 ? width : fallback;
  const heightPx = Number.isFinite(height) && height > 0 ? height : fallback;
  return {
    heightPx: Math.max(8, Math.min(96, heightPx)),
    sizePx: Math.max(8, Math.min(96, Math.min(widthPx, heightPx))),
    widthPx: Math.max(8, Math.min(96, widthPx)),
  };
}

function normalizeNodeGraphWindowPosition(position = {}) {
  const source = position && typeof position === "object" ? position : {};
  const left = source.left === null || source.left === undefined ? NaN : Number(source.left);
  const top = source.top === null || source.top === undefined ? NaN : Number(source.top);
  return {
    left: Number.isFinite(left) ? Math.max(0, left) : null,
    top: Number.isFinite(top) ? Math.max(0, top) : null,
  };
}

function normalizeNodeGraphPatchWindows(windows = {}) {
  return {
    metadata: normalizeNodeGraphWindowPosition(windows.metadata),
    moduleActions: normalizeNodeGraphWindowPosition(windows.moduleActions),
  };
}

const nodeGraphWorkspaceViewLimits = Object.freeze({
  minHeightGu: 4,
  minWidthGu: 4,
});

function normalizeNodeGraphPatchView(view = {}) {
  const widthGu = Math.round(Number(view?.widthGu));
  const heightGu = Math.round(Number(view?.heightGu));
  return {
    heightGu: Number.isFinite(heightGu)
      ? Math.max(0, heightGu)
      : 0,
    widthGu: Number.isFinite(widthGu)
      ? Math.max(0, widthGu)
      : 0,
  };
}

function normalizeNodeGraphPatchUiItems(uiItems = [], options = {}) {
  if (!Array.isArray(uiItems)) {
    return [];
  }

  const nodeIds = options.nodeIds instanceof Set ? options.nodeIds : null;
  const seen = new Set();
  return uiItems
    .map((item, index) => {
      const source = item && typeof item === "object" ? item : {};
      const sourceNodeId = String(source.sourceNodeId || "").trim();
      if (nodeIds && (!sourceNodeId || !nodeIds.has(sourceNodeId))) {
        return null;
      }
      const idSource = String(source.id || "").trim() || `ui-${index + 1}`;
      const id = idSource.replace(/[^a-z0-9_-]/gi, "-").slice(0, 64) || `ui-${index + 1}`;
      if (seen.has(id)) {
        return null;
      }
      seen.add(id);
      const x = Math.round(Number(source.x));
      const y = Math.round(Number(source.y));
      const w = Math.round(Number(source.w));
      const h = Math.round(Number(source.h));
      const label = nodeGraphOneLineText(source.label).slice(0, 64) || sourceNodeId || id;
      return {
        h: Number.isFinite(h) ? Math.max(28, Math.min(240, h)) : 44,
        id,
        label,
        sourceNodeId,
        w: Number.isFinite(w) ? Math.max(64, Math.min(360, w)) : 132,
        x: Number.isFinite(x) ? Math.max(0, Math.min(2000, x)) : 24,
        y: Number.isFinite(y) ? Math.max(0, Math.min(2000, y)) : 24,
      };
    })
    .filter(Boolean);
}
