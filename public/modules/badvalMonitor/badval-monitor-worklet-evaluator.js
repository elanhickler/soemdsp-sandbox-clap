NodeLiveAudioProcessor.prototype.monitorBadValueSample = function monitorBadValueSample(value, nodeId) {
    const number = Number(value);
    const reason = this.badValueReason(number);
    if (reason) {
      this.badNumberCount += 1;
      this.lastBadValueReason = reason;
      this.lastBadValueNodeId = nodeId;
      this.lastBadValueSource = "BADVAL Monitor input";
    }
    return number;
  };

