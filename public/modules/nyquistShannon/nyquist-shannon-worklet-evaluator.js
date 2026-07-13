NodeLiveAudioProcessor.prototype.createNyquistShannonState = function createNyquistShannonState() {
    return {
      phase: 0,
      rotatorPhase: 0,
      lastFphas: 0,
      hasLastFphas: false,
      toneSmoothCurrent: 0,
      toneSmoothInit: false,
      resetWasHigh: false,
      nativeHandle: 0,
    };
  };

NodeLiveAudioProcessor.prototype.nyquistShannonTrisaw = function nyquistShannonTrisaw(phase, warp) {
    const safeWarp = this.clampValue(warp, 0.001, 0.999);
    const wrapped = phase - Math.floor(phase);
    return wrapped < safeWarp ? wrapped / safeWarp : (1 - wrapped) / (1 - safeWarp);
  };

NodeLiveAudioProcessor.prototype.nyquistShannonSampleJs = function nyquistShannonSampleJs(state, options = {}) {
    const safeRate = Math.max(1, Number(options.sampleRate) || sampleRate || 44100);
    const frequencyA = Number(options.frequencyA) || 0;
    const midiNoteRaw = Number(options.midiNoteRaw) || 0;
    const rate = Number(options.rate) || 0;
    const sampleDots = Number(options.sampleDots) || 0;
    const phaseOffset = Number(options.phaseOffset) || 0;
    const frequencyB = Number(options.frequencyB) || 0;
    const subPhase = Number(options.subPhase) || 0;
    const subPhaseRotationSpeed = Number(options.subPhaseRotationSpeed) || 0;
    const tone = Number(options.tone) || 0;
    const toneSmoothTime = Number(options.toneSmoothTime) || 0;
    const artifact = Number(options.artifact) || 0;
    const enableToneModPitch = Number(options.enableToneModPitch) || 0;
    const enableToneModFreq = Number(options.enableToneModFreq) || 0;
    const enableToneModNote = Number(options.enableToneModNote) || 0;

    const userFreqA = frequencyA;
    const pitch = frequencyB;
    const phasorFreq = userFreqA * pitch;
    const midiNote = midiNoteRaw - 48;
    const sr = rate;
    const blend = 1 / (1 - sampleDots + 0.001);
    const tri = this.clampValue(1 - artifact, 0.001, 0.999);
    const freqToPitch = (12 * Math.log2(Math.abs(userFreqA) / 440) + 69) - 48;

    const toneMode = (enableToneModNote >= 0.5 ? 1 : 0) + (enableToneModPitch >= 0.5 ? 2 : 0) + (enableToneModFreq >= 0.5 ? 4 : 0);

    const mainPhas = (state.phase + phaseOffset) - Math.floor(state.phase + phaseOffset);
    const fphas = this.nyquistShannonTrisaw(mainPhas, tri);

    const stair = Math.floor(fphas * sr) / sr;
    const fmodFphasSr = (fphas * sr) - Math.floor(fphas * sr);
    const phas = this.clampValue(blend * fmodFphasSr, 0, 1) / sr + stair;

    const waveX = phas * 2 - 1;
    let waveY = 0;

    const smoothSamples = toneSmoothTime > 0 ? toneSmoothTime * safeRate : 1;
    const smoothStep = smoothSamples > 0 ? (1 / smoothSamples) : 1;

    const runSmoother = (target) => {
      if (!state.toneSmoothInit) {
        state.toneSmoothCurrent = target;
        state.toneSmoothInit = true;
      } else if (state.toneSmoothCurrent < target) {
        state.toneSmoothCurrent = target - state.toneSmoothCurrent > smoothStep
          ? state.toneSmoothCurrent + smoothStep
          : target;
      } else if (state.toneSmoothCurrent > target) {
        state.toneSmoothCurrent = state.toneSmoothCurrent - target > smoothStep
          ? state.toneSmoothCurrent - smoothStep
          : target;
      }
      return state.toneSmoothCurrent;
    };

    let actualTone;
    switch (toneMode) {
      case 0: actualTone = tone; break;
      case 1: actualTone = tone + runSmoother(midiNote); break;
      case 2: actualTone = tone + runSmoother(pitch - 1); break;
      case 3: actualTone = tone + runSmoother((pitch - 1) + midiNote); break;
      case 4: actualTone = tone + freqToPitch; break;
      case 5: actualTone = tone + runSmoother(midiNote * 0.5) + freqToPitch * 0.5; break;
      case 6: actualTone = tone + runSmoother(pitch - 1) + freqToPitch; break;
      default: actualTone = tone + runSmoother((pitch - 1) + midiNote * 0.5) + freqToPitch * 0.5; break;
    }

    const rotatorArg = state.rotatorPhase - subPhase;
    const psXPi = (rotatorArg - Math.floor(rotatorArg)) * Math.PI * 2;

    const wasFirstSample = !state.hasLastFphas;
    const changed = wasFirstSample ? 0 : (state.lastFphas > fphas ? 1 : (state.lastFphas < fphas ? -1 : 0));
    state.lastFphas = fphas;
    state.hasLastFphas = true;

    if (changed === 1) {
      waveY = Math.sin(actualTone * Math.PI * 2 * phas + psXPi);
    } else {
      waveY = -Math.sin(sr * Math.PI * phas + Math.PI / 2) * Math.sin(phas * (sr / 2 - actualTone) * Math.PI * 2 - psXPi);
    }

    state.phase = state.phase + phasorFreq / safeRate;
    state.phase -= Math.floor(state.phase);
    state.rotatorPhase = state.rotatorPhase + (-subPhaseRotationSpeed) / safeRate;
    state.rotatorPhase -= Math.floor(state.rotatorPhase);

    return { x: waveX, y: waveY };
  };

