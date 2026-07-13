NodeLiveAudioProcessor.prototype.screenSpaceShaderSample = function screenSpaceShaderSample(node, readInput, rate = sampleRate, nodeId = "") {
    const script = node?.screenSpaceShader || {};
    const value = {};
    for (const input of script.visualInputs || []) {
      if (input.mode === "raw") {
        continue;
      }
      const signed = input.mode === "signed";
      const raw = readInput(input.port);
      const target = signed
        ? this.visualControlSigned(raw, nodeId, `screen space shader ${input.port}`)
        : this.visualControlIntensity(raw, nodeId, `screen space shader ${input.port}`);
      value[input.key] = this.smoothVisualControl(
        input.key,
        target,
        rate,
        signed ? 0.045 : 0.025,
        signed ? -1 : 0,
        1,
      );
    }
    return value;
  };

