function setNodeBootLoadingProgress(value, label = "") {
  const progress = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const bar = document.querySelector(".node-boot-loading-bar");
  const fill = document.getElementById("nodeBootLoadingBarFill");
  const labelElement = document.getElementById("nodeBootLoadingLabel");
  if (bar) {
    bar.setAttribute("aria-valuenow", String(progress));
  }
  if (fill) {
    fill.style.width = `${progress}%`;
  }
  if (label && labelElement) {
    labelElement.textContent = label;
  }
}

function finishNodeBootLoading() {
  if (!document.body.classList.contains("node-boot-loading")) {
    return;
  }
  setNodeBootLoadingProgress(100, "ready");
  document.body.dataset.nodeBootFinished = "interface-ready";
  document.body.classList.remove("node-boot-loading");
  document.body.classList.add("node-boot-fading");
  window.setTimeout(() => {
    document.body.classList.remove("node-boot-fading");
    document.body.classList.add("node-boot-ready");
  }, 333);
}

window.addEventListener("nodeSandboxStartupProgress", (event) => {
  setNodeBootLoadingProgress(event.detail?.progress, event.detail?.label);
});
window.addEventListener("nodeSandboxInterfaceReady", finishNodeBootLoading, { once: true });

if (window.nodeSandboxInterfaceReady) {
  finishNodeBootLoading();
}
