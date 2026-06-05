document.documentElement.style.setProperty(
  "--node-boot-cursor-delay",
  `${-(Date.now() % 1000)}ms`,
);

function finishNodeBootLoading() {
  if (!document.body.classList.contains("node-boot-loading")) {
    return;
  }
  document.body.dataset.nodeBootFinished = "interface-ready";
  document.body.classList.remove("node-boot-loading");
  document.body.classList.add("node-boot-fading");
  window.setTimeout(() => {
    document.body.classList.remove("node-boot-fading");
    document.body.classList.add("node-boot-ready");
  }, 333);
}

window.addEventListener("nodeSandboxInterfaceReady", finishNodeBootLoading, { once: true });

if (window.nodeSandboxInterfaceReady) {
  finishNodeBootLoading();
}
