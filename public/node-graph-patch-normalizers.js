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

const nodeGraphScopeShaderDefaultSource = `// Prettyscope-style module scope shader
// V1 authoring contract. This script is saved on one module.
// The current renderer does not execute it yet; use it to design the
// module-local scope renderer that will replace shared phosphor drawing.

export default function drawScope(scope) {
  const signal = scope.signal;
  const style = scope.style;
  const screen = scope.screen;

  // Screen Settings defaults, written as values so this is easy to edit.
  // const backgroundColor = style.background;
  const backgroundColor = "#000000";
  // const screenBurn = style.screenBurn;
  const screenBurn = 0.00;
  // const overdrawPoints = style.overdrawPoints;
  const overdrawPoints = 1;
  // const skipSamples = style.skipSamples;
  const skipSamples = 1;
  // const lineThicknessPx = style.lineThicknessPx;
  const lineThicknessPx = 2.00;

  // Dot 1 is the bright center layer.
  // const dot1Color = style.dot1.color;
  const dot1Color = "#ffa3a8";
  // const dot1SizePx = style.dot1.sizePx;
  const dot1SizePx = 3.18;
  // const dot1Brightness = style.dot1.brightness;
  const dot1Brightness = 4.50;

  // Dot 2 is the larger outer layer.
  // const dot2Color = style.dot2.color;
  const dot2Color = "#444444";
  // const dot2SizePx = style.dot2.sizePx;
  const dot2SizePx = 4.00;
  // const dot2Brightness = style.dot2.brightness;
  const dot2Brightness = 0.45;

  screen.fade({ color: backgroundColor, burn: screenBurn });
  screen.trace(signal, {
    overdrawPoints,
    skipSamples,
    layers: [
      {
        color: dot2Color,
        radiusPx: dot2SizePx * lineThicknessPx,
        brightness: dot2Brightness,
      },
      {
        color: dot1Color,
        radiusPx: dot1SizePx * lineThicknessPx,
        brightness: dot1Brightness,
      },
    ],
  });
}`;

function normalizeNodeGraphScopeShader(scopeShader = {}) {
  const source = typeof scopeShader === "string"
    ? scopeShader
    : scopeShader && typeof scopeShader === "object"
      ? scopeShader.source
      : "";
  const language = String(scopeShader?.language || "scope-js").trim().slice(0, 32) || "scope-js";
  const normalizedSource = String(source || "").trim().slice(0, 100000);
  return {
    enabled: scopeShader?.enabled !== false,
    kind: "scopeShader",
    language,
    source: normalizedSource || nodeGraphScopeShaderDefaultSource,
  };
}

const nodeGraphDefaultCameraColors = Object.freeze([
  "#ff3333",
  "#3399ff",
  "#38c46b",
  "#9b5cff",
]);

const nodeGraphDefaultCameraFrame = Object.freeze({
  height: 489,
  width: 868,
  x: 0,
  y: 0,
});

const nodeGraphCameraFrameLimits = Object.freeze({
  minHeight: 80,
  minWidth: 120,
});

const nodeGraphDefaultCameraResolution = Object.freeze({
  height: 1080,
  width: 1920,
});

function normalizeNodeGraphCameraResolution(value, fallback) {
  const resolution = Math.round(Number(value));
  return Number.isFinite(resolution) ? Math.max(16, Math.min(16384, resolution)) : fallback;
}

function normalizeNodeGraphCameraMidiTrigger(trigger = null) {
  const source = trigger && typeof trigger === "object" ? trigger : {};
  const type = source.type === "cc" ? "cc" : source.type === "note" ? "note" : "";
  if (!type) {
    return null;
  }
  const channel = Math.round(Number(source.channel));
  const number = Math.round(Number(source.number));
  return {
    channel: Number.isFinite(channel) ? Math.max(1, Math.min(16, channel)) : 1,
    number: Number.isFinite(number) ? Math.max(0, Math.min(127, number)) : 0,
    type,
    valueMode: source.valueMode === "threshold" ? "threshold" : "select",
  };
}

function normalizeNodeGraphCamera(camera = {}, index = 0) {
  const source = camera && typeof camera === "object" ? camera : {};
  const fallbackId = `camera-${index + 1}`;
  const id = String(source.id || fallbackId).trim().replace(/[^a-z0-9_-]/gi, "-").slice(0, 64) || fallbackId;
  const color = String(source.color || nodeGraphDefaultCameraColors[index % nodeGraphDefaultCameraColors.length] || "#ff3333").trim();
  const x = Math.round(Number(source.x));
  const y = Math.round(Number(source.y));
  const width = Math.round(Number(source.width));
  const resolutionWidth = normalizeNodeGraphCameraResolution(
    source.resolutionWidth,
    nodeGraphDefaultCameraResolution.width,
  );
  const resolutionHeight = normalizeNodeGraphCameraResolution(
    source.resolutionHeight,
    nodeGraphDefaultCameraResolution.height,
  );
  const aspectRatio = Math.max(0.01, resolutionWidth / resolutionHeight);
  const safeWidth = Number.isFinite(width)
    ? Math.max(nodeGraphCameraFrameLimits.minWidth, Math.min(4000, width))
    : nodeGraphDefaultCameraFrame.width;
  const safeHeight = Math.max(nodeGraphCameraFrameLimits.minHeight, Math.round(safeWidth / aspectRatio));
  return {
    color: /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : nodeGraphDefaultCameraColors[index % nodeGraphDefaultCameraColors.length],
    enabled: source.enabled !== false,
    height: Math.min(4000, safeHeight),
    id,
    midiTrigger: normalizeNodeGraphCameraMidiTrigger(source.midiTrigger),
    name: nodeGraphOneLineText(source.name).slice(0, 64) || `Camera ${index + 1}`,
    resolutionHeight,
    resolutionWidth,
    width: Math.min(4000, Math.round(Math.min(4000, safeHeight) * aspectRatio)),
    x: Number.isFinite(x) ? Math.max(0, Math.min(10000, x)) : nodeGraphDefaultCameraFrame.x,
    y: Number.isFinite(y) ? Math.max(0, Math.min(10000, y)) : nodeGraphDefaultCameraFrame.y,
  };
}

function normalizeNodeGraphPatchCameras(cameras = [], activeCameraId = "") {
  const source = Array.isArray(cameras) && cameras.length ? cameras : [{}];
  const seen = new Set();
  const normalized = source.map((camera, index) => normalizeNodeGraphCamera(camera, index))
    .filter((camera) => {
      if (seen.has(camera.id)) {
        return false;
      }
      seen.add(camera.id);
      return true;
    });
  const safeCameras = normalized.length ? normalized : [normalizeNodeGraphCamera({}, 0)];
  const active = String(activeCameraId || "").trim();
  return {
    activeCameraId: safeCameras.some((camera) => camera.id === active) ? active : safeCameras[0].id,
    cameras: safeCameras,
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
