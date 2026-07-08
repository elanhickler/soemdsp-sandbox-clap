// soemdsp-native-module: blit
// soemdsp-native-label: BLIT Oscillator
// soemdsp-native-target: blit
// soemdsp-native-kind: oscillator
//
// Band-Limited Impulse Train (BLIT) oscillator, Stilson/Smith style.
// Mirrors the PolyBLEP module's output taps (Saw / Ramp / Square / Tri / Sine
// / Wave Out) so it can drop into the same node-graph slots, but derives its
// alias-suppressed waveforms by integrating a closed-form BLIT impulse train
// instead of adding PolyBLEP correction polynomials.

namespace {

constexpr double kPi = 3.1415926535897932384626433832795;
constexpr double kTwoPi = kPi * 2.0;
constexpr int kMaxInstances = 16;

struct BlitState {
  bool active;
  // Per-waveform leaky integrators. Slot layout matches the PolyBLEP taps:
  // 0 = selected/out, 1 = saw, 2 = ramp, 3 = square, 4 = tri.
  double sawIntegrator[5];
  double sqIntegrator[5];
  double triIntegrator[5];
  double out;
  double saw;
  double ramp;
  double square;
  double tri;
  double sine;
};

static BlitState gPool[kMaxInstances];

double clampD(double value, double lo, double hi) {
  return value < lo ? lo : (value > hi ? hi : value);
}

double wrap01(double value) {
  double f = value - __builtin_floor(value);
  if (f < 0.0) f += 1.0;
  if (f >= 1.0) f -= 1.0;
  return f;
}

double wrapRadians(double value) {
  while (value > kPi) value -= kTwoPi;
  while (value < -kPi) value += kTwoPi;
  return value;
}

double sinApprox(double value) {
  const double x = wrapRadians(value);
  const double x2 = x * x;
  return x * (1.0 + x2 * (-1.0 / 6.0 + x2 * (1.0 / 120.0 + x2 * (-1.0 / 5040.0 + x2 * (1.0 / 362880.0)))));
}

// Number of harmonics that fit under Nyquist for the given normalized
// increment (cycles/sample). BLIT uses an odd harmonic count M = 2*floor(...)+1.
int blitHarmonics(double dt) {
  const double freqRatio = clampD(dt < 0.0 ? -dt : dt, 1.0e-6, 0.5);
  int m = (int)(1.0 / (2.0 * freqRatio));
  if (m < 1) m = 1;
  return 2 * m + 1;
}

// Closed-form band-limited impulse train sample for phase in [0,1).
// blit(t) = (M/N) * sinc_N(M*t) with the classic Dirichlet-kernel form
// sin(pi*M*x) / (N*sin(pi*x)); N normalizes DC to unity impulses.
double blitImpulse(double phaseCycle, int harmonics) {
  const double denomArg = kPi * phaseCycle;
  const double s = sinApprox(denomArg);
  const double num = sinApprox(denomArg * harmonics);
  const double eps = 1.0e-9;
  if (s < eps && s > -eps) {
    // L'Hopital limit at the singularity -> +/- M / N (peak of the train).
    return 1.0;
  }
  return (num / (harmonics * s));
}

// Bipolar impulse pair for square/triangle: impulses of alternating sign a
// half period apart, integrated to a band-limited square wave.
double blitBipolar(double phaseCycle, int harmonics) {
  return blitImpulse(phaseCycle, harmonics) - blitImpulse(wrap01(phaseCycle + 0.5), harmonics);
}

double renderSaw(BlitState& s, int slot, double phaseCycle, double dt, int harmonics) {
  const double leak = 0.999;
  const double dc = dt; // average impulse contribution to subtract for zero DC
  double integ = s.sawIntegrator[slot] * leak + (blitImpulse(phaseCycle, harmonics) - 1.0) * dt;
  integ = clampD(integ, -1.5, 1.5);
  s.sawIntegrator[slot] = integ;
  (void)dc;
  // Scale/centre into roughly [-1,1].
  return clampD(integ * 2.0, -1.0, 1.0);
}

double renderSquare(BlitState& s, int slot, double phaseCycle, double dt, int harmonics) {
  const double leak = 0.999;
  double integ = s.sqIntegrator[slot] * leak + blitBipolar(phaseCycle, harmonics) * dt * 2.0;
  integ = clampD(integ, -1.5, 1.5);
  s.sqIntegrator[slot] = integ;
  return clampD(integ * 2.0, -1.0, 1.0);
}

double renderTriangle(BlitState& s, int slot, double phaseCycle, double dt, int harmonics) {
  const double square = renderSquare(s, slot, phaseCycle, dt, harmonics);
  const double leak = 0.9995;
  double integ = (s.triIntegrator[slot] + square * dt * 4.0) * leak;
  integ = clampD(integ, -1.0, 1.0);
  s.triIntegrator[slot] = integ;
  return integ;
}

// waveform: 0 Saw, 1 Ramp, 2 Square, 3 Triangle, 4 Sine (matches PolyBLEP)
double oscillatorSample(BlitState& s, int slot, double phase, double phaseIncrement, int waveform) {
  const double dt = clampD(phaseIncrement < 0.0 ? -phaseIncrement : phaseIncrement, 1.0e-6, 0.5);
  const int harmonics = blitHarmonics(dt);
  const double phaseCycle = wrap01(phase / kTwoPi);
  switch (waveform) {
    case 1:
      return -renderSaw(s, slot, phaseCycle, dt, harmonics);
    case 2:
      return renderSquare(s, slot, phaseCycle, dt, harmonics);
    case 3:
      return renderTriangle(s, slot, phaseCycle, dt, harmonics);
    case 4:
      return sinApprox(phase);
    case 0:
    default:
      return renderSaw(s, slot, phaseCycle, dt, harmonics);
  }
}

}  // namespace

