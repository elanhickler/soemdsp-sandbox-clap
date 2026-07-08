// soemdsp-native-module: pluck_envelope
// soemdsp-native-label: Pluck Envelope
// soemdsp-native-target: pluckEnvelope
// soemdsp-native-kind: envelope

namespace {

static const char kMetadataJson[] =
  "{"
    "\"module\":\"pluck_envelope\","
    "\"label\":\"Pluck Envelope\","
    "\"targetType\":\"pluckEnvelope\","
    "\"kind\":\"envelope\","
    "\"inputs\":[\"Trigger\",\"Release\"],"
    "\"outputs\":[\"Out\"],"
    "\"parameters\":["
      "{\"key\":\"delayTime\",\"label\":\"Delay\",\"kind\":\"time\",\"defaultValue\":0,\"min\":0,\"mid\":0,\"max\":1,\"step\":\"any\",\"unit\":\"s\"},"
      "{\"key\":\"attackFeedback\",\"label\":\"Attack\",\"kind\":\"time\",\"defaultValue\":0.002,\"min\":0,\"mid\":0.002,\"max\":1,\"step\":\"any\",\"unit\":\"s\"},"
      "{\"key\":\"decay\",\"label\":\"Decay\",\"defaultValue\":0.35,\"min\":0.1,\"mid\":0.35,\"max\":1,\"step\":\"any\"},"
      "{\"key\":\"decayModStart\",\"label\":\"Attack Energy\",\"defaultValue\":0.08,\"min\":0.001,\"mid\":0.08,\"max\":1.8,\"step\":\"any\"},"
      "{\"key\":\"decayModEnd\",\"label\":\"Decay Energy\",\"defaultValue\":0.55,\"min\":0.01,\"mid\":0.55,\"max\":3,\"step\":\"any\"},"
      "{\"key\":\"endingDecay\",\"label\":\"Ending Decay\",\"defaultValue\":0.8,\"min\":0,\"mid\":0.8,\"max\":1.4,\"step\":\"any\"},"
      "{\"key\":\"decayModCurve\",\"label\":\"Decay Curve\",\"defaultValue\":0,\"min\":-1,\"mid\":0,\"max\":1,\"step\":\"any\"},"
      "{\"key\":\"decayModFrequency\",\"label\":\"Decay Motion\",\"kind\":\"frequency\",\"defaultValue\":1.5,\"min\":0,\"mid\":1.5,\"max\":100,\"step\":\"any\",\"unit\":\"Hz\"},"
      "{\"key\":\"autoReleaseTime\",\"label\":\"Auto Release\",\"kind\":\"time\",\"defaultValue\":0.08,\"min\":0,\"mid\":0.08,\"max\":10,\"step\":\"any\",\"unit\":\"s\"},"
      "{\"key\":\"releaseFeedback\",\"label\":\"Release\",\"defaultValue\":0.35,\"min\":0,\"mid\":0.35,\"max\":1,\"step\":\"any\"},"
      "{\"key\":\"velocity\",\"label\":\"Velocity\",\"defaultValue\":1,\"min\":0,\"mid\":0.5,\"max\":1,\"step\":\"any\"},"
      "{\"key\":\"velocitySensitivity\",\"label\":\"Velocity Sensitivity\",\"defaultValue\":0,\"min\":0,\"mid\":0.5,\"max\":1,\"step\":\"any\"},"
      "{\"key\":\"level\",\"label\":\"Level\",\"defaultValue\":1,\"min\":0,\"mid\":0.5,\"max\":1,\"step\":\"any\"}"
    "]"
  "}";

static const int kMaxInstances = 64;

// stage: 0=off, 1=delay, 2=attack, 3=decay, 4=release
enum PluckStage { STAGE_OFF = 0, STAGE_DELAY = 1, STAGE_ATTACK = 2, STAGE_DECAY = 3, STAGE_RELEASE = 4 };

struct PluckEnvelopeState {
  double autoReleasePhasor;
  double currentValue;
  double decayIncrement;
  double lastRelease;
  double lastTrigger;
  double phasor;
  double releaseIncrement;
  double secondsPassed;
  double peak;
  int    stage;
  bool   active;
};

static PluckEnvelopeState gPool[kMaxInstances];

static inline double safe(double x) { return x * 0.0 == 0.0 ? x : 0.0; }
static inline double clamp(double x, double lo, double hi) { return x < lo ? lo : (x > hi ? hi : x); }
static inline double maxd(double a, double b) { return a > b ? a : b; }
static inline double mind(double a, double b) { return a < b ? a : b; }

// General-purpose exp(x) via range reduction: exp(x) = 2^n * exp(f*ln2),
// n = floor(x / ln2), f = x/ln2 - n in [0, 1). The 2^n scale is applied by
// directly building the IEEE-754 exponent bits; exp(f*ln2) (f*ln2 in
// [0, ln2)) uses a Taylor series, which converges fast over that small range.
static double dsp_exp(double x) {
  if (x < -700.0) return 0.0;
  if (x > 700.0) return 1e300;
  const double LOG2E = 1.4426950408889634;
  const double LN2 = 0.6931471805599453;
  double t = x * LOG2E;
  long long n = (long long)t;
  if (t < 0.0 && (double)n != t) n -= 1;  // floor
  double f = t - (double)n;
  double y = f * LN2;
  double ey = 1.0 + y*(1.0 + y*(0.5 + y*(1.0/6.0 + y*(1.0/24.0 + y*(1.0/120.0 + y*(1.0/720.0 + y/5040.0))))));
  union { double d; unsigned long long u; } bits;
  bits.u = (unsigned long long)(n + 1023) << 52;
  return ey * bits.d;
}

// Natural log via IEEE-754 exponent/mantissa split (x = m * 2^e, m in [1,2))
// plus the atanh-based series ln(m) = 2*atanh((m-1)/(m+1)), which converges
// quickly since (m-1)/(m+1) stays within [0, 1/3] for m in [1,2).
static double dsp_ln(double x) {
  if (x <= 0.0) return -700.0;
  union { double d; unsigned long long u; } bits;
  bits.d = x;
  int e = (int)((bits.u >> 52) & 0x7FF) - 1023;
  bits.u = (bits.u & 0x000FFFFFFFFFFFFFULL) | 0x3FF0000000000000ULL;
  double m = bits.d;
  double y = (m - 1.0) / (m + 1.0);
  double y2 = y * y;
  double series = y * (1.0 + y2*(1.0/3.0 + y2*(1.0/5.0 + y2*(1.0/7.0 + y2*(1.0/9.0 + y2/11.0)))));
  const double LN2 = 0.6931471805599453;
  return 2.0*series + (double)e*LN2;
}

static inline double dsp_log10(double x) {
  const double INV_LN10 = 0.4342944819032518;
  return dsp_ln(x) * INV_LN10;
}

static double exponential_curve(double value, double skew) {
  double safeValue = clamp(value, 0.0, 1.0);
  double safeSkew = clamp(skew, -0.99, 0.99);
  if (safeSkew == 0.0) return safeValue;
  double c = 0.5 * (safeSkew + 1.0);
  double a = 2.0 * dsp_log10((1.0 - c) / c);
  double denom = 1.0 - dsp_exp(a);
  return denom == 0.0 ? safeValue : (1.0 - dsp_exp(safeValue * a)) / denom;
}

static void pluck_prepare_for_decay(PluckEnvelopeState& s, double rate, double peak) {
  s.phasor = 0.0;
  s.autoReleasePhasor = 0.0;
  s.currentValue = peak;
  s.decayIncrement = (s.currentValue - 1.0) / maxd(1.0, rate) / 50.0;
}

static void pluck_trigger_attack(
  PluckEnvelopeState& s, double delayTime, double attackFeedback,
  double velocity, double velocitySensitivity, double rate
) {
  const double period = 1.0 / maxd(1.0, rate);
  const double vel = clamp(velocity, 0.0, 1.0);
  const double sens = clamp(velocitySensitivity, 0.0, 1.0);
  const double peak = (1.0 - sens) + vel * sens;
  s.secondsPassed = 0.0;
  s.stage = STAGE_DELAY;
  if (delayTime < period) {
    if (attackFeedback <= 1e-8) {
      s.stage = STAGE_DECAY;
      pluck_prepare_for_decay(s, rate, peak);
    } else {
      s.stage = STAGE_ATTACK;
    }
  }
  s.peak = peak;
}

static void pluck_trigger_release(PluckEnvelopeState& s, double rate) {
  if (s.stage != STAGE_RELEASE) {
    s.stage = STAGE_RELEASE;
    s.releaseIncrement = s.currentValue / maxd(1.0, rate) / 50.0;
  }
}

static double pluck_decay_feedback(
  PluckEnvelopeState& s, double decay, double decayModStart, double decayModEnd,
  double decayModCurve, double endingDecay
) {
  double finalDecayMod = endingDecay;
  if (s.phasor < 1.0) {
    double shaped = exponential_curve(s.phasor, decayModCurve == 0.0 ? -1e-8 : decayModCurve);
    finalDecayMod = decay + decayModStart + shaped * (decayModEnd - decayModStart);
  }
  return mind(1.0 - 1e-6, dsp_exp(-finalDecayMod * 10.0));
}

}  // namespace

