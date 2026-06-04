function serializeNodeGraphPatch(patch = nodeGraphMvp.patch) {
  return JSON.stringify(
    {
      audio: normalizeNodeGraphPatchAudio(patch.audio),
      bypassedNodes: patch.bypassedNodes || [],
      connections: patch.connections,
      format: { ...nodeGraphPatchFormat },
      grid: patch.grid,
      info: normalizeNodeGraphPatchInfo(patch.info),
      modulations: patch.modulations || [],
      monitors: normalizeNodeGraphPatchMonitors(patch.monitors, patch),
      nodes: patch.nodes,
      timing: normalizeNodeGraphPatchTiming(patch.timing),
      uiItems: normalizeNodeGraphPatchUiItems(patch.uiItems),
      view: normalizeNodeGraphPatchView(patch.view),
      visual: normalizeNodeGraphPatchVisual(patch.visual),
    },
    null,
    2,
  );
}

function nodeGraphPatchFingerprint(patch = nodeGraphMvp.patch) {
  const text = typeof patch === "string" ? patch : serializeNodeGraphPatch(patch);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
