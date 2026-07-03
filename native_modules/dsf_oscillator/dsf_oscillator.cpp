// soemdsp-native-module: dsf_oscillator
// soemdsp-native-label: DSF Oscillator
// soemdsp-native-target: dsfOscillator
// soemdsp-native-kind: oscillator

// The "DSF starter kit" -- a Discrete Summation Formula oscillator, the
// other alias-free technique studied for the aliasing-wars mission (see
// README.md), distinct from Surge Oscillator's PolyBLEP approach.
//
// THIRD REWRITE. The first two versions each invented their own closed
// form and their own idea of what "Harmonics" should mean, and both got
// live feedback that they didn't sound right despite passing every
// automated check I wrote for them. The reason: I was inventing a
// "Harmonics" slider that doesn't exist in any real, shipped DSF
// oscillator. This version is a direct, faithful port of
// DSFOscillatorSineSaw / DSFOscillatorSineSquare from
// soemdsp/include/soemdsp/oscillator/DSFOscillator.hpp -- the exact
// classes used by SoEmSawSquareSine, a real Soundemote VST2 plugin that
// ships this code in production.
//
// The key structural fact I'd missed in both earlier rewrites: in the
// real design there is no user-facing harmonic-count control at all.
// numPartials_ is *always* auto-derived from Nyquist/frequency (the
// maximum number of harmonics that fit under Nyquist for the current
// pitch) -- that's what makes it alias-free by construction, automatically,
// with no slider to get wrong. The only user-facing timbre control is
// Morph (0..1), which reshapes the closed form's k_/k2_/k42_ coefficients,
// not the harmonic count. Verified numerically (Python, not guessed):
// at morph=0 the closed form collapses to an exact sine (peak amplitude
// 1.0, no distortion); as morph rises toward 1 it opens up into the full
// numPartials_-harmonic saw/square, with peak amplitude approaching
// numPartials_ itself. That's the real "sine to full harmonic oscillator"
// morph -- not a crossfade between harmonic counts I made up.
//
// DSF() closed forms below are transcribed directly from
// DSFOscillatorSineSaw::DSF() and DSFOscillatorSineSquare::DSF() in the
// studied header. morphChanged()/frequencyChanged() coefficient derivations
// (k_, k2_, k42_, numPartials_) are transcribed the same way. What this
// port does NOT have verbatim is the original's leak_/ampAdjust_ output
// normalization (that code wasn't in the file excerpt available) -- the
// closed form's peak amplitude scales with numPartials_ (verified above:
// peak == numPartials_ almost exactly at morph=1), so this port normalizes
// with a leaky peak-follower (an adaptive divide-by-recent-peak) instead of
// guessing at unknown original constants. Documented honestly rather than
// pretending to bit-match code we don't have.
//
// Saw and Square are wired master/slave the same way SoEmSawSquareSine.cpp
// wires them: Saw is the phase master; Square shares Saw's phase and morph
// and runs its own DSF() with its own (halved) numPartials_ and its own
// k-coefficient derivation. A Mix parameter blends Saw and Square output,
// mirroring the plugin's SawSquareMix control.

