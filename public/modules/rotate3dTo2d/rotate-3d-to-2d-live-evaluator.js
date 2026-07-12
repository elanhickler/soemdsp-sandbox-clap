// Registers the offline/render-time dispatch handler for rotate3dTo2d into
// nodeGraphLiveModuleEvaluators (declared in node-graph-live-frame-evaluator.js).
// Extracted from the inline if/else-if branch that used to live in that file.
nodeGraphLiveModuleEvaluators.rotate3dTo2d = ({ runtime, node, nodeId, frame, frames, frameValues, mixInput }) => {
  const angleX = readNodeGraphLiveEffectiveParam(runtime, node, "rotateX", 0, frame, frames, frameValues) * Math.PI * 2;
  const angleY = readNodeGraphLiveEffectiveParam(runtime, node, "rotateY", 0, frame, frames, frameValues) * Math.PI * 2;
  const angleZ = readNodeGraphLiveEffectiveParam(runtime, node, "rotateZ", 0, frame, frames, frameValues) * Math.PI * 2;
  let x = nodeGraphSafeFilterNumber(mixInput(nodeId, "X"), runtime, nodeId, null, "rotation 3d x input");
  let y = nodeGraphSafeFilterNumber(mixInput(nodeId, "Y"), runtime, nodeId, null, "rotation 3d y input");
  let z = nodeGraphSafeFilterNumber(mixInput(nodeId, "Z"), runtime, nodeId, null, "rotation 3d z input");
  const sinX = Math.sin(angleX);
  const cosX = Math.cos(angleX);
  const nextY = y * cosX - z * sinX;
  const nextZ = y * sinX + z * cosX;
  y = nextY;
  z = nextZ;
  const sinY = Math.sin(angleY);
  const cosY = Math.cos(angleY);
  const nextX = x * cosY + z * sinY;
  z = -x * sinY + z * cosY;
  x = nextX;
  const sinZ = Math.sin(angleZ);
  const cosZ = Math.cos(angleZ);
  return {
    X: nodeGraphSafeFilterNumber(x * cosZ - y * sinZ, runtime, nodeId, null, "rotation 3d x output"),
    Y: nodeGraphSafeFilterNumber(x * sinZ + y * cosZ, runtime, nodeId, null, "rotation 3d y output"),
  };
};
