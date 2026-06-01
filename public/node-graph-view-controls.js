function renderNodeGraphHistoryControls() {
  const undo = document.getElementById("nodeUndoButton");
  const redo = document.getElementById("nodeRedoButton");
  if (!undo || !redo) {
    return;
  }
  const canUndo = nodeGraphMvp.historyIndex > 0;
  const canRedo = nodeGraphMvp.historyIndex < nodeGraphMvp.historySnapshots.length - 1;
  undo.disabled = !canUndo;
  redo.disabled = !canRedo;
  undo.removeAttribute("title");
  redo.removeAttribute("title");
}

function renderNodeGraphGridToggle() {
  const workspace = document.getElementById("nodeGraphWorkspace");
  const button = document.getElementById("nodeGridToggleButton");
  const visible = Boolean(nodeGraphMvp.gridVisible);
  workspace?.classList.toggle("grid-visible", visible);
  if (button) {
    button.textContent = visible ? "Hide Grid" : "Show Grid";
    button.setAttribute("aria-pressed", visible ? "true" : "false");
    button.removeAttribute("title");
  }
  syncNodeUserUiSettingsViewControls();
}

function renderNodeGraphSliderVisibilityToggles() {
  const workspace = document.getElementById("nodeGraphWorkspace");
  const amountButton = document.getElementById("nodeSliderAmountToggleButton");
  const positionButton = document.getElementById("nodeSliderPositionToggleButton");
  const amountVisible = Boolean(nodeGraphMvp.sliderAmountVisible);
  const positionVisible = Boolean(nodeGraphMvp.sliderPositionVisible);
  workspace?.classList.toggle("show-slider-amount", amountVisible);
  workspace?.classList.toggle("hide-slider-position", !positionVisible);
  if (amountButton) {
    amountButton.textContent = amountVisible ? "Hide Amount Slider" : "Show Amount Slider";
    amountButton.setAttribute("aria-pressed", amountVisible ? "true" : "false");
    amountButton.removeAttribute("title");
  }
  if (positionButton) {
    positionButton.textContent = positionVisible ? "Hide Position Slider" : "Show Position Slider";
    positionButton.setAttribute("aria-pressed", positionVisible ? "true" : "false");
    positionButton.removeAttribute("title");
  }
  syncNodeUserUiSettingsViewControls();
}

const nodeGraphSliderLayouts = Object.freeze([
  { key: "text-inside", label: "Text Inside" },
  { key: "label-value-slider", label: "Label Value Slider" },
  { key: "value-unit-left", label: "Value And Unit Left" },
  { key: "value-unit-right", label: "Value And Unit Right" },
  { key: "label-outside", label: "Label Outside" },
  { key: "label-outside-no-unit", label: "Label Outside No Unit" },
  { key: "value-outside", label: "Value Outside" },
  { key: "unit-only", label: "Unit Only" },
  { key: "value-focus", label: "Value Focus" },
]);

function normalizeNodeGraphSliderLayout(value) {
  const aliases = {
    alternate: "label-outside",
    classic: "text-inside",
  };
  const key = aliases[value] || value;
  return nodeGraphSliderLayouts.some((layout) => layout.key === key) ? key : "text-inside";
}

function nodeGraphSliderLayoutLabel(value) {
  const normalized = normalizeNodeGraphSliderLayout(value);
  return nodeGraphSliderLayouts.find((layout) => layout.key === normalized)?.label || "Text Inside";
}

function nextNodeGraphSliderLayout(value) {
  const normalized = normalizeNodeGraphSliderLayout(value);
  const index = nodeGraphSliderLayouts.findIndex((layout) => layout.key === normalized);
  const next = nodeGraphSliderLayouts[(index + 1) % nodeGraphSliderLayouts.length];
  return next?.key || "text-inside";
}

function renderNodeGraphSliderLayout() {
  const layout = normalizeNodeGraphSliderLayout(nodeGraphMvp.sliderLayout);
  nodeGraphMvp.sliderLayout = layout;
  document.getElementById("nodeGraphWorkspace")?.setAttribute("data-slider-layout", layout);
  document.getElementById("nodeWiringPanel")?.setAttribute("data-slider-layout", layout);
  syncNodeUserUiSettingsViewControls();
}

