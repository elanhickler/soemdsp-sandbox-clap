# 🎛️ soemdsp-sandbox-clap

A native desktop shell around [`soemdsp-sandbox`](https://github.com/soundemote/soemdsp-sandbox) — the same browser-based modular DSP sandbox, minus the "open a terminal and remember a URL" part — plus a set of raw-CLAP-API plugin prototypes exploring what it looks like for the sandbox itself to run *inside* a DAW, as a real instrument.

This repo is the CLAP-hosting arm of the sandbox project. If you want the browser version, go to [`soemdsp-sandbox`](https://github.com/soundemote/soemdsp-sandbox) directly. If you want to know why CLAP specifically was worth building a whole native fork around, keep reading.

---

## 💌 A love letter to CLAP

I've spent a long time in this world thinking about modulation as a first-class citizen, not an afterthought bolted onto a parameter list. So when I actually sat down and read the CLAP spec — not the marketing copy, the actual `events.h` — I found the thing I didn't know I'd been waiting for.

Here's what got me.

**Every voice has an address, and it's not just a MIDI channel.** CLAP identifies a note with a four-value tuple: `(port, channel, key, note_id)` — "PCKN." Any of those four can be `-1`, meaning "wildcard, matches anything." Want to modulate everything on a channel? Leave channel set, wildcard the rest. Want to reach into *one specific voice*, the exact one that started three seconds ago and has since been joined by four other notes at the same pitch because your patch does unison? That's what `note_id` is for — a persistent identity issued by the host at note-on that survives retriggers, glissandos, and every other way a "key number" alone stops meaning anything the moment you have more than one voice per note. MIDI never had this. VST3's note expression gets you partway there. CLAP built it into the address of every single note and modulation event from day one.

**Modulation and value are two different things, on purpose.** A `clap_event_param_value` *sets* a parameter. A `clap_event_param_mod` *adds* to it — a separate `amount`, layered on top of whatever the base value already is, addressed by the exact same PCKN tuple. That split sounds small until you actually need it: a host can run an LFO or an envelope that owns its own offset completely, independent of whatever the user is doing with a knob at the same time, and the plugin GUI can *show* you the difference — base value here, modulated value riding on top of it — instead of one number that occasionally jumps around for reasons you can't see. Most formats give you one number. CLAP gives you the number and the reason it's moving.

**The host can run the modulation, not just the plugin.** This is the one that actually changed how I think about the format. `clap.voice-info` isn't just a courtesy extension — it's a negotiation: the plugin reports how many voices it's actually using (`voice_count`) and how many it *could* use (`voice_capacity`), specifically "so the host can keep its own voice pool coherent with what the plugin is doing." That sentence is doing a lot of work. It means a host-side modulation matrix — an LFO you built once, outside any plugin, in your DAW or in a patch like this sandbox's own module graph — can reach into an arbitrary polyphonic synth and modulate *individual, currently-sounding notes* of it, without that synth having to natively understand your modulator at all. The synth just has to understand CLAP. The intelligence about *what* modulates *what* can live entirely on the host side. I don't know another mainstream plugin format that hands that much of the modulation architecture to the host as a deliberate, spec-level design choice, rather than something a plugin has to specifically opt into supporting on its own terms.

**And it's granular per parameter, not all-or-nothing.** A plugin doesn't just say "yes, modulation" — it can declare, per parameter, exactly which addressing scope that parameter is modulatable at: globally, per-port, per-channel, per-key, per-note-id, each its own bit (`CLAP_PARAM_IS_MODULATABLE_PER_NOTE_ID`, `_PER_KEY`, `_PER_CHANNEL`, `_PER_PORT`). A filter cutoff might be modulatable per-note (every voice gets its own envelope-driven cutoff) while a master output trim stays global-only, and the plugin says so explicitly instead of the host having to guess or the format forcing one model on everything.

Put together, that's not "CLAP has modulation." That's CLAP treating *which voice, which parameter, at what precision, set versus added* as one coherent addressing problem, solved once, at the protocol level — instead of the usual pile of special cases (MIDI CC is global-or-channel-only; classic VST automation is one lane, one number, no addressing at all; even VST3's note expression is a narrower, more plugin-driven answer to a smaller slice of the same question). It's the kind of design that looks obvious in hindsight and clearly wasn't easy to get to. That's the CLAP I fell for, and it's the reason this fork exists at all.

---

## 🧪 What's actually in this repo

- **`src-tauri/`** — a working Tauri v2 native shell. `main.rs` spawns the sandbox's own local server as a sidecar process, polls until it's actually listening, then opens a native window pointed at it. Same server, same UI, no browser tab required.
- **`clap-plugin/`** — four raw-CLAP-API (no JUCE, no wrapper) proof-of-concept plugins, each proving one load-bearing piece of the eventual "sandbox running natively inside a DAW" architecture:
  - `soemdsp_minimal.cpp` — the smallest possible CLAP plugin. Proves the ABI loads.
  - `soemdsp_dsp_proof.cpp` — links a real `native_modules/` DSP module straight into a CLAP `process()` callback. Proves the sandbox's own native DSP runs correctly *as* a plugin, no browser/WASM involved.
  - `soemdsp_gui_proof.cpp` — embeds a WebView2 control via `clap.gui`. Proves a modern web view can live inside a plugin GUI in a real host.
  - `soemdsp_sandbox_gui_proof.cpp` — the integration proof. Spawns the same sidecar server the Tauri shell uses, and points the embedded WebView2 at it. The actual sandbox interface, running as a plugin GUI, inside a DAW.
- **The rest** — everything else is the full `soemdsp-sandbox` codebase this fork branched from: the module graph, the native DSP modules, `server.py`, all of it. This is a real fork, not a stub.

## 🚀 Building

**Native desktop shell:**

```powershell
cd src-tauri
cargo build          # verify it compiles
cargo run             # spawns the sidecar, opens the sandbox in a native window
```

**CLAP plugin prototypes** (requires clang++, an installed MSVC toolset + Windows SDK for import libs, and the vendored CLAP SDK submodule):

```powershell
git submodule update --init clap-plugin/third_party/clap

scripts\build_clap_plugin.ps1          # soemdsp_minimal
scripts\build_dsp_proof.ps1            # soemdsp_dsp_proof
scripts\build_sandbox_gui_proof.ps1    # soemdsp_sandbox_gui_proof
```

Each installs its built `.clap` into your per-user CLAP folder — rescan plugins in your DAW to pick it up.

## 🗺️ Where this goes next

The CLAP GUI proof loads the real sandbox UI inside a plugin; it doesn't process real audio yet (silent passthrough). The natural next step is wiring the module graph's actual audio output into the plugin's `process()` callback — at which point the sandbox stops being a thing you host CLAP plugins *from*, and becomes a CLAP plugin itself, with the full realtime modulation model above available to whatever DAW it's loaded into.

## 🔗 Related

- [`soemdsp-sandbox`](https://github.com/soundemote/soemdsp-sandbox) — the parent project, browser-based.
- [`docs/WEBUI_CLAP_HOST_PLAN.md`](docs/WEBUI_CLAP_HOST_PLAN.md) — the plan/status doc for the *other* direction: the sandbox hosting third-party CLAP plugins, rather than becoming one.
