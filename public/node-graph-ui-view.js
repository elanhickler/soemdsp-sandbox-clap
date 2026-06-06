function nodeGraphUiItemTypeForNode(node) {
  return node?.type === "graph" ? "graphEditor" : "moduleControl";
}

function createNodeGraphUiItemElement(item) {
  const sourceNode = nodeGraphPatchNode(item.sourceNodeId);
  const article = document.createElement("article");
  article.className = `node-ui-item node-ui-item-${item.type || "moduleControl"}`;
  article.dataset.uiItem = item.id;
  article.dataset.sourceNode = item.sourceNodeId;
  article.style.left = `${item.x}px`;
  article.style.top = `${item.y}px`;
  article.style.width = `${item.w}px`;
  article.style.height = `${item.h}px`;

  const header = document.createElement("div");
  header.className = "node-ui-item-header";
  const title = document.createElement("strong");
  title.textContent = sourceNode ? nodeGraphPatchNodeTitle(sourceNode) : item.label;
  const meta = document.createElement("span");
  meta.textContent = sourceNode?.type === "graph" ? "graph editor" : "ui item";
  header.append(title, meta);
  article.append(header);

  const body = document.createElement("div");
  body.className = "node-ui-item-body";
  if (sourceNode?.type === "graph") {
    const display = document.createElement("div");
    display.className = "node-module-graph-display node-ui-graph-display";
    display.dataset.graphNode = sourceNode.id;
    display.tabIndex = 0;
    display.setAttribute("aria-label", `${nodeGraphNodeDisplayName(sourceNode.id)} UI graph editor`);
    display.addEventListener("pointerdown", beginNodeGraphGraphNodeDrag, true);
    renderNodeGraphGraphDisplay(display, sourceNode.graph);
    body.append(display);
  } else {
    const empty = document.createElement("div");
    empty.className = "node-ui-item-placeholder";
    empty.textContent = sourceNode ? "UI control coming soon" : "missing source module";
    body.append(empty);
  }
  article.append(body);
  return article;
}

function renderNodeGraphUiView() {
  const stage = document.getElementById("nodeUiViewStage");
  const status = document.getElementById("nodeUiViewStatus");
  if (!stage) {
    return;
  }
  const items = normalizeNodeGraphPatchUiItems(
    nodeGraphMvp.patch.uiItems,
    { nodeIds: new Set(nodeGraphMvp.patch.nodes.map((node) => node.id)) },
  );
  stage.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "node-ui-view-empty";
    empty.textContent = "Add a Graph module to UI from its action menu.";
    stage.append(empty);
  } else {
    items.forEach((item) => stage.append(createNodeGraphUiItemElement(item)));
  }
  if (status) {
    status.textContent = items.length === 1 ? "1 UI item" : `${items.length} UI items`;
  }
}
