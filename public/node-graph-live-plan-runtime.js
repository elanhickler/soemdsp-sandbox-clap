function nodeGraphBuildLivePlan() {
  const compiled = compileNodeGraphExecutionPlan();
  if (!compiled.valid) {
    const error = new Error(compiled.issues.join(", "));
    error.issues = [...compiled.issues];
    throw error;
  }

  const activeNodeIds = nodeGraphActiveNodeIds(compiled);
  const activeSignalConnections = nodeGraphActiveSignalConnections(compiled)
    .map((connection) => ({ ...connection }));
  const activeModulations = nodeGraphActiveModulations(compiled)
    .map((modulation) => ({ ...modulation }));

  return {
    connections: activeSignalConnections,
    feedbackConnections: compiled.feedbackConnections.map((connection) => ({ ...connection })),
    feedbackModulations: compiled.feedbackModulations.map((modulation) => ({ ...modulation })),
    modulations: activeModulations,
    nodes: nodeGraphBuildLiveParameterNodes(activeNodeIds),
    order: [...compiled.order],
    outputNode: compiled.outputNode,
    patchFingerprint: nodeGraphPatchFingerprint(),
    speakerOutputActive: Boolean(compiled.speakerOutputActive),
    sourceNodes: [...compiled.sourceNodes],
    visualSinks: (compiled.visualSinks || []).map((sink) => ({
      ...sink,
      inputs: (sink.inputs || []).map((input) => ({ ...input })),
    })),
  };
}

function nodeGraphBuildLivePlanForPatch(patch) {
  const normalizedPatch = validateNodeGraphPatch(patch);
  const compiled = compileNodeGraphExecutionPlan(normalizedPatch);
  if (!compiled.valid) {
    const error = new Error(compiled.issues.join(", "));
    error.issues = [...compiled.issues];
    throw error;
  }
  const activeNodeIds = nodeGraphActiveNodeIds(compiled);
  return {
    connections: nodeGraphActiveSignalConnections(compiled).map((connection) => ({ ...connection })),
    feedbackConnections: compiled.feedbackConnections.map((connection) => ({ ...connection })),
    feedbackModulations: compiled.feedbackModulations.map((modulation) => ({ ...modulation })),
    modulations: nodeGraphActiveModulations(compiled).map((modulation) => ({ ...modulation })),
    nodes: nodeGraphBuildLiveParameterNodesForPatch(normalizedPatch, activeNodeIds),
    order: [...compiled.order],
    outputNode: compiled.outputNode,
    patchFingerprint: nodeGraphPatchFingerprint(normalizedPatch),
    speakerOutputActive: Boolean(compiled.speakerOutputActive),
    sourceNodes: [...compiled.sourceNodes],
    visualSinks: [],
  };
}

function nodeGraphBuildLiveParameterNodes(activeNodeIds = null) {
  const activeIds = activeNodeIds instanceof Set ? activeNodeIds : null;
  return nodeGraphMvp.patch.nodes
    .filter((node) => !activeIds || activeIds.has(node.id))
    .map((node) => {
      const definition = nodeGraphModuleDefinitions[node.type];
      const params = {};
      const paramMeta = {};
      for (const parameter of definition.parameters || []) {
        const value = nodeGraphReadPatchParameterValue(node, parameter.key);
        params[parameter.key] = Number.isFinite(value)
          ? value
          : nodeGraphParameterFallback(node.type, parameter.key);
        paramMeta[parameter.key] = nodeGraphReadPatchParameterMetadata(node, parameter.key);
      }
      if (node.type === "clapPlugin") {
        for (const [key, metadata] of Object.entries(node.paramMeta || {})) {
          if (Object.hasOwn(paramMeta, key)) {
            continue;
          }
          const normalizedMetadata = normalizeNodeGraphPatchParameterMetadata(node.type, key, metadata);
          if (!normalizedMetadata) {
            continue;
          }
          paramMeta[key] = normalizedMetadata;
          params[key] = normalizeNodeGraphPatchParameter(
            node.type,
            key,
            Object.hasOwn(node.params || {}, key) ? node.params[key] : normalizedMetadata.def,
            normalizedMetadata,
          );
        }
      }
      const runtimeNode = {
        id: node.id,
        paramMeta,
        params,
        type: node.type,
      };
      if (node.type === "codeblock") {
        runtimeNode.codeblock = normalizeNodeGraphCodeblock(node.codeblock);
      }
      if (node.type === "moduleGroup") {
        runtimeNode.moduleGroup = normalizeNodeGraphModuleGroup(node.moduleGroup);
        if (runtimeNode.moduleGroup.sourcePatch) {
          runtimeNode.moduleGroupPlan = nodeGraphBuildLivePlanForPatch(runtimeNode.moduleGroup.sourcePatch);
        }
      }
      if (node.type === "clapPlugin") {
        runtimeNode.clap = normalizeNodeGraphClapPluginBinding(node.clap);
      }
      return runtimeNode;
    });
}

