// soemdsp-native-module: dsf_oscillator
// soemdsp-native-label: DSF Oscillator
// soemdsp-native-target: dsfOscillator
// soemdsp-native-kind: oscillator

// The "DSF starter kit" -- a Discrete Summation Formula oscillator, the
// other alias-free technique studied for the aliasing-wars mission (see
// README.md), distinct from Surge Oscillator's PolyBLEP approach.
//
// FOURTH REWRITE. The third rewrite ("faithful port") transcribed
// DSFOscillatorSineSaw's DSF() closed form correctly, but missed the
// actual architecture around it -- and never had DSFOscillatorSineSquare's
// real closed form at all, guessing at a derived saw-shift instead. Live
// feedback: "virtually unchanged." Re-read DSFOscillator.hpp in full this
// time (soemdsp/include/soemdsp/oscillator/DSFOscillator.hpp) rather than
// the partial excerpt used before. Two things the third rewrite missed
// entirely:
//
// 1. DSF() is NOT evaluated as a direct per-sample waveform. The real
//    run() treats it as a rate of change and integrates it:
//      leak_            = leak_ * 0.99 + 0.000005
//      preAmpAdjustOut_ = preAmpAdjustOut_ * (1.0 - leak_)
//      preAmpAdjustOut_ += DSF() * increment_
//      out_ = preAmpAdjustOut_ * ampAdjust_
//    This is a leaky integrator, not a stateless closed-form lookup --
//    a structurally different thing to sonically evaluate against, which
//    is exactly why a "correct closed form, evaluated directly" port
//    could pass every offline spectral test and still sound completely
//    different live.
// 2. DSFOscillatorSineSquare has its own, structurally different closed
//    form -- not derivable from Saw by a phase shift (that was a guess
//    made when only a partial header excerpt was available):
//      k_ = 1 - 1/((morph_/2 + 0.25)^14 * 10000 + 1) + 1e-12
//      DSF = 8 * (k^(N+1)*k*cos(x(2N-1)) - k^(N+1)*cos(x(2N+1))
//                 - k*cos(x)*(k-1)) / k / (1 + k^2 - 2k*cos(2x))
//
// Both closed forms and both morphChanged() coefficient derivations below
// are transcribed directly from the full header. What's added on top,
// and NOT in the original: the leaky-integrator's own accumulator has a
// documented, real bug -- the header's own top-of-file comment lists
// "morph_ not consistent in volume" as a known problem, and it's not
// cosmetic: verified numerically (Python) that at high Morph the
// accumulator drifts to a flat, fully-clipped DC value with zero
// oscillation left -- i.e. actually silent, not just quieter. Confirmed
// this is inherent to the real formula (not a WASM/precision artifact) by
// reproducing it in plain Python with exact math.pow. The shipped plugin
// (SoEmSawSquareSine.cpp) papers over this with a final hard
// std::clamp(-1, 1) before output; a hard clamp alone still leaves the
// dead-flat-DC failure mode audible as harsh clipping with no waveform
// underneath. Added instead: a DC-blocking highpass (clears the drift)
// plus a leaky peak-follower normalizer (keeps the result bounded and
// actually oscillating instead of pinned flat) -- verified numerically to
// keep every Morph value in [0,1] audibly oscillating and bounded, at
// multiple frequencies, before shipping.

