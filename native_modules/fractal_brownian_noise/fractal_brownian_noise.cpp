// soemdsp-native-module: fractal_brownian_noise
// soemdsp-native-label: Fractal Brownian Noise
// soemdsp-native-target: fractalBrownianNoise
// soemdsp-native-kind: noise

#include <wasm_simd128.h>

namespace {

static const int kMaxInstances = 16;

struct FbmState {
  double time;
  int currentSeed;
  bool active;
  double lastX;
  double lastY;
  double lastZ;
  double lastRawX;
  double lastRawY;
  double lastRawZ;
};

static FbmState gPool[kMaxInstances];

static unsigned int seedHash(int seed, int axis) {
  unsigned int h = (unsigned int)(seed * 2654435761u) ^ (unsigned int)(axis * 0x9e3779b9u);
  h ^= h >> 16;
  h = h * 0x45d9f3bu;
  h ^= h >> 16;
  return h ? h : 1u;
}

static double hashBipolar(int index, unsigned int seed) {
  unsigned int value = (unsigned int)index ^ seed;
  value ^= value >> 16;
  value = value * 2246822507u;
  value ^= value >> 13;
  value = value * 3266489909u;
  value ^= value >> 16;
  return (double)value / 4294967295.0 * 2.0 - 1.0;
}

static double smoothNoise1d(double x, unsigned int seed) {
  int left = (int)x;
  if (x < 0.0 && x != (double)left) left -= 1;
  const double frac = x - (double)left;
  const double smooth = frac * frac * (3.0 - 2.0 * frac);
  const double a = hashBipolar(left, seed);
  const double b = hashBipolar(left + 1, seed);
  return a + (b - a) * smooth;
}

static double fbmAxis(double time, int octaves, double persistence, double scale, unsigned int baseSeed) {
  double total = 0.0;
  double amplitude = 1.0;
  double freq = 1.0;
  double maxValue = 0.0;
  for (int i = 0; i < octaves; i++) {
    total += smoothNoise1d(time * scale * freq, baseSeed + (unsigned int)(i * 1013)) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    freq *= 2.0;
  }
  return maxValue > 0.0 ? total / maxValue : 0.0;
}

// SIMD kernel: runs hashBipolar's integer chain for up to 4 lanes at once.
// Bit-exact vs the scalar version -- every op here (xor, wrapping i32 mul,
// logical shift) is exact 32-bit modular arithmetic, not floating point, so
// there is no reordering-induced deviation the way there is in the Sabrina
// kernels. Only 3 of the 4 lanes are ever real (X/Y/Z); the 4th is unused
// padding, never read back.
static v128_t hashBipolarBitsBatch(v128_t indexXorSeed) {
  v128_t value = indexXorSeed;
  value = wasm_v128_xor(value, wasm_u32x4_shr(value, 16));
  value = wasm_i32x4_mul(value, wasm_i32x4_splat(static_cast<int>(2246822507u)));
  value = wasm_v128_xor(value, wasm_u32x4_shr(value, 13));
  value = wasm_i32x4_mul(value, wasm_i32x4_splat(static_cast<int>(3266489909u)));
  value = wasm_v128_xor(value, wasm_u32x4_shr(value, 16));
  return value;
}

static void unpackBipolar3(v128_t bits, double out[3]) {
  unsigned int lanes[4];
  wasm_v128_store(lanes, bits);
  for (int lane = 0; lane < 3; lane += 1) {
    out[lane] = static_cast<double>(lanes[lane]) / 4294967295.0 * 2.0 - 1.0;
  }
}

// Computes all three FBM axes together instead of calling fbmAxis three
// times. The key structural fact this exploits: time*scale*freq is IDENTICAL
// for X/Y/Z at a given octave (only the seed differs), so `left`/`frac`/
// `smooth` -- the noise-position math -- only needs computing ONCE per
// octave instead of three times. What's left to vary per axis is just the
// hash lookups, which batch into hashBipolarBitsBatch across X/Y/Z lanes.
// This is a real algorithmic reduction (2/3 less position math) plus a
// genuine SIMD win on ALU-bound integer hashing, unlike the earlier
// Sabrina Reverb attempt where the vectorized portion was too thin to
// outrun its own pack/unpack overhead.
static void fbmAxesSimd(
  double time,
  int octaves,
  double persistence,
  double scale,
  unsigned int baseX,
  unsigned int baseY,
  unsigned int baseZ,
  double& outX,
  double& outY,
  double& outZ
) {
  double totalX = 0.0;
  double totalY = 0.0;
  double totalZ = 0.0;
  double amplitude = 1.0;
  double freq = 1.0;
  double maxValue = 0.0;
  for (int i = 0; i < octaves; i += 1) {
    const double x = time * scale * freq;
    int left = static_cast<int>(x);
    if (x < 0.0 && x != static_cast<double>(left)) {
      left -= 1;
    }
    const double frac = x - static_cast<double>(left);
    const double smooth = frac * frac * (3.0 - 2.0 * frac);
    const int leftPlus1 = left + 1;
    const unsigned int seedOffset = static_cast<unsigned int>(i * 1013);
    const v128_t seeds = wasm_i32x4_make(
      static_cast<int>(baseX + seedOffset),
      static_cast<int>(baseY + seedOffset),
      static_cast<int>(baseZ + seedOffset),
      0
    );

    const v128_t aBits = hashBipolarBitsBatch(wasm_v128_xor(wasm_i32x4_splat(left), seeds));
    const v128_t bBits = hashBipolarBitsBatch(wasm_v128_xor(wasm_i32x4_splat(leftPlus1), seeds));
    double aVals[3];
    double bVals[3];
    unpackBipolar3(aBits, aVals);
    unpackBipolar3(bBits, bVals);

    totalX += (aVals[0] + (bVals[0] - aVals[0]) * smooth) * amplitude;
    totalY += (aVals[1] + (bVals[1] - aVals[1]) * smooth) * amplitude;
    totalZ += (aVals[2] + (bVals[2] - aVals[2]) * smooth) * amplitude;

    maxValue += amplitude;
    amplitude *= persistence;
    freq *= 2.0;
  }
  outX = maxValue > 0.0 ? totalX / maxValue : 0.0;
  outY = maxValue > 0.0 ? totalY / maxValue : 0.0;
  outZ = maxValue > 0.0 ? totalZ / maxValue : 0.0;
}

}  // namespace

