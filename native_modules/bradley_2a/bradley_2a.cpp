// soemdsp-native-module: bradley_2a
// soemdsp-native-label: Bradley 2A Jitter/Hit Synth
// soemdsp-native-target: bradley2a
// soemdsp-native-kind: oscillator
//
// Naive digitization of the Bradley Telcom Jitter and Hit Synthesizer
// (with Frequency Translation and Harmonic Distortion Module). A test
// tone that gets impaired: phase jitter, amplitude jitter, frequency
// translation, harmonic distortion, single-frequency interference, and
// periodic "hits" (gain hit / dropout / phase hit / impulse). Ideal
// blocks, no antialiasing -- it aliases by design. First-pass behavioral
// model; character first, band-limiting later.
//
// One sample = one closed-form expression:
//   out = (1 + (g-1)H) * D[ (1 + Ja*sin(ampLfo)) * sin(car + phaseJit + shift + Ph*H) + Ai*sin(interf) ] + Ii*noise*H
// with H = hit gate, D[x] = x + h2 x^2 + h3 x^3.

namespace {

static const char kMetadataJson[] =
  "{"
    "\"module\":\"bradley_2a\","
    "\"label\":\"Bradley 2A Jitter/Hit Synth\","
    "\"targetType\":\"bradley2a\","
    "\"kind\":\"oscillator\","
    "\"outputs\":[\"Out\"],"
    "\"parameters\":["
      "{\"key\":\"carrierFreq\",\"label\":\"Carrier\",\"kind\":\"frequency\",\"defaultValue\":1004,\"min\":0,\"mid\":1000,\"max\":20000,\"step\":\"any\",\"unit\":\"Hz\"},"
      "{\"key\":\"freqOffset\",\"label\":\"Freq Translate\",\"kind\":\"frequency\",\"defaultValue\":0,\"min\":-500,\"mid\":0,\"max\":500,\"step\":\"any\",\"unit\":\"Hz\"},"
      "{\"key\":\"jitterDepth\",\"label\":\"Phase Jitter\",\"defaultValue\":0,\"min\":0,\"mid\":0.25,\"max\":3.141592653589793,\"step\":\"any\"},"
      "{\"key\":\"jitterRate\",\"label\":\"Jitter Rate\",\"kind\":\"frequency\",\"defaultValue\":60,\"min\":0,\"mid\":100,\"max\":300,\"step\":\"any\",\"unit\":\"Hz\"},"
      "{\"key\":\"ampDepth\",\"label\":\"Amp Jitter\",\"defaultValue\":0,\"min\":0,\"mid\":0.25,\"max\":1,\"step\":\"any\"},"
      "{\"key\":\"ampRate\",\"label\":\"Amp Rate\",\"kind\":\"frequency\",\"defaultValue\":40,\"min\":0,\"mid\":50,\"max\":300,\"step\":\"any\",\"unit\":\"Hz\"},"
      "{\"key\":\"interfLevel\",\"label\":\"Interference\",\"defaultValue\":0,\"min\":0,\"mid\":0.25,\"max\":1,\"step\":\"any\"},"
      "{\"key\":\"interfFreq\",\"label\":\"Interf Freq\",\"kind\":\"frequency\",\"defaultValue\":2600,\"min\":0,\"mid\":1000,\"max\":20000,\"step\":\"any\",\"unit\":\"Hz\"},"
      "{\"key\":\"harm2\",\"label\":\"2nd Harm\",\"defaultValue\":0,\"min\":0,\"mid\":0.25,\"max\":1,\"step\":\"any\"},"
      "{\"key\":\"harm3\",\"label\":\"3rd Harm\",\"defaultValue\":0,\"min\":0,\"mid\":0.25,\"max\":1,\"step\":\"any\"},"
      "{\"key\":\"hitRate\",\"label\":\"Hit Rate\",\"defaultValue\":1,\"min\":0,\"mid\":2,\"max\":20,\"step\":\"any\",\"unit\":\"Hz\"},"
      "{\"key\":\"hitDuration\",\"label\":\"Hit Time\",\"defaultValue\":0.005,\"min\":0,\"mid\":0.02,\"max\":0.2,\"step\":\"any\",\"unit\":\"s\"},"
      "{\"key\":\"hitGain\",\"label\":\"Gain Hit\",\"defaultValue\":1,\"min\":0,\"mid\":1,\"max\":4,\"step\":\"any\"},"
      "{\"key\":\"hitPhase\",\"label\":\"Phase Hit\",\"defaultValue\":0,\"min\":-3.141592653589793,\"mid\":0,\"max\":3.141592653589793,\"step\":\"any\"},"
      "{\"key\":\"impulseLevel\",\"label\":\"Impulse\",\"defaultValue\":0,\"min\":0,\"mid\":0.25,\"max\":1,\"step\":\"any\"},"
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

static inline double safe(double x) { return x * 0.0 == 0.0 ? x : 0.0; }
static inline double clamp(double x, double lo, double hi) { return x < lo ? lo : (x > hi ? hi : x); }
static inline double maxd(double a, double b) { return a > b ? a : b; }

static double wrap_two_pi(double p) {
  return p - kTwoPi * dsp_floor(p / kTwoPi);
}

struct Bradley2AState {
  double carrierPhase;
  double jitterLfoPhase;
  double ampLfoPhase;
  double shiftPhase;
  double interfPhase;
  double hitClock;
  int    hitSamplesLeft;
  unsigned int noiseSeed;
  bool   active;
};

static Bradley2AState gPool[kMaxInstances];

// deterministic LCG noise in [-1, 1] (swap for pi-noise later)
static double next_noise(Bradley2AState& s) {
  s.noiseSeed = (unsigned int)(1664525u * s.noiseSeed + 1013904223u);
  return ((double)s.noiseSeed / 4294967295.0) * 2.0 - 1.0;
}

}  // namespace

