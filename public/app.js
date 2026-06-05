function nodeSandboxInterfaceLayoutSignature() {
  const shell = document.querySelector(".shell");
  const workspace = document.getElementById("nodeGraphWorkspace");
  const nodes = document.getElementById("nodeGraphNodes");
  const shellRect = shell?.getBoundingClientRect();
  const workspaceRect = workspace?.getBoundingClientRect();
  return [
    document.documentElement.scrollWidth,
    document.documentElement.scrollHeight,
    Math.round(shellRect?.width || 0),
    Math.round(shellRect?.height || 0),
    Math.round(workspaceRect?.width || 0),
    Math.round(workspaceRect?.height || 0),
    nodes?.childElementCount || 0,
  ].join(":");
}

async function waitForNodeSandboxStableLayout(stableFrames = 4, maxFrames = 24) {
  let previous = "";
  let stable = 0;
  for (let frame = 0; frame < maxFrames && stable < stableFrames; frame += 1) {
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    const current = nodeSandboxInterfaceLayoutSignature();
    stable = current === previous ? stable + 1 : 0;
    previous = current;
  }
}

async function markNodeSandboxInterfaceReady() {
  await document.fonts?.ready;
  await waitForNodeSandboxStableLayout();
  document.documentElement.dataset.nodeSandboxInterfaceReady = "true";
  globalThis.nodeSandboxInterfaceReady = true;
  window.dispatchEvent(new CustomEvent("nodeSandboxInterfaceReady", {
    detail: { reason: "stable-layout" },
  }));
}

async function initSandboxApp() {
  loadSignalPlotSettings();
  await Promise.all([
    loadManifest(),
    initNodeGraphMvp(),
  ]);
  await markNodeSandboxInterfaceReady();
}

initSandboxApp().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Sandbox startup failed", error);
  document.documentElement.dataset.nodeSandboxInterfaceError = message;
  document.documentElement.dataset.nodeSandboxInterfaceReady = "error";
  globalThis.nodeSandboxInterfaceReady = true;
  window.dispatchEvent(new CustomEvent("nodeSandboxInterfaceReady", {
    detail: { error: message },
  }));
});
