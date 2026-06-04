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
  } else if (nodeGraphModuleDefinitions[type]?.layout === "image") {
    node.layout = normalizeNodeGraphImageLayout(options.layout);
  }
  if (type === "graph") {
    node.graph = normalizeNodeGraphGraph(options.graph);
  }
  if (type === "codeblock") {
    node.codeblock = normalizeNodeGraphCodeblock(options.codeblock);
  }
  return node;
}

const nodeGraphDefaultNodeConfigs = Object.freeze([]);

const nodeGraphDefaultConnections = Object.freeze([]);

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
  timing: {
    tempoBpm: 120,
    timeSignatureDenominator: 4,
    timeSignatureNumerator: 4,
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
  uiItems: [],
});
