// Bespoke display renderer for the oscilloscopeBank module (displayType
// "oscilloscopeBankBurn"), extracted out of node-graph-module-scopes.js.
// Draws each voice as a bipolar stem at its phase position, colored by pan,
// with additive blending (Hypersaw's own display uses worklet -> main
// thread, not the per-sample audio-rate signal graph) so overlapping voices
// brighten rather than overpaint, and phosphor persistence via painting a
// translucent black rect instead of clearing.

function nodeGraphOscilloscopeBankPanColor(pan) {
  const p = clampNodeSliderValue(Number(pan) || 0, -1, 1);
  let r, g, b;
  if (p <= 0) {
    // -1 (red) .. 0 (green)
    const t = p + 1; // 0..1
    r = Math.round(255 * (1 - t));
    g = Math.round(255 * t);
    b = 0;
  } else {
    // 0 (green) .. +1 (blue)
    const t = p; // 0..1
    r = 0;
    g = Math.round(255 * (1 - t));
    b = Math.round(255 * t);
  }
  return `rgb(${r}, ${g}, ${b})`;
}

function drawNodeGraphOscilloscopeBankBurnItem(renderer, item, pixelRatio) {
  const nodeId = item?.slot?.nodeId;
  if (!nodeId) {
    return;
  }
  const canvas = nodeGraphModuleScopeLocalFallbackCanvas(item?.slot);
  const screenElement = item?.screenElement || item?.slot?.scopeElement;
  if (!canvas || !syncNodeGraphModuleScopeLocalFallbackCanvas(canvas, screenElement, pixelRatio)) {
    return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  // Burn-in decay: normal (non-additive) compositing so the fade-to-black
  // actually darkens rather than brightening what's already there.
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const phases = readNodeGraphDataInput(nodeId, "Phases");
  const amplitudes = readNodeGraphDataInput(nodeId, "Amplitudes");
  const pans = readNodeGraphDataInput(nodeId, "Pans");
  if (!Array.isArray(phases) || !phases.length || !Array.isArray(amplitudes) || !amplitudes.length) {
    return;
  }

  const centerY = canvas.height / 2;
  const halfHeight = canvas.height / 2;
  const lineWidth = Math.max(1, canvas.width / 240);

  ctx.globalCompositeOperation = "lighter";
  ctx.lineWidth = lineWidth;
  const count = Math.min(phases.length, amplitudes.length);
  for (let i = 0; i < count; i++) {
    const phase = Number(phases[i]);
    const amplitude = Number(amplitudes[i]);
    if (!Number.isFinite(phase) || !Number.isFinite(amplitude)) {
      continue;
    }
    const pan = Array.isArray(pans) ? Number(pans[i]) : 0;
    const x = clampNodeSliderValue(phase, 0, 1) * canvas.width;
    const y = centerY - clampNodeSliderValue(amplitude, -1.5, 1.5) * halfHeight;
    ctx.strokeStyle = nodeGraphOscilloscopeBankPanColor(pan);
    ctx.beginPath();
    ctx.moveTo(x, centerY);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
}

nodeGraphModuleScopeCustomRenderers.oscilloscopeBankBurn = drawNodeGraphOscilloscopeBankBurnItem;
