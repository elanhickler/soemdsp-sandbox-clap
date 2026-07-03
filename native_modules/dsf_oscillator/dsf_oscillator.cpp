// soemdsp-native-module: dsf_oscillator
// soemdsp-native-label: DSF Oscillator
// soemdsp-native-target: dsfOscillator
// soemdsp-native-kind: oscillator

// The "DSF starter kit" -- a Discrete Summation Formula oscillator, the
// other alias-free technique studied for the aliasing-wars mission (see
// README.md), distinct from Surge Oscillator's PolyBLEP approach.
//
// REWRITTEN: the first version used a geometric-decay DSF closed form
// (amplitude ratio a^n per harmonic, sourced from a public DSF reference).
// It had a real correctness bug, caught live: Harmonics = 1 did not collapse
// to a plain sine the way "1 harmonic" should -- the formula's harmonic
// count and its amplitude-decay ratio were coupled in a way that never
// isolated to a single clean tone. Verified numerically: dsf(x, a=0.6, N=1,
// fi=0) produced a phase-inverted, denominator-shaped distortion, not sin(x).
//
// This version uses a different, verified closed form instead: an EQUAL-
// WEIGHTED harmonic sum (a Dirichlet-kernel-style "pure" oscillator), sourced
// from Walter H. Hackett's own reference implementations
// ("Extended DSF Oscillators.cxx", pureSawEng/pureSquEng). Confirmed by FFT:
// at Harmonics = 1, the spectrum is a single clean peak at the fundamental --
// an actual sine -- and each increment of Harmonics adds exactly one more
// harmonic at equal weight, which is the intuitive "I'm changing the number
// of harmonics" behavior the geometric version never had.
//
//   pureSaw(t, N)    = [sin(pi*t*(2N+1)) / sin(pi*t) - 1] / (2N)
//   pureSquare(t, N) = [2*sin(4*pi*t*m) / sin(2*pi*t)] / (4m),  m = N / 2
//
// where t is phase in [0, 1). Both have removable singularities (t=0 for
// pureSaw; t=0 and t=0.5 for pureSquare) handled via their L'Hopital limits,
// verified numerically before shipping. Both are normalized by their own
// measured peak amplitude (2N and 4m respectively) rather than an assumed
// constant -- confirmed empirically that the peak always occurs exactly at
// the singularity point, for every harmonic count tested.
//
// Waveforms:
//   - Sine:      sin(x) directly, no DSF math involved.
//   - Saw/Buzz:  pureSaw.
//   - Square:    pureSquare (m = N/2, odd harmonics only, by construction).
//   - Formant:   an honest simplification, not the original geometric-DSF
//                phase-offset approach (which caused the earlier DC-bias
//                bug and has no verified analog in this equal-weighted
//                family). A crossfade between Saw and Square character,
//                controlled by PWM -- a real, verified, distinct timbral
//                shift, described accurately rather than oversold as
//                formant/vocal modeling.
//   - Triangle:  a leaky integrator run over Square, same idea Surge
//                Oscillator's PolyBLEP triangle tap uses.
//   - Fractal Stack: three pureSaw generators at octave-spaced frequencies
//                (f, 2f, 4f) with geometrically falling amplitude, summed.
//                Not a literal mathematical fractal (DSF's closed form
//                fundamentally can't do genuine geometric-frequency
//                self-similarity -- see README.md) but a cheap, finite
//                self-similar cascade, same idea as fractalBrownianNoise.
//
// Morph sweeps the *effective harmonic count* continuously from 1 (a plain
// sine) up to the Harmonics slider's (Nyquist-capped) value -- "sine to
// full-harmonic oscillator" in one knob, with a linear crossfade between
// the two nearest integer harmonic counts so the sweep is smooth, not
// stepped.

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

