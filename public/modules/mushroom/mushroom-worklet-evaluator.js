NodeLiveAudioProcessor.prototype.createMushroomState = function createMushroomState() {
    return { phase: 0, capRotRamp: 0, clusterRotRamp: 0, resetWasHigh: false, nativeHandle: 0 };
  };

NodeLiveAudioProcessor.prototype.mushroomTrisaw = function mushroomTrisaw(phase, warp) {
    const safeWarp = this.clampValue(warp, 0.001, 0.999);
    const wrapped = phase - Math.floor(phase);
    return wrapped < safeWarp ? wrapped / safeWarp : (1 - wrapped) / (1 - safeWarp);
  };

NodeLiveAudioProcessor.prototype.mushroomSampleJs = function mushroomSampleJs(state, options = {}) {
    const safeRate = Math.max(1, Number(options.sampleRate) || sampleRate || 44100);
    const frequency = Number(options.frequency) || 0;
    const phaseOffset = Number(options.phaseOffset) || 0;
    const numMushroomsRaw = Number(options.numMushrooms) || 0;
    const grow = Number(options.grow) || 0;
    const density = Number(options.density) || 0;
    const capRotation = Number(options.capRotation) || 0;
    const stemRotationSpeed = Number(options.stemRotationSpeed) || 0;
    const head = Number(options.head) || 0;
    const spread = Number(options.spread) || 0;
    const wobble = Number(options.wobble) || 0;
    const clusterRotation = Number(options.clusterRotation) || 0;
    const clusterRotationSpeed = Number(options.clusterRotationSpeed) || 0;
    const sharp = Number(options.sharp) || 0;
    const width = Number(options.width) || 0;
    const stem = Number(options.stem) || 0;
    const apart = Number(options.apart) || 0;
    const capStemTransition = Number(options.capStemTransition) || 0;

    const nom = this.clampValue(numMushroomsRaw, -5, 5) || 1;
    const nomTrunc = nom === 0 ? 1 : Math.trunc(nom);
    const phasorFreq = nomTrunc < 0 ? (frequency / nomTrunc * 0.5) : (frequency * 0.5);
    const safeSharp = sharp * 0.5 + 0.5;
    const safeSpread = spread * 4;

    const phas = (state.phase + phaseOffset * 0.5) - Math.floor(state.phase + phaseOffset * 0.5);
    const caprot = (state.capRotRamp + capRotation) - Math.floor(state.capRotRamp + capRotation);
    const stemrot = (state.clusterRotRamp + clusterRotation) - Math.floor(state.clusterRotRamp + clusterRotation);

    const phasXNomX2 = phas * nomTrunc * 2;
    const ph = this.mushroomTrisaw(phasXNomX2, safeSharp) * grow;
    const stair = Math.floor(phasXNomX2) / nomTrunc;
    const phukRaw = ph * wobble + stair;
    const phuk = phukRaw - Math.floor(phukRaw);

    const formulaSin = Math.sin((ph - caprot) * density * Math.PI * 2);
    const formulaCos = Math.cos((ph - caprot) * density * Math.PI * 2);

    let shroomX = formulaSin * width;
    let shroomY = -formulaCos * width;

    const sinPhTau = Math.sin(ph * Math.PI * 2);
    const shroomHeadX = shroomX * sinPhTau * 0.5;
    const densClamped = this.clampValue(density, 0, 10);
    const shroomHeadY = shroomY * 0.1 * sinPhTau * densClamped / 10;

    const shroomStemX = shroomX * -0.4 * stem;
    const shroomStemY = shroomY * -0.1 * stem;

    if (ph > head) {
      shroomX = shroomHeadX;
      shroomY = shroomHeadY;
    } else if (ph > (1 - capStemTransition) * head) {
      const oneMTransXHead = (1 - capStemTransition) * head;
      const formula2 = (ph - oneMTransXHead) / (head - oneMTransXHead);
      shroomX = shroomHeadX * formula2 + shroomStemX * (1 - formula2);
      shroomY = shroomHeadY * formula2 + shroomStemY * (1 - formula2);
    } else {
      shroomX = shroomStemX;
      shroomY = shroomStemY;
    }

    shroomX += ph * Math.cos((phuk + stemrot - 0.25) * Math.PI * 2) * 0.5 * safeSpread;
    shroomY += ph * 2 - 1;

    const dual = ((phas >= 0.5 ? 1 : 0) * 2 - 1) * apart;
    shroomX += shroomX + dual;

    if (nomTrunc > 0) {
      shroomX = -shroomX;
    }

    const nextPhase = state.phase + phasorFreq / safeRate;
    state.phase = nextPhase - Math.floor(nextPhase);
    const nextCapRot = state.capRotRamp + stemRotationSpeed / safeRate;
    state.capRotRamp = nextCapRot - Math.floor(nextCapRot);
    const nextClusterRot = state.clusterRotRamp + clusterRotationSpeed / safeRate;
    state.clusterRotRamp = nextClusterRot - Math.floor(nextClusterRot);

    return { x: shroomX, y: shroomY };
  };

NodeLiveAudioProcessor.prototype.mushroomSample = function mushroomSample(state, options = {}) {
    const resetHigh = Number(options.reset) > 0.5;
    if (resetHigh && !state.resetWasHigh) {
      state.phase = 0;
      state.capRotRamp = 0;
      state.clusterRotRamp = 0;
      if (state.nativeHandle && this.nativeMushroom?.soemdsp_jbmushroom_reset) {
        this.nativeMushroom.soemdsp_jbmushroom_reset(state.nativeHandle);
      }
    }
    state.resetWasHigh = resetHigh;
    if (
      this.nativeMushroomReady &&
      this.nativeMushroom?.soemdsp_jbmushroom_create &&
      this.nativeMushroom?.soemdsp_jbmushroom_sample
    ) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativeMushroom.soemdsp_jbmushroom_create();
        }
        if (state.nativeHandle) {
          const sampleRateValue = Math.max(1, Number(options.sampleRate) || sampleRate || 44100);
          this.nativeMushroom.soemdsp_jbmushroom_sample(
            state.nativeHandle,
            Number(options.frequency) || 0,
            Number(options.phaseOffset) || 0,
            Number(options.numMushrooms) || 0,
            Number(options.grow) || 0,
            Number(options.density) || 0,
            Number(options.capRotation) || 0,
            Number(options.stemRotationSpeed) || 0,
            Number(options.head) || 0,
            Number(options.spread) || 0,
            Number(options.wobble) || 0,
            Number(options.clusterRotation) || 0,
            Number(options.clusterRotationSpeed) || 0,
            Number(options.sharp) || 0,
            Number(options.width) || 0,
            Number(options.stem) || 0,
            Number(options.apart) || 0,
            Number(options.capStemTransition) || 0,
            sampleRateValue,
          );
          return {
            x: this.safeFilterNumber(this.nativeMushroom.soemdsp_jbmushroom_x(state.nativeHandle), null),
            y: this.safeFilterNumber(this.nativeMushroom.soemdsp_jbmushroom_y(state.nativeHandle), null),
          };
        }
      } catch (error) {
        this.nativeMushroomReady = false;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "jerobeam_mushroom",
          status: "disabled",
          message: String(error?.message || error || "native Jerobeam Mushroom failed"),
        });
      }
    }
    return this.mushroomSampleJs(state, options);
  };

