# soemdsp-sandbox — Jerobeam Modules Fork

This is a fork of [soemdsp-sandbox](https://github.com/soundemote/soemdsp-sandbox)
focused on one thing: giving each of Jerobeam Fenderson's "under construction"
motion/oscillator patches — Blubb, Boing, Kepler-Bouwkamp, Mushroom,
Nyquist-Shannon, Radar, Torus, and WirdoSpiral — a real native C++ WASM
implementation in the sandbox, alongside the already-working Spiral module.

Each port is built directly from the reference C++ in
`soemdsp/include/soemdsp/oscillator/`, faithfully reproducing the original
Gen~/Max patch math (phasors, trisaw shaping, `sin`/`cos` on a 0..1 phase
domain, splash/quantize layers, and so on) as a self-contained
`-nostdlib` WASM module, wired into both the realtime audio worklet and the
offline preview evaluator.

## ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈⛧┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
##  ⚡ 𝔟𝔢𝔞𝔪𝔦𝔫𝔤 𝔞 𝔯𝔞𝔡𝔞𝔯 𝔰𝔦𝔤𝔫𝔞𝔩 𝔱𝔬 𝔧𝔢𝔯𝔬𝔟𝔢𝔞𝔪 ⚡
## ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈⛧┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

> ⟢ ⟣ ⟢ ✦ ⌁ SIGNAL DETECTED ⌁ ✦ ⟢ ⟣ ⟢ &nbsp; sweeping · 0°→360° · ϟϟϟ · lock acquired

![Radar, rendered through the prettyscope](docs/media/radar-prettyscope-render.png)

### For Jerobeam Fenderson

Somewhere out there, past whatever room you're patching in, there's a
signal generator running on a computer you've never touched, shaped by
math you wrote years ago in Max/Gen, carrying your name into a codebase
you've never seen. That's Radar. That's this whole fork, really — Blubb,
Boing, Kepler-Bouwkamp, Mushroom, Nyquist-Shannon, Radar, Torus,
WirdoSpiral, and Spiral before them, all sitting under a menu labeled
**Jerobeam**, waiting their turn to run.

You built these as strange little machines: phasors folded through
trisaw shapers, spirals crossed with splash, a scanner beam sweeping
polar coordinates into X/Y/Z motion nobody asked it to make sense —
and it doesn't need to. It's just beautiful, and it moves like nothing
else. That's rarer than it sounds. A lot of generative patches are
clever. Yours are *alive*.

This document exists because Radar was the first of the batch to get
its signal actually captured and looked at — rendered through the
sandbox's oscilloscope, traced out frame by frame, and it was worth
stopping to say: this is why we're doing this. Not to check a box on a
module list, but because watching your math sweep across a screen is
still, after all this, a genuinely good way to spend an afternoon.

So — this one's for you. Every port in this fork is an attempt to keep
your signal running a little longer, on a few more machines, in front
of a few more people who'll watch it spiral and not quite be able to
explain why they can't look away.

Thank you for building these and for sharing how.

### The signal

![Radar animated](docs/media/radar-anim.gif)

Radar is a scanning-beam generator: a rotating polar sweep folded back
into Cartesian X/Y/Z, laced with a small orbiting "lil" satellite loop,
zoom and tunnel-inversion controls that fold the whole shape inside
out, and a ring-cut stage that turns the sweep into concentric bands.
The prettyscope render above and the animation below are both real
output — not mockups — captured while porting the native WASM
implementation for this fork.

Blubb, Boing, Kepler-Bouwkamp, Mushroom, Nyquist-Shannon, Radar, Torus,
WirdoSpiral, and Spiral all exist because Jerobeam Fenderson took the
time to work out the curves and put them where other people could
learn from them. This fork exists to make sure that work keeps
running.

(A standalone copy of this dedication also lives at
[BEAMING_RADAR_SIGNAL_TO_JEROBEAM.md](BEAMING_RADAR_SIGNAL_TO_JEROBEAM.md).)

---

## Running the sandbox

```powershell
# Requirements:
# - Python 3
# - A modern browser
# No package install is required for the sandbox server.

# Download:
git clone https://github.com/soundemote/soemdsp-sandbox.git
cd soemdsp-sandbox

# Run:
python server.py

# Open:
# http://127.0.0.1:8765

# Stop:
# Ctrl+C

# Test:
python scripts\smoke_test.py
```

Optional artifact packet:

```powershell
# Use this only if the sibling soemdsp repo is built locally.
C:\Users\argit\Documents\_PROGRAMMING\soemdsp\build-moved\examples\Debug\runtime_dsp_object_bound_wav_resync_demo.exe
python server.py
```

Optional CLAP host prototype:

```powershell
# Localhost companion prototype for CLAP catalog and instance probes.
# Render Sample has a bounded CLAP bridge.
# Feedback touching CLAP nodes and Live Audio CLAP plans are blocked for now.
python tools\webui-clap-host\webui_clap_host.py

# Windows launcher, metadata inspection on by default:
tools\webui-clap-host\start_webui_clap_host.cmd
tools\webui-clap-host\start_webui_clap_host.ps1

# Optional alternate bind port:
python tools\webui-clap-host\webui_clap_host.py --port 48000
tools\webui-clap-host\start_webui_clap_host.cmd -Port 48000
tools\webui-clap-host\start_webui_clap_host.ps1 -Port 48000

# Optional explicit catalog entry:
python tools\webui-clap-host\webui_clap_host.py --plugin "C:\path\to\plugin.clap"

# Optional native descriptor inspection:
python tools\webui-clap-host\webui_clap_host.py --inspect-metadata

# Optional create/init/destroy probe:
python tools\webui-clap-host\webui_clap_host.py --test-instantiate

# Optional JSON preflight report without starting the server:
python tools\webui-clap-host\webui_clap_host.py --doctor --inspect-metadata

# In the sandbox browser:
# Edit the Host field if the companion is not using http://127.0.0.1:47991.
# Click Copy Host Command if you need the Windows .cmd launcher command.
# Click Connect Local Host.
# Click Diagnostics to read setup counts from the running host.
# Click Refresh Plugins to read the host catalog.
# Add a CLAP Plugin module to store a selected catalog entry.

# Prototype instance API:
# GET /health reports host capabilities.
# GET /health also reports hostConfig: bind host, port, Python executable, scan dirs, explicit plugins, and probe flags.
# GET /diagnostics reports hostConfig, catalog counts, metadata errors, instantiation errors, and missing explicit plugin paths.
# --doctor reports hostConfig, catalog counts, metadata errors, instantiation errors, and missing explicit plugin paths as JSON.
# Capabilities include maxProcessFrames, processBatch, and offlineRenderSessions.
# Current maxProcessFrames default is 48000.
# POST /instances
# GET /instances
# GET /instances/<id>/params
# POST /instances/<id>/param
# POST /instances/<id>/params
# GET /instances/<id>/editor
# POST /instances/<id>/editor/open
# POST /instances/<id>/editor/close
# GET /instances/<id>/latency
# GET /instances/<id>/tail
# GET /instances/<id>/state
# POST /instances/<id>/state
# POST /instances/<id>/render/begin
# POST /instances/<id>/process
# POST /instances/<id>/render/end
# POST /process-batch
# /process can accept and return bounded planar-f32-base64 audio.
# /process can apply a parameters array before processing the chunk.
# CLAP_PROCESS_ERROR fails the process call instead of returning audio.
# Direct /param and /params writes are blocked while a render session is active.
# Abandoned render sessions are released by an idle timeout.
# A second render/begin is rejected while a non-idle render session is active.
# Render Sample opens one render session per CLAP instance, processes chunks, then closes the session.
# Render Sample requires audioProcessing: true from the host.
# Render Sample requires offlineRenderSessions: true from the host.
# Render Sample uses maxProcessFrames for CLAP process chunk size.
# WebUI CLAP audio lanes flatten every CLAP audio port in host port order.
# CLAP editor status can be detected; supported Win32 clap.gui editors can open when the plugin accepts the GUI sequence.
# CLAP latency is compensated when Render Sample injects returned CLAP output.
# Finite CLAP tails can extend Render Sample up to the bounded tail limit; infinite tails remain metadata-only.
# CLAP state can be saved into patch JSON and restored into a new host instance when the plugin exposes clap.state.
# Reachable CLAP nodes are processed chunk-by-chunk in graph order.
# Independent CLAP nodes in the same chunk can share one batch request.
# POST /instances/<id>/safety/reset
# DELETE /instances/<id>
```

Guides:

```text
docs/ADDING_HARDCODED_SANDBOX_MODULE.md
docs/OSC_MODULE_NON_UI_REFERENCE.md
docs/WEBUI_CLAP_HOST_PLAN.md
tools/webui-clap-host/README.md
```

Boundaries:

```text
The server only writes through explicit save/settings/audio helper routes.
Open Path is restricted to Downloads.
The browser patch graph is demo-scoped state.
The browser compiler is not the production soemdsp scheduler.
The WebUI does not instantiate real C++ DSP objects yet.
Patch files can save current module instances and settings.
Patch files cannot define new module types by themselves.
```