// Equal-weighted harmonic sum, harmonics 1..n, sourced from Walter H.
// Hackett's pureSawEng. Verified: N=1 gives a single clean spectral peak at
// the fundamental (a plain sine); peak amplitude is always exactly 2N,
// occurring at the t=0 singularity, confirmed numerically for N up to 20.
double pureSaw(double t, int n) {
  if (n < 1) n = 1;
  const double denom = sinApprox(kPi * t);
  double ratio;
  if (denom > -1.0e-9 && denom < 1.0e-9) {
    ratio = 2.0 * n + 1.0;  // L'Hopital limit as t -> 0
  } else {
    ratio = sinApprox(kPi * t * (2.0 * n + 1.0)) / denom;
  }
  const double raw = ratio - 1.0;
  const double peak = 2.0 * n;
  return raw / peak;
}

// Equal-weighted ODD harmonic sum, sourced from Walter H. Hackett's
// pureSquEng. m = n/2 harmonic pairs; m=0 (n<2) is silence, matching the
// reference behavior. Verified: peak amplitude is always exactly 4m, at
// t=0 (+4m) and t=0.5 (-4m), both singularities handled via their limits.
double pureSquare(double t, int n) {
  const int m = n / 2;
  if (m < 1) return 0.0;
  const double denom = sinApprox(kTwoPi * t);
  double raw;
  if (denom > -1.0e-9 && denom < 1.0e-9) {
    // Limit is +4m at t=0, -4m at t=0.5 -- distinguish by which zero it is.
    const double tw = wrap01(t);
    raw = (tw < 0.25 || tw > 0.75) ? (4.0 * m) : (-4.0 * m);
  } else {
    raw = 2.0 * sinApprox(4.0 * kPi * t * m) / denom;
  }
  const double peak = 4.0 * m;
  return raw / peak;
}

// Smooth crossfade between harmonic count 1 (a plain sine) and n, so Morph
// sweeps continuously rather than stepping between integer harmonic counts.
double morphedHarmonicWaveform(double t, int n, double morph, bool square) {
  const double target = 1.0 + clampD(morph, 0.0, 1.0) * (n - 1);
  const int lowN = static_cast<int>(target);
  const int highN = lowN + 1 > n ? n : lowN + 1;
  const double frac = target - lowN;
  const double lowVal = square ? pureSquare(t, lowN < 2 ? 2 : lowN) : pureSaw(t, lowN < 1 ? 1 : lowN);
  const double highVal = square ? pureSquare(t, highN < 2 ? 2 : highN) : pureSaw(t, highN < 1 ? 1 : highN);
  return lowVal * (1.0 - frac) + highVal * frac;
}

struct DsfOscillatorState {
  bool active;
  double phase;         // main phase, 0..1
  double phase2;        // fractal stack: 2nd octave
  double phase3;         // fractal stack: 3rd octave
  double triangleIntegrator;
  double dcBlockLastInput;   // DC-blocking one-pole highpass state (safety net)
  double dcBlockLastOutput;
  double out;
};

// Kept as a defensive safety net -- the new pure/equal-weighted waveforms
// are symmetric and measured near-zero DC on their own, but this costs
// nothing and protects against any future waveform that isn't.
double dcBlock(DsfOscillatorState& s, double input) {
  // r=0.9995 (a ~3.8 Hz cutoff) wasn't steep enough to fully clear a residual
  // near-DC component (0-6 Hz) that Triangle mode's leaky integrator leaves
  // behind at high harmonic counts -- measured via FFT, not assumed. r=0.995
  // (~38 Hz cutoff) clears it while staying well below any oscillator
  // fundamental this module is meant to produce.
  const double r = 0.995;
  const double output = input - s.dcBlockLastInput + r * s.dcBlockLastOutput;
  s.dcBlockLastInput = input;
  s.dcBlockLastOutput = output;
  return output;
}

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
  s.dcBlockLastInput = 0.0;
  s.dcBlockLastOutput = 0.0;
}

