// Fourth proof-of-load plugin. Proves the one thing none of the prior
// three proofs touched: can a real native_modules DSP source compile
// directly into a CLAP plugin (no WASM, no browser) and produce correct
// audio from inside process(). Confirmed via inspection that
// native_modules/*.cpp are plain portable C++ (extern "C" functions, no
// emscripten/WASM-specific code) -- compiled here as a second .cpp on the
// same build line and linked directly into this plugin's DLL.
//
// Deliberately narrow scope: hardcoded 440Hz sine, no GUI, no params, no
// state. If this doesn't work, the only possible cause is "native DSP
// code doesn't run correctly inside a CLAP plugin's audio thread" --
// nothing else is layered on top to confuse the result. GUI+DSP+params+
// state coming together live is the next proof after this one, not this
// one.
//
// basic_oscillator.cpp keeps phase as caller-managed state (it takes
// phase + phaseIncrement as arguments rather than tracking them
// internally -- see its soemdsp_basic_oscillator_sample signature), so
// this plugin owns the phase accumulator, exactly like the real
// AudioWorklet-side JS callers do.

#include <clap/clap.h>
#include <cmath>
#include <cstring>

// Forward declarations for the native_modules/basic_oscillator exports
// this proof links against (compiled as a second source file on the same
// build command, not included -- see build_dsp_proof.ps1).
extern "C" int soemdsp_basic_oscillator_create();
extern "C" void soemdsp_basic_oscillator_destroy(int handle);
extern "C" double soemdsp_basic_oscillator_sample(int handle, double phase,
                                                   double phaseIncrement,
                                                   double waveform);

namespace {

constexpr double kTwoPi = 6.283185307179586476;
constexpr double kToneHz = 440.0;
constexpr double kSineWaveform = 4.0;  // matches basic_oscillator's case 4

struct PluginState {
  const clap_host_t *host = nullptr;
  double sampleRate = 44100.0;
  double phase = 0.0;
  int oscHandle = 0;
};

// --- clap_plugin_audio_ports (same shape as every prior proof) -------------

uint32_t AudioPortsCount(const clap_plugin_t *, bool isInput) {
  return isInput ? 0 : 1;
}

bool AudioPortsGet(const clap_plugin_t *, uint32_t index, bool isInput,
                    clap_audio_port_info_t *info) {
  if (isInput || index != 0) {
    return false;
  }
  info->id = 0;
  std::strncpy(info->name, "Output", sizeof(info->name) - 1);
  info->name[sizeof(info->name) - 1] = '\0';
  info->flags = CLAP_AUDIO_PORT_IS_MAIN;
  info->channel_count = 2;
  info->port_type = CLAP_PORT_STEREO;
  info->in_place_pair = CLAP_INVALID_ID;
  return true;
}

const clap_plugin_audio_ports_t kAudioPortsExtension = {
    AudioPortsCount,
    AudioPortsGet,
};

// --- clap_plugin -------------------------------------------------------------

bool PluginInit(const clap_plugin_t *plugin) {
  auto *state = static_cast<PluginState *>(plugin->plugin_data);
  state->oscHandle = soemdsp_basic_oscillator_create();
  return state->oscHandle != 0;
}

void PluginDestroy(const clap_plugin_t *plugin) {
  auto *state = static_cast<PluginState *>(plugin->plugin_data);
  if (state->oscHandle) {
    soemdsp_basic_oscillator_destroy(state->oscHandle);
  }
  delete state;
  delete plugin;
}

bool PluginActivate(const clap_plugin_t *plugin, double sampleRate, uint32_t,
                     uint32_t) {
  auto *state = static_cast<PluginState *>(plugin->plugin_data);
  state->sampleRate = sampleRate > 0 ? sampleRate : 44100.0;
  state->phase = 0.0;
  return true;
}

void PluginDeactivate(const clap_plugin_t *) {}
bool PluginStartProcessing(const clap_plugin_t *) { return true; }
void PluginStopProcessing(const clap_plugin_t *) {}

void PluginReset(const clap_plugin_t *plugin) {
  static_cast<PluginState *>(plugin->plugin_data)->phase = 0.0;
}

clap_process_status PluginProcess(const clap_plugin_t *plugin,
                                   const clap_process_t *process) {
  auto *state = static_cast<PluginState *>(plugin->plugin_data);
  if (process->audio_outputs_count < 1 || !state->oscHandle) {
    return CLAP_PROCESS_CONTINUE;
  }
  clap_audio_buffer_t &out = process->audio_outputs[0];
  const double phaseIncrement = kTwoPi * kToneHz / state->sampleRate;

  for (uint32_t frame = 0; frame < process->frames_count; ++frame) {
    const double raw = soemdsp_basic_oscillator_sample(
        state->oscHandle, state->phase, phaseIncrement, kSineWaveform);
    const float sample = static_cast<float>(raw * 0.2);
    for (uint32_t channel = 0; channel < out.channel_count; ++channel) {
      out.data32[channel][frame] = sample;
    }
    state->phase += phaseIncrement;
    if (state->phase > kTwoPi) {
      state->phase -= kTwoPi;
    }
  }
  return CLAP_PROCESS_CONTINUE;
}

const void *PluginGetExtension(const clap_plugin_t *, const char *id) {
  if (std::strcmp(id, CLAP_EXT_AUDIO_PORTS) == 0) {
    return &kAudioPortsExtension;
  }
  return nullptr;
}

void PluginOnMainThread(const clap_plugin_t *) {}

// --- clap_plugin_descriptor --------------------------------------------------

const char *kFeatures[] = {CLAP_PLUGIN_FEATURE_INSTRUMENT,
                            CLAP_PLUGIN_FEATURE_SYNTHESIZER, nullptr};

const clap_plugin_descriptor_t kDescriptor = {
    CLAP_VERSION,
    "com.soundemote.soemdsp-dsp-proof",
    "soemdsp DSP Proof",
    "Soundemote",
    "https://soundemote.io",
    "",
    "",
    "0.0.1",
    "Proof that a real native_modules DSP source (basic_oscillator.cpp) "
    "compiles directly into a raw-CLAP (no JUCE) plugin and produces "
    "correct audio from inside process() -- no WASM, no browser.",
    kFeatures,
};

}  // namespace

