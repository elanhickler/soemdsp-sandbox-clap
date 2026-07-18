// Second proof-of-load plugin, separate from soemdsp_minimal.cpp (which
// already works -- not touching it). This one proves the other load-bearing
// unknown: can a raw-CLAP plugin (no JUCE) embed a real WebView2 instance
// into a CLAP host's window via clap.gui's set_parent(), inside an actual
// DAW. Audio is a trivial silent passthrough -- the DSP side is already
// proven by soemdsp_minimal.cpp; this file's only job is the GUI embedding.
//
// WebView2 SDK headers/loader vendored locally in third_party/webview2/
// (fetched from the official Microsoft.Web.WebView2 NuGet package -- no
// JUCE, no Tauri/Rust dependency at build time, even though the WebView2
// *runtime* on this machine is the same one Tauri already uses).

#include <clap/clap.h>

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <unknwn.h>
#include <atomic>
#include <cstring>
#include <string>

#include "third_party/webview2/WebView2.h"

namespace {

// --- minimal COM completion-handler helpers ---------------------------------
// WebView2's environment/controller creation are async COM calls. Outside a
// full app framework there's no message loop already pumping for us, so we
// implement the completion handlers ourselves, store the result, and pump
// Win32 messages in a short synchronous loop until they fire. This is the
// standard pattern for embedding WebView2 in a host that doesn't already own
// the message loop (which is exactly a CLAP plugin's situation).

template <typename Interface>
class SimpleComHandler : public Interface {
 public:
  // Release() deletes through this base-class pointer, so this destructor
  // must be virtual -- without it, deleting a derived instance (e.g.
  // EnvironmentCompletedHandler) via a SimpleComHandler<Interface>* is
  // undefined behavior, even though it happened to work here since the
  // derived classes only hold trivially-destructible members.
  virtual ~SimpleComHandler() = default;

  ULONG STDMETHODCALLTYPE AddRef() override { return ++refCount_; }
  ULONG STDMETHODCALLTYPE Release() override {
    ULONG count = --refCount_;
    if (count == 0) {
      delete this;
    }
    return count;
  }
  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void **ppv) override {
    if (!ppv) {
      return E_POINTER;
    }
    if (riid == __uuidof(Interface) || riid == IID_IUnknown) {
      *ppv = static_cast<Interface *>(this);
      AddRef();
      return S_OK;
    }
    *ppv = nullptr;
    return E_NOINTERFACE;
  }

 protected:
  std::atomic<ULONG> refCount_{1};
};

class EnvironmentCompletedHandler final
    : public SimpleComHandler<
          ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler> {
 public:
  explicit EnvironmentCompletedHandler(
      ICoreWebView2Environment **outEnvironment, bool *outDone)
      : outEnvironment_(outEnvironment), outDone_(outDone) {}

  HRESULT STDMETHODCALLTYPE Invoke(HRESULT errorCode,
                                    ICoreWebView2Environment *env) override {
    if (SUCCEEDED(errorCode) && env) {
      env->AddRef();
      *outEnvironment_ = env;
    }
    *outDone_ = true;
    return S_OK;
  }

 private:
  ICoreWebView2Environment **outEnvironment_;
  bool *outDone_;
};

class ControllerCompletedHandler final
    : public SimpleComHandler<
          ICoreWebView2CreateCoreWebView2ControllerCompletedHandler> {
 public:
  explicit ControllerCompletedHandler(ICoreWebView2Controller **outController,
                                       bool *outDone)
      : outController_(outController), outDone_(outDone) {}

  HRESULT STDMETHODCALLTYPE Invoke(HRESULT errorCode,
                                    ICoreWebView2Controller *controller) override {
    if (SUCCEEDED(errorCode) && controller) {
      controller->AddRef();
      *outController_ = controller;
    }
    *outDone_ = true;
    return S_OK;
  }

 private:
  ICoreWebView2Controller **outController_;
  bool *outDone_;
};

// Pumps the Win32 message queue until `done` is set or a timeout elapses.
// CLAP's create()/set_parent() run on the host's main thread, which for a
// real DAW is already a window-message-pumping thread -- but nothing pumps
// it *for* us while we're inside this call, so we do it ourselves.
void PumpUntil(bool *done, DWORD timeoutMs = 5000) {
  const DWORD start = GetTickCount();
  MSG msg;
  while (!*done && (GetTickCount() - start) < timeoutMs) {
    while (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) {
      TranslateMessage(&msg);
      DispatchMessageW(&msg);
    }
    Sleep(1);
  }
}

