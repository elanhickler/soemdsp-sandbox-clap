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
