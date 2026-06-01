function nodeGraphTracePoint(value) {
  return Math.round((Number(value) || 0) - 0.5) + 0.5;
}

function normalizeNodeGraphTracePoints(points) {
  if (!Array.isArray(points)) {
    return [];
  }
  return points
    .map((point) => ({
      x: nodeGraphTracePoint(point?.x),
      y: nodeGraphTracePoint(point?.y),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function nodeGraphTraceWaypointAttribute(points) {
  return JSON.stringify(normalizeNodeGraphTracePoints(points));
}

function nodeGraphTracePushPoint(points, point) {
  const previous = points[points.length - 1];
  if (!previous || Math.abs(previous.x - point.x) > 0.001 || Math.abs(previous.y - point.y) > 0.001) {
    points.push(point);
  }
}

function nodeGraphTraceLastPoint(from, points) {
  const anchors = normalizeNodeGraphTracePoints([from, ...normalizeNodeGraphTracePoints(points)]);
  return anchors.at(-1) || null;
}

function nodeGraphTraceSingleMovePoint(from, points, point) {
  const previous = nodeGraphTraceLastPoint(from, points);
  const target = normalizeNodeGraphTracePoints([point])[0];
  if (!previous || !target) {
    return target || previous;
  }
  const dx = Math.abs(target.x - previous.x);
  const dy = Math.abs(target.y - previous.y);
  return dx >= dy
    ? { x: target.x, y: previous.y }
    : { x: previous.x, y: target.y };
}

function nodeGraphTraceAppendSingleMovePoint(from, points, point) {
  const nextPoint = nodeGraphTraceSingleMovePoint(from, points, point);
  if (nextPoint) {
    nodeGraphTracePushPoint(points, nextPoint);
  }
}

function nodeGraphTraceFinalApproachPoint(from, points, point) {
  const previous = nodeGraphTraceLastPoint(from, points);
  const target = normalizeNodeGraphTracePoints([point])[0];
  if (!previous || !target) {
    return target || previous;
  }
  return { x: previous.x, y: target.y };
}

function nodeGraphTraceAppendFinalApproachPoint(from, points, point) {
  const nextPoint = nodeGraphTraceFinalApproachPoint(from, points, point);
  if (nextPoint) {
    nodeGraphTracePushPoint(points, nextPoint);
  }
}

function nodeGraphTracePointBetween(value, a, b) {
  const min = Math.min(a, b) - 0.001;
  const max = Math.max(a, b) + 0.001;
  return value >= min && value <= max;
}

function nodeGraphTraceCleanFinalDestinationPoints(from, points, to) {
  const anchors = normalizeNodeGraphTracePoints([from, ...normalizeNodeGraphTracePoints(points)]);
  const target = normalizeNodeGraphTracePoints([to])[0];
  if (anchors.length < 3 || !target) {
    return normalizeNodeGraphTracePoints(points);
  }

  for (let index = anchors.length - 2; index >= 1; index -= 1) {
    const start = anchors[index - 1];
    const end = anchors[index];
    if (
      Math.abs(start.x - end.x) > 0.001 ||
      !nodeGraphTracePointBetween(target.y, start.y, end.y)
    ) {
      continue;
    }
    const cleaned = anchors.slice(1, index);
    nodeGraphTracePushPoint(cleaned, { x: start.x, y: target.y });
    return cleaned;
  }
  return normalizeNodeGraphTracePoints(points);
}

function nodeGraphTraceOrthogonalPoints(from, points, to) {
  const anchors = normalizeNodeGraphTracePoints([from, ...normalizeNodeGraphTracePoints(points), to]);
  if (anchors.length < 2) {
    return anchors;
  }
  const routed = [];
  nodeGraphTracePushPoint(routed, anchors[0]);
  for (const anchor of anchors.slice(1)) {
    const previous = routed[routed.length - 1];
    if (Math.abs(previous.x - anchor.x) > 0.001 && Math.abs(previous.y - anchor.y) > 0.001) {
      nodeGraphTracePushPoint(routed, { x: anchor.x, y: previous.y });
    }
    nodeGraphTracePushPoint(routed, anchor);
  }
  return routed;
}

function nodeGraphTracePathFromPoints(from, points, to) {
  const allPoints = nodeGraphTraceOrthogonalPoints(from, points, to);
  if (!allPoints.length) {
    return "";
  }
  const [start, ...rest] = allPoints;
  return [
    `M ${start.x} ${start.y}`,
    ...rest.map((point) => `L ${point.x} ${point.y}`),
  ].join(" ");
}