const wchar_t *kTestPageHtml =
    L"<!doctype html><html><head><meta charset='utf-8'>"
    L"<style>"
    L"body{margin:0;height:100vh;display:flex;align-items:center;"
    L"justify-content:center;background:#12152a;color:#fff;"
    L"font-family:Segoe UI,sans-serif;text-align:center}"
    L"h1{color:#7fc7d9;font-size:28px;margin-bottom:8px}"
    L"p{color:#9aa0c0;font-size:15px}"
    L"</style></head><body><div>"
    L"<h1>soemdsp GUI Proof</h1>"
    L"<p>WebView2, embedded via raw CLAP clap.gui, no JUCE.</p>"
    L"<p>If you can read this inside your DAW, the embedding works.</p>"
    L"</div></body></html>";

// --- plugin state --------------------------------------------------------

struct PluginState {
  const clap_host_t *host = nullptr;
  double sampleRate = 44100.0;

  HWND parentWindow = nullptr;
  ICoreWebView2Environment *environment = nullptr;
  ICoreWebView2Controller *controller = nullptr;
  ICoreWebView2 *webview = nullptr;
};

constexpr uint32_t kGuiWidth = 480;
constexpr uint32_t kGuiHeight = 320;

// --- clap_plugin_audio_ports (silent, proven separately by soemdsp_minimal) --

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

// --- clap_plugin_gui -------------------------------------------------------

bool GuiIsApiSupported(const clap_plugin_t *, const char *api, bool isFloating) {
  return !isFloating && std::strcmp(api, CLAP_WINDOW_API_WIN32) == 0;
}

bool GuiGetPreferredApi(const clap_plugin_t *, const char **api, bool *isFloating) {
  *api = CLAP_WINDOW_API_WIN32;
  *isFloating = false;
  return true;
}

bool GuiCreate(const clap_plugin_t *plugin, const char *api, bool isFloating) {
  if (isFloating || std::strcmp(api, CLAP_WINDOW_API_WIN32) != 0) {
    return false;
  }
  auto *state = static_cast<PluginState *>(plugin->plugin_data);

  ICoreWebView2Environment *environment = nullptr;
  bool done = false;
  auto *handler = new EnvironmentCompletedHandler(&environment, &done);
  HRESULT hr = CreateCoreWebView2EnvironmentWithOptions(
      nullptr, nullptr, nullptr, handler);
  handler->Release();
  if (FAILED(hr)) {
    return false;
  }
  PumpUntil(&done);
  if (!environment) {
    return false;
  }
  state->environment = environment;
  return true;
}

void GuiDestroy(const clap_plugin_t *plugin) {
  auto *state = static_cast<PluginState *>(plugin->plugin_data);
  if (state->webview) {
    state->webview->Release();
    state->webview = nullptr;
  }
  if (state->controller) {
    state->controller->Close();
    state->controller->Release();
    state->controller = nullptr;
  }
  if (state->environment) {
    state->environment->Release();
    state->environment = nullptr;
  }
  state->parentWindow = nullptr;
}

bool GuiSetScale(const clap_plugin_t *, double) { return true; }

bool GuiGetSize(const clap_plugin_t *, uint32_t *width, uint32_t *height) {
  *width = kGuiWidth;
  *height = kGuiHeight;
  return true;
}

bool GuiCanResize(const clap_plugin_t *) { return false; }

bool GuiGetResizeHints(const clap_plugin_t *, clap_gui_resize_hints_t *) {
  return false;
}

bool GuiAdjustSize(const clap_plugin_t *, uint32_t *, uint32_t *) { return false; }

bool GuiSetSize(const clap_plugin_t *, uint32_t, uint32_t) { return true; }

