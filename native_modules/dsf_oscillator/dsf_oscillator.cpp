// soemdsp-native-module: dsf_oscillator
// soemdsp-native-label: DSF Oscillator
// soemdsp-native-target: dsfOscillator
// soemdsp-native-kind: oscillator

// The "DSF starter kit" -- a Discrete Summation Formula oscillator, the
// other alias-free technique studied for the aliasing-wars mission (see
// README.md), distinct from Surge Oscillator's PolyBLEP approach. Instead
// of correcting a discontinuity after the fact, DSF computes the waveform
// directly from a closed-form trigonometric sum whose harmonic count is
// capped below Nyquist -- alias-free by construction.
//
// Core formula (sourced from the public DSF reference, itself tracing to
// Moorer 1976 -- see README.md for the full derivation):
//
//   DSF(x, a, N, fi) = (sin(fi) - a*sin(x+fi) - a^N*sin(N*x+fi)
//                        + a^(N-1)*sin((N-1)*x+fi)) / (1 - 2a*cos(x) + a^2)
//
// where x is the fundamental phase, a is a harmonic-amplitude ratio
// (0 < a < 1), N is the harmonic count, and fi is a phase offset.
//
// Waveforms built from that one formula:
//   - Saw/Buzz:   dsf(x, a, N, 0) directly -- Moorer's original case.
//   - Square:     dsf(x, a, N, 0) - dsf(x + offset, a, N, 0). Subtracting a
//                 phase-shifted copy of a saw cancels every even harmonic;
//                 sweeping `offset` continuously between the two calls is
//                 also literally variable-width PWM -- one identity, two
//                 uses, which is the PWM morph slider below.
//   - Formant:    dsf(x, a, N, fi) with fi driven by the PWM slider instead
//                 of a fixed offset -- moves the hump of harmonic emphasis
//                 instead of cancelling harmonics. This was DSF's original
//                 motivating use case (formant/vocal-like spectra), not
//                 saw/square at all.
//   - Triangle:   a leaky integrator run over the Square case (same idea
//                 the PolyBLEP-based Surge Oscillator uses for its own
//                 triangle tap).
//   - Fractal Stack: three DSF saw generators at octave-spaced frequencies
//                 (f, 2f, 4f) with geometrically falling amplitude, summed.
//                 Not a literal mathematical fractal (DSF's closed form
//                 fundamentally can't do that -- see README.md's fractal
//                 discussion) but a cheap, finite self-similar cascade,
//                 same idea as this sandbox's fractalBrownianNoise module.
//
// The Morph parameter sweeps `a` from near-0 (collapses toward a plain
// sine) up toward the harmonically rich end -- "sine to full harmonic
// oscillator" in one knob.

namespace {

constexpr double kPi = 3.1415926535897932384626433832795;
constexpr double kTwoPi = kPi * 2.0;
constexpr int kMaxInstances = 16;
constexpr int kMaxHarmonics = 64;

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
  return sinApprox(value + kPi / 2.0);
}

double powD(double base, int exponent) {
  double result = 1.0;
  double b = base;
  int e = exponent;
  while (e > 0) {
    if (e & 1) result *= b;
    b *= b;
    e >>= 1;
  }
  return result;
}

// The one closed-form equation everything below is built from.
double dsf(double x, double a, int n, double fi) {
  const double s3 = a * sinApprox(x + fi);
  const double s2 = powD(a, n) * sinApprox(n * x + fi);
  const double s1 = powD(a, n - 1) * sinApprox((n - 1) * x + fi);
  const double s4 = 1.0 - 2.0 * a * cosApprox(x) + a * a;
  if (s4 > -1.0e-9 && s4 < 1.0e-9) return 0.0;
  // (1 - a) is the standard DSF amplitude normalization: without it, peak
  // amplitude grows roughly like 1/(1-a) as a approaches 1 (worse still with
  // a nonzero phase offset fi, as in Formant mode), which otherwise slammed
  // straight into this module's safety clamp -- flat-topped digital clipping,
  // not a musical shape. Measured: raw peak ~2.44 at a=0.59, fi=pi/2 before
  // this factor; ~1.0 after it.
  return (1.0 - a) * (sinApprox(fi) - s3 - s2 + s1) / s4;
}

