// soemdsp-native-module: sabrina_reverb
// soemdsp-native-label: Sabrina Reverb
// soemdsp-native-target: reverbEffect
// soemdsp-native-kind: effect

namespace {
constexpr int kDelayCount = 14;
constexpr int kDiffusionCount = 12;
constexpr int kMaxInstances = 2;
constexpr int kMaxDelaySamples = 192000;
// Internal per-sample ramp time for delay-line geometry (offset/LFO speed).
// This runs independent of whatever smoothing the JS caller applies, so a
// param update never snaps a delay tap length -- which is audible as a click
// even when the incoming value itself arrives already smoothed.
constexpr double kParamSmoothSeconds = 0.05;

double clamp(double value, double minValue, double maxValue) {
  if (value < minValue) {
    return minValue;
  }
  if (value > maxValue) {
    return maxValue;
  }
  return value;
}

bool finite(double value) {
  return value == value && value > -1.0e12 && value < 1.0e12;
}

double fract(double value) {
  const double whole = __builtin_floor(value);
  return value - whole;
}

double parabol(double value) {
  const double wrapped = fract(value);
  const double fit = wrapped * 2.0 - 1.0;
  return 4.0 * fit * (1.0 - __builtin_fabs(fit));
}

double smoothStep(double current, double target, double alpha) {
  return current + (target - current) * alpha;
}

// nostdlib build has no libm to link against, so exp() isn't available --
// range-reduce by halving then a short Taylor series, which is plenty
// accurate for deriving a one-pole smoothing coefficient.
double expApprox(double x) {
  int halvings = 0;
  double reduced = x;
  while (reduced > 0.5 || reduced < -0.5) {
    reduced *= 0.5;
    halvings += 1;
  }
  double term = 1.0;
  double sum = 1.0;
  for (int index = 1; index <= 12; index += 1) {
    term *= reduced / index;
    sum += term;
  }
  for (int index = 0; index < halvings; index += 1) {
    sum *= sum;
  }
  return sum;
}

struct SabrinaDelay {
  float buffer[kMaxDelaySamples];
  int driver;
  int rndNext;
  double feedback;
  double rndAcc;
  double offset;
  double modInc;
  double modSpeed;
  double lfopercent;
  // Stored random values so applyDelayGeometry can reuse them without advancing the RNG
  double rndOffset;
  double rndMod;
};

struct SabrinaState {
  SabrinaDelay delays[kDelayCount];
  bool active;
  double sampleRate;
  double ch0;
  double ch1;
  double lastLeft;
  double lastRight;
  double lastWet;
  double mix;
  double diffusionSize;
  double diffusionAmount;
  double delaySize;
  double recycle;
  double lfoAmplitude;
  double lfoBaseSpeed;
  double lfoVariation;
  int seed;
  // Ramped copies of the params that feed delay-line offsets/LFO speed --
  // advanced one step per sample in advanceSabrinaSmoothing so the geometry
  // that applyDelayGeometry derives from them never jumps discontinuously.
  double smoothedDiffusionSize;
  double smoothedDelaySize;
  double smoothedLfoAmplitude;
  double smoothedLfoBaseSpeed;
  double smoothedLfoVariation;
  double paramSmoothAlpha;
};

SabrinaState states[kMaxInstances];

double rnd(SabrinaDelay& delay) {
  delay.rndNext = (delay.rndNext + 109) % 123094;
  delay.rndAcc = parabol(parabol((delay.rndNext + delay.rndAcc + 10.0) * 134987.489798 + 1987.19687) * 1987.4987 + 98497.19879);
  return delay.rndAcc * 0.5 + 0.5;
}

void clearDelay(SabrinaDelay& delay) {
  for (int index = 0; index < kMaxDelaySamples; index += 1) {
    delay.buffer[index] = 0.0f;
  }
}

// Uses stored rndOffset — safe to call repeatedly without changing the random sequence
void setOffsetSize(SabrinaDelay& delay, double size, double maxDelaySize) {
  delay.offset = maxDelaySize * delay.rndOffset * (size * 0.1 + 0.0000001) + 1.0;
}

// Uses stored rndMod — safe to call repeatedly without changing the random sequence
void initializeMod(SabrinaDelay& delay, double lfoSeconds, double lfoVariation, double sampleRate) {
  const double seconds = lfoSeconds + delay.rndMod * lfoVariation;
  delay.modSpeed = (1.0 / (seconds > 0.000001 ? seconds : 0.000001)) / sampleRate;
}

void initializeDelay(SabrinaDelay& delay, int seed, double sampleRate) {
  clearDelay(delay);
  delay.driver = 0;
  delay.feedback = 0.0;
  delay.rndNext = seed % 123094;
  delay.rndAcc = 0.0;
  rnd(delay);
  rnd(delay);
  rnd(delay);
  // Consume and store the random values that applyDelayGeometry will need
  delay.rndOffset = rnd(delay);
  delay.rndMod = rnd(delay);
  delay.modInc = 0.0;
  delay.lfopercent = 0.0;
  setOffsetSize(delay, 0.06, sampleRate * 4.0);
  initializeMod(delay, 1.0, 0.001, sampleRate);
}

double readDelay(const SabrinaDelay& delay, double where) {
  double wrapped = where;
  while (wrapped < 0.0) {
    wrapped += kMaxDelaySamples;
  }
  while (wrapped >= kMaxDelaySamples) {
    wrapped -= kMaxDelaySamples;
  }
  const int before = static_cast<int>(wrapped);
  const int after = (before + 1) % kMaxDelaySamples;
  const double mix = wrapped - before;
  return delay.buffer[before] * (1.0 - mix) + delay.buffer[after] * mix;
}

double delaySample(SabrinaDelay& delay, double input) {
  const double safeInput = finite(input) ? input : 0.0;
  delay.modInc += delay.modSpeed;
  const double lfo = parabol(delay.modInc) * 0.5 + 0.5;
  const double readPosition = delay.driver - delay.offset - delay.offset * lfo * delay.lfopercent;
  delay.driver = (delay.driver + 1) % kMaxDelaySamples;
  const double delayed = readDelay(delay, readPosition);
  delay.buffer[delay.driver] = static_cast<float>(safeInput);
  return finite(delayed) ? delayed : 0.0;
}

double diffuseSample(SabrinaDelay& delay, double input) {
  const double safeInput = finite(input) ? input : 0.0;
  delay.modInc += delay.modSpeed;
  const double lfo = parabol(delay.modInc) * 0.5 + 0.5;
  const double readPosition = delay.driver - delay.offset - delay.offset * lfo * delay.lfopercent;
  delay.driver = (delay.driver + 1) % kMaxDelaySamples;
  const double delayed = readDelay(delay, readPosition);
  delay.buffer[delay.driver] = static_cast<float>(clamp((0.0 - safeInput) - delayed * delay.feedback, -16.0, 16.0));
  const double output = safeInput * delay.feedback - delayed * (1.0 - delay.feedback * delay.feedback);
  return finite(output) ? output : 0.0;
}

// Re-derives every delay line's random offset/modulation phase from a single
// seed, clearing their buffers in the process (same as a reset). Each delay
// line keeps its own distinct sub-seed (index * 137 + 7) so they don't all
// land on the same random values -- seed 0 reproduces the original hardcoded
// pattern exactly, any other seed shifts the whole random sequence.
void reseedDelays(SabrinaState& state, int seed) {
  state.seed = seed;
  for (int index = 0; index < kDelayCount; index += 1) {
    initializeDelay(state.delays[index], index * 137 + 7 + seed * 9973, state.sampleRate);
  }
}

// Derives delay-line offsets/LFO speed from the ramped (smoothed*) copies of
// the params, never the raw target values -- called every sample so tap
// length changes glide instead of snapping.
void applyDelayGeometry(SabrinaState& state) {
  const double maxDelaySize = state.sampleRate * 4.0;
  const double lfoSpeed = ((1.0 - state.smoothedLfoBaseSpeed) * 1.95 + 0.5) * 0.5;
  const double lfoVariation = (1.0 - state.smoothedLfoVariation) * 0.25;
  for (int index = 0; index < kDiffusionCount; index += 1) {
    SabrinaDelay& delay = state.delays[index];
    setOffsetSize(delay, state.smoothedDiffusionSize, maxDelaySize);
    delay.feedback = state.diffusionAmount;
    delay.lfopercent = state.smoothedLfoAmplitude * 0.1;
    initializeMod(delay, lfoSpeed, lfoVariation, state.sampleRate);
  }
  for (int index = kDiffusionCount; index < kDelayCount; index += 1) {
    SabrinaDelay& delay = state.delays[index];
    delay.offset = (maxDelaySize - 2.0) * state.smoothedDelaySize * 0.1 + 1.0;
    delay.lfopercent = state.smoothedLfoAmplitude * 0.1;
    initializeMod(delay, lfoSpeed, lfoVariation, state.sampleRate);
  }
}

// Advances the smoothed* fields one step toward their targets and reapplies
// delay geometry. Call once per sample.
void advanceSabrinaSmoothing(SabrinaState& state) {
  state.smoothedDiffusionSize = smoothStep(state.smoothedDiffusionSize, state.diffusionSize, state.paramSmoothAlpha);
  state.smoothedDelaySize = smoothStep(state.smoothedDelaySize, state.delaySize, state.paramSmoothAlpha);
  state.smoothedLfoAmplitude = smoothStep(state.smoothedLfoAmplitude, state.lfoAmplitude, state.paramSmoothAlpha);
  state.smoothedLfoBaseSpeed = smoothStep(state.smoothedLfoBaseSpeed, state.lfoBaseSpeed, state.paramSmoothAlpha);
  state.smoothedLfoVariation = smoothStep(state.smoothedLfoVariation, state.lfoVariation, state.paramSmoothAlpha);
  applyDelayGeometry(state);
}

void resetState(SabrinaState& state, double sampleRate) {
  state.active = true;
  state.sampleRate = clamp(sampleRate, 1.0, 192000.0);
  state.ch0 = 0.0;
  state.ch1 = 0.0;
  state.lastLeft = 0.0;
  state.lastRight = 0.0;
  state.lastWet = 0.0;
  state.mix = 0.43;
  state.diffusionSize = 0.35;
  state.diffusionAmount = 0.70;
  state.delaySize = 0.02;
  state.recycle = 0.70;
  state.lfoAmplitude = 0.07;
  state.lfoBaseSpeed = 0.83;
  state.lfoVariation = 0.001;
  state.smoothedDiffusionSize = state.diffusionSize;
  state.smoothedDelaySize = state.delaySize;
  state.smoothedLfoAmplitude = state.lfoAmplitude;
  state.smoothedLfoBaseSpeed = state.lfoBaseSpeed;
  state.smoothedLfoVariation = state.lfoVariation;
  state.paramSmoothAlpha = 1.0 - expApprox(-1.0 / (kParamSmoothSeconds * state.sampleRate));
  reseedDelays(state, 0);
  applyDelayGeometry(state);
}

SabrinaState* stateForHandle(int handle) {
  if (handle <= 0 || handle > kMaxInstances) {
    return nullptr;
  }
  SabrinaState& state = states[handle - 1];
  return state.active ? &state : nullptr;
}
}  // namespace