function cycleNodeGraphSliderLayout() {
  nodeGraphMvp.sliderLayout = nextNodeGraphSliderLayout(nodeGraphMvp.sliderLayout);
  renderNodeGraphSliderLayout();
  setNodeInteractionHelp(`Slider layout: ${nodeGraphSliderLayoutLabel(nodeGraphMvp.sliderLayout)}.`);
}

function renderNodeGraphTooltipToggle() {
  const helpStack = document.querySelector(".node-help-stack");
  const help = document.getElementById("nodeInteractionHelp");
  const button = document.getElementById("nodeTooltipToggleButton");
  const visible = Boolean(nodeGraphMvp.tooltipVisible);
  helpStack?.classList.toggle("tips-hidden", !visible);
  if (!visible && help) {
    help.textContent = "";
  }
  if (button) {
    button.textContent = visible ? "Hide Tips" : "Show Tips";
    button.setAttribute("aria-pressed", visible ? "true" : "false");
    button.removeAttribute("title");
  }
}

function toggleNodeGraphGridVisibility() {
  nodeGraphMvp.gridVisible = !nodeGraphMvp.gridVisible;
  renderNodeGraphGridToggle();
}

function toggleNodeGraphTooltipVisibility() {
  nodeGraphMvp.tooltipVisible = !nodeGraphMvp.tooltipVisible;
  renderNodeGraphTooltipToggle();
}

function toggleNodeGraphSliderAmount() {
  nodeGraphMvp.sliderAmountVisible = !nodeGraphMvp.sliderAmountVisible;
  renderNodeGraphSliderVisibilityToggles();
}

function toggleNodeGraphSliderPosition() {
  nodeGraphMvp.sliderPositionVisible = !nodeGraphMvp.sliderPositionVisible;
  renderNodeGraphSliderVisibilityToggles();
}

function renderNodeVisibility() {
  for (const node of document.querySelectorAll(".dsp-node")) {
    node.classList.toggle("removed", !nodeGraphMvp.activeNodes.has(node.dataset.node));
  }
  drawNodeGraphWires();
}

function renderNodePalette() {
  for (const button of document.querySelectorAll("[data-palette-node]")) {
    button.classList.remove("active");
    button.setAttribute("aria-pressed", "false");
  }
}

function setNodeGraphViewMode(mode) {
  if (mode !== "script") {
    flushNodeGraphScriptCommit();
  }
  const settingsMode = mode === "settings";
  const scriptMode = mode === "script";
  const modularOnlyMode = mode === "modular-only";
  const modularMode = modularOnlyMode || (!settingsMode && !scriptMode);
  document.getElementById("nodeWiringPanel")?.classList.toggle("modular-only-view", modularOnlyMode);
  document.getElementById("nodeGraphWorkspace").hidden = !modularMode;
  document.getElementById("nodeScriptView").hidden = !scriptMode;
  document.getElementById("nodeSettingsView").hidden = !settingsMode;
  document.getElementById("nodeSettingsViewButton").classList.toggle("active", settingsMode);
  document.getElementById("nodeModularViewButton").classList.toggle("active", modularMode && !modularOnlyMode);
  document.getElementById("nodeModularOnlyViewButton").classList.toggle("active", modularOnlyMode);
  document.getElementById("nodeSettingsScriptViewButton").classList.toggle("active", scriptMode);
  document.getElementById("nodeSettingsViewButton").setAttribute("aria-pressed", String(settingsMode));
  document.getElementById("nodeModularViewButton").setAttribute("aria-pressed", String(modularMode && !modularOnlyMode));
  document.getElementById("nodeModularOnlyViewButton").setAttribute("aria-pressed", String(modularOnlyMode));
  document.getElementById("nodeSettingsScriptViewButton").setAttribute("aria-pressed", String(scriptMode));
  if (scriptMode) {
    syncNodeGraphScriptView();
  } else if (settingsMode) {
    syncNodeGraphSettingsView();
    scheduleNodeSettingsHeaderTextFit();
  } else {
    drawNodeGraphWires();
  }
}
