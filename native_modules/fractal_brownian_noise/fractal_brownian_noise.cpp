// soemdsp-native-module: fractal_brownian_noise
// soemdsp-native-label: Fractal Brownian Noise
// soemdsp-native-target: fractalBrownianNoise
// soemdsp-native-kind: noise

namespace {

static const int kMaxInstances = 16;

struct FbmState {
  double time;
  int currentSeed;
  bool active;
  double lastX;
  double lastY;
  double lastZ;
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

  s.lastX = fbmAxis(s.time, safeOctaves, safePers, safeScale, baseX) * level;
  s.lastY = fbmAxis(s.time, safeOctaves, safePers, safeScale, baseY) * level;
  s.lastZ = fbmAxis(s.time, safeOctaves, safePers, safeScale, baseZ) * level;

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

extern "C" int soemdsp_fbm_version() {
  return 1;
}
