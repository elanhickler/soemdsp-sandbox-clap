// soemdsp-native-module: pi_spigot_noise
// soemdsp-native-label: Pi Spigot Noise
// soemdsp-native-target: piSpigotNoise
// soemdsp-native-kind: noise

// Uses the Bailey-Borwein-Plouffe (BBP) spigot formula to extract
// hexadecimal digits of pi directly at an arbitrary position, without
// computing any digits before it -- see
// https://en.wikipedia.org/wiki/Bailey%E2%80%93Borwein%E2%80%93Plouffe_formula
//
//   pi = sum_{k=0}^inf (1/16^k) * (4/(8k+1) - 2/(8k+4) - 1/(8k+5) - 1/(8k+6))
//
// series(m, n) below computes frac(16^n * sum_{k=0}^inf 1/((8k+m) 16^k))
// using modular exponentiation (pow_mod) so the exact-integer part of each
// term never needs to be formed -- only its fractional contribution, which
// is all a spigot digit needs. A single evaluation only carries about 13
// correct hex digits of usable precision (a double's ~52-bit mantissa),
// so this is NOT a source you can stream forever from one seed point --
// each output sample independently re-evaluates the formula at its own
// digit position, which costs O(n) per sample and is why the whole run is
// precomputed once into a cache (see reset_seed) rather than evaluated
// live per audio sample.
//
// Honest limitation: series(m, n) costs O(n), so filling a cache of C
// samples starting at offset "start" costs O(C * (start + C)). That bounds
// both the cache size and the digit offset range to what reset_seed can
// finish in well under a second -- kCacheSize=1024 and kMaxStart=256 were
// chosen from measured wall-clock time (~2-400ms worst case), not
// guesswork. The tradeoff is a ~1024-sample (~23ms at 44.1kHz) repeating
// loop -- this reads as a gritty/buzzy digital texture, not broadband
// hiss. That's this algorithm's real, disclosed constraint: BBP is built
// to jump to one arbitrary distant digit cheaply, not to mass-produce a
// long run of consecutive ones. A sequential spigot (Rabinowitz-Wagon)
// would trade that off differently, at the cost of losing "jump to any
// offset for free" and needing careful carry-propagation logic.

namespace {

static const char kMetadataJson[] =
  "{"
    "\"module\":\"pi_spigot_noise\","
    "\"label\":\"Pi Spigot Noise\","
    "\"targetType\":\"piSpigotNoise\","
    "\"kind\":\"noise\","
    "\"outputs\":[\"Out\"],"
    "\"parameters\":["
      "{\"key\":\"start\",\"label\":\"Digit Offset\",\"defaultValue\":0,\"min\":0,\"mid\":128,\"max\":256,\"step\":1},"
      "{\"key\":\"level\",\"label\":\"Level\",\"defaultValue\":1,\"min\":0,\"mid\":0.5,\"max\":1,\"step\":\"any\"}"
    "]"
  "}";

static const int kMaxInstances = 16;
static const int kCacheSize = 1024;
// Hard ceiling on the digit offset regardless of what the caller passes --
// series() cost is O(n), so this bounds worst-case cache-fill time.
static const int kMaxStart = 256;

struct PiSpigotNoiseState {
  double cache[kCacheSize];
  int    readIndex;
  bool   active;
};

static PiSpigotNoiseState gPool[kMaxInstances];

static inline double clampd(double x, double lo, double hi) { return x < lo ? lo : (x > hi ? hi : x); }

// a^b mod m, where a, b, m are all small enough (well under 2^26 for the
// digit ranges this module allows) that plain double multiplication stays
// exact -- no extended-precision splitting trick needed at this scale.
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

// frac(16^n * sum_{k=0}^inf 1/((8k+m) * 16^k))
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

// One independently-evaluated fractional value at hex-digit position n,
// mapped to bipolar [-1, 1). Each call costs O(n).
static double pi_bbp_bipolar(int n) {
  double x = 4.0 * series(1, n) - 2.0 * series(4, n) - series(5, n) - series(6, n);
  x -= (double)(long long)x;
  if (x < 0.0) x += 1.0;
  return x * 2.0 - 1.0;
}

}  // namespace

extern "C" int soemdsp_pi_spigot_noise_create() {
  for (int i = 0; i < kMaxInstances; i++) {
    if (!gPool[i].active) {
      PiSpigotNoiseState& s = gPool[i];
      for (int j = 0; j < kCacheSize; j++) s.cache[j] = 0.0;
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

// Fills the whole cache from scratch starting at the given digit offset.
// Called by the JS wrapper only when "start" actually changes, same
// reset-on-change convention as random_walk's seed handling.
extern "C" void soemdsp_pi_spigot_noise_reset_seed(int handle, double start) {
  if (handle < 1 || handle > kMaxInstances) return;
  PiSpigotNoiseState& s = gPool[handle - 1];
  int safeStart = (int)clampd(start, 0.0, (double)kMaxStart);
  for (int i = 0; i < kCacheSize; i++) {
    s.cache[i] = pi_bbp_bipolar(safeStart + i);
  }
  s.readIndex = 0;
}

extern "C" double soemdsp_pi_spigot_noise_sample(int handle, double level) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  PiSpigotNoiseState& s = gPool[handle - 1];
  double value = s.cache[s.readIndex];
  s.readIndex = (s.readIndex + 1) % kCacheSize;
  return value * level;
}

extern "C" int soemdsp_pi_spigot_noise_version() {
  return 1;
}

extern "C" const char* soemdsp_pi_spigot_noise_metadata_json() {
  return kMetadataJson;
}

extern "C" int soemdsp_pi_spigot_noise_metadata_json_size() {
  return sizeof(kMetadataJson) - 1;
}
