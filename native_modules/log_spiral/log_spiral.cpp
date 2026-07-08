// soemdsp-native-module: log_spiral
// soemdsp-native-label: Logarithmic Spiral
// soemdsp-native-target: logSpiral
// soemdsp-native-kind: jerobeam
//
// The pure r = a * e^(b*theta) equiangular spiral, swept as a periodic,
// bounded audio-rate X/Y/Z oscillator: `turns` revolutions per cycle while
// the radius envelope grows exponentially with phase and resets each cycle.
// See public/node-graph-log-spiral.js for the derivation this is a direct
// port of.

namespace {

static const char kMetadataJson[] =
  "{"
    "\"module\":\"log_spiral\","
    "\"label\":\"Logarithmic Spiral\","
    "\"targetType\":\"logSpiral\","
    "\"kind\":\"jerobeam\","
    "\"outputs\":[\"X\",\"Y\",\"Z\"],"
    "\"parameters\":["
      "{\"key\":\"frequency\",\"label\":\"Frequency\",\"kind\":\"frequency\",\"defaultValue\":1,\"min\":0,\"mid\":5,\"max\":100,\"step\":\"any\",\"unit\":\"Hz\"},"
      "{\"key\":\"turns\",\"label\":\"Turns\",\"defaultValue\":4,\"min\":0.1,\"mid\":4,\"max\":16,\"step\":\"any\"},"
      "{\"key\":\"growth\",\"label\":\"Growth\",\"defaultValue\":3,\"min\":-10,\"mid\":3,\"max\":10,\"step\":\"any\"},"
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

// Range-reduced exp -- see pluck_envelope.cpp/exp_adsr.cpp for the derivation.
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

static inline double maxd(double a, double b) { return a > b ? a : b; }

static double wrap01(double value) {
  return value - dsp_floor(value);
}

struct LogSpiralState {
  double phase;
  double spinPhase;
  double outX, outY, outZ;
  bool   active;
};

static LogSpiralState gPool[kMaxInstances];

}  // namespace

extern "C" int soemdsp_log_spiral_create() {
  for (int i = 0; i < kMaxInstances; i++) {
    if (!gPool[i].active) {
      LogSpiralState& s = gPool[i];
      s.phase = 0.0;
      s.spinPhase = 0.0;
      s.outX = 0.0; s.outY = 0.0; s.outZ = 0.0;
      s.active = true;
      return i + 1;
    }
  }
  return 0;
}

extern "C" void soemdsp_log_spiral_destroy(int handle) {
  if (handle < 1 || handle > kMaxInstances) return;
  gPool[handle - 1].active = false;
}

extern "C" void soemdsp_log_spiral_sample(
  int    handle,
  double frequency,
  double spin,
  double size,
  double growth,
  double turns,
  double sampleRate
) {
  if (handle < 1 || handle > kMaxInstances) return;
  LogSpiralState& s = gPool[handle - 1];

  const double rate = maxd(1.0, sampleRate);
  const double safeSize = maxd(0.0, size);
  const double safeTurns = maxd(0.1, turns);

  const double mainPhase = wrap01(s.phase);
  s.phase = wrap01(s.phase + frequency / rate);
  const double spinPhaseValue = wrap01(s.spinPhase);
  s.spinPhase = wrap01(s.spinPhase + spin / rate);

  const double theta = safeTurns * kTwoPi * mainPhase;
  const double envelope = dsp_exp(growth * (mainPhase - 0.5));
  const double radius = safeSize * envelope;

  const double rawX = radius * dsp_cos(theta);
  const double rawY = radius * dsp_sin(theta);

  const double spinAngle = spinPhaseValue * kTwoPi;
  const double cosSpin = dsp_cos(spinAngle);
  const double sinSpin = dsp_sin(spinAngle);

  s.outX = rawX * cosSpin - rawY * sinSpin;
  s.outY = rawX * sinSpin + rawY * cosSpin;
  s.outZ = envelope - 1.0;
}

extern "C" double soemdsp_log_spiral_x(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].outX;
}

extern "C" double soemdsp_log_spiral_y(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].outY;
}

extern "C" double soemdsp_log_spiral_z(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].outZ;
}

extern "C" int soemdsp_log_spiral_version() {
  return 1;
}

extern "C" const char* soemdsp_log_spiral_metadata_json() {
  return kMetadataJson;
}

extern "C" int soemdsp_log_spiral_metadata_json_size() {
  return sizeof(kMetadataJson) - 1;
}
