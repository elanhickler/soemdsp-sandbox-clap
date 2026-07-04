# 🎛️ soemdsp-sandbox

**A browser-based modular audio synthesis sandbox** — patch together native
C++/WASM DSP modules, watch waveforms render live, and hear the result
instantly. No install, no build step, just a Python file server and a
browser.

### 🌐 Live Demo — [soundemote.io/sandbox](http://soundemote.io/sandbox)

---

## ✨ What's inside

- 🔊 **Live Audio** — patch modules together and hear them in real time via
  an AudioWorklet-driven graph.
- 🧩 **Native DSP modules** — oscillators, filters, envelopes, reverbs, and
  chaos generators compiled from C++ to WASM.
- 📈 **Render Sample** — bounce a patch to audio and inspect the waveform.
- 🔌 **CLAP host prototype** — a localhost companion that can probe and host
  real CLAP plugins inside the sandbox graph.

---

## 🚀 Quick start

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

<details>
<summary>⚙️ Optional artifact packet</summary>

```powershell
# Use this only if the sibling soemdsp repo is built locally.
C:\Users\argit\Documents\_PROGRAMMING\soemdsp\build-moved\examples\Debug\runtime_dsp_object_bound_wav_resync_demo.exe
python server.py
```

</details>

<details>
<summary>🎚️ Optional CLAP host prototype</summary>

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

</details>

---

## 🎚️ Analog filters research

