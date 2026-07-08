// soemdsp-native-module: sine_wavetable
// soemdsp-native-label: SinCos
// soemdsp-native-target: sineWavetable
// soemdsp-native-kind: oscillator
//
// The JS original looked up a linearly-interpolated 2048-point precomputed
// sine table. A freestanding wasm32 module can't run a static-initializer
// table fill reliably (no --no-entry-friendly global ctor pass here), so
// this computes sin/cos directly via the same range-reduced polynomial
// already used in chaotic_phase_locking_filter.cpp and lorenz_attractor.cpp
// -- strictly more accurate than the table's linear-interpolation
// quantization, not less.

namespace {

static const char kMetadataJson[] =
  "{"
    "\"module\":\"sine_wavetable\","
    "\"label\":\"SinCos\","
    "\"targetType\":\"sineWavetable\","
    "\"kind\":\"oscillator\","
    "\"inputs\":[\"0.1V/Oct\",\"Freq\",\"Amplitude\"],"
    "\"outputs\":[\"sin\",\"cos\"],"
    "\"parameters\":["
      "{\"key\":\"phase\",\"label\":\"Phase\",\"kind\":\"phase\",\"defaultValue\":0,\"min\":0,\"mid\":0.5,\"max\":1,\"step\":0.01,\"unit\":\"cycle\"},"
      "{\"key\":\"freq\",\"label\":\"Freq\",\"kind\":\"frequency\",\"defaultValue\":100,\"min\":0,\"mid\":220,\"max\":20000,\"step\":\"any\",\"unit\":\"Hz\"},"
      "{\"key\":\"amp\",\"label\":\"Amplitude\",\"defaultValue\":1,\"min\":0,\"mid\":0.5,\"max\":1,\"step\":\"any\"}"
    "]"
  "}";

static const int kMaxInstances = 64;
static const double kPi     = 3.141592653589793238;
static const double kTwoPi  = 6.283185307179586476;
static const double kHalfPi = 1.5707963267948966192;

static double poly_sin_0_halfpi(double x) {
  const double x2 = x * x;
  return x * (1.0 + x2 * (-1.6666666666666667e-1 + x2 * (8.3333333333333329e-3 + x2 * (-1.9841269841269841e-4 + x2 * (2.7557319223985888e-6 + x2 * (-2.5052108385441720e-8 + x2 * 1.6059043836821614e-10))))));
}

static double dsp_sin_0_pi(double x) {
  if (x > kHalfPi) x = kPi - x;
  return poly_sin_0_halfpi(x);
}

static inline double dsp_floor(double x) {
  double xi = (double)(long long)x;
  return (x < xi) ? xi - 1.0 : xi;
}

static double dsp_sin(double x) {
  double wrapped = x - kTwoPi * dsp_floor(x / kTwoPi);
  double sign = 1.0;
  if (wrapped >= kPi) {
    wrapped -= kPi;
    sign = -1.0;
  }
  return sign * dsp_sin_0_pi(wrapped);
}

static double dsp_cos(double x) {
  return dsp_sin(x + kHalfPi);
}

static inline double safe(double x) { return x * 0.0 == 0.0 ? x : 0.0; }
static inline double clamp(double x, double lo, double hi) { return x < lo ? lo : (x > hi ? hi : x); }
static inline double maxd(double a, double b) { return a > b ? a : b; }
static inline double mind(double a, double b) { return a < b ? a : b; }

static double smoothstep01(double value) {
  double t = clamp(value, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

static double nyquist_fade_amplitude(double frequency, double sampleRate) {
  const double rate = maxd(1.0, sampleRate);
  const double nyquist = rate * 0.5;
  const double freq = maxd(0.0, frequency);
  const double fadeStart = mind(20000.0, nyquist * 0.9);
  if (freq <= fadeStart) return 1.0;
  if (freq >= nyquist) return 0.0;
  const double progress = (freq - fadeStart) / maxd(1.0, nyquist - fadeStart);
  return 1.0 - smoothstep01(progress);
}

struct SineWavetableState {
  double phase;
  double outSin;
  double outCos;
  bool   active;
};

static SineWavetableState gPool[kMaxInstances];

}  // namespace

extern "C" int soemdsp_sine_wavetable_create() {
  for (int i = 0; i < kMaxInstances; i++) {
    if (!gPool[i].active) {
      SineWavetableState& s = gPool[i];
      s.phase = 0.0;
      s.outSin = 0.0;
      s.outCos = 0.0;
      s.active = true;
      return i + 1;
    }
  }
  return 0;
}

extern "C" void soemdsp_sine_wavetable_destroy(int handle) {
  if (handle < 1 || handle > kMaxInstances) return;
  gPool[handle - 1].active = false;
}

extern "C" void soemdsp_sine_wavetable_sample(
  int    handle,
  double phaseOffsetRadians,
  double frequency,
  double amplitude,
  double sampleRate
) {
  if (handle < 1 || handle > kMaxInstances) return;
  SineWavetableState& s = gPool[handle - 1];

  const double rate = sampleRate < 1.0 ? 1.0 : sampleRate;
  const double safeFrequency = safe(frequency);
  const double level = maxd(0.0, safe(amplitude)) * nyquist_fade_amplitude(safeFrequency, rate);
  const double samplePhase = s.phase + safe(phaseOffsetRadians);

  s.outSin = dsp_sin(samplePhase) * level;
  s.outCos = dsp_cos(samplePhase) * level;

  const double phaseIncrement = safeFrequency / rate;
  double nextPhase = s.phase + kTwoPi * phaseIncrement;
  nextPhase = nextPhase - kTwoPi * dsp_floor(nextPhase / kTwoPi);
  if (nextPhase < 0.0) nextPhase += kTwoPi;
  s.phase = nextPhase;
}

extern "C" double soemdsp_sine_wavetable_sin(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].outSin;
}

extern "C" double soemdsp_sine_wavetable_cos(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].outCos;
}

extern "C" int soemdsp_sine_wavetable_version() {
  return 1;
}

extern "C" const char* soemdsp_sine_wavetable_metadata_json() {
  return kMetadataJson;
}

extern "C" int soemdsp_sine_wavetable_metadata_json_size() {
  return sizeof(kMetadataJson) - 1;
}
