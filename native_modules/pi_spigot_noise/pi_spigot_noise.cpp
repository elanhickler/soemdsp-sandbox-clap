// soemdsp-native-module: pi_spigot_noise
// soemdsp-native-label: Pi Spigot Noise
// soemdsp-native-target: piSpigotNoise
// soemdsp-native-kind: noise

// Two ways to get pi digits live here, and why both exist:
//
// 1) soemdsp_pi_spigot_noise_sample/reset_seed (the real playback path):
//    slices directly from 1,000,000 real decimal digits of pi (fetched
//    once from https://api.pi.delivery, a free public API, and embedded
//    below as kPiDigitSamples -- see pi_digits_data.inc) grouped 3 digits
//    per sample (1000 quantization levels) and pre-scaled to int16. No
//    computation at all, just an array index -- this is what makes a long
//    (333,333-sample, ~7.56s at 44.1kHz), non-repeating buffer affordable.
//
// 2) soemdsp_pi_spigot_noise_compute_bipolar (kept reachable, not wired to
//    playback): the actual Bailey-Borwein-Plouffe spigot formula --
//    https://en.wikipedia.org/wiki/Bailey%E2%80%93Borwein%E2%80%93Plouffe_formula
//    -- extracting a hex digit's fractional value at an arbitrary position
//    with no big-integer arithmetic, only modular exponentiation. Verified
//    against known pi hex digits ("2 4 3 F 6 A 8 8 8 5..."). Kept exported
//    (not deleted) because it's a real, distinct, independently-useful
//    capability -- computing digit N without needing digits 0..N-1 -- even
//    though it costs O(n) per digit and was never fast enough to be the
//    default playback path (filling a useful-length cache this way took
//    20+ seconds measured wall-clock; see git history on this file).

#include "pi_digits_data.inc"

namespace {

static const char kMetadataJson[] =
  "{"
    "\"module\":\"pi_spigot_noise\","
    "\"label\":\"Pi Spigot Noise\","
    "\"targetType\":\"piSpigotNoise\","
    "\"kind\":\"noise\","
    "\"outputs\":[\"Out\"],"
    "\"parameters\":["
      "{\"key\":\"start\",\"label\":\"Digit Offset\",\"defaultValue\":0,\"min\":0,\"mid\":166666,\"max\":333332,\"step\":1},"
      "{\"key\":\"level\",\"label\":\"Level\",\"defaultValue\":1,\"min\":0,\"mid\":0.5,\"max\":1,\"step\":\"any\"}"
    "]"
  "}";

static const int kMaxInstances = 16;

struct PiSpigotNoiseState {
  int  start;
  int  readIndex;
  bool active;
};

static PiSpigotNoiseState gPool[kMaxInstances];

static inline double clampd(double x, double lo, double hi) { return x < lo ? lo : (x > hi ? hi : x); }
static inline int clampi(int x, int lo, int hi) { return x < lo ? lo : (x > hi ? hi : x); }

// --- BBP spigot digit-extraction (see file header, capability #2) ---

static double pow_mod(double a, double b, double m) {
  double result = 1.0;
  double base = a - m * (double)(long long)(a / m);
  while (b > 0.5) {
    double half = b * 0.5;
    bool odd = (double)(long long)half * 2.0 != b;
    if (odd) {
      double p = result * base;
      result = p - m * (double)(long long)(p / m);
    }
    b = (double)(long long)half;
    double sq = base * base;
    base = sq - m * (double)(long long)(sq / m);
  }
  return result;
}

static double series(int m, int n) {
  double s = 0.0;
  for (int k = 0; k <= n; k++) {
    double ak = 8.0 * k + m;
    double t = pow_mod(16.0, (double)(n - k), ak);
    s += t / ak;
    s -= (double)(long long)s;
  }
  for (int k = n + 1; k < n + 100; k++) {
    double ak = 8.0 * k + m;
    double t = 1.0;
    for (int e = 0; e < k - n; e++) t *= (1.0 / 16.0);
    if (t < 1e-17) break;
    s += t / ak;
  }
  double frac = s - (double)(long long)s;
  return frac < 0.0 ? frac + 1.0 : frac;
}

}  // namespace

extern "C" int soemdsp_pi_spigot_noise_create() {
  for (int i = 0; i < kMaxInstances; i++) {
    if (!gPool[i].active) {
      PiSpigotNoiseState& s = gPool[i];
      s.start = 0;
      s.readIndex = 0;
      s.active = true;
      return i + 1;
    }
  }
  return 0;
}

extern "C" void soemdsp_pi_spigot_noise_destroy(int handle) {
  if (handle < 1 || handle > kMaxInstances) return;
  gPool[handle - 1].active = false;
}

extern "C" void soemdsp_pi_spigot_noise_reset_seed(int handle, double start) {
  if (handle < 1 || handle > kMaxInstances) return;
  PiSpigotNoiseState& s = gPool[handle - 1];
  s.start = clampi((int)start, 0, kPiDigitSampleCount - 1);
  s.readIndex = 0;
}

extern "C" double soemdsp_pi_spigot_noise_sample(int handle, double level) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  PiSpigotNoiseState& s = gPool[handle - 1];
  int index = (s.start + s.readIndex) % kPiDigitSampleCount;
  double value = (double)kPiDigitSamples[index] / 32767.0;
  s.readIndex = (s.readIndex + 1) % kPiDigitSampleCount;
  return value * level;
}

// Real-time BBP spigot evaluation at hex-digit position n, mapped to
// bipolar [-1, 1) -- see file header, capability #2. Costs O(n); not used
// by soemdsp_pi_spigot_noise_sample above.
extern "C" double soemdsp_pi_spigot_noise_compute_bipolar(int n) {
  double x = 4.0 * series(1, n) - 2.0 * series(4, n) - series(5, n) - series(6, n);
  x -= (double)(long long)x;
  if (x < 0.0) x += 1.0;
  return x * 2.0 - 1.0;
}

extern "C" int soemdsp_pi_spigot_noise_sample_count() {
  return kPiDigitSampleCount;
}

extern "C" int soemdsp_pi_spigot_noise_version() {
  return 2;
}

extern "C" const char* soemdsp_pi_spigot_noise_metadata_json() {
  return kMetadataJson;
}

extern "C" int soemdsp_pi_spigot_noise_metadata_json_size() {
  return sizeof(kMetadataJson) - 1;
}
