NodeLiveAudioProcessor.prototype.speakerProtectionSample = function speakerProtectionSample(value, nodeId) {
    const number = Number(value);
    const unsafe = !Number.isFinite(number) || Math.abs(number) > 1;
    if (unsafe) {
      this.meterProtectionMuteCount += 1;
      this.speakerProtectionPeak = Math.max(
        Number(this.speakerProtectionPeak) || 0,
        Number.isFinite(number) ? Math.abs(number) : Infinity,
      );
      this.speakerProtectionNodeId = String(nodeId || "");
    }
    return unsafe ? 0 : number;
  };

