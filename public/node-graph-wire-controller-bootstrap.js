

const nodeGraphWireHelpers = window.createNodeGraphWireHelpers({
  clonePatch: cloneNodeGraphPatch,
  commitPatch: commitNodeGraphPatch,
  connectModulation: connectNodeGraphModulation,
  connectPorts: connectNodeGraphPorts,
  drawWires: drawNodeGraphWires,
  elementCenter: nodeGraphElementCenter,
  modulationPortCenter: nodeGraphModulationPortCenter,
  modulationPortSelector: nodeGraphModulationPortSelector,
  patch: () => nodeGraphMvp.patch,
  portCenter: nodeGraphPortCenter,
  portSelector: nodeGraphPortSelector,
  selectWire: selectNodeGraphWire,
  setSelection: setNodeGraphSelection,
  wireFromSelection: nodeGraphWireFromSelection,
  zoomSurface: nodeGraphZoomSurface,
});

const nodeGraphWireInteractions = window.createNodeGraphWireInteractionController({
  burstZap: burstNodeGraphZap,
  clientPoint: nodeGraphClientPoint,
  drawWires: drawNodeGraphWires,
  helpers: nodeGraphWireHelpers,
  setHelp: setNodeInteractionHelp,
  state: nodeGraphMvp,
  svg: () => document.getElementById("nodeWireSvg"),
  workspace: () => document.getElementById("nodeGraphWorkspace"),
});