function nodeGraphBuildLiveParameterNodesForPatch(patch, activeNodeIds = null) {
  const activeIds = activeNodeIds instanceof Set ? activeNodeIds : null;
  return (patch.nodes || [])
    .filter((node) => !activeIds || activeIds.has(node.id))
    .map((node) => {
      const definition = nodeGraphModuleDefinitions[node.type];
      const params = {};
      const paramMeta = {};
      for (const parameter of definition.parameters || []) {
        const value = Number(node.params?.[parameter.key]);
        params[parameter.key] = Number.isFinite(value)
          ? value
          : nodeGraphParameterFallback(node.type, parameter.key);
        paramMeta[parameter.key] = normalizeNodeGraphPatchParameterMetadata(
          node.type,
          parameter.key,
          node.paramMeta?.[parameter.key],
        ) || nodeGraphParameterDefinitionMetadata(parameter);
      }
      if (node.type === "clapPlugin") {
        for (const [key, metadata] of Object.entries(node.paramMeta || {})) {
          if (Object.hasOwn(paramMeta, key)) {
            continue;
          }
          const normalizedMetadata = normalizeNodeGraphPatchParameterMetadata(node.type, key, metadata);
          if (!normalizedMetadata) {
            continue;
          }
          paramMeta[key] = normalizedMetadata;
          params[key] = normalizeNodeGraphPatchParameter(
            node.type,
            key,
            Object.hasOwn(node.params || {}, key) ? node.params[key] : normalizedMetadata.def,
            normalizedMetadata,
          );
        }
      }
      const runtimeNode = {
        id: node.id,
        paramMeta,
        params,
        type: node.type,
      };
      if (node.type === "codeblock") {
        runtimeNode.codeblock = normalizeNodeGraphCodeblock(node.codeblock);
      }
      if (node.type === "moduleGroup") {
        runtimeNode.moduleGroup = normalizeNodeGraphModuleGroup(node.moduleGroup);
        if (runtimeNode.moduleGroup.sourcePatch) {
          runtimeNode.moduleGroupPlan = nodeGraphBuildLivePlanForPatch(runtimeNode.moduleGroup.sourcePatch);
        }
      }
      if (node.type === "clapPlugin") {
        runtimeNode.clap = normalizeNodeGraphClapPluginBinding(node.clap);
      }
      return runtimeNode;
    });
}

