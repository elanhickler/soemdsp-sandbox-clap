function bindNodeGraphWorkspaceInteractionEvents() {
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("nodegraph:environment-command", handleNodeGraphEnvironmentCommand);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("contextmenu", openNodeSceneContextMenu);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointerdown", completeNodeGraphModulePlacement, true);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("auxclick", preventNodeGraphMiddleMouseAuxClick);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("mousedown", preventNodeGraphMiddleMouseDefault, true);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointerdown", nodeGraphWireInteractions.beginPatchPointWireDrag, true);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointerdown", beginNodeGraphWorkspacePan, true);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointerdown", beginNodeGraphSmoothZoomDrag, true);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointerdown", beginNodeGraphMarqueeSelection);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointermove", beginNodeGraphMarqueeSelectionOnEntry);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointermove", updateNodeGraphMouseLight);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointerleave", () => {
      nodeGraphWireInteractions.clearHover();
      clearNodeGraphMouseLight();
    });
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointermove", dragNodeGraphMarqueeSelection);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointerup", endNodeGraphMarqueeSelection);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointercancel", endNodeGraphMarqueeSelection);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("wheel", handleNodeGraphWorkspaceWheel, { passive: false });
  document
    .getElementById("nodeGraphResizeHandle")
    .addEventListener("pointerdown", beginNodeGraphWorkspaceResize);

  document.addEventListener("pointermove", nodeGraphWireInteractions.dragWire);
  document.addEventListener("pointermove", dragNodeGraphModulePlacement);
  document.addEventListener("pointerup", nodeGraphWireInteractions.endWireDrag);
  document.addEventListener("pointercancel", nodeGraphWireInteractions.endWireDrag);
  document.addEventListener("pointermove", dragNodeGraphWorkspaceResize);
  document.addEventListener("pointerup", endNodeGraphWorkspaceResize);
  document.addEventListener("pointercancel", endNodeGraphWorkspaceResize);
  document.addEventListener("pointermove", dragNodeGraphWorkspacePan);
  document.addEventListener("pointerup", endNodeGraphWorkspacePan);
  document.addEventListener("pointercancel", endNodeGraphWorkspacePan);
  document.addEventListener("pointermove", dragNodeGraphSmoothZoom);
  document.addEventListener("pointermove", nodeGraphWireInteractions.handlePatchPointHover);
  document.addEventListener("pointerup", endNodeGraphSmoothZoomDrag);
  document.addEventListener("pointercancel", endNodeGraphSmoothZoomDrag);
  document.addEventListener("pointerdown", trackNodeGraphOutsideMarqueePointer, true);
  document.addEventListener("pointerup", clearNodeGraphOutsideMarqueePointer, true);
  document.addEventListener("pointercancel", clearNodeGraphOutsideMarqueePointer, true);
  document.addEventListener("click", handleNodeGraphDocumentClick);
  window.addEventListener("resize", handleNodeGraphWindowResize);
  document.addEventListener("pointermove", dragNodeMetadataPopover);
  document.addEventListener("pointerup", endNodeMetadataPopoverDrag);
  document.addEventListener("pointercancel", endNodeMetadataPopoverDrag);
  document.addEventListener("pointermove", dragNodeSceneContextMenu);
  document.addEventListener("pointerup", endNodeSceneContextMenuDrag);
  document.addEventListener("pointercancel", endNodeSceneContextMenuDrag);
}