extern "C" int soemdsp_fbm_create() {
  for (int i = 0; i < kMaxInstances; i++) {
    if (!gPool[i].active) {
      gPool[i] = FbmState{};
      gPool[i].active = true;
      gPool[i].currentSeed = -1;
      return i + 1;
    }
  }
  return 0;
}

extern "C" void soemdsp_fbm_destroy(int handle) {
  if (handle < 1 || handle > kMaxInstances) return;
  gPool[handle - 1].active = false;
}

extern "C" void soemdsp_fbm_reset(int handle) {
  if (handle < 1 || handle > kMaxInstances) return;
  gPool[handle - 1].time = 0.0;
}

extern "C" void soemdsp_fbm_sample(
  int handle,
  int seedInt,
  int octaves,
  double persistence,
  double scale,
  double frequency,
  double level,
  double sampleRate
) {
  if (handle < 1 || handle > kMaxInstances) return;
  FbmState& s = gPool[handle - 1];

  const int safeSeed      = seedInt < 0 ? 0 : (seedInt > 99999 ? 99999 : seedInt);
  const int safeOctaves   = octaves < 1 ? 1 : (octaves > 8 ? 8 : octaves);
  const double safePers   = persistence < 0.0 ? 0.0 : (persistence > 0.99 ? 0.99 : persistence);
  const double safeScale  = scale < 0.000001 ? 0.000001 : scale;
  const double safeFreq   = frequency < 0.0 ? 0.0 : frequency;
  const double safeRate   = sampleRate < 1.0 ? 1.0 : sampleRate;

  if (safeSeed != s.currentSeed) {
    s.currentSeed = safeSeed;
    s.time = 0.0;
  }

  const unsigned int baseX = seedHash(safeSeed, 0);
  const unsigned int baseY = seedHash(safeSeed, 1);
  const unsigned int baseZ = seedHash(safeSeed, 2);

  fbmAxesSimd(s.time, safeOctaves, safePers, safeScale, baseX, baseY, baseZ, s.lastRawX, s.lastRawY, s.lastRawZ);
  s.lastX = s.lastRawX * level;
  s.lastY = s.lastRawY * level;
  s.lastZ = s.lastRawZ * level;

  s.time += safeFreq / safeRate;
}

extern "C" double soemdsp_fbm_x(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].lastX;
}

extern "C" double soemdsp_fbm_y(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].lastY;
}

extern "C" double soemdsp_fbm_z(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].lastZ;
}

extern "C" double soemdsp_fbm_x_raw(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].lastRawX;
}

extern "C" double soemdsp_fbm_y_raw(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].lastRawY;
}

extern "C" double soemdsp_fbm_z_raw(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].lastRawZ;
}

extern "C" int soemdsp_fbm_version() {
  return 1;
}
