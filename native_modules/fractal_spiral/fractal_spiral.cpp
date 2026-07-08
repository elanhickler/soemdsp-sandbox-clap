// soemdsp-native-module: fractal_spiral
// soemdsp-native-label: Fractal Spiral
// soemdsp-native-target: fractalSpiral
// soemdsp-native-kind: jerobeam
//
// Weierstrass-style self-affine fractal spiral: N rotating copies of the
// same unit vector, each spun `lacunarity`x faster and scaled by `gain`,
// summed and normalized onto a logarithmic-spiral envelope. See
// public/node-graph-fractal-spiral.js for the full derivation this is a
// direct port of.

namespace {

static const char kMetadataJson[] =
  "{"
    "\"module\":\"fractal_spiral\","
    "\"label\":\"Fractal Spiral\","
    "\"targetType\":\"fractalSpiral\","
    "\"kind\":\"jerobeam\","
    "\"outputs\":[\"X\",\"Y\",\"Z\"],"
    "\"parameters\":["
      "{\"key\":\"frequency\",\"label\":\"Frequency\",\"kind\":\"frequency\",\"defaultValue\":1,\"min\":0,\"mid\":5,\"max\":100,\"step\":\"any\",\"unit\":\"Hz\"},"
      "{\"key\":\"octaves\",\"label\":\"Octaves\",\"defaultValue\":5,\"min\":1,\"mid\":8,\"max\":16,\"step\":1},"
      "{\"key\":\"gain\",\"label\":\"Gain\",\"defaultValue\":0.5,\"min\":0.001,\"mid\":0.5,\"max\":0.98,\"step\":\"any\"},"
      "{\"key\":\"lacunarity\",\"label\":\"Lacunarity\",\"defaultValue\":2,\"min\":1.0001,\"mid\":2,\"max\":8,\"step\":\"any\"},"
      "{\"key\":\"twist\",\"label\":\"Twist\",\"defaultValue\":0.381966,\"min\":0,\"mid\":0.5,\"max\":1,\"step\":\"any\"},"
      "{\"key\":\"growth\",\"label\":\"Growth\",\"defaultValue\":1.5,\"min\":-10,\"mid\":1.5,\"max\":10,\"step\":\"any\"},"
      "{\"key\":\"size\",\"label\":\"Size\",\"defaultValue\":0.5,\"min\":0,\"mid\":0.5,\"max\":1,\"step\":\"any\"},"
      "{\"key\":\"spin\",\"label\":\"Spin\",\"kind\":\"frequency\",\"defaultValue\":0.05,\"min\":0,\"mid\":1,\"max\":20,\"step\":\"any\",\"unit\":\"Hz\"},"
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

static double dsp_exp(double x) {
  if (x < -700.0) return 0.0;
  if (x > 700.0) return 1e300;
  const double LOG2E = 1.4426950408889634;
  const double LN2 = 0.6931471805599453;
  double t = x * LOG2E;
  long long n = (long long)t;
  if (t < 0.0 && (double)n != t) n -= 1;
  double f = t - (double)n;
  double y = f * LN2;
  double ey = 1.0 + y*(1.0 + y*(0.5 + y*(1.0/6.0 + y*(1.0/24.0 + y*(1.0/120.0 + y*(1.0/720.0 + y/5040.0))))));
  union { double d; unsigned long long u; } bits;
  bits.u = (unsigned long long)(n + 1023) << 52;
  return ey * bits.d;
}

static inline double safe(double x) { return x * 0.0 == 0.0 ? x : 0.0; }
static inline double clamp(double x, double lo, double hi) { return x < lo ? lo : (x > hi ? hi : x); }
static inline double maxd(double a, double b) { return a > b ? a : b; }
static inline double mind(double a, double b) { return a < b ? a : b; }

static double wrap01(double value) {
  return value - dsp_floor(value);
}

struct FractalSpiralState {
  double phase;
  double spinPhase;
  double outX, outY, outZ;
  bool   active;
};

static FractalSpiralState gPool[kMaxInstances];

}  // namespace

extern "C" int soemdsp_fractal_spiral_create() {
  for (int i = 0; i < kMaxInstances; i++) {
    if (!gPool[i].active) {
      FractalSpiralState& s = gPool[i];
      s.phase = 0.0;
      s.spinPhase = 0.0;
      s.outX = 0.0; s.outY = 0.0; s.outZ = 0.0;
      s.active = true;
      return i + 1;
    }
  }
  return 0;
}

extern "C" void soemdsp_fractal_spiral_destroy(int handle) {
  if (handle < 1 || handle > kMaxInstances) return;
  gPool[handle - 1].active = false;
}

extern "C" void soemdsp_fractal_spiral_sample(
  int    handle,
  double frequency,
  double spin,
  double size,
  double growth,
  double gain,
  double lacunarity,
  double octaves,
  double twist,
  double sampleRate
) {
  if (handle < 1 || handle > kMaxInstances) return;
  FractalSpiralState& s = gPool[handle - 1];

  const double rate = maxd(1.0, sampleRate);
  const double safeSize = maxd(0.0, safe(size));
  const double safeGain = clamp(safe(gain), 0.001, 0.98);
  const double safeLacunarity = maxd(1.0001, safe(lacunarity));
  const int octaveCount = (int)clamp((double)(long long)(safe(octaves) + 0.5), 1.0, 16.0);
  const double safeTwist = safe(twist);

  const double mainPhase = wrap01(s.phase);
  s.phase = wrap01(s.phase + frequency / rate);
  const double spinPhaseValue = wrap01(s.spinPhase);
  s.spinPhase = wrap01(s.spinPhase + spin / rate);

  const double theta = mainPhase * kTwoPi;
  const double envelope = dsp_exp(growth * (mainPhase - 0.5));

  double sumX = 0.0;
  double sumY = 0.0;
  double ampSum = 0.0;
  double amp = 1.0;
  double angleMultiplier = 1.0;
  for (int k = 0; k < octaveCount; k++) {
    const double angle = angleMultiplier * theta + (double)k * safeTwist * kTwoPi;
    sumX += amp * dsp_cos(angle);
    sumY += amp * dsp_sin(angle);
    ampSum += amp;
    amp *= safeGain;
    angleMultiplier *= safeLacunarity;
  }
  const double normX = ampSum > 0.0 ? sumX / ampSum : 0.0;
  const double normY = ampSum > 0.0 ? sumY / ampSum : 0.0;

  const double radius = envelope * safeSize;
  const double rawX = normX * radius;
  const double rawY = normY * radius;

  const double spinAngle = spinPhaseValue * kTwoPi;
  const double cosSpin = dsp_cos(spinAngle);
  const double sinSpin = dsp_sin(spinAngle);

  s.outX = rawX * cosSpin - rawY * sinSpin;
  s.outY = rawX * sinSpin + rawY * cosSpin;
  s.outZ = envelope - 1.0;
}

extern "C" double soemdsp_fractal_spiral_x(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].outX;
}

extern "C" double soemdsp_fractal_spiral_y(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].outY;
}

extern "C" double soemdsp_fractal_spiral_z(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].outZ;
}

extern "C" int soemdsp_fractal_spiral_version() {
  return 1;
}

extern "C" const char* soemdsp_fractal_spiral_metadata_json() {
  return kMetadataJson;
}

extern "C" int soemdsp_fractal_spiral_metadata_json_size() {
  return sizeof(kMetadataJson) - 1;
}