extern "C" int soemdsp_sabrina_reverb_create(double sampleRate) {
  for (int index = 0; index < kMaxInstances; index += 1) {
    if (!states[index].active) {
      resetState(states[index], sampleRate);
      return index + 1;
    }
  }
  return 0;
}

extern "C" void soemdsp_sabrina_reverb_destroy(int handle) {
  SabrinaState* state = stateForHandle(handle);
  if (!state) {
    return;
  }
  state->active = false;
}

extern "C" void soemdsp_sabrina_reverb_reset(int handle, double sampleRate) {
  SabrinaState* state = stateForHandle(handle);
  if (!state) {
    return;
  }
  resetState(*state, sampleRate);
}

extern "C" void soemdsp_sabrina_reverb_set_params(
  int handle,
  double mix,
  double diffusionSize,
  double diffusionAmount,
  double delaySize,
  double recycle,
  double lfoAmplitude,
  double lfoBaseSpeed,
  double lfoVariation,
  double seed
) {
  SabrinaState* state = stateForHandle(handle);
  if (!state) {
    return;
  }
  state->mix = clamp(mix, 0.0, 1.0);
  state->diffusionSize = clamp(diffusionSize, 0.0, 1.0);
  state->diffusionAmount = clamp(diffusionAmount, 0.0, 0.98);
  state->delaySize = clamp(delaySize, 0.0, 1.0);
  state->recycle = clamp(recycle, 0.0, 0.98);
  state->lfoAmplitude = clamp(lfoAmplitude, 0.0, 1.0);
  state->lfoBaseSpeed = clamp(lfoBaseSpeed, 0.0, 1.0);
  state->lfoVariation = clamp(lfoVariation, 0.0, 1.0);
  const int seedInt = static_cast<int>(seed + 0.5);
  if (seedInt != state->seed) {
    reseedDelays(*state, seedInt);
  }
}

