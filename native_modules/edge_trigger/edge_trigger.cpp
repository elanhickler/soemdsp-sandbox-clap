// soemdsp-native-module: edge_trigger
// soemdsp-native-label: Up/Down Trigger
// soemdsp-native-target: edgeTrigger
// soemdsp-native-kind: utility
//
// Watches a digital input (high = above 0.5, matching the trigger threshold
// used elsewhere in this codebase, e.g. pulse_explosion) and fires whenever
// it changes state. Rising edges (0->1, e.g. the start of a square wave's
// high phase) drive the Up outputs; falling edges (1->0) drive the Down
// outputs. Each side gets both a true 1-sample trigger and a
// pulseTime-length gate, each with its own independent level control, so the
// two can be summed/patched together into a little stepped waveform (a
// short spike from the trigger followed by a sustained plateau from the
// pulse, both scaled independently).
//
// Main _sample() call returns Up Trigger; the other three outputs are read
// via accessor functions after the call, following this codebase's
// established pattern for native modules with more than one output (compare
// soemdsp_pulse_explosion_curve, soemdsp_pll_vco_out, etc.).

namespace {

static const int kMaxInstances = 64;

struct EdgeTriggerState {
  bool active;
  bool wasHigh;
  double upPulseRemaining;    // seconds left in the current Up Pulse gate
  double downPulseRemaining;  // seconds left in the current Down Pulse gate
  double lastUpPulse;
  double lastDownTrigger;
  double lastDownPulse;
};

static EdgeTriggerState gPool[kMaxInstances];

static inline double safe(double x) { return x * 0.0 == 0.0 ? x : 0.0; }

}  // namespace

extern "C" int soemdsp_edge_trigger_create() {
  for (int i = 0; i < kMaxInstances; i++) {
    if (!gPool[i].active) {
      EdgeTriggerState& s = gPool[i];
      s.wasHigh = false;
      s.upPulseRemaining = 0.0;
      s.downPulseRemaining = 0.0;
      s.lastUpPulse = 0.0;
      s.lastDownTrigger = 0.0;
      s.lastDownPulse = 0.0;
      s.active = true;
      return i + 1;
    }
  }
  return 0;
}

extern "C" void soemdsp_edge_trigger_destroy(int handle) {
  if (handle < 1 || handle > kMaxInstances) return;
  gPool[handle - 1].active = false;
}

extern "C" double soemdsp_edge_trigger_sample(
  int    handle,
  double digitalIn,
  double pulseTime,
  double triggerLevel,
  double pulseLevel,
  double sampleRate
) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  EdgeTriggerState& s = gPool[handle - 1];

  const double safeRate = sampleRate < 1.0 ? 44100.0 : sampleRate;
  const double safePulseTime = safe(pulseTime) < 0.0 ? 0.0 : safe(pulseTime);
  const double sampleDuration = 1.0 / safeRate;

  const bool high = safe(digitalIn) > 0.5;
  const bool risingEdge = high && !s.wasHigh;
  const bool fallingEdge = !high && s.wasHigh;
  s.wasHigh = high;

  double upTrigger = 0.0;
  if (risingEdge) {
    upTrigger = safe(triggerLevel);
    s.upPulseRemaining = safePulseTime;
  }
  double downTrigger = 0.0;
  if (fallingEdge) {
    downTrigger = safe(triggerLevel);
    s.downPulseRemaining = safePulseTime;
  }

  const double upPulse = s.upPulseRemaining > 0.0 ? safe(pulseLevel) : 0.0;
  const double downPulse = s.downPulseRemaining > 0.0 ? safe(pulseLevel) : 0.0;
  if (s.upPulseRemaining > 0.0) s.upPulseRemaining -= sampleDuration;
  if (s.downPulseRemaining > 0.0) s.downPulseRemaining -= sampleDuration;

  s.lastUpPulse = upPulse;
  s.lastDownTrigger = downTrigger;
  s.lastDownPulse = downPulse;

  return upTrigger;
}

extern "C" double soemdsp_edge_trigger_up_pulse(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].lastUpPulse;
}

extern "C" double soemdsp_edge_trigger_down_trigger(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].lastDownTrigger;
}

extern "C" double soemdsp_edge_trigger_down_pulse(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].lastDownPulse;
}

extern "C" int soemdsp_edge_trigger_version() {
  return 1;
}
