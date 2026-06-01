function createNodeGraphPatchNode(type, options = {}) {
  const node = {
    gx: Number.isFinite(Number(options.gx)) ? Number(options.gx) : 0,
    gy: Number.isFinite(Number(options.gy)) ? Number(options.gy) : 0,
    id: String(options.id || type),
    paramMeta: nodeGraphDefaultParamMetaForType(type),
    params: nodeGraphDefaultParamsForType(type),
    type,
  };
  if (Object.hasOwn(options, "widthGu")) {
    node.widthGu = normalizeNodeGraphModuleWidthUnits(type, options.widthGu);
  }
  const alias = normalizeNodeGraphPatchNodeAlias(options.alias);
  if (alias) {
    node.alias = alias;
  }
  if (Object.hasOwn(options, "heightGu")) {
    node.heightGu = normalizeNodeGraphModuleHeightUnits(type, options.heightGu, options.ui);
  }
  const ui = nodeGraphModuleDefinitions[type]?.layout === "textBox" && !Object.hasOwn(options, "ui")
    ? { buttonsHidden: true }
    : normalizeNodeGraphPatchNodeUi(options.ui);
  if (ui.buttonsHidden || ui.titleHidden) {
    node.ui = ui;
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "textBox") {
    node.layout = normalizeNodeGraphTextBoxLayout(options.layout);
  }
  return node;
}

const nodeGraphDefaultNodeConfigs = Object.freeze([
  createNodeGraphPatchNode("osc", { id: "osc", gx: 1, gy: 1 }),
  createNodeGraphPatchNode("noise", { id: "noise", gx: 0, gy: 11 }),
  {
    ...createNodeGraphPatchNode("gain", { id: "gain", gx: 11, gy: 2 }),
    params: { ...nodeGraphDefaultParamsForType("gain"), amount: 1 },
  },
  {
    ...createNodeGraphPatchNode("output", { id: "output", gx: 22, gy: 9 }),
    params: { ...nodeGraphDefaultParamsForType("output"), volume: 0.1 },
  },
]);

const nodeGraphDefaultConnections = Object.freeze([
  { sourceNode: "osc", sourcePort: "Out", destinationNode: "gain", destinationPort: "In" },
  { sourceNode: "gain", sourcePort: "Out", destinationNode: "output", destinationPort: "Left" },
  { sourceNode: "gain", sourcePort: "Out", destinationNode: "output", destinationPort: "Right" },
]);

const nodeGraphDefaultPatch = Object.freeze({
  audio: {
    targetSampleRate: 88200,
  },
  bypassedNodes: [],
  info: {
    author: "",
    description: "",
    name: "Patch name",
    tags: "tags",
  },
  visual: {
    background: {
      h: 210,
      l: 5,
      s: 0,
    },
    mode: "auto",
    scale: 1,
    style: "glow",
    theme: "cyan-violet",
    trail: 0.35,
  },
  windows: {
    metadata: { left: null, top: null },
    moduleActions: { left: null, top: null },
  },
  grid: { ...nodeGraphGrid },
  view: { widthGu: 31, heightGu: 20 },
  nodes: nodeGraphDefaultNodeConfigs.map((node) => ({ ...node })),
  connections: nodeGraphDefaultConnections.map((connection) => ({ ...connection })),
  modulations: [],
  monitors: [],
});
