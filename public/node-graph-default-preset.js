const nodeGraphDefaultPresetUrl = "./public/presets/default.json";
const nodeGraphDefaultPresetStorageKey = "soemdsp-sandbox.defaultPatch.live.v2";

async function loadNodeGraphDefaultPresetPatch() {
  const storedPatch = loadNodeGraphLocalDefaultPresetPatch();
  if (nodeGraphDefaultPresetPatchIsUsable(storedPatch)) {
    return storedPatch;
  }
  try {
    const response = await fetch(nodeGraphDefaultPresetUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const fetchedPatch = loadNodeGraphPatchFromScript(await response.text());
    return nodeGraphDefaultPresetPatchIsUsable(fetchedPatch)
      ? fetchedPatch
      : cloneNodeGraphPatch(nodeGraphDefaultPatch);
  } catch {
    return cloneNodeGraphPatch(nodeGraphDefaultPatch);
  }
}

function nodeGraphDefaultPresetPatchIsUsable(patch) {
  if (!patch || !Array.isArray(patch.nodes)) {
    return false;
  }
  return patch.nodes.some((node) => node?.id === "output" && node?.type === "output");
}

function nodeGraphLocalDefaultPresetAllowed() {
  return ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
}

function loadNodeGraphLocalDefaultPresetPatch() {
  if (!nodeGraphLocalDefaultPresetAllowed()) {
    return null;
  }
  try {
    const text = window.localStorage.getItem(nodeGraphDefaultPresetStorageKey);
    return text ? loadNodeGraphPatchFromScript(text) : null;
  } catch {
    return null;
  }
}

function saveNodeGraphLocalDefaultPreset(text) {
  if (!nodeGraphLocalDefaultPresetAllowed()) {
    return false;
  }
  try {
    window.localStorage.setItem(nodeGraphDefaultPresetStorageKey, text);
    return true;
  } catch {
    return false;
  }
}

function configureNodeGraphDefaultPresetButton() {
  const button = document.getElementById("updateDefaultPresetButton");
  if (!button || !nodeGraphLocalDefaultPresetAllowed()) {
    return;
  }
  button.hidden = false;
}
