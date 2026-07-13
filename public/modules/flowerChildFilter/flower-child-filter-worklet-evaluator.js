NodeLiveAudioProcessor.prototype.createFlowerChildFilterState = function createFlowerChildFilterState() {
    return {
      phase: 0, phaseOffset: 0, stage1: 0, stage2: 0, selfMod: 0,
      rev3Feedback: 0, rev3Lpf1Y1: 0, rev3Lpf2Y1: 0, dsPhase: 0, dsHeld: 0,
      nativeHandle: 0,
    };
  };

NodeLiveAudioProcessor.prototype.flowerChildFilterCurveShape = function flowerChildFilterCurveShape(v, tension) {
    const denom = 2 * tension * v - tension - 1;
    if (denom === 0) return v;
    return (tension * v - v) / denom;
  };

NodeLiveAudioProcessor.prototype.flowerChildFilterRationalCurve = function flowerChildFilterRationalCurve(p, skew) {
    return ((1 + skew) * p) / (1 - skew + 2 * skew * p);
  };

NodeLiveAudioProcessor.prototype.flowerChildFilterEvalResonanceGraph = function flowerChildFilterEvalResonanceGraph(x, n0y, breakpoint, n2y, skew) {
    if (x < 0) return n0y;
    if (x >= 1) return n2y;
    if (x < breakpoint) return n0y;
    const p = (x - breakpoint) / (1 - breakpoint);
    return n0y + (n2y - n0y) * this.flowerChildFilterRationalCurve(p, skew);
  };

NodeLiveAudioProcessor.prototype.flowerChildFilterOnePoleCoefficient = function flowerChildFilterOnePoleCoefficient(cutoffHz, sampleRateValue) {
    const rawWc = (2 * Math.PI * cutoffHz) / sampleRateValue;
    const wc = this.clampValue(rawWc, 1e-9, Math.PI * 0.98);
    const s = Math.sin(wc);
    const c = Math.cos(wc);
    const t = Math.tan(0.25 * (wc - Math.PI));
    let denom = s - c * t;
    if (denom > -1e-12 && denom < 1e-12) denom = denom >= 0 ? 1e-12 : -1e-12;
    return t / denom;
  };

NodeLiveAudioProcessor.prototype.flowerChildFilterOnePoleStep = function flowerChildFilterOnePoleStep(prevY1, input, a) {
    let y0 = input;
    y0 = y0 / (1 + y0 * y0);
    return y0 + a * (y0 - prevY1);
  };

NodeLiveAudioProcessor.prototype.flowerChildFilterEllipse = function flowerChildFilterEllipse(phase, ellipseC) {
    const sinX = Math.sin(phase * 2 * Math.PI);
    const cosX = Math.cos(phase * 2 * Math.PI);
    let sqrtVal = Math.sqrt(cosX * cosX + (ellipseC * sinX) * (ellipseC * sinX));
    if (sqrtVal < 1e-12) sqrtVal = 1e-12;
    return cosX / sqrtVal;
  };

NodeLiveAudioProcessor.prototype.flowerChildFilterEvalGraph = function flowerChildFilterEvalGraph(nodes, x) {
    if (nodes.length === 0) return 0;
    if (x < nodes[0].x) return nodes[0].y;
    let i = -1;
    for (let k = 0; k < nodes.length; k++) {
      if (nodes[k].x > x) { i = k; break; }
    }
    if (i < 0) return nodes[nodes.length - 1].y;
    if (i === 0) return nodes[0].y;
    const n1 = nodes[i - 1];
    const n2 = nodes[i];
    if (n2.x - n1.x < 1e-9) return 0.5 * (n1.y + n2.y);
    const p = (x - n1.x) / (n2.x - n1.x);
    if (n2.shape === 1) return n1.y + (n2.y - n1.y) * this.flowerChildFilterRationalCurve(p, n2.skew);
    if (n2.shape === 2) {
      const c = 0.5 * (n2.skew + 1);
      const a = 2 * Math.log((1 - c) / c);
      return n1.y + (n2.y - n1.y) * (1 - Math.exp(p * a)) / (1 - Math.exp(a));
    }
    return n1.y + (n2.y - n1.y) * p;
  };