// --- clap_plugin_factory ------------------------------------------------------

namespace {

uint32_t FactoryGetPluginCount(const clap_plugin_factory_t *) { return 1; }

const clap_plugin_descriptor_t *FactoryGetPluginDescriptor(
    const clap_plugin_factory_t *, uint32_t index) {
  return index == 0 ? &kDescriptor : nullptr;
}

const clap_plugin_t *FactoryCreatePlugin(const clap_plugin_factory_t *,
                                          const clap_host_t *host,
                                          const char *pluginId) {
  if (std::strcmp(pluginId, kDescriptor.id) != 0) {
    return nullptr;
  }
  auto *plugin = new clap_plugin_t{};
  auto *state = new PluginState{};
  state->host = host;
  plugin->desc = &kDescriptor;
  plugin->plugin_data = state;
  plugin->init = PluginInit;
  plugin->destroy = PluginDestroy;
  plugin->activate = PluginActivate;
  plugin->deactivate = PluginDeactivate;
  plugin->start_processing = PluginStartProcessing;
  plugin->stop_processing = PluginStopProcessing;
  plugin->reset = PluginReset;
  plugin->process = PluginProcess;
  plugin->get_extension = PluginGetExtension;
  plugin->on_main_thread = PluginOnMainThread;
  return plugin;
}

const clap_plugin_factory_t kFactory = {
    FactoryGetPluginCount,
    FactoryGetPluginDescriptor,
    FactoryCreatePlugin,
};

bool EntryInit(const char *) { return true; }
void EntryDeinit() {}

const void *EntryGetFactory(const char *factoryId) {
  if (std::strcmp(factoryId, CLAP_PLUGIN_FACTORY_ID) == 0) {
    return &kFactory;
  }
  return nullptr;
}

}  // namespace

extern "C" CLAP_EXPORT const clap_plugin_entry_t clap_entry = {
    CLAP_VERSION,
    EntryInit,
    EntryDeinit,
    EntryGetFactory,
};