function createNodeGraphLiveRuntime(plan) {
  const nodes = new Map((plan.nodes || []).map((node) => [node.id, node]));
  const inputConnections = new Map();
  for (const connection of plan.connections || []) {
    const key = `${connection.destinationNode}.${connection.destinationPort}`;
    const connections = inputConnections.get(key) || [];
    connections.push(connection);
    inputConnections.set(key, connections);
  }
  const modulationConnections = new Map();
  for (const modulation of plan.modulations || []) {
    const key = nodeGraphParameterKey(modulation.destinationNode, modulation.destinationParam);
    const modulations = modulationConnections.get(key) || [];
    modulations.push(modulation);
    modulationConnections.set(key, modulations);
  }
  const phases = new Map();
  const noiseSeedKeys = new Map();
  const noiseSeeds = new Map();
  const oscResetStates = new Map();
  const graphLfoStates = new Map();
  const bandpassStates = new Map();
  const clockStates = new Map();
  const codeblockFunctions = new Map();
  const cookbookFilterStates = new Map();
  const clockDividerStates = new Map();
  const delayedTriggerStates = new Map();
  const expAdsrStates = new Map();
  const fractalBrownianNoiseStates = new Map();
  const flowerChildEnvelopeFollowerStates = new Map();
  const highpassStates = new Map();
  const ladderFilterStates = new Map();
  const linearEnvelopeStates = new Map();
  const lowpassStates = new Map();
  const moduleGroupRuntimes = new Map();
  const noiseGeneratorStates = new Map();
  const noiseSampleHoldStates = new Map();
  const oscillatorLastPhaseIncrements = new Map();
  const oscillatorStoppedSamples = new Map();
  const pluckEnvelopeStates = new Map();
  const randomClockStates = new Map();
  const randomWalkStates = new Map();
  const sampleHoldStates = new Map();
  const slewLimiterStates = new Map();
  const stepSequencerStates = new Map();
  const spiralStates = new Map();
  const smoothers = new Map();
  const triggerCounterStates = new Map();
  const triggerDividerStates = new Map();
  const triangleStates = new Map();
  const vactrolEnvelopeStates = new Map();
  const visualControlState = createNodeGraphVisualControlState();
  for (const node of plan.nodes || []) {
    if (node.type === "osc" || node.type === "fbPolyBlepOsc") {
      phases.set(node.id, 0);
      oscResetStates.set(node.id, createNodeGraphOscResetState());
      triangleStates.set(node.id, 0);
    }
    if (node.type === "osc" || node.type === "fbPolyBlepOsc" || node.type === "noise") {
      noiseSeeds.set(node.id, nodeGraphStableSeed(node.id));
    }
    if (node.type === "stereoNoise") {
      noiseSeeds.set(`${node.id}:left`, nodeGraphStableSeed(`${node.id}:left`));
      noiseSeeds.set(`${node.id}:right`, nodeGraphStableSeed(`${node.id}:right`));
    }
    if (node.type === "spiral") {
      spiralStates.set(node.id, createJerobeamSpiralState());
    }
    if (node.type === "highpass") {
      highpassStates.set(node.id, createNodeGraphHighpassState());
    }
    if (node.type === "lowpass") {
      lowpassStates.set(node.id, createNodeGraphLowpassState());
    }
    if (node.type === "bandpass") {
      bandpassStates.set(node.id, createNodeGraphBandpassState());
    }
    if (node.type === "cookbookFilter") {
      cookbookFilterStates.set(node.id, createNodeGraphCookbookFilterState());
    }
    if (node.type === "ladderFilter") {
      ladderFilterStates.set(node.id, createNodeGraphLadderFilterState());
    }
    if (node.type === "clock") {
      clockStates.set(node.id, createNodeGraphClockState());
    }
    if (node.type === "graph") {
      graphLfoStates.set(node.id, createNodeGraphGraphLfoState());
    }
    if (node.type === "clockDivider") {
      clockDividerStates.set(node.id, createNodeGraphTriggerDividerState());
    }
    if (node.type === "delayedTrigger") {
      delayedTriggerStates.set(node.id, createNodeGraphDelayedTriggerState());
    }
    if (node.type === "randomClock") {
      randomClockStates.set(node.id, createNodeGraphRandomClockState());
    }
    if (node.type === "sampleHold") {
      sampleHoldStates.set(node.id, createNodeGraphSampleHoldState());
    }
    if (node.type === "slewLimiter") {
      slewLimiterStates.set(node.id, createNodeGraphSlewLimiterState());
    }
    if (node.type === "expAdsr") {
      expAdsrStates.set(node.id, createNodeGraphExpAdsrState());
    }
    if (node.type === "linearEnvelope") {
      linearEnvelopeStates.set(node.id, createNodeGraphLinearEnvelopeState());
    }
    if (node.type === "noiseGenerator") {
      noiseGeneratorStates.set(node.id, createNodeGraphNoiseGeneratorState());
    }
    if (node.type === "noise") {
      noiseSampleHoldStates.set(node.id, createNodeGraphNoiseSampleHoldState());
    }
    if (node.type === "randomWalk") {
      randomWalkStates.set(node.id, createNodeGraphRandomWalkState());
    }
    if (node.type === "fractalBrownianNoise") {
      fractalBrownianNoiseStates.set(node.id, createNodeGraphFractalBrownianNoiseState());
    }
    if (node.type === "flowerChildEnvelopeFollower") {
      flowerChildEnvelopeFollowerStates.set(node.id, createNodeGraphFlowerChildEnvelopeFollowerState());
    }
    if (node.type === "pluckEnvelope") {
      pluckEnvelopeStates.set(node.id, createNodeGraphPluckEnvelopeState());
    }
    if (node.type === "stepSequencer") {
      stepSequencerStates.set(node.id, createNodeGraphStepSequencerState());
    }
    if (node.type === "triggerCounter") {
      triggerCounterStates.set(node.id, createNodeGraphTriggerCounterState());
    }
    if (node.type === "triggerDivider") {
      triggerDividerStates.set(node.id, createNodeGraphTriggerDividerState());
    }
    if (node.type === "vactrolEnvelope") {
      vactrolEnvelopeStates.set(node.id, createNodeGraphVactrolEnvelopeState());
    }
    if (node.type === "moduleGroup" && node.moduleGroup?.sourcePatch) {
      try {
        moduleGroupRuntimes.set(node.id, createNodeGraphLiveRuntime(nodeGraphBuildLivePlanForPatch(node.moduleGroup.sourcePatch)));
      } catch (_error) {
        moduleGroupRuntimes.delete(node.id);
      }
    }
    for (const [key, value] of Object.entries(node.params || {})) {
      smoothers.set(
        nodeGraphParameterKey(node.id, key),
        createNodeGraphParameterSmoother(value, node.paramMeta?.[key]),
      );
    }
  }
  return {
    inputConnections,
    badNumberCount: 0,
    bandpassStates,
    clockDividerStates,
    clockStates,
    codeblockFunctions,
    cookbookFilterStates,
    delayedTriggerStates,
    expAdsrStates,
    fractalBrownianNoiseStates,
    flowerChildEnvelopeFollowerStates,
    graphLfoStates,
    ladderFilterStates,
    linearEnvelopeStates,
    meterCounter: 0,
    meterClipCount: 0,
    meterPeak: 0,
    meterSamples: 0,
    meterSquareSum: 0,
    modulationConnections,
    macroControls: Array.isArray(nodeGraphMvp?.macroControls) ? [...nodeGraphMvp.macroControls] : new Array(10).fill(0),
    moduleGroupRuntimes,
    pitchModWheelSignal: {
      mod: Math.max(0, Math.min(1, Number(nodeGraphMvp?.modWheelSignal) || 0)),
      pitch: Math.max(-1, Math.min(1, Number(nodeGraphMvp?.pitchWheelSignal) || 0)),
    },
    midiKeyboardSignal: null,
    nodeOutputs: new Map((plan.nodes || []).map((node) => [node.id, 0])),
    nodes,
    oscResetStates,
    oscillatorLastPhaseIncrements,
    oscillatorStoppedSamples,
    noiseSeedKeys,
    noiseSeeds,
    noiseGeneratorStates,
    noiseSampleHoldStates,
    pluckEnvelopeStates,
    randomClockStates,
    highpassStates,
    lowpassStates,
    order: [...(plan.order || [])],
    outputNode: plan.outputNode || "output",
    phases,
    randomWalkStates,
    sampleHoldStates,
    slewLimiterStates,
    smoothers,
    spiralStates,
    stepSequencerStates,
    triggerCounterStates,
    triggerDividerStates,
    triangleStates,
    vactrolEnvelopeStates,
    visualSinks: (plan.visualSinks || []).map((sink) => ({
      ...sink,
      inputs: (sink.inputs || []).map((input) => ({ ...input })),
    })),
    visualControls: visualControlState.controls,
    visualControlStates: visualControlState.states,
  };
}

