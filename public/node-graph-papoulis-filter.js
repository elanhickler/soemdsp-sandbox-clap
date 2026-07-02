// Papoulis (Optimum-L) order-3 lowpass — used to smooth live XY draw input.
//
// Order-2 Papoulis is identical to Butterworth (both reduce to s^2 + sqrt(2)s + 1),
// so order 3 is the lowest order where Papoulis actually differs: faster roll-off
// than Butterworth while staying monotonic (no ripple/overshoot), which is what you
// want smoothing a drawn path — jitter gets cut harder without the trace overshooting
// past where the mouse actually went.
//
// Normalized (cutoff = 1 rad/s) analog prototype, from Papoulis (1958):
//   D(s) = (s + 0.6203) * (s^2 + 0.6904s + 0.9308)
// Each factor is designed here with unity DC gain individually so the cascade's
// overall DC gain is exactly 1.

function papoulisLowpass3BilinearPole(pole, cutoffHz, sampleRate) {
  const wc = 2 * Math.PI * Math.max(0, cutoffHz);
  const k = 2 * sampleRate;
  const p = pole * wc;
  const a0 = k + p;
  return {
    b0: p / a0,
    b1: p / a0,
    a1: (p - k) / a0,
  };
}

function papoulisLowpass3BilinearBiquad(alpha, beta, cutoffHz, sampleRate) {
  const wc = 2 * Math.PI * Math.max(0, cutoffHz);
  const k = 2 * sampleRate;
  const a1s = alpha * wc;
  const a0s = beta * wc * wc;
  const a0 = k * k + a1s * k + a0s;
  return {
    b0: a0s / a0,
    b1: (2 * a0s) / a0,
    b2: a0s / a0,
    a1: (2 * a0s - 2 * k * k) / a0,
    a2: (k * k - a1s * k + a0s) / a0,
  };
}

function designPapoulisLowpass3(cutoffHz, sampleRate) {
  return {
    pole: papoulisLowpass3BilinearPole(0.6203, cutoffHz, sampleRate),
    biquad: papoulisLowpass3BilinearBiquad(0.6904, 0.9308, cutoffHz, sampleRate),
  };
}

function createPapoulisLowpass3State() {
  return {
    poleX1: 0,
    poleY1: 0,
    biquadX1: 0,
    biquadX2: 0,
    biquadY1: 0,
    biquadY2: 0,
  };
}

function papoulisLowpass3Process(state, coeffs, input) {
  const poleOut = coeffs.pole.b0 * input + coeffs.pole.b1 * state.poleX1 - coeffs.pole.a1 * state.poleY1;
  state.poleX1 = input;
  state.poleY1 = poleOut;

  const { b0, b1, b2, a1, a2 } = coeffs.biquad;
  const biquadOut = b0 * poleOut + b1 * state.biquadX1 + b2 * state.biquadX2 - a1 * state.biquadY1 - a2 * state.biquadY2;
  state.biquadX2 = state.biquadX1;
  state.biquadX1 = poleOut;
  state.biquadY2 = state.biquadY1;
  state.biquadY1 = biquadOut;

  return biquadOut;
}

// Module-facing API for the standalone Papoulis Filter node — mirrors the
// createNodeGraphXState()/nodeGraphXSample() naming convention used by
// passiveFilter/cookbookFilter/ladderFilter so it plugs into the same
// per-node state-map dispatch pattern in the live evaluator and worklet.

function createNodeGraphPapoulisFilterState() {
  return {
    filter: createPapoulisLowpass3State(),
    coeffs: null,
    cutoffHz: NaN,
    sampleRate: NaN,
  };
}

function nodeGraphPapoulisFilterSample(state, input, cutoffHz, sampleRate) {
  const safeCutoff = Math.max(0.01, Math.min(sampleRate * 0.49, Number(cutoffHz) || 0));
  if (state.cutoffHz !== safeCutoff || state.sampleRate !== sampleRate) {
    state.coeffs = designPapoulisLowpass3(safeCutoff, sampleRate);
    state.cutoffHz = safeCutoff;
    state.sampleRate = sampleRate;
  }
  return papoulisLowpass3Process(state.filter, state.coeffs, Number(input) || 0);
}

function nodeGraphPapoulisFilterMagnitudeAt(cutoffHz, frequency, sampleRate) {
  const safeCutoff = Math.max(0.01, Math.min(sampleRate * 0.49, Number(cutoffHz) || 0));
  const coeffs = designPapoulisLowpass3(safeCutoff, sampleRate);
  const omega = (2 * Math.PI * Math.max(0, frequency)) / Math.max(1, sampleRate);
  const zRe = Math.cos(omega);
  const zIm = -Math.sin(omega);

  const poleNumRe = coeffs.pole.b0 + coeffs.pole.b1 * zRe;
  const poleNumIm = coeffs.pole.b1 * zIm;
  const poleDenRe = 1 + coeffs.pole.a1 * zRe;
  const poleDenIm = coeffs.pole.a1 * zIm;
  const poleDenMagSq = poleDenRe * poleDenRe + poleDenIm * poleDenIm;
  const poleMag = Math.sqrt((poleNumRe * poleNumRe + poleNumIm * poleNumIm) / Math.max(1e-12, poleDenMagSq));

  const z2Re = zRe * zRe - zIm * zIm;
  const z2Im = 2 * zRe * zIm;
  const { b0, b1, b2, a1, a2 } = coeffs.biquad;
  const biquadNumRe = b0 + b1 * zRe + b2 * z2Re;
  const biquadNumIm = b1 * zIm + b2 * z2Im;
  const biquadDenRe = 1 + a1 * zRe + a2 * z2Re;
  const biquadDenIm = a1 * zIm + a2 * z2Im;
  const biquadDenMagSq = biquadDenRe * biquadDenRe + biquadDenIm * biquadDenIm;
  const biquadMag = Math.sqrt(
    (biquadNumRe * biquadNumRe + biquadNumIm * biquadNumIm) / Math.max(1e-12, biquadDenMagSq),
  );

  return poleMag * biquadMag;
}