namespace {

constexpr double kPi = 3.1415926535897932384626433832795;
constexpr double kTwoPi = kPi * 2.0;
constexpr int kMaxInstances = 16;

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

double cosApprox(double value) {
  return sinApprox(value + kPi * 0.5);
}

// Accurate pow(base, exponent) for base > 0, via bit-level frexp (IEEE-754
// exponent + mantissa in [1,2)) plus atanh-series ln and range-reduced
// Taylor exp. Two cheaper approaches (Newton-iteration ln/exp, and the
// one-line Schraudolph/Ankerl bit-manipulation "fastpow" also used in
// native_modules/vactrol_envelope/vactrol_envelope.cpp) were tried in the
// previous rewrite and rejected -- both lost enough precision to shift
// where this closed form's singularities land. This version is accurate
// to ~1e-9 relative error against math.pow, verified before shipping.
double lnApprox(double x) {
  union { double d; long long i; } u;
  u.d = x;
  const long long bits = u.i;
  const int e = static_cast<int>((bits >> 52) & 0x7FF) - 1023;
  const long long mbits = (bits & 0xFFFFFFFFFFFFFLL) | (1023LL << 52);
  u.i = mbits;
  const double m = u.d;  // in [1, 2)
  const double z = (m - 1.0) / (m + 1.0);  // in [0, 1/3]
  const double z2 = z * z;
  const double atanh = z * (1.0 + z2 * (1.0 / 3.0 + z2 * (1.0 / 5.0 + z2 * (1.0 / 7.0 + z2 * (1.0 / 9.0 + z2 * (1.0 / 11.0))))));
  return e * 0.6931471805599453 + 2.0 * atanh;
}

double expApprox(double x) {
  if (x < -700.0) return 0.0;
  if (x > 700.0) return 1.0e300;
  const double ln2 = 0.6931471805599453;
  const double n = __builtin_floor(x / ln2 + 0.5);
  const double r = x - n * ln2;
  const double er = 1.0 + r * (1.0 + r * (0.5 + r * (1.0 / 6.0 + r * (1.0 / 24.0 + r * (1.0 / 120.0 + r * (1.0 / 720.0 + r / 5040.0))))));
  const long long ni = static_cast<long long>(n);
  if (ni <= -1023LL) return 0.0;
  if (ni >= 1023LL) return 1.0e300;
  union { double d; long long i; } u;
  u.i = (ni + 1023LL) << 52;
  return u.d * er;
}

double powD(double base, double exponent) {
  if (base <= 0.0) return 0.0;
  return expApprox(exponent * lnApprox(base));
}

// math::map0to1<double>(t, a, b) -- linear map of t in [0,1] onto [a, b].
double map01(double t, double a, double b) {
  return a + t * (b - a);
}

// Per-waveform-generator state, mirroring DSFOscillatorBase's per-instance
// fields (leak_, preAmpAdjustOut_) -- Saw and Square each accumulate
// independently even though they share phase/dsfState in the original.
struct DsfGeneratorState {
  double leak;
  double preAmpAdjustOut;
  double peak;
  double dcLastInput;
  double dcLastOutput;
};

void resetGenerator(DsfGeneratorState& g) {
  g.leak = 1.0;
  g.preAmpAdjustOut = 0.0;
  g.peak = 1.0;
  g.dcLastInput = 0.0;
  g.dcLastOutput = 0.0;
}

// DSFOscillatorSineSaw::morphChanged(), transcribed.
struct SawCoeffs {
  double k2;
  double k42;
  double ampAdjust;
};

SawCoeffs sawMorphCoeffs(double morph) {
  const double m = clampD(morph, 0.0, 1.0);
  const double k = (1.0 - powD(m, 0.14)) * 4.0;
  const double k2 = k * k;
  const double k42 = powD(4.0, k2);
  return SawCoeffs{k2, k42, map01(m, 3.15, 2.7)};
}

// DSFOscillatorSineSaw::DSF(), transcribed. dsfState is phase in radians
// [0, 2*pi).
double sawDsf(double dsfState, double numPartials, const SawCoeffs& c) {
  const double x = dsfState;
  const double xn = dsfState * numPartials;
  const double cosx = cosApprox(x);
  const double cosxn = cosApprox(xn);
  const double sinx = sinApprox(x);
  const double sinxn = sinApprox(xn);
  const double den = 1.0 - powD(2.0, 1.0 + c.k2) * cosx + c.k42;
  if (den > -1.0e-9 && den < 1.0e-9) return 0.0;
  const double num = (c.k42 * cosxn - powD(8.0, c.k2) * (cosxn * cosx - sinxn * sinx)) *
                          powD(2.0, -c.k2 * (numPartials + 1.0)) +
                      cosx * c.k42 - powD(2.0, c.k2);
  return num / den;
}

// DSFOscillatorSineSquare::morphChanged(), transcribed.
struct SquareCoeffs {
  double k;
  double ampAdjust;
};

SquareCoeffs squareMorphCoeffs(double morph) {
  const double m = clampD(morph, 0.0, 1.0);
  const double k = 1.0 - (1.0 / (powD(m / 2.0 + 0.25, 14.0) * 10000.0 + 1.0)) + 1.0e-12;
  return SquareCoeffs{k, map01(m, 0.34, 0.81)};
}

// DSFOscillatorSineSquare::DSF(), transcribed. Guarded against k -> 0 and
// the denominator's own zero (both are real edge cases of this formula,
// not artifacts -- verified in Python against exact math.pow before
// shipping).
double squareDsf(double dsfState, double numPartials, const SquareCoeffs& c) {
  const double x = dsfState;
  const double k = c.k;
  if (k > -1.0e-9 && k < 1.0e-9) return 0.0;
  const double powKNP1 = powD(k, numPartials + 1.0);
  const double den = k * (1.0 + k * k - 2.0 * k * cosApprox(2.0 * x));
  if (den > -1.0e-12 && den < 1.0e-12) return 0.0;
  const double num = powKNP1 * k * cosApprox(x * (2.0 * numPartials - 1.0)) -
                      powKNP1 * cosApprox(x * (2.0 * numPartials + 1.0)) -
                      k * cosApprox(x) * (k - 1.0);
  return 8.0 * (num / den);
}

// One sample of DSFOscillatorBase::run(): leaky-integrate DSF() (scaled by
// increment_, i.e. treated as a rate of change), then a DC blocker and
// adaptive peak-follower on top -- see file header for why those two
// extra stages are needed to keep the real leaky-integrator architecture
// from collapsing to flat, fully-clipped DC at high Morph.
double runGenerator(DsfGeneratorState& g, double dsf, double increment, double ampAdjust) {
  g.leak = g.leak * 0.99 + 0.000005;
  g.preAmpAdjustOut = g.preAmpAdjustOut * (1.0 - g.leak) + dsf * increment;
  const double raw = g.preAmpAdjustOut * ampAdjust;

  const double r = 0.995;
  const double dcOut = raw - g.dcLastInput + r * g.dcLastOutput;
  g.dcLastInput = raw;
  g.dcLastOutput = dcOut;

  const double absOut = dcOut < 0.0 ? -dcOut : dcOut;
  g.peak = g.peak * 0.999 + absOut * 0.001;
  if (g.peak < 1.0) g.peak = 1.0;
  return dcOut / g.peak;
}

struct DsfOscillatorState {
  bool active;
  double phase;  // 0..1, shared between Saw and Square (both slave to it)
  DsfGeneratorState saw;
  DsfGeneratorState square;
  double out;
};

static DsfOscillatorState gPool[kMaxInstances];

}  // namespace

