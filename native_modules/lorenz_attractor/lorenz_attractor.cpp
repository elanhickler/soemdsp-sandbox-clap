// soemdsp-native-module: lorenz_attractor
// soemdsp-native-label: Lorenz Attractor
// soemdsp-native-target: lorenzAttractor
// soemdsp-native-kind: chaos

namespace {

static const char kMetadataJson[] =
  "{"
    "\"module\":\"lorenz_attractor\","
    "\"label\":\"Lorenz Attractor\","
    "\"targetType\":\"lorenzAttractor\","
    "\"kind\":\"chaos\","
    "\"inputs\":[\"Reset\"],"
    "\"outputs\":[\"X\",\"Y\",\"Z\"],"
    "\"parameters\":["
      "{\"key\":\"speed\",\"label\":\"Speed\",\"defaultValue\":1,\"min\":0,\"mid\":1,\"max\":4,\"step\":\"any\"},"
      "{\"key\":\"sigma\",\"label\":\"Sigma\",\"defaultValue\":10,\"min\":0,\"mid\":10,\"max\":30,\"step\":\"any\"},"
      "{\"key\":\"rho\",\"label\":\"Rho\",\"defaultValue\":28,\"min\":-30,\"mid\":28,\"max\":60,\"step\":\"any\"},"
      "{\"key\":\"beta\",\"label\":\"Beta\",\"defaultValue\":2.6666666666666665,\"min\":0,\"mid\":2.6666666666666665,\"max\":10,\"step\":\"any\"},"
      "{\"key\":\"rotate\",\"label\":\"Rotate\",\"defaultValue\":0,\"min\":0,\"mid\":0.5,\"max\":1,\"step\":\"any\"},"
      "{\"key\":\"scale\",\"label\":\"Scale\",\"defaultValue\":1,\"min\":0,\"mid\":1,\"max\":4,\"step\":\"any\"},"
      "{\"key\":\"zDepth\",\"label\":\"Z Depth\",\"defaultValue\":0.4,\"min\":0,\"mid\":0.5,\"max\":1,\"step\":\"any\"},"
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

static inline double dsp_ceil(double x) {
  double xi = (double)(long long)x;
  return (x > xi) ? xi + 1.0 : xi;
}

static inline double safe(double x) { return x * 0.0 == 0.0 ? x : 0.0; }
static inline double clamp(double x, double lo, double hi) { return x < lo ? lo : (x > hi ? hi : x); }
static inline double maxd(double a, double b) { return a > b ? a : b; }

struct LorenzState {
  double x, y, z;
  double outX, outY, outZ;
  bool   resetWasHigh;
  bool   active;
};

static LorenzState gPool[kMaxInstances];

static void reset_lorenz(LorenzState& s) {
  s.x = 0.1;
  s.y = 0.0;
  s.z = 0.0;
}

// IEEE-754 exponent field is all-ones (0x7FF) for both NaN and +/-Infinity.
static bool is_finite(double x) {
  union { double d; unsigned long long u; } bits;
  bits.d = x;
  return ((bits.u >> 52) & 0x7FF) != 0x7FF;
}

}  // namespace

extern "C" int soemdsp_lorenz_attractor_create() {
  for (int i = 0; i < kMaxInstances; i++) {
    if (!gPool[i].active) {
      LorenzState& s = gPool[i];
      reset_lorenz(s);
      s.outX = 0.0; s.outY = 0.0; s.outZ = 0.0;
      s.resetWasHigh = false;
      s.active = true;
      return i + 1;
    }
  }
  return 0;
}

extern "C" void soemdsp_lorenz_attractor_destroy(int handle) {
  if (handle < 1 || handle > kMaxInstances) return;
  gPool[handle - 1].active = false;
}

extern "C" void soemdsp_lorenz_attractor_sample(
  int    handle,
  double reset,
  double speed,
  double sigma,
  double rho,
  double beta,
  double rotate,
  double scale,
  double zDepth,
  double sampleRate
) {
  if (handle < 1 || handle > kMaxInstances) return;
  LorenzState& s = gPool[handle - 1];

  const bool resetHigh = safe(reset) > 0.5;
  if (resetHigh && !s.resetWasHigh) {
    reset_lorenz(s);
  }
  s.resetWasHigh = resetHigh;

  const double rate = sampleRate < 1.0 ? 1.0 : sampleRate;
  const double safeSpeed = maxd(0.0, safe(speed));
  const double safeSigma = maxd(0.0, safe(sigma));
  const double safeRho = safe(rho);
  const double safeBeta = maxd(0.0, safe(beta));
  const double dt = (0.75 * safeSpeed) / rate;
  const int steps = (int)maxd(1.0, dsp_ceil(dt / 0.0007));
  const double stepDt = steps > 0 ? dt / (double)steps : 0.0;

  for (int i = 0; i < steps; i++) {
    const double dx = safeSigma * (s.y - s.x);
    const double dy = s.x * (safeRho - s.z) - s.y;
    const double dz = s.x * s.y - safeBeta * s.z;
    s.x += dx * stepDt;
    s.y += dy * stepDt;
    s.z += dz * stepDt;
    if (!is_finite(s.x) || !is_finite(s.y) || !is_finite(s.z)) {
      reset_lorenz(s);
      break;
    }
  }

  const double rotateRad = safe(rotate) * kTwoPi;
  const double cosRotate = dsp_cos(rotateRad);
  const double sinRotate = dsp_sin(rotateRad);
  const double normalizedX = s.x / 24.0;
  const double normalizedY = s.y / 32.0;
  const double normalizedZ = (s.z - 25.0) / 30.0;
  const double depth = clamp(safe(zDepth), 0.0, 1.0);
  const double depthScale = 1.0 + normalizedZ * depth * 0.35;
  const double finalScale = maxd(0.0, safe(scale)) * depthScale;
  const double outX = (normalizedX * cosRotate - normalizedY * sinRotate) * finalScale;
  const double outY = (normalizedX * sinRotate + normalizedY * cosRotate) * finalScale;
  const double outZ = normalizedZ * finalScale;

  s.outX = clamp(outX, -1.0, 1.0);
  s.outY = clamp(outY, -1.0, 1.0);
  s.outZ = clamp(outZ, -1.0, 1.0);
}

extern "C" double soemdsp_lorenz_attractor_x(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].outX;
}

extern "C" double soemdsp_lorenz_attractor_y(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].outY;
}

extern "C" double soemdsp_lorenz_attractor_z(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].outZ;
}

extern "C" int soemdsp_lorenz_attractor_version() {
  return 1;
}

extern "C" const char* soemdsp_lorenz_attractor_metadata_json() {
  return kMetadataJson;
}

extern "C" int soemdsp_lorenz_attractor_metadata_json_size() {
  return sizeof(kMetadataJson) - 1;
}
