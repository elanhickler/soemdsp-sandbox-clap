const nodeSliderHandleHalfWidthPx = 8;
const nodeSliderHandleLeftWallClearancePx = 1;
const nodeSliderHandleRightWallClearancePx = 3;

function clampNodeSliderValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrapNodeSliderValue(value, min, max) {
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) {
    return min;
  }
  return min + ((((value - min) % range) + range) % range);
}

function shortestNodeGraphWrapDelta(from, to, min, max) {
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) {
    return to - from;
  }
  let delta = to - from;
  if (delta > range / 2) {
    delta -= range;
  } else if (delta < -range / 2) {
    delta += range;
  }
  return delta;
}

function createNodeGraphParameterSmoother(initialValue, metadata = {}) {
  const value = Number(initialValue);
  const safeValue = Number.isFinite(value) ? value : 0;
  return {
    current: safeValue,
    linearSmoothing: metadata.linearSmoothing !== false,
    max: Number.isFinite(Number(metadata.max)) ? Number(metadata.max) : 1,
    min: Number.isFinite(Number(metadata.min)) ? Number(metadata.min) : 0,
    target: safeValue,
    wraparound: Boolean(metadata.wraparound),
  };
}

function updateNodeGraphParameterSmoother(smoother, targetValue, metadata = {}) {
  const value = Number(targetValue);
  smoother.target = Number.isFinite(value) ? value : smoother.target;
  smoother.linearSmoothing = metadata.linearSmoothing !== false;
  smoother.max = Number.isFinite(Number(metadata.max)) ? Number(metadata.max) : smoother.max;
  smoother.min = Number.isFinite(Number(metadata.min)) ? Number(metadata.min) : smoother.min;
  smoother.wraparound = Boolean(metadata.wraparound);
  if (!smoother.linearSmoothing) {
    smoother.current = smoother.target;
  }
}

function readNodeGraphSmoothedParameter(smoother, frame, frames) {
  if (!smoother || !smoother.linearSmoothing || frames <= 1) {
    return smoother?.target ?? 0;
  }
  const progress = (frame + 1) / frames;
  const delta = smoother.wraparound
    ? shortestNodeGraphWrapDelta(
      smoother.current,
      smoother.target,
      smoother.min,
      smoother.max,
    )
    : smoother.target - smoother.current;
  const value = smoother.current + delta * progress;
  return smoother.wraparound
    ? wrapNodeSliderValue(value, smoother.min, smoother.max)
    : value;
}

function finishNodeGraphParameterSmoothing(smoothers) {
  for (const smoother of smoothers.values()) {
    smoother.current = smoother.wraparound
      ? wrapNodeSliderValue(smoother.target, smoother.min, smoother.max)
      : smoother.target;
  }
}

function normalizeNodeSliderValue(slider, value, min = Number(slider.min), max = Number(slider.max)) {
  if (!Number.isFinite(value)) {
    return Number.isFinite(min) ? min : 0;
  }
  return nodeSliderShouldWraparound(slider)
    ? wrapNodeSliderValue(value, min, max)
    : clampNodeSliderValue(value, min, max);
}

function normalizedNodeSliderMid(slider) {
  const min = Number(slider.min);
  const max = Number(slider.max);
  const mid = clampNodeSliderValue(Number(slider.dataset.mid), min, max);
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) {
    return 0.5;
  }

  return clampNodeSliderValue((mid - min) / range, 0.000001, 0.999999);
}

function nodeSliderSkewExponent(slider) {
  if (!nodeSliderShouldUseNonlinearSlider(slider)) {
    return 1;
  }
  return Math.log(normalizedNodeSliderMid(slider)) / Math.log(0.5);
}

function nodeSliderValueFromTravel(slider, travel) {
  const min = Number(slider.min);
  const max = Number(slider.max);
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) {
    return min;
  }

  const exponent = nodeSliderSkewExponent(slider);
  const normalizedTravel = nodeSliderShouldWraparound(slider)
    ? wrapNodeSliderValue(travel, 0, 1)
    : clampNodeSliderValue(travel, 0, 1);
  return min + range * normalizedTravel ** exponent;
}

function nodeSliderTravelFromValue(slider, value) {
  const min = Number(slider.min);
  const max = Number(slider.max);
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) {
    return 0;
  }

  const exponent = nodeSliderSkewExponent(slider);
  const normalizedValue = clampNodeSliderValue((value - min) / range, 0, 1);
  return normalizedValue ** (1 / exponent);
}

