// soemdsp-native-module: pi_spigot_noise
// soemdsp-native-label: Pi Spigot Noise
// soemdsp-native-target: piSpigotNoise
// soemdsp-native-kind: noise

// Two ways to get pi digits live here, and why both exist:
//
// 1) soemdsp_pi_spigot_noise_sample/reset_seed (the real playback path):
//    reads a small 1-second (44,100-sample) buffer of real decimal digits
//    of pi (fetched once from https://api.pi.delivery, a free public API,
//    grouped 3 digits per sample -- 1000 quantization levels -- and
//    embedded below as kPiDigitSamples, see pi_digits_data.inc) as a
//    circular wavetable, but the read phase advances by kPlaybackStep
//    (1 + a small irrational fraction) instead of exactly 1.0 per sample.
//    Since that ratio never divides evenly back into the buffer length,
//    each lap starts at a slightly different fractional offset than the
//    last -- the wrap point drifts continuously and, being irrational
//    relative to the buffer, never exactly realigns. A tiny buffer this
//    way avoids sounding like a hard, exact, audibly-periodic loop, at a
//    cost of one linear interpolation per sample instead of a plain array
//    index -- still effectively free. (An earlier version of this module
//    used a 333,333-sample/~7.56s buffer with a plain hard loop instead;
//    this replaced it -- see git history.)
//
// 2) soemdsp_pi_spigot_noise_compute_bipolar (kept reachable, not wired to
//    playback): the actual Bailey-Borwein-Plouffe spigot formula --
//    https://en.wikipedia.org/wiki/Bailey%E2%80%93Borwein%E2%80%93Plouffe_formula
//    -- extracting a hex digit's fractional value at an arbitrary position
//    with no big-integer arithmetic, only modular exponentiation. Verified
//    against known pi hex digits ("2 4 3 F 6 A 8 8 8 5..."). Kept exported
//    (not deleted) because it's a real, distinct, independently-useful
//    capability -- computing digit N without needing digits 0..N-1 -- even
//    though it costs O(n) per digit and was never fast enough to be a
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
      "{\"key\":\"start\",\"label\":\"Digit Offset\",\"defaultValue\":0,\"min\":0,\"mid\":22050,\"max\":44099,\"step\":1},"
      "{\"key\":\"color\",\"label\":\"Color\",\"defaultValue\":0,\"choices\":[\"White\",\"Pink\",\"Brown\",\"Blue\",\"Violet\"],\"displayChoices\":true,\"divideChoicesVisibly\":true,\"min\":0,\"mid\":2,\"max\":4,\"step\":1},"
      "{\"key\":\"level\",\"label\":\"Level\",\"defaultValue\":1,\"min\":0,\"mid\":0.5,\"max\":1,\"step\":\"any\"}"
    "]"
  "}";

static const int kMaxInstances = 16;

// Golden ratio conjugate (1/phi) as the drift fraction -- the canonical
// "most irrational" number (worst rational-approximable), so the wrap
// phase drifts as evenly/slowly-repeating-never as possible rather than
// happening to land near a simple fraction that would re-align sooner.
static const double kPlaybackStep = 1.0 + 0.6180339887498949 / (double)44100;

struct PiSpigotNoiseState {
  double phase;
  // Color-filter memory. pink[]/brown reuse noise_generator.cpp's Paul
  // Kellet pink filter and leaky-integrator brown approach (same taps,
  // same codebase convention) so this module's colors sound consistent
  // with the rest of the sandbox's noise sources. prevWhite1/2 are for
  // the first/second-difference blue/violet filters, which noise_generator
  // doesn't have -- those are new here.
  double pink[7];
  double brown;
  double prevWhite1;
  double prevWhite2;
  bool   active;
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

static void resetColorFilters(PiSpigotNoiseState& s) {
  for (int i = 0; i < 7; i++) s.pink[i] = 0.0;
  s.brown = 0.0;
  s.prevWhite1 = 0.0;
  s.prevWhite2 = 0.0;
}

extern "C" int soemdsp_pi_spigot_noise_create() {
  for (int i = 0; i < kMaxInstances; i++) {
    if (!gPool[i].active) {
      PiSpigotNoiseState& s = gPool[i];
      s.phase = 0.0;
      resetColorFilters(s);
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
  s.phase = clampd(start, 0.0, (double)(kPiDigitSampleCount - 1));
  resetColorFilters(s);
}

// Colors White/Pink/Brown match noise_generator.cpp's filter taps and
// scaling exactly (same Paul Kellet pink filter, same leaky-integrator
// brown), applied to the pi-digit "white" source instead of an LCG one.
// Blue/Violet (first/second difference of white) are new -- this module
// is the only one with them so far.
static double applyColor(PiSpigotNoiseState& s, double white, int color) {
  if (color == 1) {
    s.pink[0] = 0.99886 * s.pink[0] + white * 0.0555179;
    s.pink[1] = 0.99332 * s.pink[1] + white * 0.0750759;
    s.pink[2] = 0.969   * s.pink[2] + white * 0.153852;
    s.pink[3] = 0.8665  * s.pink[3] + white * 0.3104856;
    s.pink[4] = 0.55    * s.pink[4] + white * 0.5329522;
    s.pink[5] = -0.7616 * s.pink[5] - white * 0.016898;
    const double out = (s.pink[0] + s.pink[1] + s.pink[2] +
      s.pink[3] + s.pink[4] + s.pink[5] + s.pink[6] + white * 0.5362) * 0.11;
    s.pink[6] = white * 0.115926;
    return out;
  }
  if (color == 2) {
    s.brown = clampd(s.brown + white * 0.05, -1.0, 1.0);
    return s.brown;
  }
  if (color == 3) {
    const double out = (white - s.prevWhite1) * 0.5;
    s.prevWhite1 = white;
    return out;
  }
  if (color == 4) {
    const double out = (white - 2.0 * s.prevWhite1 + s.prevWhite2) * 0.25;
    s.prevWhite2 = s.prevWhite1;
    s.prevWhite1 = white;
    return out;
  }
  return white;
}

extern "C" double soemdsp_pi_spigot_noise_sample(int handle, double color, double level) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  PiSpigotNoiseState& s = gPool[handle - 1];
  double readPos = s.phase - (double)kPiDigitSampleCount * (double)(long long)(s.phase / (double)kPiDigitSampleCount);
  if (readPos < 0.0) readPos += (double)kPiDigitSampleCount;
  int i0 = (int)readPos;
  int i1 = (i0 + 1) % kPiDigitSampleCount;
  double frac = readPos - (double)i0;
  double v0 = (double)kPiDigitSamples[i0] / 32767.0;
  double v1 = (double)kPiDigitSamples[i1] / 32767.0;
  double white = v0 + (v1 - v0) * frac;
  s.phase += kPlaybackStep;
  int safeColor = clampi((int)(color + 0.5), 0, 4);
  double value = applyColor(s, white, safeColor);
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
  return 3;
}

extern "C" const char* soemdsp_pi_spigot_noise_metadata_json() {
  return kMetadataJson;
}

extern "C" int soemdsp_pi_spigot_noise_metadata_json_size() {
  return sizeof(kMetadataJson) - 1;
}