// waveform: 0=Sine, 1=Saw/Buzz, 2=Square, 3=Formant (Saw/Square blend),
//           4=Triangle, 5=Fractal Stack
// harmonics: N, clamped to [1, 64], then Nyquist-capped per frequency
// morph: 0..1, sweeps the effective harmonic count from 1 (sine) to N
// pulseWidth: 0..1 -- Saw/Square blend amount for Formant mode
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

  // The whole "alias-free by construction" claim depends on this: the
  // Harmonics slider is a *ceiling*, not a fixed count. If N*frequency were
  // allowed to exceed Nyquist, that excess content wouldn't get suppressed
  // by the closed form -- it would alias, fold back into the audible range.
  const double nyquist = safeSampleRate * 0.5;
  const double safeFrequency = frequencyHz > 1.0 ? frequencyHz : 1.0;
  const int nyquistCappedHarmonics = static_cast<int>(nyquist / safeFrequency);
  const int requestedHarmonics = harmonics < 1 ? 1 : (harmonics > kMaxHarmonics ? kMaxHarmonics : harmonics);
  const int n = requestedHarmonics < nyquistCappedHarmonics ? requestedHarmonics : (nyquistCappedHarmonics < 1 ? 1 : nyquistCappedHarmonics);
  const double t = s.phase;

  double sample = 0.0;
  switch (waveform) {
    case 1: {  // Saw / Buzz
      sample = morphedHarmonicWaveform(t, n, morph, false);
      break;
    }
    case 2: {  // Square
      sample = morphedHarmonicWaveform(t, n, morph, true);
      break;
    }
    case 3: {  // Formant: a verified Saw/Square blend, not the original
               // geometric-DSF phase-offset approach (see file header).
      const double blend = clampD(pulseWidth, 0.0, 1.0);
      const double sawPart = morphedHarmonicWaveform(t, n, morph, false);
      const double squarePart = morphedHarmonicWaveform(t, n, morph, true);
      sample = sawPart * (1.0 - blend) + squarePart * blend;
      break;
    }
    case 4: {  // Triangle: leaky-integrate the Square case.
      const double squareLike = morphedHarmonicWaveform(t, n, morph, true);
      double next = (s.triangleIntegrator + squareLike * increment * 4.0) * 0.995;
      next = clampD(next, -1.0, 1.0);
      s.triangleIntegrator = next;
      sample = next;
      break;
    }
    case 5: {  // Fractal Stack: three octave-spaced saws, falling amplitude.
      // Each layer runs at its own frequency (f, 2f, 4f) and needs its own
      // independent Nyquist cap -- reusing the base layer's n would let the
      // higher octaves alias even though the base layer is safe.
      s.phase2 = wrap01(s.phase2 + increment * 2.0);
      s.phase3 = wrap01(s.phase3 + increment * 4.0);
      const int n2Cap = static_cast<int>(nyquist / (safeFrequency * 2.0));
      const int n3Cap = static_cast<int>(nyquist / (safeFrequency * 4.0));
      const int n2 = requestedHarmonics < n2Cap ? requestedHarmonics : (n2Cap < 1 ? 1 : n2Cap);
      const int n3 = requestedHarmonics < n3Cap ? requestedHarmonics : (n3Cap < 1 ? 1 : n3Cap);
      const double layer1 = morphedHarmonicWaveform(t, n, morph, false);
      const double layer2 = morphedHarmonicWaveform(s.phase2, n2, morph, false) * 0.5;
      const double layer3 = morphedHarmonicWaveform(s.phase3, n3, morph, false) * 0.25;
      sample = (layer1 + layer2 + layer3) / 1.75;
      break;
    }
    default:  // Sine
      sample = sinApprox(t * kTwoPi);
      break;
  }

  const double dcFreeSample = dcBlock(s, sample);
  s.out = clampD(dcFreeSample, -1.5, 1.5) * level;
}

extern "C" double soemdsp_dsf_oscillator_out(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].out;
}

extern "C" int soemdsp_dsf_oscillator_version() {
  return 2;
}