extern "C" int soemdsp_bradley_2a_create() {
  for (int i = 0; i < kMaxInstances; i++) {
    if (!gPool[i].active) {
      Bradley2AState& s = gPool[i];
      s.carrierPhase = 0.0;
      s.jitterLfoPhase = 0.0;
      s.ampLfoPhase = 0.0;
      s.shiftPhase = 0.0;
      s.interfPhase = 0.0;
      s.hitClock = 0.0;
      s.hitSamplesLeft = 0;
      s.noiseSeed = 0x2A2A2A2Au;
      s.active = true;
      return i + 1;
    }
  }
  return 0;
}

extern "C" void soemdsp_bradley_2a_destroy(int handle) {
  if (handle < 1 || handle > kMaxInstances) return;
  gPool[handle - 1].active = false;
}

extern "C" double soemdsp_bradley_2a_sample(
  int    handle,
  double carrierFreq,
  double freqOffset,
  double jitterDepth,
  double jitterRate,
  double ampDepth,
  double ampRate,
  double interfLevel,
  double interfFreq,
  double harm2,
  double harm3,
  double hitRate,
  double hitDuration,
  double hitGain,
  double hitPhase,
  double impulseLevel,
  double level,
  double sampleRate
) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  Bradley2AState& s = gPool[handle - 1];

  const double rate = sampleRate < 1.0 ? 1.0 : sampleRate;

  // --- hit clock (sawtooth): trigger a hit when it wraps ---
  s.hitClock += maxd(0.0, safe(hitRate)) / rate;
  if (s.hitClock >= 1.0) {
    s.hitClock -= 1.0;
    s.hitSamplesLeft = (int)maxd(0.0, safe(hitDuration) * rate);
  }
  const bool hitActive = s.hitSamplesLeft > 0;
  if (hitActive) s.hitSamplesLeft--;

  // --- jitter lfos (slow sines) ---
  s.jitterLfoPhase = wrap_two_pi(s.jitterLfoPhase + kTwoPi * safe(jitterRate) / rate);
  const double phaseJitter = safe(jitterDepth) * dsp_sin(s.jitterLfoPhase);

  s.ampLfoPhase = wrap_two_pi(s.ampLfoPhase + kTwoPi * safe(ampRate) / rate);
  const double ampMod = 1.0 + safe(ampDepth) * dsp_sin(s.ampLfoPhase);

  // --- frequency translation (phase ramp) ---
  s.shiftPhase = wrap_two_pi(s.shiftPhase + kTwoPi * safe(freqOffset) / rate);

  // --- impaired carrier ---
  const double phaseHit = hitActive ? safe(hitPhase) : 0.0;
  s.carrierPhase = wrap_two_pi(s.carrierPhase + kTwoPi * safe(carrierFreq) / rate);
  double sig = dsp_sin(s.carrierPhase + phaseJitter + s.shiftPhase + phaseHit) * ampMod;

  // --- single frequency interference ---
  s.interfPhase = wrap_two_pi(s.interfPhase + kTwoPi * safe(interfFreq) / rate);
  sig += safe(interfLevel) * dsp_sin(s.interfPhase);

  // --- harmonic distortion (naive, aliases by design) ---
  sig = sig + safe(harm2) * sig * sig + safe(harm3) * sig * sig * sig;

  // --- hits: gain / dropout / impulse ---
  if (hitActive) {
    sig *= safe(hitGain);
    sig += next_noise(s) * safe(impulseLevel);
  }

  return clamp(sig * safe(level), -1.0, 1.0);
}

extern "C" int soemdsp_bradley_2a_version() {
  return 1;
}

extern "C" const char* soemdsp_bradley_2a_metadata_json() {
  return kMetadataJson;
}

extern "C" int soemdsp_bradley_2a_metadata_json_size() {
  return sizeof(kMetadataJson) - 1;
}
