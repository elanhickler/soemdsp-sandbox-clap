<div align="center">

# 🎚️ soemdsp-sandbox — Analog Filters

*A fork of [soemdsp-sandbox](https://github.com/soundemote/soemdsp-sandbox),*
*chasing the sound of circuits that were never digital to begin with.*

[![License: Noncommercial](https://img.shields.io/badge/license-noncommercial-blue.svg)](LICENSE)
[![Language: C++/WASM](https://img.shields.io/badge/native-C%2B%2B%20%E2%86%92%20WASM-654ff0.svg)](native_modules)
[![Runtime: Vanilla JS](https://img.shields.io/badge/runtime-vanilla%20JS-f7df1e.svg)](public)
[![Status: Research](https://img.shields.io/badge/status-research-orange.svg)](#)
[![Focus: Analog Filters](https://img.shields.io/badge/focus-analog%20filters-654ff0.svg)](#)

</div>

---

## 📖 Contents

- [Why analog filters](#-why-analog-filters)
- [What makes them hard to get right in software](#-what-makes-them-hard-to-get-right-in-software)
- [Filters on the list](#-filters-on-the-list)
- [Listen & watch](#-listen--watch)
- [Running it](#-running-it)
- [License](#-license)

---

## 🎛️ Why analog filters

Every classic analog filter is a physical accident wearing a transfer
function. Resistors, capacitors, and transistors doing exactly what physics
demands of them — and what physics demands turns out to sound *incredible*
under stress: self-oscillating resonance, soft-clipping feedback loops,
component drift, asymmetric distortion on the way into saturation. None of
that is a bug. It's the entire reason a Moog ladder filter has a personality
and a textbook biquad doesn't.

This fork exists to chase that personality in `soemdsp`'s native C++/WASM
modules — not by approximating the *sound* from the outside, but by modeling
the *circuit* closely enough that the personality falls out on its own.

---

## 🧪 What makes them hard to get right in software

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

---

## 🎚️ Filters on the list

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

This table is the honest state of things: a target list, not a changelog.
Each filter gets the same treatment already proven out elsewhere in
`soemdsp-sandbox` — native C++ compiled to WASM, verified against the real
compiled artifact (not just a JS mirror) before it's wired into the graph.

---

## 🎧 Listen & watch

*(Placeholder links below — real recordings and demo videos go here once
they exist.)*

| Filter | Audio example | Video demo |
|---|---|---|
| Moog Ladder | [Google Drive — TBD](https://drive.google.com/drive/folders/REPLACE_ME_MOOG_LADDER_AUDIO) | [YouTube — TBD](https://youtube.com/watch?v=REPLACE_ME_MOOG_LADDER_DEMO) |
| Diode Ladder | [Google Drive — TBD](https://drive.google.com/drive/folders/REPLACE_ME_DIODE_LADDER_AUDIO) | [YouTube — TBD](https://youtube.com/watch?v=REPLACE_ME_DIODE_LADDER_DEMO) |
| Sallen-Key | [Google Drive — TBD](https://drive.google.com/drive/folders/REPLACE_ME_SALLEN_KEY_AUDIO) | [YouTube — TBD](https://youtube.com/watch?v=REPLACE_ME_SALLEN_KEY_DEMO) |
| State-Variable Filter | [Google Drive — TBD](https://drive.google.com/drive/folders/REPLACE_ME_SVF_AUDIO) | [YouTube — TBD](https://youtube.com/watch?v=REPLACE_ME_SVF_DEMO) |
| Twin-T Notch | [Google Drive — TBD](https://drive.google.com/drive/folders/REPLACE_ME_TWIN_T_AUDIO) | [YouTube — TBD](https://youtube.com/watch?v=REPLACE_ME_TWIN_T_DEMO) |
| Discrete Multimode Filter | [Google Drive — clean filter, hot growl](https://drive.google.com/file/d/1E3-sMArwa7t_eC6wMtEOVAn5BaVc_leS/view?usp=drive_link) | [YouTube — TBD](https://youtube.com/watch?v=REPLACE_ME_DISCRETE_MULTIMODE_DEMO) |
| Simultaneous LP/HP Filter | [Google Drive — audio demo](https://drive.google.com/file/d/1v6cj6S2RXMOlhOBtbkLipTRUmtfrA46H/view?usp=drive_link) | [YouTube — TBD](https://youtube.com/watch?v=REPLACE_ME_SIMULTANEOUS_LPHP_DEMO) |
| Switchable Third-Order Filter | [Demo 1](https://drive.google.com/file/d/1bhXlDZkRRuVh6U2f-yfDGbNIiGXiXShG/view?usp=drive_link) · [Demo 2](https://drive.google.com/file/d/1n_9JrZ-zFQ6GQ_a3WGlaKEBpWaulGuDD/view?usp=drive_link) · [Demo 3](https://drive.google.com/file/d/17c3guemmtnHMpqAFP10LeAs0udspJS4r/view?usp=drive_link) · [Demo 4](https://drive.google.com/file/d/1qEJnqQwlNJC80FcRapuWH1bSFhWHdRDQ/view?usp=drive_link) | [YouTube — TBD](https://youtube.com/watch?v=REPLACE_ME_SWITCHABLE_THIRD_ORDER_DEMO) |

---

## ▶️ Running it

```powershell
# Requirements: Python 3, a modern browser. No package install needed.

git clone https://github.com/elanhickler/soemdsp-sandbox-analog-filters.git
cd soemdsp-sandbox-analog-filters

python server.py
# open http://127.0.0.1:8765

python scripts\smoke_test.py
```

---

## 📄 License

Source-available for noncommercial use only, same as upstream. Commercial use
requires a separate written commercial license from Soundemote. See
[`LICENSE`](LICENSE).

<div align="center">

*Chasing circuits that were never digital to begin with.*

</div>