Ported over from the [Analog Filters](https://github.com/elanhickler/soemdsp-sandbox-analog-filters)
fork — modeling the *circuit*, not the sound, so the self-oscillating,
saturating personality of classic analog filters falls out on its own.

Every classic analog filter is a physical accident wearing a transfer
function. Resistors, capacitors, and transistors doing exactly what physics
demands of them — and what physics demands turns out to sound *incredible*
under stress: self-oscillating resonance, soft-clipping feedback loops,
component drift, asymmetric distortion on the way into saturation. None of
that is a bug. It's the entire reason a Moog ladder filter has a personality
and a textbook biquad doesn't.

### 🧪 What makes them hard to get right in software

A naive digital filter is linear, time-invariant, and stable by construction.
A real analog filter is often none of those things, which is exactly what's
being chased here:

- **Nonlinearity.** Real transistor ladder stages saturate. A textbook
  digital filter doesn't, unless you deliberately put a nonlinearity back in
  — and where you put it changes the sound completely.
- **Self-oscillating resonance.** Push feedback gain high enough on a real
  Moog ladder and it turns into an oscillator, cleanly, on purpose. Getting
  a digital model to do the same without exploding numerically is the whole
  game.
- **Zero-delay feedback.** Naive digital translations of analog feedback
  loops introduce a one-sample delay that isn't in the real circuit, which
  audibly changes the resonant behavior. Topology-preserving transform (TPT)
  / zero-delay-feedback (ZDF) techniques exist specifically to close that gap.
- **Frequency-dependent nonlinear behavior.** Saturating a signal *before*
  filtering it sounds different from saturating *after* — and real circuits
  often do both, in a loop, simultaneously. That interaction is where a lot
  of the "expensive analog gear" character actually lives.
- **Aliasing from the nonlinear stages.** Any saturation stage generates
  harmonics; without oversampling, those harmonics fold back down as
  aliasing. Getting the nonlinear modeling right and getting the aliasing
  under control are two separate problems that have to be solved together.

### 🌸 The Flower Child family

Ported from an older `soemdsp` codebase (`FlowerChildFilterCore.h`) —
resonant, self-oscillating feedback designs, not passive filters in the
textbook sense. Each is a native C++/WASM module, verified against the real
compiled artifact with a Python+wasmtime harness before wiring:

| Module | Modes | Notes |
|---|---|---|
| `flower_child_filter` | Clean, Dirty, Rev3, Downsampled | The original two revisions plus an ellipsoid-oscillator variant and a sample-and-hold aliasing variant |
| `rsmet_filter` | LP6/12/18/24, HP6/12/18/24, BP6, BP12 (10) | A ladder filter with a tanh soft clipper and noise injection stage |
| `yellowjacket_filter` | — | Feedback ellipse-oscillator filter, grindy, easily produces square-wave-like output. Its resonance has a chaotic, bubbly character reminiscent of a Polivoks-style filter |
| `superlove_filter` | LP18, LP24, HP6, BP6 | Trisaw-oscillator feedback resonator, warm and stably self-oscillating |
| `chaotic_phase_locking_filter` | — | Direct feedback ellipse-waveshaper resonator (no oscillator phasor) |
| `resonator_filter` | Sinusoid, Triangle, Sawtooth | Dual-phasor FM feedback resonator — each mode's *resonance itself* is visibly and audibly shaped like its namesake, not just a generic buzz with a different label. See below |
| `human_filter` 🚧 | BP6, LP6, LP12 | Dual-phasor feedback network shaped by a bell filter — marked under construction; the original's feedback-filter wrapper (Q, center frequency) wasn't recoverable from the accessible codebase, so a documented Q=1/1kHz default stands in |

Every shaping curve in these (resonance-vs-frequency, FM/PM crossfade, etc.)
is reproduced from the real `soemdsp::utility::Graph` /
`soemdsp::curve::Rational` source, not approximated — a generic N-node graph
evaluator was built once and reused across all of them.

**What makes Flower Child Filter itself interesting:** its Dirty/Rev3-style
oscillators don't crossfade between a sine and a square wave with two
separate waveshapers — they use one continuous
[`ellipse()`](https://github.com/soundemote/oldcode/blob/main/old%20stuff%20se_framework/SynthesizerComponents/oscillator/waveshapes.cpp)
function that morphs a sine into a square (and everywhere in between) as a
single parameter moves, driven directly by resonance. That's the actual
mechanism behind why turning resonance from clean to hot doesn't feel like
switching between two different sounds — it's one continuous, stable
waveshape sweep behind the feedback loop, which is exactly why it sounds and
behaves like a real overdriven self-oscillating filter rather than a
digital effect being crossfaded in.

**SuperLove's HP6 mode in particular** screams — driven hard, it produces
clean, beautiful square waves and is generally one of the hottest-sounding
highpass filters in this set.

**Resonator Filter deserves more than "dual-phasor FM feedback resonator."**
What actually makes it interesting is that each of its three modes doesn't
just change the *timbre* of the resonance — it visibly reshapes what the
resonance *is*:

- **Sawtooth mode's** resonance is literally sawtooth-shaped when you look
  at the waveform, not just "a buzzier tone."
- **Triangle mode's** resonance is literally triangular — a different
  geometric shape entirely, not a filtered version of the same shape.
- **Sinusoid mode's** resonance looks like an overly rounded sine wave, and
  that rounding is exactly why it sounds bubbly rather than smooth — a kind
  of sinusoidal fractal quality that comes directly from the shape, not from
  added modulation.

That's a genuinely novel result for a feedback resonator: the *shape* of the
self-oscillation is the mode, not a label on top of the same underlying
waveform. Measured directly from the real compiled `.wasm` (driven with a
220Hz tone at resonance 0.7–0.85, steady state):

<div align="center">
<img src="docs/assets/resonator-waveforms.png" alt="Three stacked waveform plots: Sinusoid mode showing a rounded sine, Triangle mode showing a triangular shape with jitter, and Sawtooth mode showing an asymmetric ramp-and-decay shape" width="85%"/>
</div>

### 📈 Characterizing behavior empirically

Here's the thing that makes this whole family hard to reason about from the
code alone: **they're feedback oscillators, not fixed filters.** A plain
lowpass has one transfer function you can write down. These don't — the
"curve" depends on resonance, input level, and the knob position feeds back
into the oscillator's own pitch. There's no formula to graph.

So instead of guessing, the plan is to *measure*: feed a compiled module a
swept sine tone through the same Python+wasmtime harness already used to
verify it, record output RMS per frequency, and plot the result. This turns
"what does turning this knob actually do" from a guess into a chart.

**First result, `yellowjacket_filter`** (see the module's own naming
confusion first — `Yellowjacket_BP` in the original code, but the filter
tap it actually uses is `LP_6`, a lowpass): swept a sine tone from 20Hz to
14kHz through the compiled `.wasm` at three Frequency-knob settings,
resonance fixed at 0.3:

- **Knob 0.2** — flat response (~0.616 RMS) across the whole sweep. The
  self-oscillation is loud enough to drown out whatever's coming in; the
  input frequency barely matters.
- **Knob 0.5** — behaves like an actual lowpass: loud below ~100Hz, settling
  to ~0.046 above ~400Hz.
- **Knob 0.8** — a genuine resonant peak around 1.2–1.6kHz (~0.21 RMS,
  roughly double its neighbors), falling off on both sides.

<div align="center">
<img src="docs/assets/yellowjacket-response.png" alt="Line chart of Yellowjacket Filter output level versus input frequency (log scale) at three Frequency knob settings. Knob 0.2 is flat. Knob 0.5 slopes down like a lowpass. Knob 0.8 has a clear resonant peak around 1.2 to 1.6kHz." width="85%"/>
</div>

That last point is the answer to "but it sounds like a bandpass in use" —
it does, and now there's a measurement showing exactly where and how much.
The lesson generalizes: for this whole family, "what's the filter curve"
only has an honest answer as a measured, knob-position-dependent chart, not
a static formula — and that's the method to reach for on the rest of the
list below as they get built.

### 🎚️ Filters on the list

| Filter | Status |
|---|---|
| **Moog Ladder** (4-pole transistor ladder, self-oscillating resonance) | 🔲 not started |
| **Diode Ladder** (TB-303-style, asymmetric diode nonlinearity) | 🔲 not started |
| **Sallen-Key** (2-pole op-amp topology, gentler slope) | 🔲 not started |
| **State-Variable Filter** (simultaneous LP/HP/BP/notch outputs) | 🔲 not started |
| **Twin-T Notch** (passive notch, the basis of classic phaser/wah circuits) | 🔲 not started |
| **Discrete Multimode Filter** (parallel 24dB LP / 24dB HP / 12dB BP / 12dB notch outputs, resonance from a feedback loop with an insert point in the path) | 🔲 not started |
| **Simultaneous LP/HP Filter** (one core filter stage driven as a 12dB lowpass and a separate highpass at once, each with its own audio input and level control, prized for a screaming self-oscillating character) | 🔲 not started |
| **Switchable Third-Order Filter** (three cascaded first-order sections, each switchable between lowpass and highpass, a mode switch selecting among four low-pass/band-pass/reversed-band-pass/high-pass combinations, and a voltage-controlled resonance amplifier that can be driven well past the onset of oscillation into chaotic and phase-locked territory, with taps available after each of the three stages) | 🔲 not started |
| **Diode-Controlled LP/HP Pair** (a highpass stage tracking at half rate paired with a lowpass stage tracking at full rate to form a bandpass-like sweep, with frequency set by diode control current rather than a transistor or OTA stage — which naturally narrows the usable sweep range — and matched capacitor pairs tuning the corner behavior) | 🔲 not started |

This table is the honest state of things: a target list, not a changelog.
Each filter gets the same treatment already proven out elsewhere in
`soemdsp-sandbox` — native C++ compiled to WASM, verified against the real
compiled artifact (not just a JS mirror) before it's wired into the graph.

### 🎧 Listen & watch

*(Placeholder links below — real recordings and demo videos go here once
they exist.)*

| Filter | Audio example | Video demo |
|---|---|---|
| Moog Ladder | [File — TBD](https://drive.google.com/drive/folders/REPLACE_ME_MOOG_LADDER_AUDIO) | [Video — TBD](https://youtube.com/watch?v=REPLACE_ME_MOOG_LADDER_DEMO) |
| Diode Ladder | [File — TBD](https://drive.google.com/drive/folders/REPLACE_ME_DIODE_LADDER_AUDIO) | [Video — TBD](https://youtube.com/watch?v=REPLACE_ME_DIODE_LADDER_DEMO) |
| Sallen-Key | [File — TBD](https://drive.google.com/drive/folders/REPLACE_ME_SALLEN_KEY_AUDIO) | [Video — TBD](https://youtube.com/watch?v=REPLACE_ME_SALLEN_KEY_DEMO) |
| State-Variable Filter | [File — TBD](https://drive.google.com/drive/folders/REPLACE_ME_SVF_AUDIO) | [Video — TBD](https://youtube.com/watch?v=REPLACE_ME_SVF_DEMO) |
| Twin-T Notch | [File — TBD](https://drive.google.com/drive/folders/REPLACE_ME_TWIN_T_AUDIO) | [Video — TBD](https://youtube.com/watch?v=REPLACE_ME_TWIN_T_DEMO) |
| Discrete Multimode Filter | [File — clean filter, hot growl](https://drive.google.com/file/d/1E3-sMArwa7t_eC6wMtEOVAn5BaVc_leS/view?usp=drive_link) | [Video — TBD](https://youtube.com/watch?v=REPLACE_ME_DISCRETE_MULTIMODE_DEMO) |
| Simultaneous LP/HP Filter | [File — audio demo](https://drive.google.com/file/d/1v6cj6S2RXMOlhOBtbkLipTRUmtfrA46H/view?usp=drive_link) | [Video — TBD](https://youtube.com/watch?v=REPLACE_ME_SIMULTANEOUS_LPHP_DEMO) |
| Switchable Third-Order Filter | [Demo 1](https://drive.google.com/file/d/1bhXlDZkRRuVh6U2f-yfDGbNIiGXiXShG/view?usp=drive_link) · [Demo 2](https://drive.google.com/file/d/1n_9JrZ-zFQ6GQ_a3WGlaKEBpWaulGuDD/view?usp=drive_link) · [Demo 3](https://drive.google.com/file/d/17c3guemmtnHMpqAFP10LeAs0udspJS4r/view?usp=drive_link) · [Demo 4](https://drive.google.com/file/d/1qEJnqQwlNJC80FcRapuWH1bSFhWHdRDQ/view?usp=drive_link) | [Video — TBD](https://youtube.com/watch?v=REPLACE_ME_SWITCHABLE_THIRD_ORDER_DEMO) |
| Diode-Controlled LP/HP Pair | [File — audio demo](https://drive.google.com/file/d/1fkqbuZDtS1OKaCmWBK-u9vtAbCAzDxhS/view?usp=drive_link) | [Video — TBD](https://youtube.com/watch?v=REPLACE_ME_DIODE_CONTROLLED_LPHP_DEMO) |

---

## 🌆 Supersaw research

Ported over from the [`elanhickler/supersaw`](https://github.com/elanhickler/supersaw)
fork — forked from the
[`aliasing-wars`](https://github.com/elanhickler/soemdsp-sandbox-aliasing-wars)
mission to zoom out from single-oscillator anti-aliasing to the classic
"wall of detuned saws" sound, and to a specific, unusually elegant answer to
the aliasing question that a *stack* of oscillators raises: **pitch
dithering**, from Robin Schmidt's [RS-MET](https://github.com/RobinSchmidt/RS-MET)
project.

### 🎻 Why a supersaw needs its own aliasing story

A single bandlimited sawtooth is a solved problem — that's what
`aliasing-wars` is about. A **supersaw** stacks a whole *choir* of them (7,
15, 31, up to 63 in Soundemote's own implementation), each detuned by a few
cents, each drifting slightly in pitch and phase over time to imitate the
micro-variation of a real string or synth-choir section. That multiplies the
aliasing-mitigation problem by the oscillator count — and multiplies the
*cost* of naive fixes (oversampling scales linearly with voice count; BLEP
tables get expensive fast at 63 simultaneous edges per sample).

Robin Schmidt's answer sidesteps the cost question entirely with a different
trick: **don't correct the aliasing — replace it with noise you'd rather
have.**

### 🎲 Pitch Dithering — RobinSchmidt/RS-MET

- Repo: [RobinSchmidt/RS-MET](https://github.com/RobinSchmidt/RS-MET)
- Author's page: [soundemote.io/robinschmidt](https://soundemote.io/robinschmidt)
- Write-up: [`Notes/Scratch/PitchDithering.md`](https://github.com/RobinSchmidt/RS-MET/blob/work/Notes/Scratch/PitchDithering.md)
- Implementation: [`PitchDitherOscs.h`](https://github.com/RobinSchmidt/RS-MET/blob/work/Libraries/RobsJuceModules/rapt/Generators/PitchDitherOscs.h) / [`PitchDitherOscs.cpp`](https://github.com/RobinSchmidt/RS-MET/blob/work/Libraries/RobsJuceModules/rapt/Generators/PitchDitherOscs.cpp)

The core observation: a digital sawtooth is genuinely alias-free — no
correction needed at all — whenever its cycle length happens to land on an
**exact integer number of samples**. The catch is obvious: only a discrete
set of frequencies satisfy that, and rounding every requested pitch to the
nearest one would mistune everything, worse at higher pitches.

**Pitch dithering's move:** don't round to *one* integer cycle length —
*probabilistically alternate* between integer cycle lengths so that the
*average* comes out exactly right. If the true desired cycle length is
`c = 100.3` samples, alternate between 100-sample and 101-sample cycles
with probabilities `0.7` / `0.3` — the long-run average length is exactly
`100.3`, and every individual cycle rendered is alias-free by construction
(integer length ⇒ no aliasing, just harmonic amplitude reshuffling).

The naive version of this idea has one flaw: the *amount* of resulting
noise depends on how close the desired length is to an integer. Exactly on
an integer → zero noise. Exactly halfway between two integers (`c = xxx.5`)
→ maximum noise. That inconsistency would make the oscillator's character
shift audibly as you play different notes. RS-MET's refinement — the
**3-cycle-length scheme** in `rsPitchDitherOsc` (`c₁ = c₂ − 1`, `c₂`, `c₃ = c₂ + 1`,
each with its own probability) — is specifically constructed so the
*variance* of the injected noise stays constant regardless of how close `c`
is to an integer. The trade of "aliasing artifacts" for "a small, constant,
pitch-independent noise floor" is the whole idea, and — per the write-up —
it survives waveshaping: since the underlying phasor is what's dithered,
not the final waveform, any shape you build on top of that phasor (saw,
square, or an arbitrary waveshaper) inherits the same alias-free property
for free.

**Proof of concept, native module:** [`native_modules/robin_supersaw`](native_modules/robin_supersaw)
(`RobinSupersaw` in the module browser) is a direct, faithful transcription
of `calcCycleDistribution()` / `updateCycleLength()` / `getSamplePhasor()`
from the reference implementation, stacking up to 9 independently-dithered,
detuned voices into a classic wall-of-saws supersaw.

This is a genuinely different philosophy from `aliasing-wars`'s other two
techniques:

| Technique | Idea |
|---|---|
| PolyBLEP (`aliasing-wars`) | Correct the edge, right after it happens |
| DSF (`aliasing-wars`) | Never create the edge — build the waveform from a closed-form harmonic sum |
| Pitch dithering (here) | Let the edge be exactly periodic every single cycle, and hide the pitch error in noise instead of in the spectrum |

For a supersaw specifically, this matters because the cost of pitch
dithering per voice is trivial (an integer-cycle-length phasor plus a tiny
RNG draw), so it scales to dozens of simultaneous detuned voices in a way
that oversampling or per-voice BLEP tables can't match as cheaply.

### 🎹 Soundemote's own Supersaw

Alongside RS-MET's research, Soundemote has its own production supersaw
architecture, `SupersawUnit` / `SupersawMaster` — reference copy checked
into [`docs/reference/Supersaw.hpp`](docs/reference/Supersaw.hpp) (and its
sibling, [`docs/reference/Hypersaw.hpp`](docs/reference/Hypersaw.hpp)) —
built on top of `soemdsp`'s `PolyBLEP` oscillator and RS-MET's `RAPT`
library (bundled under `soemdsp/libs/RSMET`, via `RatioGenerator.h` and
`ArrayTools.h`). This is the "real instrument" layer that a pitch-dithered
or DSF-based unison voice would eventually slot into.

Structurally, `SupersawMaster` drives up to **63** `SupersawUnit` voices,
each one a `PolyBLEP` oscillator plus its own envelope, drift generator,
and vibrato feed. What makes it sound like an *instrument* rather than a
wall of identical detuned saws is the amount of per-voice variation on top:

- **Six detune algorithms** (`Classic`, `Realistic`, `Emotional`, `Chordal`,
  `Linear`, `Exponential`), each a different ratio table generated via
  RS-MET's `RAPT::rsRatioGenerator` (`primePower`, `primePowerDiff`, and
  `linToExp` ratio kinds) — different mathematical relationships between
  voices produce audibly different characters, from "classic" even
  detuning to "chordal" ratios that lean toward consonant intervals.
- **Per-voice drift** — a `FlexibleRandomWalk` nudging each voice's pitch
  independently over time, for the slow, organic wobble a real unison
  section has that a static detune spread doesn't.
- **Vibrato**, switchable **per-voice or per-oscillator** — either the
  whole stack breathes together, or each voice gets its own independent
  vibrato phase and rate for a much wider, less synchronized chorus.
- **Randomized per-voice envelopes** — delay, attack, and release times are
  each drawn per voice on every note-on (`triggerAttack()`), so voices
  don't all fade in and out in lockstep.
- **Phase reset modes** (`Never` / `Legato` / `Always`) and **portamento**
  with a continuously variable linear-to-exponential curve
  (`portamentoStyle_`), plus a **pitch-compensation** curve that scales how
  much drift/vibrato bends pitch as a function of the note's absolute pitch
  (more movement is more audible — and more useful — in different registers).
- **Center/side stereo crossfade** (`getCenterSideAmplitudeValue`) — blends
  between "everything mixed to a fat mono center" and "spread hard across
  the stereo field," rather than a single fixed unison-width knob.

### 🌌 The Synthwave Orchestra

The reason this research bundles both an anti-aliasing thread *and* a
production supersaw architecture is a specific, larger ambition:
Soundemote's plan for a **Synthwave Orchestra** — an instrument that fuses
the analog-synth unison stack (supersaws, arpeggiated sequences, glowing
pads) with a full orchestral palette (strings, brass, choir), aimed at that
retro-futurist "80s synth score meets real orchestra" sound.

![Synthwave Orchestra interface](docs/images/synthwave-orchestra-interface.png)

Getting a supersaw stack that sits *convincingly* next to real orchestral
samples — without either sounding harshly aliased under heavy detune, or
requiring so much oversampling that a 63-voice-per-note instrument becomes
unplayable in real time — is exactly the intersection this research works
out: RS-MET's pitch dithering for cheap, alias-free density at scale, and
Soundemote's existing `Supersaw`/`Hypersaw` voice architecture for the
musical character on top of it.

### 🌀 Hypersaw

A sibling voice architecture to Supersaw (reference copy:
[`docs/reference/Hypersaw.hpp`](docs/reference/Hypersaw.hpp)) — a phase-modulated
bank of sawtooths where every voice is kept confined to a small band of
phases, rather than allowed to drift or randomize freely across the full
cycle. Letting detuned saws roam into arbitrary, uncorrelated phase
relationships is exactly what produces unwanted flanging and phasing as
their relative offsets sweep in and out of alignment — Hypersaw sidesteps
that by design, keeping the phase spread narrow enough that voices stay
in a stable relationship to one another.

📄 Dedicated write-up: *link coming soon*

### 🎼 Additive supersaw (research idea, not yet implemented)

A third, distinct approach worth tracking alongside pitch dithering and
Hypersaw's phase-banding: build the sawtooth **additively** — as an
explicit sum of sine harmonics up to Nyquist — and inject independent
**noise modulation on each harmonic** (small, decorrelated jitter in each
partial's phase and/or amplitude) rather than on the fundamental or the
phase relationship between voices.

This targets the same underlying complaint pitch dithering and Hypersaw
each address in their own way — a supersaw stack that sounds too static,
too perfectly aligned, or harshly beating as voices drift in and out of
phase — but from a different domain entirely. Pitch dithering randomizes
the *fundamental's timing*; Hypersaw constrains the *phase relationship
between voices*; this idea randomizes *each harmonic independently*
within a single additive voice. The result, if it works as intended,
would be a softer, more dispersed, less "laser-etched" character to the
individual sawtooth itself — closer to how a real unison section's
micro-variation lives in the fine spectral detail of each note, not just
in its pitch or its stereo phase spread.

Open questions before this becomes a real module: how much per-harmonic
noise depth is possible before the result stops reading as "a sawtooth"
at all, and whether an explicit oscillator-per-harmonic bank (up to
`Nyquist / frequency` oscillators per voice) is cheap enough to run
per-voice across a 63-voice supersaw stack in real time.

---

## 🍴 Featured forks & experiments

Themed sandbox forks exploring specific DSP ideas — each one a self-contained
detour worth a look:

| Fork | What makes it worth a click |
|---|---|
| 🌊 [**Aliasing Wars**](https://github.com/elanhickler/soemdsp-sandbox-aliasing-wars) | Anti-aliases a hard-sync oscillator with reused PolyBLEP and sub-sample sync timing, proven out via a 27-assertion WASM test harness. |
| 💡 [**Vactrols**](https://github.com/elanhickler/soemdsp-sandbox-vactrols) | Grounds the vactrol envelope modules in real photoconductor physics, backed by actual recordings of hardware vactrols under CV control. |
| 🔢 [**Digital Signals**](https://github.com/elanhickler/soemdsp-sandbox-digital-signals-audio) | Asks what happens if patch wires carry packed bits instead of a continuous voltage — down to an FPGA-inspired LUT Cell module. |
| 📺 [**Phosphor**](https://github.com/elanhickler/soemdsp-sandbox-phosphor) | Rebuilds the scope renderers on real CRT-phosphor decay physics, with a hand-curated gallery of oscilloscope glow references. |
| ⚡ [**Digital Efficient Patch System**](https://github.com/elanhickler/soemdsp-sandbox-digital-efficient-patch-system) | Chases real-time multiplayer patch editing, with a brutally honest, phase-by-phase log of profiling dead ends before finding the actual bottleneck. |
| 🐾 [**Creatures**](https://github.com/elanhickler/soemdsp-sandbox-creatures) | A patchable virtual pet that eats your audio signal and reacts with eight moods, from Peaceful to Meltdown on a harsh clipped signal. |
| 🎚️ [**Analog Filters**](https://github.com/elanhickler/soemdsp-sandbox-analog-filters) | Models classic analog filter circuits (Moog ladder, ZDF/TPT feedback) closely enough that their self-oscillating, saturating personality falls out for free. |
| 🧵 [**SIMD**](https://github.com/elanhickler/soemdsp-simd) *(in progress)* | A methodical dig into the parameter/smoothing architecture, landing measured wins like a 1.5x faster reverb from skipping settled-parameter recomputation. |

---

## 📄 License

This repository is source-available for noncommercial use only. Commercial
use requires a separate written commercial license from Soundemote. See
[`LICENSE`](LICENSE).

---

## 📚 Guides

- [`docs/ADDING_HARDCODED_SANDBOX_MODULE.md`](docs/ADDING_HARDCODED_SANDBOX_MODULE.md)
- [`docs/OSC_MODULE_NON_UI_REFERENCE.md`](docs/OSC_MODULE_NON_UI_REFERENCE.md)
- [`docs/WEBUI_CLAP_HOST_PLAN.md`](docs/WEBUI_CLAP_HOST_PLAN.md)
- [`tools/webui-clap-host/README.md`](tools/webui-clap-host/README.md)

## 🧭 Boundaries

- The server only writes through explicit save/settings/audio helper routes.
- Open Path is restricted to Downloads.
- The browser patch graph is demo-scoped state.
- The browser compiler is not the production soemdsp scheduler.
- The WebUI does not instantiate real C++ DSP objects yet.
- Patch files can save current module instances and settings.
- Patch files cannot define new module types by themselves.