extern "C" int soemdsp_pluck_envelope_create() {
  for (int i = 0; i < kMaxInstances; i++) {
    if (!gPool[i].active) {
      PluckEnvelopeState& s = gPool[i];
      s.autoReleasePhasor = 0.0;
      s.currentValue = 0.0;
      s.decayIncrement = 0.0;
      s.lastRelease = 0.0;
      s.lastTrigger = 0.0;
      s.phasor = 0.0;
      s.releaseIncrement = 0.0;
      s.secondsPassed = 0.0;
      s.peak = 0.0;
      s.stage = STAGE_OFF;
      s.active = true;
      return i + 1;
    }
  }
  return 0;
}

extern "C" void soemdsp_pluck_envelope_destroy(int handle) {
  if (handle < 1 || handle > kMaxInstances) return;
  gPool[handle - 1].active = false;
}

extern "C" double soemdsp_pluck_envelope_sample(
  int    handle,
  double trigger,
  double release,
  double delayTime,
  double attackFeedback,
  double decay,
  double decayModStart,
  double decayModEnd,
  double endingDecay,
  double decayModCurve,
  double decayModFrequency,
  double autoReleaseTime,
  double releaseFeedback,
  double velocity,
  double velocitySensitivity,
  double level,
  double sampleRate
) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  PluckEnvelopeState& s = gPool[handle - 1];

  const double rate = sampleRate < 1.0 ? 1.0 : sampleRate;
  const double period = 1.0 / rate;
  const double safeTrigger = safe(trigger);
  const double safeRelease = safe(release);
  const double safeDelayTime = maxd(0.0, safe(delayTime));
  const double safeAttackFeedback = maxd(0.0, safe(attackFeedback));
  const double safeDecay = clamp(safe(decay), 0.1, 1.0);
  const double safeDecayModStart = clamp(safe(decayModStart), 0.001, 1.8);
  const double safeDecayModEnd = clamp(safe(decayModEnd), 0.01, 3.0);
  const double safeEndingDecay = clamp(safe(endingDecay), 0.0, 1.4);
  const double safeDecayModCurve = clamp(safe(decayModCurve), -1.0, 1.0);
  const double safeDecayModFrequency = clamp(safe(decayModFrequency), 0.0, 100.0);
  const double safeAutoReleaseTime = maxd(0.0, safe(autoReleaseTime));
  const double safeReleaseFeedback = clamp(safe(releaseFeedback), 0.0, 1.0);
  const double safeVelocity = clamp(safe(velocity), 0.0, 1.0);
  const double safeVelocitySensitivity = clamp(safe(velocitySensitivity), 0.0, 1.0);
  const double safeLevel = clamp(safe(level), 0.0, 1.0);

  if (s.lastTrigger <= 0.0 && safeTrigger > 0.0) {
    pluck_trigger_attack(s, safeDelayTime, safeAttackFeedback, safeVelocity, safeVelocitySensitivity, rate);
  }
  if (s.lastRelease <= 0.0 && safeRelease > 0.0) {
    pluck_trigger_release(s, rate);
  }
  s.lastTrigger = safeTrigger;
  s.lastRelease = safeRelease;

  const double attackFeedbackAmp = 1.0 / (maxd(safeAttackFeedback, 1e-8) * rate);
  const double releaseFeedbackAmp = mind(1.0 - 1e-6, dsp_exp(-safeReleaseFeedback * 10.0));
  const double autoReleaseIncrement = safeAutoReleaseTime <= 1e-8
    ? 0.0
    : 1.0 / (maxd(safeAutoReleaseTime, 1e-8) * rate);
  const double phasorIncrement = safeDecayModFrequency / rate;

  switch (s.stage) {
    case STAGE_DELAY:
      s.secondsPassed += period;
      if (s.secondsPassed >= safeDelayTime) {
        s.stage = STAGE_ATTACK;
      }
      break;
    case STAGE_ATTACK:
      s.currentValue += period + s.currentValue * attackFeedbackAmp;
      if (s.currentValue >= s.peak) {
        s.stage = STAGE_DECAY;
        pluck_prepare_for_decay(s, rate, s.peak);
      }
      break;
    case STAGE_DECAY: {
      double feedback = pluck_decay_feedback(s, safeDecay, safeDecayModStart, safeDecayModEnd, safeDecayModCurve, safeEndingDecay);
      s.currentValue -= s.decayIncrement + s.currentValue * s.currentValue * feedback;
      s.phasor += phasorIncrement;
      s.autoReleasePhasor += autoReleaseIncrement;
      if (autoReleaseIncrement > 0.0 && s.autoReleasePhasor >= 1.0) {
        pluck_trigger_release(s, rate);
      }
      if (s.currentValue < 0.0) {
        s.currentValue = 0.0;
        s.secondsPassed = 0.0;
        s.phasor = 0.0;
        s.autoReleasePhasor = 0.0;
        s.stage = STAGE_OFF;
      }
      break;
    }
    case STAGE_RELEASE:
      s.currentValue -= s.releaseIncrement + s.currentValue * s.currentValue * releaseFeedbackAmp;
      if (s.currentValue <= 0.0) {
        s.currentValue = 0.0;
        s.secondsPassed = 0.0;
        s.phasor = 0.0;
        s.autoReleasePhasor = 0.0;
        s.stage = STAGE_OFF;
      }
      break;
    case STAGE_OFF:
    default:
      break;
  }

  return safe(s.currentValue * safeLevel);
}

extern "C" int soemdsp_pluck_envelope_version() {
  return 1;
}

extern "C" const char* soemdsp_pluck_envelope_metadata_json() {
  return kMetadataJson;
}

extern "C" int soemdsp_pluck_envelope_metadata_json_size() {
  return sizeof(kMetadataJson) - 1;
}
