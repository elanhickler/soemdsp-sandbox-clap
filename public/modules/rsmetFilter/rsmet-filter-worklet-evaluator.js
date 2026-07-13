NodeLiveAudioProcessor.prototype.createRsmetFilterState = function createRsmetFilterState() {
    return { y: [0, 0, 0, 0, 0], nativeHandle: 0 };
  };

NodeLiveAudioProcessor.prototype.rsmetFilterModeToLadder = function rsmetFilterModeToLadder(rsmetMode) {
    const table = [[1,1],[1,2],[1,3],[1,4],[2,1],[2,2],[2,3],[2,4],[3,1],[3,4]];
    const idx = Math.max(0, Math.min(9, Math.round(rsmetMode)));
    return table[idx];
  };

NodeLiveAudioProcessor.prototype.rsmetFilterSampleJs = function rsmetFilterSampleJs(state, input, params, rate) {
    const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
    const freqNorm = this.clampValue(this.safeFilterNumber(params.frequency, state), 0, 1);
    const resoNorm = this.clampValue(this.safeFilterNumber(params.resonance, state), 0, 1);
    const chaos = this.clampValue(this.safeFilterNumber(params.chaos, state), 0, 1);

    const freqGraph = [{x:0,y:3.0,skew:0,shape:0},{x:1,y:20000,skew:-0.95,shape:2}];
    const resoGraph = [{x:0,y:0.0,skew:0,shape:0},{x:1,y:1.0,skew:0.5,shape:2}];
    const cutoffHz = Math.max(0.000001, Math.min(safeRate * 0.49, this.analogEvalGraph(freqGraph, freqNorm)));
    const feedback = Math.max(0, Math.min(0.999, this.analogEvalGraph(resoGraph, resoNorm)));

    const [ladderMode, stages] = this.rsmetFilterModeToLadder(Number(params.mode) || 0);

    const wc = Math.max(1e-9, Math.min(Math.PI * 0.98, 2 * Math.PI * cutoffHz / safeRate));
    const sine = Math.sin(wc), cosine = Math.cos(wc), tangent = Math.tan(0.25 * (wc - Math.PI));
    let a = sine - cosine * tangent;
    a = (a > -1e-12 && a < 1e-12) ? (a >= 0 ? 1e-12 : -1e-12) : a;
    a = tangent / a;

    let mixS;
    const c = [0, 0, 0, 0, 0];
    if (ladderMode === 1) { c[stages] = 1; mixS = stages * 0.25; }
    else if (ladderMode === 2) {
      const hp = [[1,-1,0,0,0],[1,-2,1,0,0],[1,-3,3,-1,0],[1,-4,6,-4,1]];
      for (let i = 0; i <= stages; i++) c[i] = hp[stages-1][i];
      mixS = stages * 0.25;
    } else {
      const bp = [[0,2,-2,0,0],[0,2,-2,0,0],[0,0,3,-3,0],[0,0,4,-8,4]];
      for (let i = 0; i < 5; i++) c[i] = bp[stages-1][i];
      mixS = 0.125;
    }

    const b = 1 + a;
    const denom = Math.max(1e-12, 1 + a * a + 2 * a * cosine);
    const g2 = (b * b) / denom;
    const k = feedback / Math.max(1e-12, g2 * g2);
    const g = 1 + mixS * k;

    const safeInput = this.safeFilterNumber(input, state);
    let inputSignal = Math.tanh(safeInput * 2);
    if (chaos > 0) inputSignal += (Math.random() * 2 - 1) * chaos;

    const y = state.y;
    y[0] = (g * inputSignal - k * y[4]);
    y[0] = y[0] / (1 + y[0] * y[0]);
    y[1] = y[0] + a * (y[0] - y[1]);
    y[2] = y[1] + a * (y[1] - y[2]);
    y[3] = y[2] + a * (y[2] - y[3]);
    y[4] = y[3] + a * (y[3] - y[4]);

    const out = c[0]*y[0] + c[1]*y[1] + c[2]*y[2] + c[3]*y[3] + c[4]*y[4];
    return this.safeFilterNumber(out * 0.41, state);
  };

NodeLiveAudioProcessor.prototype.rsmetFilterSample = function rsmetFilterSample(state, input, params, rate = sampleRate) {
    if (this.nativeRsmetFilterReady) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativeRsmetFilter.soemdsp_rsmet_filter_create();
        }
        if (state.nativeHandle) {
          return this.safeFilterNumber(
            this.nativeRsmetFilter.soemdsp_rsmet_filter_sample(
              state.nativeHandle,
              this.safeFilterNumber(input, state),
              this.clampValue(this.safeFilterNumber(params.frequency, state), 0, 1),
              this.clampValue(this.safeFilterNumber(params.resonance, state), 0, 1),
              this.clampValue(this.safeFilterNumber(params.chaos, state), 0, 1),
              Math.max(0, Math.min(9, Math.round(Number(params.mode) || 0))),
              Math.max(1, Number(rate) || sampleRate || 44100),
            ),
            state,
          );
        }
      } catch (error) {
        this.nativeRsmetFilterReady = false;
        state.nativeHandle = 0;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "rsmet_filter",
          status: "disabled",
          message: String(error?.message || error || "native RSMET Filter failed"),
        });
      }
    }
    return this.rsmetFilterSampleJs(state, input, params, rate);
  };

