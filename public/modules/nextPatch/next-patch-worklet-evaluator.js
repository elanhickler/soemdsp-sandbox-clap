NodeLiveAudioProcessor.prototype.createPatchCommandState = function createPatchCommandState() {
    return {
      lastTrigger: 0,
    };
  };

NodeLiveAudioProcessor.prototype.patchCommandTriggerSample = function patchCommandTriggerSample(state, trigger, threshold, command, nodeId) {
    const safeTrigger = this.safeFilterNumber(trigger, null);
    const safeThreshold = this.safeFilterNumber(threshold, null);
    if (state.lastTrigger <= safeThreshold && safeTrigger > safeThreshold) {
      this.port.postMessage({
        command,
        nodeId,
        sessionId: this.sessionId,
        type: "patchCommand",
      });
    }
    state.lastTrigger = safeTrigger;
    return 0;
  };

