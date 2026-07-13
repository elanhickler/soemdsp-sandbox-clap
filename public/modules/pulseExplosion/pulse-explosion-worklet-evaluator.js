NodeLiveAudioProcessor.prototype.createPulseExplosionState = function createPulseExplosionState() {
    return {
      wasHigh: false, exploding: false, elapsed: 0,
      pulses: [], nextPulseIndex: 0, nativeHandle: 0,
    };
  };

NodeLiveAudioProcessor.prototype.pulseExplosionRationalCurve = function pulseExplosionRationalCurve(p, skew) {
    let denom = 1 - skew + 2 * skew * p;
    if (denom > -1e-12 && denom < 1e-12) denom = denom >= 0 ? 1e-12 : -1e-12;
    return ((1 + skew) * p) / denom;
  };

NodeLiveAudioProcessor.prototype.pulseExplosionRaisedCosineEase = function pulseExplosionRaisedCosineEase(x, x1, x2) {
    const span = x2 - x1;
    if (span > -1e-12 && span < 1e-12) return 0.5;
    let p = (x - x1) / span;
    p = Math.max(0, Math.min(1, p));
    return 1 - (0.5 + 0.5 * Math.sin((p - 0.5) * Math.PI));
  };

NodeLiveAudioProcessor.prototype.pulseExplosionDensity = function pulseExplosionDensity(t, startTime, centerTime, endTime, skew) {
    if (t <= startTime || t >= endTime) return 0;
    const ease = t < centerTime
      ? this.pulseExplosionRaisedCosineEase(t, centerTime, startTime)
      : this.pulseExplosionRaisedCosineEase(t, centerTime, endTime);
    return Math.max(0, Math.min(1, this.pulseExplosionRationalCurve(ease, skew)));
  };

NodeLiveAudioProcessor.prototype.pulseExplosionMulberry32 = function pulseExplosionMulberry32(seed) {
    let a = seed >>> 0;
    return function pulseExplosionNext() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

NodeLiveAudioProcessor.prototype.pulseExplosionSeedHash = function pulseExplosionSeedHash(seed) {
    const buffer = new ArrayBuffer(8);
    new Float64Array(buffer)[0] = Number(seed) || 0;
    const words = new Uint32Array(buffer);
    let x = (words[0] ^ words[1]) >>> 0;
    x ^= x >>> 16;
    x = Math.imul(x, 0x7feb352d) >>> 0;
    x ^= x >>> 15;
    x = Math.imul(x, 0x846ca68b) >>> 0;
    x ^= x >>> 16;
    return (x >>> 0) || 0x9e3779b9;
  };

NodeLiveAudioProcessor.prototype.pulseExplosionRandomFn = function pulseExplosionRandomFn(seed) {
    const seedNumber = Number(seed) || 0;
    if (seedNumber === 0) {
      return Math.random;
    }
    return this.pulseExplosionMulberry32(this.pulseExplosionSeedHash(seedNumber));
  };

NodeLiveAudioProcessor.prototype.pulseExplosionSampleJs = function pulseExplosionSampleJs(state, trigger, params, rate) {
    const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
    const safeStart = Math.max(0, this.safeFilterNumber(params.startTime, state));
    let safeEnd = this.safeFilterNumber(params.endTime, state);
    if (safeEnd <= safeStart) safeEnd = safeStart + 0.001;
    let safeCenter = this.clampValue(this.safeFilterNumber(params.centerTime, state), safeStart, safeEnd);
    if (safeCenter <= safeStart) safeCenter = safeStart + 1e-6;
    if (safeCenter >= safeEnd) safeCenter = safeEnd - 1e-6;
    const skew = -0.99 + 1.98 * this.clampValue(this.safeFilterNumber(params.timeSpread, state), 0, 1);
    const safeCount = Math.max(1, Math.min(128, Math.round(Number(params.numberOfPulses) || 1)));
    const lo = Math.min(Number(params.lowAmplitude) || 0, Number(params.highAmplitude) || 0);
    const hi = Math.max(Number(params.lowAmplitude) || 0, Number(params.highAmplitude) || 0);

    const high = this.safeFilterNumber(trigger, state) > 0.5;
    if (high && !state.wasHigh) {
      state.nextPulseIndex = 0;
      state.elapsed = 0;
      state.exploding = true;

      const random = this.pulseExplosionRandomFn(params.seed);
      const pulses = [];
      for (let i = 0; i < safeCount; i++) {
        let chosenTime = safeCenter;
        for (let attempt = 0; attempt < 200; attempt++) {
          const candidate = safeStart + (safeEnd - safeStart) * random();
          const roll = random();
          const density = this.pulseExplosionDensity(candidate, safeStart, safeCenter, safeEnd, skew);
          if (roll < density) {
            chosenTime = candidate;
            break;
          }
        }
        pulses.push({ time: chosenTime, amplitude: lo + (hi - lo) * random() });
      }
      pulses.sort((a, b) => a.time - b.time);
      state.pulses = pulses;
    }
    state.wasHigh = high;

    let output = 0;
    if (state.exploding) {
      if (state.nextPulseIndex < state.pulses.length && state.elapsed >= state.pulses[state.nextPulseIndex].time) {
        output = state.pulses[state.nextPulseIndex].amplitude;
        state.nextPulseIndex++;
      }
      state.elapsed += 1 / safeRate;
      if (state.nextPulseIndex >= state.pulses.length && state.elapsed > safeEnd) {
        state.exploding = false;
      }
    }

    const curve = this.pulseExplosionDensity(state.elapsed, safeStart, safeCenter, safeEnd, skew);
    return {
      Out: this.safeFilterNumber(output, state),
      Curve: this.safeFilterNumber(curve, state),
    };
  };

NodeLiveAudioProcessor.prototype.pulseExplosionSample = function pulseExplosionSample(state, trigger, params, rate = sampleRate) {
    if (this.nativePulseExplosionReady) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativePulseExplosion.soemdsp_pulse_explosion_create();
        }
        if (state.nativeHandle) {
          const output = this.safeFilterNumber(
            this.nativePulseExplosion.soemdsp_pulse_explosion_sample(
              state.nativeHandle,
              this.safeFilterNumber(trigger, state),
              Math.max(0, this.safeFilterNumber(params.startTime, state)),
              this.safeFilterNumber(params.centerTime, state),
              this.safeFilterNumber(params.endTime, state),
              this.clampValue(this.safeFilterNumber(params.timeSpread, state), 0, 1),
              Math.max(1, Math.min(128, Math.round(Number(params.numberOfPulses) || 1))),
              this.safeFilterNumber(params.lowAmplitude, state),
              this.safeFilterNumber(params.highAmplitude, state),
              Number(params.seed) || 0,
              Math.max(1, Number(rate) || sampleRate || 44100),
            ),
            state,
          );
          const curve = this.safeFilterNumber(
            this.nativePulseExplosion.soemdsp_pulse_explosion_curve?.(state.nativeHandle) || 0,
            state,
          );
          return { Out: output, Curve: curve };
        }
      } catch (error) {
        this.nativePulseExplosionReady = false;
        state.nativeHandle = 0;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "pulse_explosion",
          status: "disabled",
          message: String(error?.message || error || "native Pulse Explosion failed"),
        });
      }
    }
    return this.pulseExplosionSampleJs(state, trigger, params, rate);
  };