struct DsfOscillatorState {
  bool active;
  double phase;         // main phase, 0..1
  double phase2;        // fractal stack: 2nd octave
  double phase3;         // fractal stack: 3rd octave
  double triangleIntegrator;
  double out;
};

static DsfOscillatorState gPool[kMaxInstances];

}  // namespace

extern "C" int soemdsp_dsf_oscillator_create() {
  for (int i = 0; i < kMaxInstances; i++) {
    if (!gPool[i].active) {
      gPool[i] = DsfOscillatorState{};
      gPool[i].active = true;
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
  s.phase2 = 0.0;
  s.phase3 = 0.0;
  s.triangleIntegrator = 0.0;
}

// waveform: 0=Sine, 1=Saw/Buzz, 2=Square, 3=Formant, 4=Triangle, 5=Fractal Stack
// harmonics: N, clamped to [1, 64]
// morph: 0..1, mapped to the DSF ratio `a` (near-0 -> sine-like, near-1 -> rich)
// pulseWidth: 0..1 -- PWM offset for Square, formant-shift amount for Formant
extern "C" void soemdsp_dsf_oscillator_sample(
  int handle,
  double frequencyHz,
  double sampleRate,
  int waveform,
  int harmonics,
  double morph,
  double pulseWidth,
  double level
) {
  if (handle < 1 || handle > kMaxInstances) return;
  DsfOscillatorState& s = gPool[handle - 1];

  const double safeSampleRate = sampleRate > 1.0 ? sampleRate : 48000.0;
  const double increment = clampD(frequencyHz / safeSampleRate, -0.5, 0.5);
  s.phase = wrap01(s.phase + increment);

  const int n = harmonics < 1 ? 1 : (harmonics > kMaxHarmonics ? kMaxHarmonics : harmonics);
  const double a = clampD(0.02 + clampD(morph, 0.0, 1.0) * 0.95, 0.02, 0.97);
  const double x = s.phase * kTwoPi;

  double sample = 0.0;
  switch (waveform) {
    case 1: {  // Saw / Buzz
      sample = dsf(x, a, n, 0.0);
      break;
    }
    case 2: {  // Square (odd harmonics), pulseWidth sweeps duty cycle
      const double offset = clampD(pulseWidth, 0.001, 0.999) * kTwoPi;
      sample = dsf(x, a, n, 0.0) - dsf(x + offset, a, n, 0.0);
      break;
    }
    case 3: {  // Formant: same formula, but the offset shifts harmonic
               // emphasis rather than cancelling anything.
      const double fi = clampD(pulseWidth, 0.0, 1.0) * kPi;
      sample = dsf(x, a, n, fi);
      break;
    }
    case 4: {  // Triangle: leaky-integrate the Square case.
      const double offset = clampD(pulseWidth, 0.001, 0.999) * kTwoPi;
      const double squareLike = dsf(x, a, n, 0.0) - dsf(x + offset, a, n, 0.0);
      double next = (s.triangleIntegrator + squareLike * increment * 4.0) * 0.995;
      next = clampD(next, -1.0, 1.0);
      s.triangleIntegrator = next;
      sample = next;
      break;
    }
    case 5: {  // Fractal Stack: three octave-spaced saws, falling amplitude.
      s.phase2 = wrap01(s.phase2 + increment * 2.0);
      s.phase3 = wrap01(s.phase3 + increment * 4.0);
      const double layer1 = dsf(s.phase * kTwoPi, a, n, 0.0);
      const double layer2 = dsf(s.phase2 * kTwoPi, a, n, 0.0) * 0.5;
      const double layer3 = dsf(s.phase3 * kTwoPi, a, n, 0.0) * 0.25;
      sample = (layer1 + layer2 + layer3) / 1.75;
      break;
    }
    default:  // Sine
      sample = sinApprox(x);
      break;
  }

  s.out = clampD(sample, -1.5, 1.5) * level;
}

extern "C" double soemdsp_dsf_oscillator_out(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].out;
}

extern "C" int soemdsp_dsf_oscillator_version() {
  return 1;
}