extern "C" void soemdsp_sabrina_reverb_process(int handle, double leftInput, double rightInput) {
  SabrinaState* state = stateForHandle(handle);
  if (!state) {
    return;
  }
  advanceSabrinaSmoothing(*state);
  const double dryLeft = finite(leftInput) ? leftInput : 0.0;
  const double dryRight = finite(rightInput) ? rightInput : dryLeft;
  double left = dryLeft + delaySample(state->delays[12], state->ch1) * state->recycle;
  for (int index = 0; index < 6; index += 1) {
    left = diffuseSample(state->delays[index * 2], left);
  }
  double right = dryRight + delaySample(state->delays[13], state->ch0) * state->recycle;
  for (int index = 0; index < 6; index += 1) {
    right = diffuseSample(state->delays[index * 2 + 1], right);
  }
  state->ch0 = finite(left) ? clamp(left, -16.0, 16.0) : 0.0;
  state->ch1 = finite(right) ? clamp(right, -16.0, 16.0) : 0.0;
  state->lastLeft = state->ch0 * state->mix + dryLeft * (1.0 - state->mix);
  state->lastRight = state->ch1 * state->mix + dryRight * (1.0 - state->mix);
  state->lastWet = (state->ch0 + state->ch1) * 0.5;
}

extern "C" double soemdsp_sabrina_reverb_left(int handle) {
  SabrinaState* state = stateForHandle(handle);
  return state ? state->lastLeft : 0.0;
}

extern "C" double soemdsp_sabrina_reverb_right(int handle) {
  SabrinaState* state = stateForHandle(handle);
  return state ? state->lastRight : 0.0;
}

extern "C" double soemdsp_sabrina_reverb_wet(int handle) {
  SabrinaState* state = stateForHandle(handle);
  return state ? state->lastWet : 0.0;
}

extern "C" double soemdsp_sabrina_reverb_wet_left(int handle) {
  SabrinaState* state = stateForHandle(handle);
  return state ? state->ch0 : 0.0;
}

extern "C" double soemdsp_sabrina_reverb_wet_right(int handle) {
  SabrinaState* state = stateForHandle(handle);
  return state ? state->ch1 : 0.0;
}

extern "C" int soemdsp_sabrina_reverb_version() {
  return 1;
}
