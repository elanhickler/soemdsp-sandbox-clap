// soemdsp-native-module: basic_oscillator
// soemdsp-native-label: Basic Oscillator
// soemdsp-native-target: osc
// soemdsp-native-kind: oscillator
//
// Shared DSP for both "osc" and "fbPolyBlepOsc" on the JS side --
// forwardBackwardPolyBlepOscillatorSample() was a pure pass-through to
// oscillatorSample() with zero behavioral difference, so one native
// module covers both, exactly like passive_filter's single WASM serving
// multiple modes via a parameter. This is the naive/basic PolyBLEP
// correction (saw/square/triangle/sine/noise); the dedicated "polyBlep"
// module (native_modules/polyblep) is a separate, more advanced
// algorithm and unaffected by this.
//
// Each of the six port outputs (main + Saw/Ramp/Square/Tri/Sine) is
// driven from an *independent* phase/state on the JS side (distinct
// "{nodeId}:saw" etc. keys) -- the worklet creates one native handle per
// virtual instance to match, rather than this module tracking six ports
// per handle itself.

namespace {

static const char kMetadataJson[] =
  "{"
    "\"module\":\"basic_oscillator\","
    "\"label\":\"Basic Oscillator\","
    "\"targetType\":\"osc\","
    "\"kind\":\"oscillator\","
    "\"outputs\":[\"Out\",\"Saw\",\"Ramp\",\"Square\",\"Tri\",\"Sine\"],"
    "\"parameters\":["
      "{\"key\":\"frequency\",\"label\":\"Frequency\",\"kind\":\"frequency\",\"defaultValue\":220,\"min\":0,\"mid\":220,\"max\":20000,\"step\":\"any\",\"unit\":\"Hz\"},"
      "{\"key\":\"waveform\",\"label\":\"Waveform\",\"defaultValue\":0,\"min\":0,\"mid\":2,\"max\":5,\"step\":1},"
      "{\"key\":\"phase\",\"label\":\"Phase\",\"kind\":\"phase\",\"defaultValue\":0,\"min\":0,\"mid\":0.5,\"max\":1,\"step\":0.01,\"unit\":\"cycle\"},"
      "{\"key\":\"level\",\"label\":\"Level\",\"defaultValue\":1,\"min\":0,\"mid\":0.5,\"max\":1,\"step\":\"any\"}"
    "]"
  "}";

static const int kMaxInstances = 256;  // 6 virtual per-port instances per node
static const double kPi    = 3.141592653589793238;
static const double kTwoPi = 6.283185307179586476;
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

static inline double safe(double x) { return x * 0.0 == 0.0 ? x : 0.0; }
static inline double clamp(double x, double lo, double hi) { return x < lo ? lo : (x > hi ? hi : x); }
static inline double absd(double a) { return a < 0.0 ? -a : a; }

static double wrap01(double value) {
  return value - dsp_floor(value);
}

static double poly_blep(double phaseCycle, double phaseIncrement) {
  const double dt = clamp(absd(phaseIncrement), 1e-6, 0.5);
  if (phaseCycle < dt) {
    const double t = phaseCycle / dt;
    return t + t - t * t - 1.0;
  }
  if (phaseCycle > 1.0 - dt) {
    const double t = (phaseCycle - 1.0) / dt;
    return t * t + t + t + 1.0;
  }
  return 0.0;
}

static double poly_blep_square(double phaseCycle, double phaseIncrement) {
  double value = phaseCycle < 0.5 ? 1.0 : -1.0;
  value += poly_blep(phaseCycle, phaseIncrement);
  value -= poly_blep(wrap01(phaseCycle + 0.5), phaseIncrement);
  return value;
}

struct OscState {
  double triangle;
  double stoppedSample;
  double lastPhaseIncrement;
  unsigned int noiseSeed;
  bool   hasStoppedSample;
  bool   hasNoiseSeed;
  bool   active;
};

static OscState gPool[kMaxInstances];

static double next_noise_sample(OscState& s) {
  s.noiseSeed = (unsigned int)(1664525u * (s.hasNoiseSeed ? s.noiseSeed : 0x12345678u) + 1013904223u);
  s.hasNoiseSeed = true;
  return ((double)s.noiseSeed / 4294967295.0) * 2.0 - 1.0;
}

static double current_noise_sample(OscState& s) {
  if (!s.hasNoiseSeed) return next_noise_sample(s);
  return ((double)s.noiseSeed / 4294967295.0) * 2.0 - 1.0;
}

}  // namespace

extern "C" int soemdsp_basic_oscillator_create() {
  for (int i = 0; i < kMaxInstances; i++) {
    if (!gPool[i].active) {
      OscState& s = gPool[i];
      s.triangle = 0.0;
      s.stoppedSample = 0.0;
      s.lastPhaseIncrement = 0.0;
      s.noiseSeed = 0;
      s.hasStoppedSample = false;
      s.hasNoiseSeed = false;
      s.active = true;
      return i + 1;
    }
  }
  return 0;
}

extern "C" void soemdsp_basic_oscillator_destroy(int handle) {
  if (handle < 1 || handle > kMaxInstances) return;
  gPool[handle - 1].active = false;
}

extern "C" double soemdsp_basic_oscillator_sample(
  int    handle,
  double phase,
  double phaseIncrement,
  double waveform
) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  OscState& s = gPool[handle - 1];

  const double phaseDelta = safe(phaseIncrement);
  const bool phaseStopped = absd(phaseDelta) <= 1e-12;
  if (phaseStopped && s.hasStoppedSample) {
    return s.stoppedSample;
  }
  const double renderPhaseIncrement = phaseStopped ? s.lastPhaseIncrement : phaseDelta;
  const double phaseCycle = wrap01(safe(phase) / kTwoPi);

  double sample = 0.0;
  const int wf = (int)dsp_floor(safe(waveform) + 0.5);
  switch (wf) {
    case 1:
      sample = -1.0 + phaseCycle * 2.0 - poly_blep(phaseCycle, renderPhaseIncrement);
      break;
    case 2:
      sample = poly_blep_square(phaseCycle, renderPhaseIncrement);
      break;
    case 3: {
      if (phaseStopped) {
        sample = s.triangle;
        break;
      }
      const double nextTriangle = (s.triangle + poly_blep_square(phaseCycle, renderPhaseIncrement) * phaseDelta * 4.0) * 0.995;
      s.triangle = clamp(nextTriangle, -1.0, 1.0);
      sample = s.triangle;
      break;
    }
    case 4:
      sample = dsp_sin(safe(phase));
      break;
    case 5:
      sample = phaseStopped ? current_noise_sample(s) : next_noise_sample(s);
      break;
    case 0:
    default:
      sample = 1.0 - phaseCycle * 2.0 + poly_blep(phaseCycle, renderPhaseIncrement);
      break;
  }

  if (phaseStopped) {
    s.stoppedSample = sample;
    s.hasStoppedSample = true;
  } else {
    s.hasStoppedSample = false;
    s.lastPhaseIncrement = phaseDelta;
  }
  return sample;
}

extern "C" int soemdsp_basic_oscillator_version() {
  return 1;
}

extern "C" const char* soemdsp_basic_oscillator_metadata_json() {
  return kMetadataJson;
}

extern "C" int soemdsp_basic_oscillator_metadata_json_size() {
  return sizeof(kMetadataJson) - 1;
}
