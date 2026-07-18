// Third proof-of-load plugin, separate from soemdsp_minimal.cpp (audio,
// already proven) and soemdsp_gui_proof.cpp (WebView2 embedding with static
// test HTML, already proven). This one proves the load-bearing unknown that
// actually matters for the "best of all worlds" architecture: can a raw-CLAP
// plugin spawn the *real* sandbox server (the same PyInstaller sidecar the
// Tauri wrapper uses) and load the *real* sandbox UI into its embedded
// WebView2, inside an actual DAW.
//
// Audio is still silent passthrough -- DSP wiring is a separate, later step.
// This file's only job is: spawn sidecar -> wait for port -> Navigate() the
// embedded webview at it, instead of NavigateToString()'ing inline HTML.

#include <clap/clap.h>

#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <windows.h>
#include <unknwn.h>
#include <atomic>
#include <cstring>
#include <string>

#include "third_party/webview2/WebView2.h"

// Each rebuild gets a distinct plugin id/name (via -DSOEMDSP_BUILD_NUMBER=N
// at compile time) so a fresh copy can be installed and rescanned without
// colliding with a previous build's id -- or its DLL, which stays locked in
// the host process until the plugin instance using it is actually removed.
#ifndef SOEMDSP_BUILD_NUMBER
#define SOEMDSP_BUILD_NUMBER 0
#endif
#define SOEMDSP_STRINGIFY2(x) #x
#define SOEMDSP_STRINGIFY(x) SOEMDSP_STRINGIFY2(x)

namespace {

// --- minimal COM completion-handler helpers (identical pattern to
// soemdsp_gui_proof.cpp -- WebView2 environment/controller creation are
// async COM calls with nothing else pumping the message loop for us here).

template <typename Interface>
class SimpleComHandler : public Interface {
 public:
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

// --- sidecar server spawn + readiness poll ----------------------------------
// Mirrors src-tauri/src/main.rs's spawn_server()/wait_for_server(): same
// sidecar binary, same env var contract, same "poll a TCP connect" readiness
// check -- just reimplemented in C++ since this plugin has no Rust/Tauri
// runtime backing it.

constexpr wchar_t kSidecarPath[] =
    L"C:\\Users\\argit\\Documents\\_PROGRAMMING\\soemdsp-sandbox-native\\"
    L"src-tauri\\binaries\\soemdsp-server-x86_64-pc-windows-msvc.exe";
constexpr wchar_t kSandboxRoot[] =
    L"C:\\Users\\argit\\Documents\\_PROGRAMMING\\soemdsp-sandbox-native";
constexpr int kSidecarPort = 8766;  // distinct from Tauri's default 8765

bool SpawnSidecarServer(PROCESS_INFORMATION *outProcess) {
  SetEnvironmentVariableW(L"SOEMDSP_SANDBOX_ROOT", kSandboxRoot);

  wchar_t commandLine[1024];
  swprintf(commandLine, 1024, L"\"%ls\" --host 127.0.0.1 --port %d",
           kSidecarPath, kSidecarPort);

  STARTUPINFOW startupInfo{};
  startupInfo.cb = sizeof(startupInfo);
  ZeroMemory(outProcess, sizeof(PROCESS_INFORMATION));

  BOOL ok = CreateProcessW(kSidecarPath, commandLine, nullptr, nullptr, FALSE,
                            CREATE_NO_WINDOW, nullptr, nullptr, &startupInfo,
                            outProcess);
  return ok != 0;
}

// Polls a TCP connect to 127.0.0.1:kSidecarPort, pumping window messages
// between attempts so the host's main thread stays responsive while the
// PyInstaller onefile sidecar self-extracts on first launch (can take
// several seconds).
bool WaitForSidecarPort(DWORD timeoutMs) {
  WSADATA wsaData;
  if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
    return false;
  }

  const DWORD start = GetTickCount();
  bool connected = false;
  while (!connected && (GetTickCount() - start) < timeoutMs) {
    SOCKET sock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (sock != INVALID_SOCKET) {
      sockaddr_in addr{};
      addr.sin_family = AF_INET;
      addr.sin_port = htons(static_cast<u_short>(kSidecarPort));
      addr.sin_addr.s_addr = inet_addr("127.0.0.1");

      u_long nonBlocking = 1;
      ioctlsocket(sock, FIONBIO, &nonBlocking);
      connect(sock, reinterpret_cast<sockaddr *>(&addr), sizeof(addr));

      fd_set writeSet;
      FD_ZERO(&writeSet);
      FD_SET(sock, &writeSet);
      timeval selectTimeout{0, 250000};  // 250ms per attempt
      if (select(0, nullptr, &writeSet, nullptr, &selectTimeout) > 0) {
        connected = true;
      }
      closesocket(sock);
    }

    if (!connected) {
      MSG msg;
      while (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
      }
      Sleep(50);
    }
  }

