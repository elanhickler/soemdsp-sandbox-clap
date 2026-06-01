function evaluateNodeGraphPlanFrame(runtime, sampleRate, frame, frames) {
  const frameValues = new Map();
  const mixInput = (nodeId, port = "In") => (runtime.inputConnections.get(`${nodeId}.${port}`) || []).reduce(
    (sum, connection) => sum + readNodeGraphRuntimePortOutput(
      runtime,
      frameValues,
      connection.sourceNode,
      connection.sourcePort,
      frame,
      frames,
    ),
    0,
  );

  for (const nodeId of runtime.order || []) {
    const node = runtime.nodes.get(nodeId);
    let value = 0;

    if (node?.type === "audioInput") {
      const input = runtime.externalInput || {};
      const leftChannel = input.left || input.right || null;
      const rightChannel = input.right || input.left || null;
      const left = Number(leftChannel?.[frame]) || 0;
      const right = Number(rightChannel?.[frame]) || left;
      const level = readNodeGraphLiveEffectiveParam(
        runtime,
        node,
        "level",
        0.35,
        frame,
        frames,
        frameValues,
      );
      value = {
        Left: left * level,
        Out: ((left + right) * 0.5) * level,
        Right: right * level,
      };
    } else if (node?.type === "osc") {
      const phase = runtime.phases.get(nodeId) || 0;
      const phaseOffset = nodeGraphPhaseRadians(
        readNodeGraphLiveEffectiveParam(
          runtime,
          node,
          "phase",
          0,
          frame,
          frames,
          frameValues,
        ),
      );
      const frequency = readNodeGraphLiveEffectiveParam(
        runtime,
        node,
        "frequency",
        220,
        frame,
        frames,
        frameValues,
      );
      const waveform = readNodeGraphLiveEffectiveParam(
        runtime,
        node,
        "waveform",
        0,
        frame,
        frames,
        frameValues,
      );
      const phaseIncrement = frequency / sampleRate;
      value = nodeGraphOscillatorWaveformSample(
        runtime,
        nodeId,
        phase + phaseOffset,
        phaseIncrement,
        waveform,
      ) * readNodeGraphLiveEffectiveParam(
        runtime,
        node,
        "level",
        0.5,
        frame,
        frames,
        frameValues,
      );
      runtime.phases.set(
        nodeId,
        (phase + (Math.PI * 2 * frequency) / sampleRate) % (Math.PI * 2),
      );
    } else if (node?.type === "noise") {
      value = nextNodeGraphNoiseSample(runtime, nodeId) * readNodeGraphLiveEffectiveParam(
        runtime,
        node,
        "level",
        0.12,
        frame,
        frames,
        frameValues,
      );
    } else if (node?.type === "spiral") {
      const state = runtime.spiralStates.get(nodeId) || createJerobeamSpiralState();
      runtime.spiralStates.set(nodeId, state);
      const read = (key, fallback) => readNodeGraphLiveEffectiveParam(
        runtime,
        node,
        key,
        fallback,
        frame,
        frames,
        frameValues,
      );
      const spiral = jerobeamSpiralSample({
        density: read("density", 1),
        frequency: read("frequency", 440),
        morph: read("morph", 0),
        morphSpeed: read("morphSpeed", 0),
        position: read("position", 0),
        positionSpeed: read("positionSpeed", 0),
        rotX: read("rotX", 0),
        rotXSpeed: read("rotXSpeed", 0),
        rotY: read("rotY", 0),
        rotYSpeed: read("rotYSpeed", 0),
        sampleRate,
        sharp: read("sharp", 0.5),
        sharpCurve: read("sharpCurve", 0),
        sharpCurveMult: read("sharpCurveMult", 1),
        size: read("size", 0.5),
        state,
        zAmount: read("zAmount", 0),
        zDepth: read("zDepth", 0),
      });
      const level = read("level", 0.35);
      value = {
        X: spiral.x * level,
        Y: spiral.y * level,
        Z: spiral.z * level,
      };
    } else if (node?.type === "gain") {
      value = mixInput(nodeId) * readNodeGraphLiveEffectiveParam(
        runtime,
        node,
        "amount",
        1,
        frame,
        frames,
        frameValues,
      );
    } else if (node?.type === "bias") {
      value = mixInput(nodeId) + readNodeGraphLiveEffectiveParam(
        runtime,
        node,
        "offset",
        0,
        frame,
        frames,
        frameValues,
      );
    } else if (node?.type === "output") {
      const left = mixInput(nodeId, "Left");
      const right = mixInput(nodeId, "Right");
      value = (left + right) * 0.5;
    }

    frameValues.set(nodeId, value);
    runtime.nodeOutputs?.set(nodeId, value);
  }

  const outputNode = runtime.nodes.get(runtime.outputNode || "output");
  const outputVolume = outputNode
    ? readNodeGraphLiveEffectiveParam(
      runtime,
      outputNode,
      "volume",
      1,
      frame,
      frames,
      frameValues,
    )
    : 1;

  return {
    frameValues,
    left: mixInput(runtime.outputNode || "output", "Left") * outputVolume,
    right: mixInput(runtime.outputNode || "output", "Right") * outputVolume,
  };
}