extern "C" int soemdsp_blit_create() {
  for (int i = 0; i < kMaxInstances; i++) {
    if (!gPool[i].active) {
      gPool[i] = BlitState{};
      gPool[i].active = true;
      return i + 1;
    }
  }
  return 0;
}

extern "C" void soemdsp_blit_destroy(int handle) {
  if (handle < 1 || handle > kMaxInstances) return;
  gPool[handle - 1].active = false;
}

extern "C" void soemdsp_blit_reset(int handle) {
  if (handle < 1 || handle > kMaxInstances) return;
  BlitState& s = gPool[handle - 1];
  for (int i = 0; i < 5; i++) {
    s.sawIntegrator[i] = 0.0;
    s.sqIntegrator[i] = 0.0;
    s.triIntegrator[i] = 0.0;
  }
}

extern "C" void soemdsp_blit_sample(
  int handle,
  double phase,
  double phaseIncrement,
  int waveform,
  double level
) {
  if (handle < 1 || handle > kMaxInstances) return;
  BlitState& s = gPool[handle - 1];
  const int safeWaveform = waveform < 0 ? 0 : (waveform > 4 ? 4 : waveform);
  s.out    = oscillatorSample(s, 0, phase, phaseIncrement, safeWaveform) * level;
  s.saw    = oscillatorSample(s, 1, phase, phaseIncrement, 0) * level;
  s.ramp   = oscillatorSample(s, 2, phase, phaseIncrement, 1) * level;
  s.square = oscillatorSample(s, 3, phase, phaseIncrement, 2) * level;
  s.tri    = oscillatorSample(s, 4, phase, phaseIncrement, 3) * level;
  s.sine   = sinApprox(phase) * level;
}

extern "C" double soemdsp_blit_out(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].out;
}

extern "C" double soemdsp_blit_saw(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].saw;
}

extern "C" double soemdsp_blit_ramp(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].ramp;
}

extern "C" double soemdsp_blit_square(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].square;
}

extern "C" double soemdsp_blit_tri(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].tri;
}

extern "C" double soemdsp_blit_sine(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].sine;
}

extern "C" int soemdsp_blit_version() {
  return 1;
}
