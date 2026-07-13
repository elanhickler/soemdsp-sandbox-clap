NodeLiveAudioProcessor.prototype.createWirdoSpiralState = function createWirdoSpiralState() {
    return { phase: 0, splashPhase: 0, resetWasHigh: false, nativeHandle: 0 };
  };

NodeLiveAudioProcessor.prototype.wirdoSpiralWrap01 = function wirdoSpiralWrap01(v) {
    return v - Math.floor(v);
  };

NodeLiveAudioProcessor.prototype.wirdoSpiralTrisaw = function wirdoSpiralTrisaw(phase, warp) {
    const safeWarp = this.clampValue(warp, 0.001, 0.999);
    const wrapped = this.wirdoSpiralWrap01(phase);
    return wrapped < safeWarp ? wrapped / safeWarp : (1 - wrapped) / (1 - safeWarp);
  };

NodeLiveAudioProcessor.prototype.wirdoSpiralSampleJs = function wirdoSpiralSampleJs(state, options = {}) {
    const safeRate = Math.max(1, Number(options.sampleRate) || sampleRate || 44100);
    const frequency = Number(options.frequency) || 0;
    const sharp = this.clampValue(Number(options.sharp) || 0, 0, 1);
    const cross = Number(options.cross) || 0;
    const density = Number(options.density) || 0;
    const length = Number(options.length) || 0;
    const rotate = Number(options.rotate) || 0;
    const splashDepth = Number(options.splashDepth) || 0;
    const splashDensity = Number(options.splashDensity) || 0;
    const cut = Number(options.cut) || 0;
    const scrap = Number(options.scrap) || 0;
    const ringCut = Number(options.ringCut) || 0;
    const splashSpeed = Number(options.splashSpeed) || 0;
    const syncCut = Number(options.syncCut) || 0;

    const dens = density * Math.PI * 2;
    const safeScrap = this.clampValue(scrap, 0.0001, 1);
    const safeCut = Math.trunc(cut + 0.5);

    let phas = state.phase;
    if (safeCut < 1000 && safeCut > 0) {
      phas = Math.trunc(phas * safeCut) / safeCut;
    }

    const crossRot = (phas > sharp ? 1 : 0) * cross * Math.PI * 2 - cross * Math.PI;
    let crossPhas = this.wirdoSpiralTrisaw(phas, sharp);
    if (syncCut < 1) {
      const denom = this.clampValue(Math.abs(dens) * syncCut, 1, 1000);
      crossPhas = Math.trunc(crossPhas * denom) / denom;
    }
    const crossbow = crossPhas * length - this.clampValue(length - 1, 0, 1);

    const crossX = crossbow * Math.cos(crossRot);
    const crossY = crossbow * Math.sin(crossRot);

    const spirot = crossbow * dens;
    const spirotX = crossX * Math.cos(spirot) + crossY * Math.sin(spirot);
    const spirotY = crossY * Math.cos(spirot) - crossX * Math.sin(spirot);

    let splash = Math.sin(this.wirdoSpiralTrisaw(phas * splashDensity + state.splashPhase, 1) * Math.PI * 2 * safeScrap);
    if (safeScrap < 0.25) {
      const denom = Math.sin(safeScrap * Math.PI * 2);
      splash = denom !== 0 ? splash / denom : 0;
    }
    if (safeScrap < 0.5) {
      splash = splash * 2 - 1;
    } else if (safeScrap < 0.75) {
      const s2 = Math.sin(safeScrap * Math.PI * 2);
      splash = splash * (2 + s2) - (s2 + 1) * (1 + s2);
    }
    if (ringCut < 10 && ringCut > 0) {
      splash = Math.trunc(splash * ringCut) / ringCut;
    }

    const x = spirotX;
    const y = spirotY * Math.cos(rotate * Math.PI * 0.5) + splash * splashDepth;

    state.phase = this.wirdoSpiralWrap01(state.phase + frequency / safeRate);
    state.splashPhase = this.wirdoSpiralWrap01(state.splashPhase + splashSpeed / safeRate);

    return { x, y };
  };

NodeLiveAudioProcessor.prototype.wirdoSpiralSample = function wirdoSpiralSample(state, options = {}) {
    const resetHigh = Number(options.reset) > 0.5;
    if (resetHigh && !state.resetWasHigh) {
      state.phase = 0;
      state.splashPhase = 0;
      if (state.nativeHandle && this.nativeWirdoSpiral?.soemdsp_jbwirdo_reset) {
        this.nativeWirdoSpiral.soemdsp_jbwirdo_reset(state.nativeHandle);
      }
    }
    state.resetWasHigh = resetHigh;
    if (
      this.nativeWirdoSpiralReady &&
      this.nativeWirdoSpiral?.soemdsp_jbwirdo_create &&
      this.nativeWirdoSpiral?.soemdsp_jbwirdo_sample
    ) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativeWirdoSpiral.soemdsp_jbwirdo_create();
        }
        if (state.nativeHandle) {
          const sampleRateValue = Math.max(1, Number(options.sampleRate) || sampleRate || 44100);
          this.nativeWirdoSpiral.soemdsp_jbwirdo_sample(
            state.nativeHandle,
            Number(options.frequency) || 0,
            this.clampValue(Number(options.sharp) || 0, 0, 1),
            Number(options.cross) || 0,
            Number(options.density) || 0,
            Number(options.length) || 0,
            Number(options.rotate) || 0,
            Number(options.splashDepth) || 0,
            Number(options.splashDensity) || 0,
            Number(options.cut) || 0,
            Number(options.scrap) || 0,
            Number(options.ringCut) || 0,
            Number(options.splashSpeed) || 0,
            Number(options.syncCut) || 0,
            sampleRateValue,
          );
          return {
            x: this.safeFilterNumber(this.nativeWirdoSpiral.soemdsp_jbwirdo_x(state.nativeHandle), null),
            y: this.safeFilterNumber(this.nativeWirdoSpiral.soemdsp_jbwirdo_y(state.nativeHandle), null),
          };
        }
      } catch (error) {
        this.nativeWirdoSpiralReady = false;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "jerobeam_wirdo_spiral",
          status: "disabled",
          message: String(error?.message || error || "native Jerobeam WirdoSpiral failed"),
        });
      }
    }
    return this.wirdoSpiralSampleJs(state, options);
  };

