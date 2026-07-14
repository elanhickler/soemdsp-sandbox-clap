// soemdsp-native-module: alias_sine
// soemdsp-native-label: Alias Sine Generator
// soemdsp-native-target: aliasSine
// soemdsp-native-kind: oscillator
//
// Simple sine generator: 0 to 1 normalized frequency input.
// 0 = DC, 1 = samplerate. Wraps naturally at Nyquist, demonstrating
// aliasing as a pure design choice. frequency = normFreq * sampleRate.

namespace {

static const char kMetadataJson[] =
  "{"
    "\"module\":\"alias_sine\","
    "\"label\":\"Alias Sine Generator\","
    "\"targetType\":\"aliasSine\","
    "\"kind\":\"oscillator\","
    "\"outputs\":[\"Out\"],"
    "\"parameters\":["
      "{\"key\":\"normFreq\",\"label\":\"Norm Freq\",\"defaultValue\":0.1,\"min\":0,\"mid\":0.5,\"max\":1.5,\"step\":\"any\"},"
      "{\"key\":\"level\",\"label\":\"Level\",\"defaultValue\":1,\"min\":0,\"mid\":0.5,\"max\":1,\"step\":\"any\"}"
    "]"
  "}";

static const int kMaxInstances = 32;
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

static double dsp_sin(double x) {
  double wrapped = x - kTwoPi * (double)(long long)(x / kTwoPi);
  double sign = 1.0;
  if (wrapped >= kPi) {
    wrapped -= kPi;
    sign = -1.0;
  }
  return sign * dsp_sin_0_pi(wrapped);
}

static inline double safe(double x) { return x * 0.0 == 0.0 ? x : 0.0; }
static inline double clamp(double x, double lo, double hi) { return x < lo ? lo : (x > hi ? hi : x); }

struct AliasSineState {
  double phase;
  bool active;
};

static AliasSineState gPool[kMaxInstances];

}  // namespace

extern "C" int soemdsp_alias_sine_create() {
  for (int i = 0; i < kMaxInstances; i++) {
    if (!gPool[i].active) {
      gPool[i].phase = 0.0;
      gPool[i].active = true;
      return i + 1;
    }
  }
  return 0;
}

extern "C" void soemdsp_alias_sine_destroy(int handle) {
  if (handle < 1 || handle > kMaxInstances) return;
  gPool[handle - 1].active = false;
}

extern "C" double soemdsp_alias_sine_sample(
  int handle,
  double normFreq,
  double level,
  double sampleRate
) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  AliasSineState& s = gPool[handle - 1];

  // normFreq maps 0->1 to frequency 0->sampleRate
  // phase increment per sample = frequency / sampleRate = normFreq
  s.phase += safe(normFreq);

  // wrap phase at 1.0 to keep it bounded
  while (s.phase >= 1.0) s.phase -= 1.0;
  while (s.phase < 0.0) s.phase += 1.0;

  // convert phase [0,1] to radians [0, 2*pi]
  double out = dsp_sin(s.phase * kTwoPi);

  return clamp(out * safe(level), -1.0, 1.0);
}

extern "C" int soemdsp_alias_sine_version() {
  return 1;
}

extern "C" const char* soemdsp_alias_sine_metadata_json() {
  return kMetadataJson;
}

extern "C" int soemdsp_alias_sine_metadata_json_size() {
  return sizeof(kMetadataJson) - 1;
}