NodeLiveAudioProcessor.prototype.flowerChildFilterOnePoleIitCoefficient = function flowerChildFilterOnePoleIitCoefficient(cutoffHz, sampleRateValue) {
    const w = Math.max(1e-9, Math.min(Math.PI * 0.98, 2 * Math.PI * cutoffHz / sampleRateValue));
    return Math.exp(-w);
  };

NodeLiveAudioProcessor.prototype.flowerChildFilterOnePoleIitStep = function flowerChildFilterOnePoleIitStep(prevY1, input, a1) {
    const b0 = 1 - a1;
    return b0 * input + a1 * prevY1;
  };

NodeLiveAudioProcessor.prototype.flowerChildFilterSampleAndHold = function flowerChildFilterSampleAndHold(state, incoming, samplingFreq, sampleRateValue) {
    state.dsPhase += samplingFreq / sampleRateValue;
    if (state.dsPhase >= 1) {
      state.dsPhase -= Math.floor(state.dsPhase);
      state.dsHeld = incoming;
    }
    return state.dsHeld;
  };

NodeLiveAudioProcessor.prototype.flowerChildFilterSampleJs = function flowerChildFilterSampleJs(state, input, params, rate) {
    const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
    const freqNorm = this.clampValue(this.safeFilterNumber(params.frequency, state), 0, 1);
    const reso = this.clampValue(this.safeFilterNumber(params.resonance, state), 0, 1);
    const chaos = this.clampValue(this.safeFilterNumber(params.chaos, state), 0, 1);
    const modeNum = Math.round(Number(params.mode) || 0);

    if (modeNum === 2) {
      const masterPitch = -120 + (105 - -120) * freqNorm;
      const masterFrequency = 440 * Math.pow(2, (masterPitch - 69) / 12);
      const fmAmount = 440 * Math.pow(2, (-48.377 - 69) / 12);
      const lpf1Cutoff = 440 * Math.pow(2, ((90 + (180 - 90) * (masterPitch - -120) / (120 - -120)) - 69) / 12);
      const lpf2Cutoff = 440 * Math.pow(2, ((80 + (130 - 80) * (masterPitch - -120) / (120 - -120)) - 69) / 12);
      const lpf1A = this.flowerChildFilterOnePoleIitCoefficient(lpf1Cutoff, safeRate);
      const lpf2A = this.flowerChildFilterOnePoleIitCoefficient(lpf2Cutoff, safeRate);

      const phaseModGraph = [{x:0,y:0.0,skew:0,shape:0},{x:0.5,y:-0.017446,skew:0.9,shape:1},{x:0.6,y:-0.017575,skew:0.0,shape:1},{x:1.0,y:-0.0147,skew:0.6,shape:1}];
      const sineAmpGraph = [{x:0,y:4.44777,skew:0,shape:0},{x:0.5,y:8.6687,skew:0.9,shape:1},{x:0.6,y:8.6687,skew:0.0,shape:1},{x:1.0,y:2.0,skew:0.6,shape:1}];
      const sineToSquareGraph = [{x:0,y:0.6792,skew:0,shape:0},{x:0.5,y:0.9552,skew:0.9,shape:1},{x:0.6,y:0.9552,skew:0.0,shape:1},{x:1.0,y:0.001,skew:0.6,shape:1}];
      const clipLevelGraph = [{x:0.0,y:7.0,skew:0,shape:0},{x:0.7,y:7.0,skew:0.0,shape:1},{x:1.0,y:2.0,skew:0.6,shape:1}];
      const noiseGraph = [{x:0.0,y:0.0,skew:0,shape:0},{x:0.8,y:0.1,skew:0,shape:0},{x:1.0,y:1.0,skew:0.0,shape:1}];

      const pmAmount = this.flowerChildFilterEvalGraph(phaseModGraph, reso);
      const sineAmp = this.flowerChildFilterEvalGraph(sineAmpGraph, reso);
      const sineToSquare = this.flowerChildFilterEvalGraph(sineToSquareGraph, reso);
      const clipLevelRaw = this.flowerChildFilterEvalGraph(clipLevelGraph, reso);
      const clipLevel = Math.min(sineAmp, clipLevelRaw);
      const noiseReduction = this.flowerChildFilterEvalGraph(noiseGraph, reso);
      const chaosAmount4x = chaos * 4;

      const safeInput = this.safeFilterNumber(input, state);
      const inSig = state.rev3Feedback + this.clampValue(-1 * safeInput, -clipLevel, clipLevel);
      const f = masterFrequency * inSig * fmAmount;
      const noiseTerm = masterFrequency * (Math.random() * 2 - 1) * chaosAmount4x * noiseReduction;

      state.phase = state.phase + (f + noiseTerm) / safeRate;
      state.phase = state.phase - Math.floor(state.phase);
      const bipolarPhasor = 2 * state.phase - 1;
      const phasorOut = bipolarPhasor + pmAmount * state.rev3Feedback;

      const ellipseOut = sineAmp * this.flowerChildFilterEllipse(phasorOut, sineToSquare);

      let feedback = this.flowerChildFilterOnePoleIitStep(state.rev3Lpf1Y1, ellipseOut, lpf1A);
      state.rev3Lpf1Y1 = feedback;
      feedback = this.flowerChildFilterOnePoleIitStep(state.rev3Lpf2Y1, feedback, lpf2A);
      state.rev3Lpf2Y1 = feedback;
      state.rev3Feedback = feedback;

      return this.safeFilterNumber(feedback * 0.15, state);
    }

    if (modeNum === 3) {
      const maxNormFreq3 = safeRate <= 44100 ? 0.928 : 1;
      const normalizedFreqInUse3 = Math.min(freqNorm, maxNormFreq3) * (161 - 3) + 3;
      const frequencyHz3 = 440 * Math.pow(2, (normalizedFreqInUse3 - 69) / 12);

      const cutoff1 = frequencyHz3 * 0.4;
      const a1 = this.flowerChildFilterOnePoleCoefficient(cutoff1, safeRate);

      let breakpoint, cap;
      if (safeRate <= 44100) { breakpoint = 0.732441; cap = 0.649123; }
      else if (safeRate <= 88200) { breakpoint = 0.816054; cap = 0.818713; }
      else { breakpoint = 0.879599; cap = 0.807018; }
      const cappedTarget = Math.min(reso, cap);
      const graphValue = this.flowerChildFilterEvalResonanceGraph(reso, reso, breakpoint, cappedTarget, -0.38);
      const selfModAmp = 0.0368 + (0.6333 - 0.0368) * this.flowerChildFilterCurveShape(graphValue, 0.4);

      const safeInput = this.safeFilterNumber(input, state);
      let inputSignal = this.clampValue(-safeInput, -1, 1) * 0.036;
      inputSignal += state.selfMod;

      const mod = 1.4 * inputSignal;
      const fm = mod;

      state.phase = state.phase + (frequencyHz3 * fm * 6.0) / safeRate;
      state.phase = state.phase - Math.floor(state.phase);

      const dsf = [{x:0,y:0,skew:0,shape:0},{x:1,y:0.025*safeRate,skew:-0.09,shape:2}];
      const samplingFreq = frequencyHz3 * 2.0 + this.flowerChildFilterEvalGraph(dsf, 10.0 * Math.abs(mod));

      const downsampledPhase = this.flowerChildFilterSampleAndHold(state, state.phase, samplingFreq, safeRate);
      const current_osc_value = Math.sin(downsampledPhase * 2 * Math.PI) * 1.3;

      const filtered = this.flowerChildFilterOnePoleStep(state.stage1, current_osc_value, a1);
      state.stage1 = filtered;
      state.selfMod = filtered * selfModAmp;

      return this.safeFilterNumber(filtered * 1.4, state);
    }

    const dirty = modeNum !== 0;

    const maxNormFreq = safeRate <= 44100 ? 0.928 : 1;
    const normalizedFreqInUse = Math.min(freqNorm, maxNormFreq) * (161 - 3) + 3;
    const frequencyHz = 440 * Math.pow(2, (normalizedFreqInUse - 69) / 12);

    // FM/PM crossfade is provably always 0 (see the .cpp header comment) --
    // collapses to pure FM feedback: fm = mod, pm = 0.

    const cutoff1 = frequencyHz * 0.164312;
    const cutoff2 = frequencyHz * 0.366131;
    const a1 = this.flowerChildFilterOnePoleCoefficient(cutoff1, safeRate);
    const a2 = this.flowerChildFilterOnePoleCoefficient(cutoff2, safeRate);

    let breakpoint, cap;
    if (dirty) {
      if (safeRate <= 44100) { breakpoint = 0.816054; cap = 0.602339; }
      else if (safeRate <= 88200) { breakpoint = 0.902657; cap = 0.654971; }
      else { breakpoint = 0.977649; cap = 0.760234; }
    } else {
      if (safeRate <= 44100) { breakpoint = 0.732441; cap = 0.649123; }
      else if (safeRate <= 88200) { breakpoint = 0.816054; cap = 0.818713; }
      else { breakpoint = 0.879599; cap = 0.807018; }
    }
    const cappedTarget = Math.min(reso, cap);

    let selfModAmp = 1;
    let ellipseC = -1;
    if (!dirty) {
      const graphValue = this.flowerChildFilterEvalResonanceGraph(reso, reso, breakpoint, cappedTarget, -0.38);
      selfModAmp = 0.0368 + (0.6333 - 0.0368) * this.flowerChildFilterCurveShape(graphValue, 0.4);
    } else {
      const graphValue = this.flowerChildFilterEvalResonanceGraph(freqNorm, reso, breakpoint, cappedTarget, -0.38);
      ellipseC = -1 + (0.00001 - -1) * this.flowerChildFilterCurveShape(graphValue, -0.6);
    }

    const clampLimit = dirty ? 1.198 : 1;
    const safeInput = this.safeFilterNumber(input, state);
    let inputSignal = this.clampValue(-safeInput, -clampLimit, clampLimit);

    if (chaos > 0) {
      inputSignal += (Math.random() * 2 - 1) * chaos;
    }

    inputSignal = state.selfMod + 0.035848699999999845 * inputSignal;

    const mod = 1.4 * inputSignal;
    const fm = mod;

    state.phaseOffset = 0;
    const incAmt = (frequencyHz * fm) / safeRate;
    state.phase = state.phase + incAmt;
    state.phase = state.phase - Math.floor(state.phase);
    let unipolarPhase = state.phase + state.phaseOffset;
    unipolarPhase = unipolarPhase - Math.floor(unipolarPhase);

    const oscValue = dirty
      ? this.flowerChildFilterEllipse(unipolarPhase, ellipseC) * 0.1
      : Math.sin(unipolarPhase * 2 * Math.PI) * 1.3;

    let out = this.flowerChildFilterOnePoleStep(state.stage1, oscValue, a1);
    state.stage1 = out;
    out = this.flowerChildFilterOnePoleStep(state.stage2, out, a2);
    state.stage2 = out;

    state.selfMod = dirty ? out * 0.465 : out * selfModAmp;

    const output = dirty ? out * 5.22 : out * 1.31;
    return this.safeFilterNumber(output, state);
  };

NodeLiveAudioProcessor.prototype.flowerChildFilterSample = function flowerChildFilterSample(state, input, params, rate = sampleRate) {
    if (this.nativeFlowerChildFilterReady) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativeFlowerChildFilter.soemdsp_flower_child_filter_create();
        }
        if (state.nativeHandle) {
          return this.safeFilterNumber(
            this.nativeFlowerChildFilter.soemdsp_flower_child_filter_sample(
              state.nativeHandle,
              this.safeFilterNumber(input, state),
              this.clampValue(this.safeFilterNumber(params.frequency, state), 0, 1),
              this.clampValue(this.safeFilterNumber(params.resonance, state), 0, 1),
              this.clampValue(this.safeFilterNumber(params.chaos, state), 0, 1),
              Math.max(0, Math.min(3, Math.round(Number(params.mode) || 0))),
              Math.max(1, Number(rate) || sampleRate || 44100),
            ),
            state,
          );
        }
      } catch (error) {
        this.nativeFlowerChildFilterReady = false;
        state.nativeHandle = 0;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "flower_child_filter",
          status: "disabled",
          message: String(error?.message || error || "native Flower Child Filter failed"),
        });
      }
    }
    return this.flowerChildFilterSampleJs(state, input, params, rate);
  };

