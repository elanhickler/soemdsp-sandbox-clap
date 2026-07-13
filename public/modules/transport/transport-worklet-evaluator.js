NodeLiveAudioProcessor.prototype.transportDivisionFactor = function transportDivisionFactor(divisions) {
    const division = Math.round(Number(divisions) || 0);
    if (division > 0) {
      return division + 1;
    }
    if (division < 0) {
      return 1 / (Math.abs(division) + 1);
    }
    return 1;
  };

NodeLiveAudioProcessor.prototype.transportSample = function transportSample(params, frame, rateHz = sampleRate) {
    const rate = Math.max(1, Number(rateHz) || sampleRate || 44100);
    const tempoBpm = Math.max(1, Number(this.timing?.tempoBpm) || 120);
    const frequency = (tempoBpm / 60) * this.transportDivisionFactor(params.divisions);
    const amplitude = this.clampValue(this.safeFilterNumber(params.amplitude, null), 0, 1);
    const phase = frequency > 0 ? this.wrapValue((Math.max(0, Number(frame) || 0) / rate) * frequency, 0, 1) : 0;
    const high = phase < 0.5;
    return {
      "-1..1": high ? amplitude : -amplitude,
      "0..1": high ? amplitude : 0,
    };
  };