function updateNodeGraphLiveRuntimePlan(runtime, plan) {
  runtime.nodes = new Map((plan.nodes || []).map((node) => [node.id, node]));
  runtime.inputConnections = new Map();
  for (const connection of plan.connections || []) {
    const key = `${connection.destinationNode}.${connection.destinationPort}`;
    const connections = runtime.inputConnections.get(key) || [];
    connections.push(connection);
    runtime.inputConnections.set(key, connections);
  }
  runtime.modulationConnections = new Map();
  for (const modulation of plan.modulations || []) {
    const key = nodeGraphParameterKey(modulation.destinationNode, modulation.destinationParam);
    const modulations = runtime.modulationConnections.get(key) || [];
    modulations.push(modulation);
    runtime.modulationConnections.set(key, modulations);
  }
  runtime.order = [...(plan.order || [])];
  runtime.outputNode = plan.outputNode || "output";
  runtime.visualSinks = (plan.visualSinks || []).map((sink) => ({
    ...sink,
    inputs: (sink.inputs || []).map((input) => ({ ...input })),
  }));
  const nodeIds = new Set(runtime.nodes.keys());
  if (!runtime.nodeOutputs) {
    runtime.nodeOutputs = new Map();
  }
  if (!runtime.noiseSeedKeys) {
    runtime.noiseSeedKeys = new Map();
  }
  if (!runtime.noiseSeeds) {
    runtime.noiseSeeds = new Map();
  }
  if (!runtime.oscResetStates) {
    runtime.oscResetStates = new Map();
  }
  if (!runtime.graphLfoStates) {
    runtime.graphLfoStates = new Map();
  }
  if (!runtime.oscillatorLastPhaseIncrements) {
    runtime.oscillatorLastPhaseIncrements = new Map();
  }
  if (!runtime.oscillatorStoppedSamples) {
    runtime.oscillatorStoppedSamples = new Map();
  }
  if (!runtime.spiralStates) {
    runtime.spiralStates = new Map();
  }
  if (!runtime.highpassStates) {
    runtime.highpassStates = new Map();
  }
  if (!runtime.lowpassStates) {
    runtime.lowpassStates = new Map();
  }
  if (!runtime.moduleGroupRuntimes) {
    runtime.moduleGroupRuntimes = new Map();
  }
  if (!runtime.ladderFilterStates) {
    runtime.ladderFilterStates = new Map();
  }
  if (!runtime.linearEnvelopeStates) {
    runtime.linearEnvelopeStates = new Map();
  }
  if (!runtime.bandpassStates) {
    runtime.bandpassStates = new Map();
  }
  if (!runtime.clockStates) {
    runtime.clockStates = new Map();
  }
  if (!runtime.codeblockFunctions) {
    runtime.codeblockFunctions = new Map();
  }
  if (!runtime.cookbookFilterStates) {
    runtime.cookbookFilterStates = new Map();
  }
  if (!runtime.clockDividerStates) {
    runtime.clockDividerStates = new Map();
  }
  if (!runtime.delayedTriggerStates) {
    runtime.delayedTriggerStates = new Map();
  }
  if (!runtime.sampleHoldStates) {
    runtime.sampleHoldStates = new Map();
  }
  if (!runtime.slewLimiterStates) {
    runtime.slewLimiterStates = new Map();
  }
  if (!runtime.expAdsrStates) {
    runtime.expAdsrStates = new Map();
  }
  if (!runtime.noiseGeneratorStates) {
    runtime.noiseGeneratorStates = new Map();
  }
  if (!runtime.noiseSampleHoldStates) {
    runtime.noiseSampleHoldStates = new Map();
  }
  if (!runtime.randomWalkStates) {
    runtime.randomWalkStates = new Map();
  }
  if (!runtime.randomClockStates) {
    runtime.randomClockStates = new Map();
  }
  if (!runtime.fractalBrownianNoiseStates) {
    runtime.fractalBrownianNoiseStates = new Map();
  }
  if (!runtime.flowerChildEnvelopeFollowerStates) {
    runtime.flowerChildEnvelopeFollowerStates = new Map();
  }
  if (!runtime.pluckEnvelopeStates) {
    runtime.pluckEnvelopeStates = new Map();
  }
  if (!runtime.stepSequencerStates) {
    runtime.stepSequencerStates = new Map();
  }
  if (!runtime.triggerDividerStates) {
    runtime.triggerDividerStates = new Map();
  }
  if (!runtime.triggerCounterStates) {
    runtime.triggerCounterStates = new Map();
  }
  if (!runtime.triangleStates) {
    runtime.triangleStates = new Map();
  }
  if (!runtime.vactrolEnvelopeStates) {
    runtime.vactrolEnvelopeStates = new Map();
  }
  resetNodeGraphRuntimeVisualControls(runtime);
  for (const node of plan.nodes || []) {
    if (!runtime.nodeOutputs.has(node.id)) {
      runtime.nodeOutputs.set(node.id, 0);
    }
    if ((node.type === "osc" || node.type === "fbPolyBlepOsc") && !runtime.phases.has(node.id)) {
      runtime.phases.set(node.id, 0);
    }
    if ((node.type === "osc" || node.type === "fbPolyBlepOsc") && !runtime.oscResetStates.has(node.id)) {
      runtime.oscResetStates.set(node.id, createNodeGraphOscResetState());
    }
    if ((node.type === "osc" || node.type === "fbPolyBlepOsc") && !runtime.triangleStates.has(node.id)) {
      runtime.triangleStates.set(node.id, 0);
    }
    if ((node.type === "osc" || node.type === "fbPolyBlepOsc" || node.type === "noise") && !runtime.noiseSeeds.has(node.id)) {
      runtime.noiseSeeds.set(node.id, nodeGraphStableSeed(node.id));
    }
    if (node.type === "stereoNoise") {
      if (!runtime.noiseSeeds.has(`${node.id}:left`)) {
        runtime.noiseSeeds.set(`${node.id}:left`, nodeGraphStableSeed(`${node.id}:left`));
      }
      if (!runtime.noiseSeeds.has(`${node.id}:right`)) {
        runtime.noiseSeeds.set(`${node.id}:right`, nodeGraphStableSeed(`${node.id}:right`));
      }
    }
    if (node.type === "spiral" && !runtime.spiralStates.has(node.id)) {
      runtime.spiralStates.set(node.id, createJerobeamSpiralState());
    }
    if (node.type === "highpass" && !runtime.highpassStates.has(node.id)) {
      runtime.highpassStates.set(node.id, createNodeGraphHighpassState());
    }
    if (node.type === "lowpass" && !runtime.lowpassStates.has(node.id)) {
      runtime.lowpassStates.set(node.id, createNodeGraphLowpassState());
    }
    if (node.type === "bandpass" && !runtime.bandpassStates.has(node.id)) {
      runtime.bandpassStates.set(node.id, createNodeGraphBandpassState());
    }
    if (node.type === "cookbookFilter" && !runtime.cookbookFilterStates.has(node.id)) {
      runtime.cookbookFilterStates.set(node.id, createNodeGraphCookbookFilterState());
    }
    if (node.type === "ladderFilter" && !runtime.ladderFilterStates.has(node.id)) {
      runtime.ladderFilterStates.set(node.id, createNodeGraphLadderFilterState());
    }
    if (node.type === "clock" && !runtime.clockStates.has(node.id)) {
      runtime.clockStates.set(node.id, createNodeGraphClockState());
    }
    if (node.type === "graph" && !runtime.graphLfoStates.has(node.id)) {
      runtime.graphLfoStates.set(node.id, createNodeGraphGraphLfoState());
    }
    if (node.type === "clockDivider" && !runtime.clockDividerStates.has(node.id)) {
      runtime.clockDividerStates.set(node.id, createNodeGraphTriggerDividerState());
    }
    if (node.type === "delayedTrigger" && !runtime.delayedTriggerStates.has(node.id)) {
      runtime.delayedTriggerStates.set(node.id, createNodeGraphDelayedTriggerState());
    }
    if (node.type === "randomClock" && !runtime.randomClockStates.has(node.id)) {
      runtime.randomClockStates.set(node.id, createNodeGraphRandomClockState());
    }
    if (node.type === "sampleHold" && !runtime.sampleHoldStates.has(node.id)) {
      runtime.sampleHoldStates.set(node.id, createNodeGraphSampleHoldState());
    }
    if (node.type === "slewLimiter" && !runtime.slewLimiterStates.has(node.id)) {
      runtime.slewLimiterStates.set(node.id, createNodeGraphSlewLimiterState());
    }
    if (node.type === "expAdsr" && !runtime.expAdsrStates.has(node.id)) {
      runtime.expAdsrStates.set(node.id, createNodeGraphExpAdsrState());
    }
    if (node.type === "linearEnvelope" && !runtime.linearEnvelopeStates.has(node.id)) {
      runtime.linearEnvelopeStates.set(node.id, createNodeGraphLinearEnvelopeState());
    }
    if (node.type === "noiseGenerator" && !runtime.noiseGeneratorStates.has(node.id)) {
      runtime.noiseGeneratorStates.set(node.id, createNodeGraphNoiseGeneratorState());
    }
    if (node.type === "noise" && !runtime.noiseSampleHoldStates.has(node.id)) {
      runtime.noiseSampleHoldStates.set(node.id, createNodeGraphNoiseSampleHoldState());
    }
    if (node.type === "randomWalk" && !runtime.randomWalkStates.has(node.id)) {
      runtime.randomWalkStates.set(node.id, createNodeGraphRandomWalkState());
    }
    if (node.type === "fractalBrownianNoise" && !runtime.fractalBrownianNoiseStates.has(node.id)) {
      runtime.fractalBrownianNoiseStates.set(node.id, createNodeGraphFractalBrownianNoiseState());
    }
    if (
      node.type === "flowerChildEnvelopeFollower" &&
      !runtime.flowerChildEnvelopeFollowerStates.has(node.id)
    ) {
      runtime.flowerChildEnvelopeFollowerStates.set(node.id, createNodeGraphFlowerChildEnvelopeFollowerState());
    }
    if (node.type === "pluckEnvelope" && !runtime.pluckEnvelopeStates.has(node.id)) {
      runtime.pluckEnvelopeStates.set(node.id, createNodeGraphPluckEnvelopeState());
    }
    if (node.type === "triggerDivider" && !runtime.triggerDividerStates.has(node.id)) {
      runtime.triggerDividerStates.set(node.id, createNodeGraphTriggerDividerState());
    }
    if (node.type === "stepSequencer" && !runtime.stepSequencerStates.has(node.id)) {
      runtime.stepSequencerStates.set(node.id, createNodeGraphStepSequencerState());
    }
    if (node.type === "triggerCounter" && !runtime.triggerCounterStates.has(node.id)) {
      runtime.triggerCounterStates.set(node.id, createNodeGraphTriggerCounterState());
    }
    if (node.type === "vactrolEnvelope" && !runtime.vactrolEnvelopeStates.has(node.id)) {
      runtime.vactrolEnvelopeStates.set(node.id, createNodeGraphVactrolEnvelopeState());
    }
    if (node.type === "moduleGroup" && node.moduleGroup?.sourcePatch && !runtime.moduleGroupRuntimes.has(node.id)) {
      try {
        runtime.moduleGroupRuntimes.set(node.id, createNodeGraphLiveRuntime(nodeGraphBuildLivePlanForPatch(node.moduleGroup.sourcePatch)));
      } catch (_error) {
        runtime.moduleGroupRuntimes.delete(node.id);
      }
    }
    for (const [key, value] of Object.entries(node.params || {})) {
      const smootherKey = nodeGraphParameterKey(node.id, key);
      const metadata = node.paramMeta?.[key];
      if (!runtime.smoothers.has(smootherKey)) {
        runtime.smoothers.set(
          smootherKey,
          createNodeGraphParameterSmoother(value, metadata),
        );
      } else {
        updateNodeGraphParameterSmoother(runtime.smoothers.get(smootherKey), value, metadata);
      }
    }
  }
  for (const id of [...runtime.phases.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.phases.delete(id);
    }
  }
  for (const id of [...runtime.oscResetStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.oscResetStates.delete(id);
    }
  }
  for (const id of [...runtime.graphLfoStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.graphLfoStates.delete(id);
    }
  }
  for (const id of [...runtime.triangleStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.triangleStates.delete(id);
    }
  }
  for (const id of [...runtime.oscillatorLastPhaseIncrements.keys()]) {
    const nodeId = String(id).split(":")[0];
    if (!nodeIds.has(nodeId)) {
      runtime.oscillatorLastPhaseIncrements.delete(id);
    }
  }
  for (const id of [...runtime.oscillatorStoppedSamples.keys()]) {
    const nodeId = String(id).split(":")[0];
    if (!nodeIds.has(nodeId)) {
      runtime.oscillatorStoppedSamples.delete(id);
    }
  }
  for (const id of [...runtime.noiseSeeds.keys()]) {
    const nodeId = String(id).split(":")[0];
    if (!nodeIds.has(nodeId)) {
      runtime.noiseSeeds.delete(id);
    }
  }
  for (const id of [...runtime.noiseSeedKeys.keys()]) {
    const nodeId = String(id).split(":")[0];
    if (!nodeIds.has(nodeId)) {
      runtime.noiseSeedKeys.delete(id);
    }
  }
  for (const id of [...runtime.nodeOutputs.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.nodeOutputs.delete(id);
    }
  }
  for (const id of [...runtime.spiralStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.spiralStates.delete(id);
    }
  }
  for (const id of [...runtime.highpassStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.highpassStates.delete(id);
    }
  }
  for (const id of [...runtime.lowpassStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.lowpassStates.delete(id);
    }
  }
  for (const id of [...runtime.moduleGroupRuntimes.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.moduleGroupRuntimes.delete(id);
    }
  }
  for (const id of [...runtime.linearEnvelopeStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.linearEnvelopeStates.delete(id);
    }
  }
  for (const id of [...runtime.bandpassStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.bandpassStates.delete(id);
    }
  }
  for (const id of [...runtime.clockStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.clockStates.delete(id);
    }
  }
  for (const id of [...runtime.codeblockFunctions.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.codeblockFunctions.delete(id);
    }
  }
  for (const id of [...runtime.cookbookFilterStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.cookbookFilterStates.delete(id);
    }
  }
  for (const id of [...runtime.ladderFilterStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.ladderFilterStates.delete(id);
    }
  }
  for (const id of [...runtime.clockDividerStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.clockDividerStates.delete(id);
    }
  }
  for (const id of [...runtime.delayedTriggerStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.delayedTriggerStates.delete(id);
    }
  }
  for (const id of [...runtime.sampleHoldStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.sampleHoldStates.delete(id);
    }
  }
  for (const id of [...runtime.slewLimiterStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.slewLimiterStates.delete(id);
    }
  }
  for (const id of [...runtime.expAdsrStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.expAdsrStates.delete(id);
    }
  }
  for (const id of [...runtime.noiseGeneratorStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.noiseGeneratorStates.delete(id);
    }
  }
  for (const id of [...runtime.noiseSampleHoldStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.noiseSampleHoldStates.delete(id);
    }
  }
  for (const id of [...runtime.randomWalkStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.randomWalkStates.delete(id);
    }
  }
  for (const id of [...runtime.randomClockStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.randomClockStates.delete(id);
    }
  }
  for (const id of [...runtime.fractalBrownianNoiseStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.fractalBrownianNoiseStates.delete(id);
    }
  }
  for (const id of [...runtime.flowerChildEnvelopeFollowerStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.flowerChildEnvelopeFollowerStates.delete(id);
    }
  }
  for (const id of [...runtime.pluckEnvelopeStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.pluckEnvelopeStates.delete(id);
    }
  }
  for (const id of [...runtime.stepSequencerStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.stepSequencerStates.delete(id);
    }
  }
  for (const id of [...runtime.triggerCounterStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.triggerCounterStates.delete(id);
    }
  }
  for (const id of [...runtime.triggerDividerStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.triggerDividerStates.delete(id);
    }
  }
  for (const id of [...runtime.vactrolEnvelopeStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.vactrolEnvelopeStates.delete(id);
    }
  }
  for (const key of [...runtime.smoothers.keys()]) {
    const [nodeId, parameter] = key.split(".");
    if (!nodeIds.has(nodeId) || !runtime.nodes.get(nodeId)?.params || !(parameter in runtime.nodes.get(nodeId).params)) {
      runtime.smoothers.delete(key);
    }
  }
}

function updateNodeGraphLiveRuntimeParameters(runtime, nodes) {
  if (!runtime) {
    return;
  }
  for (const node of nodes || []) {
    const current = runtime.nodes.get(node.id);
    if (!current) {
      continue;
    }
    current.params = { ...(node.params || {}) };
    current.paramMeta = cloneNodeGraphParamMeta(node.paramMeta);
    for (const [key, value] of Object.entries(current.params || {})) {
      const smootherKey = nodeGraphParameterKey(node.id, key);
      const metadata = current.paramMeta?.[key];
      if (!runtime.smoothers.has(smootherKey)) {
        runtime.smoothers.set(
          smootherKey,
          createNodeGraphParameterSmoother(value, metadata),
        );
      } else {
        updateNodeGraphParameterSmoother(runtime.smoothers.get(smootherKey), value, metadata);
      }
    }
  }
}