  WSACleanup();
  return connected;
}

// --- plugin state --------------------------------------------------------

struct PluginState {
  const clap_host_t *host = nullptr;
  double sampleRate = 44100.0;

  HWND parentWindow = nullptr;
  ICoreWebView2Environment *environment = nullptr;
  ICoreWebView2Controller *controller = nullptr;
  ICoreWebView2 *webview = nullptr;

  bool serverSpawned = false;
  PROCESS_INFORMATION serverProcess{};
};

constexpr uint32_t kGuiWidth = 1200;
constexpr uint32_t kGuiHeight = 800;

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

  // Many hosts (Reaper included) call destroy()/create() on every GUI
  // window close/reopen, not just on real plugin teardown -- despite the
  // CLAP docs describing destroy() as "when done with the gui". If we
  // already have a live environment (and, transitively, controller/webview
  // -- see GuiDestroy below, which no longer tears these down), reuse it
  // instead of standing up a second WebView2 instance. The sandbox page's
  // JS state (including its own Web Audio playback, which is how audio
  // actually comes out of this proof today) lives inside that instance --
  // recreating it on every window close was resetting the whole session.
  if (state->environment) {
    return true;
  }

  // Spawn the sidecar as early as possible so its self-extract/startup time
  // overlaps with WebView2 environment creation below, instead of stacking
  // serially in set_parent().
  if (!state->serverSpawned) {
    state->serverSpawned = SpawnSidecarServer(&state->serverProcess);
  }

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

// Deliberately does NOT release environment/controller/webview -- see the
// comment in GuiCreate. Real teardown happens once, in PluginDestroy, when
// the plugin instance itself goes away. Hide the controller instead, which
// is the behavior a window-close should actually have (stop rendering,
// keep the session -- audio, JS state -- alive underneath).
void GuiDestroy(const clap_plugin_t *plugin) {
  auto *state = static_cast<PluginState *>(plugin->plugin_data);
  if (state->controller) {
    state->controller->put_IsVisible(FALSE);
  }
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

  // Reopening the GUI (see GuiCreate/GuiDestroy): the host handed us a new
  // HWND, but the existing controller -- and the live page/JS/AudioContext
  // inside it -- should keep running. Re-parent in place instead of
  // creating a second controller and re-navigating, which would both leak
  // the old one and reset the sandbox session.
  if (state->controller) {
    state->controller->put_ParentWindow(state->parentWindow);
    RECT bounds{0, 0, static_cast<LONG>(kGuiWidth), static_cast<LONG>(kGuiHeight)};
    state->controller->put_Bounds(bounds);
    return true;
  }

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
    if (WaitForSidecarPort(20000)) {
      webview->Navigate(L"http://127.0.0.1:8766/");
    } else {
      webview->NavigateToString(
          L"<body style='background:#12152a;color:#fff;font-family:sans-serif;"
          L"padding:24px'><h1>Sidecar server did not come up</h1>"
          L"<p>Timed out waiting for 127.0.0.1:8766</p></body>");
    }
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
  auto *state = static_cast<PluginState *>(plugin->plugin_data);

  // Real GUI teardown, deferred from GuiDestroy (which now only hides --
  // see the comment there) until the plugin instance itself is going away.
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

  if (state->serverSpawned && state->serverProcess.hProcess) {
    TerminateProcess(state->serverProcess.hProcess, 0);
    CloseHandle(state->serverProcess.hProcess);
    CloseHandle(state->serverProcess.hThread);
  }
  delete state;
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
  // Silent -- this proof is about loading the real sandbox UI, not audio
  // (already proven by soemdsp_minimal.cpp).
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
    "com.soundemote.soemdsp-sandbox-gui-proof-b" SOEMDSP_STRINGIFY(SOEMDSP_BUILD_NUMBER),
    "soemdsp Sandbox GUI Proof (build " SOEMDSP_STRINGIFY(SOEMDSP_BUILD_NUMBER) ")",
    "Soundemote",
    "https://soundemote.io",
    "",
    "",
    "0.0.1",
    "Proof that a raw-CLAP (no JUCE) plugin can spawn the real sandbox "
    "sidecar server and load the real sandbox UI into an embedded WebView2, "
    "inside a real DAW.",
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