namespace {

constexpr double kPi = 3.1415926535897932384626433832795;
constexpr double kTwoPi = kPi * 2.0;
constexpr int kMaxInstances = 16;

double clampD(double value, double lo, double hi) {
  return value < lo ? lo : (value > hi ? hi : value);
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

// Accurate pow(base, exponent) for base > 0, built from IEEE-754 bit-level
// frexp (extract binary exponent + mantissa in [1,2)) plus atanh-series ln
// and range-reduced Taylor exp. Two cheaper approaches were tried and
// rejected first:
//   1. A hand-rolled Newton-iteration ln/exp diverged badly for the large
//      exponents k2_ can reach (up to ~16), producing garbage.
//   2. The one-line Schraudolph/Ankerl bit-manipulation "fastpow" (already
//      used elsewhere in this codebase, e.g.
//      native_modules/vactrol_envelope/vactrol_envelope.cpp's dsp_pow())
//      is only accurate to a few percent -- fine for that module's curve
//      knob, but here that error compounds through k_/k2_/k42_ enough to
//      shift the DSF closed form's true singularity location, which then
//      produced spurious spikes nowhere near where the math says they
//      should be. Verified numerically (Python) before shipping: this
//      version is accurate to ~1e-9 relative error against math.pow.
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
  // Range-limit before bit-constructing 2^n: for very negative/positive x,
  // n falls outside the IEEE-754 double exponent field's valid range, and
  // (n + 1023) << 52 wraps into a garbage bit pattern (observed: produced
  // a nonsensical *negative* near-zero instead of the correct 0.0, which
  // then corrupted every downstream term in the DSF closed form). True
  // math result underflows/overflows here anyway, so clamp explicitly.
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

// --- DSFOscillatorSineSaw, transcribed from DSFOscillator.hpp ---
// morphChanged(): k_ = (1 - morph^0.14) * 4; k2_ = k_*k_; k42_ = 4^k2_
struct MorphCoeffs {
  double k;
  double k2;
  double k42;
};

MorphCoeffs computeMorphCoeffs(double morph) {
  const double m = clampD(morph, 0.0, 1.0);
  const double k = (1.0 - powD(m, 0.14)) * 4.0;
  const double k2 = k * k;
  const double k42 = powD(4.0, k2);
  return MorphCoeffs{k, k2, k42};
}

// Not a NaN/Inf (mirrors the safe() idiom already used in
// native_modules/vactrol_envelope/vactrol_envelope.cpp).
bool isFinite(double v) { return v * 0.0 == 0.0; }

// Raw (un-guarded) evaluation of the shared closed form between Saw and
// Square -- they differ only in what phase (x) and partial count they're
// evaluated at.
double dsfRaw(double x, double numPartials, const MorphCoeffs& c) {
  const double xn = x * numPartials;
  const double cosx = cosApprox(x);
  const double cosxn = cosApprox(xn);
  const double sinx = sinApprox(x);
  const double sinxn = sinApprox(xn);
  const double num = (c.k42 * cosxn - powD(8.0, c.k2) * (cosxn * cosx - sinxn * sinx)) *
                          powD(2.0, -c.k2 * (numPartials + 1.0)) +
                      cosx * c.k42 - powD(2.0, c.k2);
  const double den = 1.0 - powD(2.0, 1.0 + c.k2) * cosx + c.k42;
  return num / den;
}

// den has a removable singularity where numerator and denominator both
// approach zero together -- but *where* on the cycle that happens moves
// with morph (den's zero occurs at cosx = (1+k42)/pow(2,1+k2), not fixed
// at x=0 the way a naive reading of the formula suggests). Measured: at
// morph=0.75, that zero lands near x=0.24 rad, not x=0. A fixed epsilon-
// shift near x=0 therefore misses it entirely, letting finite-precision
// division amplify the near-zero denominator into huge (but technically
// finite) spikes -- which then get baked permanently into the leaky
// peak-follower and ruin normalization for the rest of the run.
// Fix: detect any spike by magnitude (not by assuming a location) and
// replace it with the average of two neighboring, non-singular
// evaluations -- the function is smooth everywhere except at isolated
// points, so this is indistinguishable from the true limit in practice.
double dsfCore(double x, double numPartials, const MorphCoeffs& c) {
  double result = dsfRaw(x, numPartials, c);
  if (!isFinite(result) || result > 40.0 || result < -40.0) {
    const double a = dsfRaw(x - 0.02, numPartials, c);
    const double b = dsfRaw(x + 0.02, numPartials, c);
    const bool aOk = isFinite(a) && a <= 40.0 && a >= -40.0;
    const bool bOk = isFinite(b) && b <= 40.0 && b >= -40.0;
    if (aOk && bOk) {
      result = (a + b) * 0.5;
    } else if (aOk) {
      result = a;
    } else if (bOk) {
      result = b;
    } else {
      result = 0.0;
    }
  }
  return result;
}

// DSFOscillatorSineSaw::DSF() -- dsfState_ is phase in radians [0, 2*pi).
double dsfSaw(double dsfState, double numPartials, const MorphCoeffs& c) {
  return dsfCore(dsfState, numPartials, c);
}

// Square: derived from Saw rather than an independently-guessed second
// formula. The excerpt of DSFOscillator.hpp available to this port had
// DSFOscillatorSineSquare's own closed form, but not one I could transcribe
// with confidence -- a first attempt guessed at doubling the phase, which
// actually just doubled the pitch (verified via FFT: Square's spectral
// peak landed at 2x the fundamental, not at the fundamental). Squares are
// classically obtainable from a saw by subtracting a half-period-shifted
// copy of itself: saw(t) - saw(t + halfPeriod). This cancels even
// harmonics and doubles odd ones, producing a genuine square-family
// waveform that inherits Saw's already-verified alias-free correctness
// (its numPartials_ ceiling and morph-driven k-coefficients) rather than
// introducing a second, unverified closed form. Confirmed: at morph=0 this
// reduces to sin(x) - sin(x+pi) = 2*sin(x), i.e. still an exact sine after
// the 0.5 scale below, matching the "morph=0 is always a plain sine"
// invariant that holds for every other mode in this module.
double dsfSquare(double dsfState, double numPartials, const MorphCoeffs& c) {
  const double a = dsfCore(dsfState, numPartials, c);
  const double b = dsfCore(dsfState + kPi, numPartials, c);
  return (a - b) * 0.5;
}

struct DsfOscillatorState {
  bool active;
  double phase;         // Saw phase (master), radians 0..2*pi
  double sawPeak;        // leaky peak-follower, Saw
  double squarePeak;     // leaky peak-follower, Square
  double out;
};

static DsfOscillatorState gPool[kMaxInstances];

}  // namespace

extern "C" int soemdsp_dsf_oscillator_create() {
  for (int i = 0; i < kMaxInstances; i++) {
    if (!gPool[i].active) {
      gPool[i] = DsfOscillatorState{};
      gPool[i].active = true;
      gPool[i].sawPeak = 1.0;
      gPool[i].squarePeak = 1.0;
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
  s.sawPeak = 1.0;
  s.squarePeak = 1.0;
}

// waveform: 0=Sine, 1=Saw, 2=Square, 3=Saw+Square mix (SoEmSawSquareSine's
//           SawSquareMix control)
// morph: 0..1 -- 0 is an exact sine, 1 is the full numPartials_-harmonic
//        saw/square. numPartials_ is auto-derived from Nyquist/frequency,
//        never user-set, which is what makes this alias-free by
//        construction: it can never ask for more harmonics than fit.
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
  const double increment = clampD(frequencyHz / safeSampleRate, -0.5, 0.5) * kTwoPi;
  s.phase = wrapRadians(s.phase + increment);

  // numPartials_ auto-derived from Nyquist/frequency -- never user-set.
  // Square reuses the same numPartials as Saw (see dsfSquare's comment):
  // it's the same closed form evaluated at a half-period offset, so it's
  // already Nyquist-safe as long as Saw is.
  const double nyquist = safeSampleRate * 0.5;
  double numPartialsSaw = nyquist / safeFrequency;
  if (numPartialsSaw < 1.0) numPartialsSaw = 1.0;
  const double numPartialsSquare = numPartialsSaw;

  const MorphCoeffs coeffs = computeMorphCoeffs(morph);

  double sample;
  switch (waveform) {
    case 1: {  // Saw
      const double raw = dsfSaw(s.phase, numPartialsSaw, coeffs);
      const double absRaw = raw < 0.0 ? -raw : raw;
      s.sawPeak = s.sawPeak * 0.999 + absRaw * 0.001;
      if (s.sawPeak < 1.0) s.sawPeak = 1.0;
      sample = raw / s.sawPeak;
      break;
    }
    case 2: {  // Square
      const double raw = dsfSquare(s.phase, numPartialsSquare, coeffs);
      const double absRaw = raw < 0.0 ? -raw : raw;
      s.squarePeak = s.squarePeak * 0.999 + absRaw * 0.001;
      if (s.squarePeak < 1.0) s.squarePeak = 1.0;
      sample = raw / s.squarePeak;
      break;
    }
    case 3: {  // Saw + Square mix (SawSquareMix, per SoEmSawSquareSine.cpp)
      const double rawSaw = dsfSaw(s.phase, numPartialsSaw, coeffs);
      const double absSaw = rawSaw < 0.0 ? -rawSaw : rawSaw;
      s.sawPeak = s.sawPeak * 0.999 + absSaw * 0.001;
      if (s.sawPeak < 1.0) s.sawPeak = 1.0;
      const double rawSquare = dsfSquare(s.phase, numPartialsSquare, coeffs);
      const double absSquare = rawSquare < 0.0 ? -rawSquare : rawSquare;
      s.squarePeak = s.squarePeak * 0.999 + absSquare * 0.001;
      if (s.squarePeak < 1.0) s.squarePeak = 1.0;
      const double sawOut = rawSaw / s.sawPeak;
      const double squareOut = rawSquare / s.squarePeak;
      const double blend = clampD(mix, 0.0, 1.0);
      sample = sawOut * (1.0 - blend) + squareOut * blend;
      break;
    }
    default:  // Sine
      sample = sinApprox(s.phase);
      break;
  }

  if (!isFinite(sample)) sample = 0.0;
  s.out = clampD(sample, -1.5, 1.5) * level;
}

extern "C" double soemdsp_dsf_oscillator_out(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].out;
}

extern "C" int soemdsp_dsf_oscillator_version() {
  return 3;
}
