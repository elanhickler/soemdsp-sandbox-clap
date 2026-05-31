function nodeGraphPatchFileName() {
  const info = normalizeNodeGraphPatchInfo(nodeGraphMvp.patch.info);
  const baseName = info.name || "soemdsp-patch";
  const tagName = info.tags && info.tags !== "tags"
    ? `-${info.tags}`
    : "";
  const safeName = `${baseName}${tagName}`
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safeName || "soemdsp-patch"}.json`;
}

function nodeGraphVisualOutputFileName(fingerprint = nodeGraphMvp.rendered?.patchFingerprint || nodeGraphPatchFingerprint()) {
  const fingerprintSuffix = fingerprint ? `-${fingerprint}` : "";
  return nodeGraphPatchFileName().replace(/\.json$/i, `${fingerprintSuffix}-visual.png`);
}

function saveNodeGraphScript() {
  if (!nodeGraphScriptReadyForGraphAction("save")) {
    return;
  }
  const blob = new Blob([`${serializeNodeGraphPatch()}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nodeGraphPatchFileName();
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  setNodeGraphScriptStatus("script saved", true);
}

function loadNodeGraphScript() {
  if (!nodeGraphScriptReadyForGraphAction("load")) {
    return;
  }
  document.getElementById("nodePatchScriptFileInput")?.click();
}

function handleNodeGraphScriptFileLoad(event) {
  const [file] = event.currentTarget.files || [];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      commitNodeGraphPatch(loadNodeGraphPatchFromScript(String(reader.result || "")), {
        status: "script loaded",
      });
    } catch (error) {
      setNodeGraphScriptStatus(error.message, false);
    } finally {
      event.currentTarget.value = "";
    }
  });
  reader.addEventListener("error", () => {
    setNodeGraphScriptStatus("script file read failed", false);
    event.currentTarget.value = "";
  });
  reader.readAsText(file);
}

function handleNodePatchScriptInput(event) {
  scheduleNodeGraphScriptCommit(event.currentTarget.value);
}

async function copyNodeGraphScriptToClipboard() {
  const script = document.getElementById("nodePatchScript");
  const text = script?.value || serializeNodeGraphPatch();
  try {
    await navigator.clipboard.writeText(text);
    setNodeGraphScriptStatus("script copied", true);
  } catch {
    script?.focus();
    script?.select();
    setNodeGraphScriptStatus("copy blocked: select text manually", false);
  }
}

async function pasteNodeGraphScriptFromClipboard() {
  const script = document.getElementById("nodePatchScript");
  try {
    const text = await navigator.clipboard.readText();
    if (script) {
      script.value = text;
    }
    commitNodeGraphScript(text);
  } catch {
    setNodeGraphScriptStatus("paste blocked: use keyboard paste", false);
  }
}

async function updateDefaultNodeGraphPreset() {
  if (!nodeGraphScriptReadyForGraphAction("update default")) {
    return false;
  }
  const text = serializeNodeGraphPatch();
  try {
    const response = await fetch("/api/presets/default", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: text,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }
    nodeGraphMvp.defaultPatch = cloneNodeGraphPatch(nodeGraphMvp.patch);
    setNodeGraphScriptStatus("default preset updated", true);
    return true;
  } catch (error) {
    if (saveNodeGraphLocalDefaultPreset(text)) {
      nodeGraphMvp.defaultPatch = cloneNodeGraphPatch(nodeGraphMvp.patch);
      setNodeGraphScriptStatus("local default preset updated", true);
      return true;
    }
    setNodeGraphScriptStatus(`default update failed: ${error.message}`, false);
    return false;
  }
}

async function handleUpdateDefaultNodeGraphPresetClick(event) {
  if (!confirmNodeGraphDefaultButtonClick(event.currentTarget, () => {
    setNodeGraphScriptStatus("click Confirm Default to update default preset", true);
  })) {
    return;
  }
  flashNodeGraphDefaultButtonSaved(event.currentTarget);
  await updateDefaultNodeGraphPreset();
}