bool GuiSetParent(const clap_plugin_t *plugin, const clap_window_t *window) {
  auto *state = static_cast<PluginState *>(plugin->plugin_data);
  if (!state->environment || !window || !window->win32) {
    return false;
  }
  state->parentWindow = static_cast<HWND>(window->win32);

  ICoreWebView2Controller *controller = nullptr;
  bool done = false;
  auto *handler = new ControllerCompletedHandler(&controller, &done);
  HRESULT hr = state->environment->CreateCoreWebView2Controller(
      state->parentWindow, handler);
  handler->Release();
  if (FAILED(hr)) {
    return false;
  }
  PumpUntil(&done);
  if (!controller) {
    return false;
  }
  state->controller = controller;

  RECT bounds{0, 0, static_cast<LONG>(kGuiWidth), static_cast<LONG>(kGuiHeight)};
  controller->put_Bounds(bounds);

  ICoreWebView2 *webview = nullptr;
  if (SUCCEEDED(controller->get_CoreWebView2(&webview)) && webview) {
    state->webview = webview;
    webview->NavigateToString(kTestPageHtml);
  }
  return true;
}

bool GuiSetTransient(const clap_plugin_t *, const clap_window_t *) { return false; }

void GuiSuggestTitle(const clap_plugin_t *, const char *) {}

bool GuiShow(const clap_plugin_t *plugin) {
  auto *state = static_cast<PluginState *>(plugin->plugin_data);
  if (!state->controller) {
    return false;
  }
  state->controller->put_IsVisible(TRUE);
  return true;
}

bool GuiHide(const clap_plugin_t *plugin) {
  auto *state = static_cast<PluginState *>(plugin->plugin_data);
  if (!state->controller) {
    return false;
  }
  state->controller->put_IsVisible(FALSE);
  return true;
}

const clap_plugin_gui_t kGuiExtension = {
    GuiIsApiSupported,   GuiGetPreferredApi, GuiCreate,     GuiDestroy,
    GuiSetScale,         GuiGetSize,         GuiCanResize,  GuiGetResizeHints,
    GuiAdjustSize,       GuiSetSize,         GuiSetParent,  GuiSetTransient,
    GuiSuggestTitle,     GuiShow,            GuiHide,
};

// --- clap_plugin -------------------------------------------------------------

bool PluginInit(const clap_plugin_t *) { return true; }

void PluginDestroy(const clap_plugin_t *plugin) {
  delete static_cast<PluginState *>(plugin->plugin_data);
  delete plugin;
}

bool PluginActivate(const clap_plugin_t *plugin, double sampleRate, uint32_t,
                     uint32_t) {
  static_cast<PluginState *>(plugin->plugin_data)->sampleRate =
      sampleRate > 0 ? sampleRate : 44100.0;
  return true;
}

void PluginDeactivate(const clap_plugin_t *) {}
bool PluginStartProcessing(const clap_plugin_t *) { return true; }
void PluginStopProcessing(const clap_plugin_t *) {}
void PluginReset(const clap_plugin_t *) {}

clap_process_status PluginProcess(const clap_plugin_t *,
                                   const clap_process_t *process) {
  // Silent -- this proof is about the GUI, not the audio (already proven by
  // soemdsp_minimal.cpp).
  if (process->audio_outputs_count > 0) {
    clap_audio_buffer_t &out = process->audio_outputs[0];
    for (uint32_t frame = 0; frame < process->frames_count; ++frame) {
      for (uint32_t channel = 0; channel < out.channel_count; ++channel) {
        out.data32[channel][frame] = 0.0f;
      }
    }
  }
  return CLAP_PROCESS_CONTINUE;
}

const void *PluginGetExtension(const clap_plugin_t *, const char *id) {
  if (std::strcmp(id, CLAP_EXT_AUDIO_PORTS) == 0) {
    return &kAudioPortsExtension;
  }
  if (std::strcmp(id, CLAP_EXT_GUI) == 0) {
    return &kGuiExtension;
  }
  return nullptr;
}

void PluginOnMainThread(const clap_plugin_t *) {}

// --- clap_plugin_descriptor --------------------------------------------------

const char *kFeatures[] = {CLAP_PLUGIN_FEATURE_INSTRUMENT, nullptr};

const clap_plugin_descriptor_t kDescriptor = {
    CLAP_VERSION,
    "com.soundemote.soemdsp-gui-proof",
    "soemdsp GUI Proof",
    "Soundemote",
    "https://soundemote.io",
    "",
    "",
    "0.0.1",
    "Proof that a raw-CLAP (no JUCE) plugin can embed a real WebView2 "
    "instance via clap.gui's set_parent(), inside a real DAW.",
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