function nodeSliderVisualLane(surface, slider) {
  const rect = surface?.getBoundingClientRect?.() || { width: 0 };
  const width = Math.max(0, Number(rect.width) || 0);
  const handleHalfWidth = Math.min(nodeSliderHandleHalfWidthPx, width / 2);
  const maxClearance = Math.max(0, width / 2 - handleHalfWidth);
  const leftClearance = nodeSliderShouldWraparound(slider)
    ? 0
    : Math.min(nodeSliderHandleLeftWallClearancePx, maxClearance);
  const rightClearance = nodeSliderShouldWraparound(slider)
    ? 0
    : Math.min(nodeSliderHandleRightWallClearancePx, maxClearance);
  const leftInset = nodeSliderShouldWraparound(slider) ? 0 : handleHalfWidth + leftClearance;
  const rightInset = nodeSliderShouldWraparound(slider) ? 0 : handleHalfWidth + rightClearance;
  return {
    handleHalfWidth,
    inset: leftInset,
    leftInset,
    rightInset,
    travelWidth: Math.max(1, width - leftInset - rightInset),
    width: Math.max(1, width),
  };
}

function nodeSliderVisualCenterFromTravel(slider, surface, travel) {
  const lane = nodeSliderVisualLane(surface, slider);
  const normalizedTravel = clampNodeSliderValue(Number(travel) || 0, 0, 1);
  return lane.inset + normalizedTravel * lane.travelWidth;
}

function nodeSliderHandleRangeFromTravel(slider, surface, travel) {
  const lane = nodeSliderVisualLane(surface, slider);
  const center = nodeSliderVisualCenterFromTravel(slider, surface, travel);
  return {
    center,
    end: center + lane.handleHalfWidth,
    handleHalfWidth: lane.handleHalfWidth,
    start: center - lane.handleHalfWidth,
    width: lane.width,
  };
}

function nodeSliderTravelFromPointer(slider, surface, clientX) {
  const rect = surface.getBoundingClientRect();
  const lane = nodeSliderVisualLane(surface, slider);
  const x = clientX - rect.left;
  const rawTravel = nodeSliderShouldWraparound(slider)
    ? x / lane.width
    : (x - lane.inset) / lane.travelWidth;
  return nodeSliderShouldWraparound(slider)
    ? wrapNodeSliderValue(rawTravel, 0, 1)
    : clampNodeSliderValue(rawTravel, 0, 1);
}

function setNodeSliderMetadata(slider, metadata) {
  slider.min = String(metadata.min);
  slider.max = String(metadata.max);
  slider.dataset.mid = String(clampNodeSliderValue(metadata.mid, metadata.min, metadata.max));
  slider.dataset.default = String(
    clampNodeSliderValue(metadata.def, metadata.min, metadata.max),
  );
  slider.dataset.step = metadata.step > 0 ? String(metadata.step) : "any";
  slider.dataset.kind = metadata.kind || "decimal";
  slider.dataset.maxDigits = String(
    normalizeNodeGraphMetadataMaxDigits(metadata.maxDigits, metadata.kind),
  );
  slider.dataset.unit = metadata.unit ?? "";
  slider.dataset.choices = formatNodeMetadataChoices(metadata.choices || []);
  slider.dataset.displayChoices = metadata.displayChoices ? "true" : "false";
  slider.dataset.divideChoicesVisibly = metadata.divideChoicesVisibly ? "true" : "false";
  slider.dataset.linearSmoothing = metadata.linearSmoothing ? "true" : "false";
  slider.dataset.nonlinearSlider = metadata.nonlinearSlider ? "true" : "false";
  slider.dataset.showSign = metadata.showSign ? "true" : "false";
  slider.dataset.wraparound = metadata.wraparound ? "true" : "false";
  slider.value = String(normalizeNodeSliderValue(slider, Number(slider.value), metadata.min, metadata.max));
  syncNodeSliderReadout(slider);
}

function quantizeNodeSliderDragValue(slider, value) {
  const step = Number(slider.dataset.step);
  if (!Number.isFinite(step) || step <= 0) {
    return value;
  }

  const min = Number(slider.min);
  const origin = Number.isFinite(min) ? min : 0;
  return origin + Math.round((value - origin) / step) * step;
}