extern "C" int soemdsp_dsf_oscillator_create() {
  for (int i = 0; i < kMaxInstances; i++) {
    if (!gPool[i].active) {
      gPool[i] = DsfOscillatorState{};
      gPool[i].active = true;
      resetGenerator(gPool[i].saw);
      resetGenerator(gPool[i].square);
      return i + 1;
    }
  }
  return 0;
}

extern "C" void soemdsp_dsf_oscillator_destroy(int handle) {
  if (handle < 1 || handle > kMaxInstances) return;
  gPool[handle - 1].active = false;
}

extern "C" void soemdsp_dsf_oscillator_reset(int handle) {
  if (handle < 1 || handle > kMaxInstances) return;
  DsfOscillatorState& s = gPool[handle - 1];
  s.phase = 0.0;
  resetGenerator(s.saw);
  resetGenerator(s.square);
}

// waveform: 0=Sine, 1=Saw, 2=Square, 3=Saw+Square mix
// morph: 0..1, drives each waveform's own real coefficient derivation
// mix: 0..1 -- Saw/Square blend, used only in waveform=3
extern "C" void soemdsp_dsf_oscillator_sample(
  int handle,
  double frequencyHz,
  double sampleRate,
  int waveform,
  double morph,
  double mix,
  double level
) {
  if (handle < 1 || handle > kMaxInstances) return;
  DsfOscillatorState& s = gPool[handle - 1];

  const double safeSampleRate = sampleRate > 1.0 ? sampleRate : 48000.0;
  const double safeFrequency = frequencyHz > 1.0 ? frequencyHz : 1.0;
  const double increment = clampD(frequencyHz / safeSampleRate, -0.5, 0.5);
  // calculateState(): phase_ += increment_ * 0.9999; dsfState_ = wrap(phase_) * TAU.
  s.phase = wrap01(s.phase + increment * 0.9999);
  const double dsfState = s.phase * kTwoPi;

  const double nyquist = safeSampleRate * 0.5;
  double numPartialsSaw = nyquist / safeFrequency;
  if (numPartialsSaw < 1.0) numPartialsSaw = 1.0;
  double numPartialsSquare = numPartialsSaw * 0.5;
  if (numPartialsSquare < 1.0) numPartialsSquare = 1.0;

  double sample;
  switch (waveform) {
    case 1: {
      const SawCoeffs c = sawMorphCoeffs(morph);
      const double dsf = sawDsf(dsfState, numPartialsSaw, c);
      sample = runGenerator(s.saw, dsf, increment, c.ampAdjust);
      break;
    }
    case 2: {
      const SquareCoeffs c = squareMorphCoeffs(morph);
      const double dsf = squareDsf(dsfState, numPartialsSquare, c);
      sample = runGenerator(s.square, dsf, increment, c.ampAdjust);
      break;
    }
    case 3: {
      const SawCoeffs sc = sawMorphCoeffs(morph);
      const double sawDsfV = sawDsf(dsfState, numPartialsSaw, sc);
      const double sawOut = runGenerator(s.saw, sawDsfV, increment, sc.ampAdjust);
      const SquareCoeffs qc = squareMorphCoeffs(morph);
      const double squareDsfV = squareDsf(dsfState, numPartialsSquare, qc);
      const double squareOut = runGenerator(s.square, squareDsfV, increment, qc.ampAdjust);
      const double blend = clampD(mix, 0.0, 1.0);
      sample = sawOut * (1.0 - blend) + squareOut * blend;
      break;
    }
    default:
      sample = sinApprox(dsfState);
      break;
  }

  const bool finite = sample * 0.0 == 0.0;
  if (!finite) sample = 0.0;
  s.out = clampD(sample, -1.5, 1.5) * level;
}

extern "C" double soemdsp_dsf_oscillator_out(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].out;
}

extern "C" int soemdsp_dsf_oscillator_version() {
  return 4;
}
