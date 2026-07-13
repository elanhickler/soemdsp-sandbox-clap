NodeLiveAudioProcessor.prototype.createFractalSpiralState = function createFractalSpiralState() {
    return {
      phase: 0,
      spinPhase: 0,
      nativeHandle: 0,
    };
  };

NodeLiveAudioProcessor.prototype.fractalSpiralWrap01 = function fractalSpiralWrap01(value) {
    return value - Math.floor(value);
  };

NodeLiveAudioProcessor.prototype.fractalSpiralSample = function fractalSpiralSample(state, options = {}) {
    if (
      this.nativeFractalSpiralReady &&
      this.nativeFractalSpiral?.soemdsp_fractal_spiral_create &&
      this.nativeFractalSpiral?.soemdsp_fractal_spiral_sample
    ) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativeFractalSpiral.soemdsp_fractal_spiral_create();
        }
        if (state.nativeHandle) {
          const sampleRateValue = Math.max(1, Number(options.sampleRate) || sampleRate || 44100);
          this.nativeFractalSpiral.soemdsp_fractal_spiral_sample(
            state.nativeHandle,
            Number(options.frequency) || 0,
            Number(options.spin) || 0,
            Math.max(0, Number(options.size) || 0),
            Number(options.growth) || 0,
            Math.max(0.001, Math.min(0.98, Number(options.gain))),
            Math.max(1.0001, Number(options.lacunarity) || 1),
            Math.max(1, Math.min(16, Math.round(Number(options.octaves) || 1))),
            Number(options.twist) || 0,
            sampleRateValue,
          );
          return {
            x: this.nativeFractalSpiral.soemdsp_fractal_spiral_x(state.nativeHandle),
            y: this.nativeFractalSpiral.soemdsp_fractal_spiral_y(state.nativeHandle),
            z: this.nativeFractalSpiral.soemdsp_fractal_spiral_z(state.nativeHandle),
          };
        }
      } catch (error) {
        this.nativeFractalSpiralReady = false;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "fractal_spiral",
          status: "disabled",
          message: String(error?.message || error || "native Fractal Spiral failed"),
        });
      }
    }
    return this.fractalSpiralSampleJs(state, options);
  };

NodeLiveAudioProcessor.prototype.fractalSpiralSampleJs = function fractalSpiralSampleJs(state, options = {}) {
    const sampleRateValue = Math.max(1, Number(options.sampleRate) || sampleRate || 44100);
    const frequency = Number(options.frequency) || 0;
    const spin = Number(options.spin) || 0;
    const size = Math.max(0, Number(options.size) || 0);
    const growth = Number(options.growth) || 0;
    const gain = Math.max(0.001, Math.min(0.98, Number(options.gain)));
    const lacunarity = Math.max(1.0001, Number(options.lacunarity) || 1);
    const octaveCount = Math.max(1, Math.min(16, Math.round(Number(options.octaves) || 1)));
    const twist = Number(options.twist) || 0;

    const mainPhase = this.fractalSpiralWrap01(state.phase);
    state.phase = this.fractalSpiralWrap01(state.phase + frequency / sampleRateValue);
    const spinPhaseValue = this.fractalSpiralWrap01(state.spinPhase);
    state.spinPhase = this.fractalSpiralWrap01(state.spinPhase + spin / sampleRateValue);

    const theta = mainPhase * Math.PI * 2;
    const envelope = Math.exp(growth * (mainPhase - 0.5));

    let sumX = 0;
    let sumY = 0;
    let ampSum = 0;
    let amp = 1;
    let angleMultiplier = 1;
    for (let k = 0; k < octaveCount; k++) {
      const angle = angleMultiplier * theta + k * twist * Math.PI * 2;
      sumX += amp * Math.cos(angle);
      sumY += amp * Math.sin(angle);
      ampSum += amp;
      amp *= gain;
      angleMultiplier *= lacunarity;
    }
    const normX = ampSum > 0 ? sumX / ampSum : 0;
    const normY = ampSum > 0 ? sumY / ampSum : 0;

    const radius = envelope * size;
    const rawX = normX * radius;
    const rawY = normY * radius;

    const spinAngle = spinPhaseValue * Math.PI * 2;
    const cosSpin = Math.cos(spinAngle);
    const sinSpin = Math.sin(spinAngle);
    const x = rawX * cosSpin - rawY * sinSpin;
    const y = rawX * sinSpin + rawY * cosSpin;
    const z = envelope - 1;

    return { x, y, z };
  };

