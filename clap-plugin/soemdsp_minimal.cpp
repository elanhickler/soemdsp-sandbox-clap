// Minimal, raw-CLAP-API (no JUCE, no clap-wrapper) proof-of-load plugin.
// Goal: the smallest thing a real DAW will load, instantiate, and actually
// hear sound from -- before any GUI, parameters, DSP graph, or state
// handling gets layered on. A constant 440Hz sine tone on a stereo output,
// zero inputs, zero parameters, zero GUI.
//
// Built against clap 1.2.8 headers vendored in
// baconpaulstartingpointtemplate/libs/clap-libs/clap (headers only -- no
// JUCE, no sst-*, no clap-wrapper linked into this binary).

#include <clap/clap.h>
#include <cmath>
#include <cstring>

namespace {

constexpr double kPi = 3.14159265358979323846;
constexpr double kToneHz = 440.0;

struct PluginState {
  const clap_host_t *host = nullptr;
  double sampleRate = 44100.0;
  double phase = 0.0;
};

// --- clap_plugin_audio_ports ------------------------------------------------

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

bool PluginInit(const clap_plugin_t *) { return true; }

void PluginDestroy(const clap_plugin_t *plugin) {
  delete static_cast<PluginState *>(plugin->plugin_data);
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
  if (process->audio_outputs_count < 1) {
    return CLAP_PROCESS_CONTINUE;
  }
  clap_audio_buffer_t &out = process->audio_outputs[0];
  const double increment = 2.0 * kPi * kToneHz / state->sampleRate;
  for (uint32_t frame = 0; frame < process->frames_count; ++frame) {
    const float sample = static_cast<float>(std::sin(state->phase) * 0.2);
    for (uint32_t channel = 0; channel < out.channel_count; ++channel) {
      out.data32[channel][frame] = sample;
    }
    state->phase += increment;
    if (state->phase > 2.0 * kPi) {
      state->phase -= 2.0 * kPi;
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
    "com.soundemote.soemdsp-minimal",
    "soemdsp Minimal Proof",
    "Soundemote",
    "https://soundemote.io",
    "",
    "",
    "0.0.1",
    "Proof-of-load test tone -- confirms the raw CLAP ABI loads and "
    "produces audio in a real host, before any DSP graph or GUI is wired in.",
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

// --- clap_plugin_entry ---------------------------------------------------------

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