NodeLiveAudioProcessor.prototype.nyquistShannonSample = function nyquistShannonSample(state, options = {}) {
    const resetHigh = Number(options.reset) > 0.5;
    if (resetHigh && !state.resetWasHigh) {
      state.phase = 0;
      state.rotatorPhase = 0;
      state.hasLastFphas = false;
      state.toneSmoothInit = false;
      if (state.nativeHandle && this.nativeNyquistShannon?.soemdsp_jbnyquist_reset) {
        this.nativeNyquistShannon.soemdsp_jbnyquist_reset(state.nativeHandle);
      }
    }
    state.resetWasHigh = resetHigh;
    if (
      this.nativeNyquistShannonReady &&
      this.nativeNyquistShannon?.soemdsp_jbnyquist_create &&
      this.nativeNyquistShannon?.soemdsp_jbnyquist_sample
    ) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativeNyquistShannon.soemdsp_jbnyquist_create();
        }
        if (state.nativeHandle) {
          const sampleRateValue = Math.max(1, Number(options.sampleRate) || sampleRate || 44100);
          this.nativeNyquistShannon.soemdsp_jbnyquist_sample(
            state.nativeHandle,
            Number(options.frequencyA) || 0,
            Number(options.midiNoteRaw) || 0,
            Number(options.rate) || 0,
            Number(options.sampleDots) || 0,
            Number(options.phaseOffset) || 0,
            Number(options.frequencyB) || 0,
            Number(options.subPhase) || 0,
            Number(options.subPhaseRotationSpeed) || 0,
            Number(options.tone) || 0,
            Number(options.toneSmoothTime) || 0,
            Number(options.artifact) || 0,
            Number(options.enableToneModPitch) || 0,
            Number(options.enableToneModFreq) || 0,
            Number(options.enableToneModNote) || 0,
            sampleRateValue,
          );
          return {
            x: this.safeFilterNumber(this.nativeNyquistShannon.soemdsp_jbnyquist_x(state.nativeHandle), null),
            y: this.safeFilterNumber(this.nativeNyquistShannon.soemdsp_jbnyquist_y(state.nativeHandle), null),
          };
        }
      } catch (error) {
        this.nativeNyquistShannonReady = false;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "jerobeam_nyquist_shannon",
          status: "disabled",
          message: String(error?.message || error || "native Jerobeam Nyquist-Shannon failed"),
        });
      }
    }
    return this.nyquistShannonSampleJs(state, options);
  };

