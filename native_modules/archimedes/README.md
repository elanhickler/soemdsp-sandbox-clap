# 🥧 Computing π for Free — the Archimedes Oscillator ⚙️

## Live Demo: http://soundemote.io/sandbox

A 2-cycle integer engine uses **symplectic integration** and **dithered noise**
to spit out clean sine/cosine pairs *and* compute π — all without a single
floating-point op in the hot path. 🚀 Introduce a little noise to break the
rigid integer grid, average over thousands of cycles, and high-precision π
falls straight out of the system's own clock. Named for Archimedes, who first
cornered π by averaging polygons — this does the same trick with dithered
clock steps. 🏛️

## 🎡 Core Mechanism

By using a **Symplectic Euler Integrator** — an integration scheme that
*preserves the system's energy* — a raw integer bit-shift engine generates
perfect sine/cosine pairs in just **2–3 CPU cycles**. ⚡ The math is nothing
but shifts, adds, and one multiply:

```
x -= (y * phaseInc >> 16) + dither;   // sine  state
y += (x * phaseInc >> 16);            // cosine state
```

Because the two updates feed each other (the *new* `x` is used to update
`y`), energy is conserved and the oscillator never spirals in or blows up — it
just orbits forever. 🌀 And here's the fun part: the time it takes to sweep a
**half-cycle is exactly π**, so counting clock steps *is* measuring π. 🥧

## 🔁 Why We Must Average Multiple Cycles

A single digital loop **can't** resolve the fractional digits of π — it's stuck
counting whole integer steps (3141 steps... or 3142 steps, never 3141.59 😅).

The fix is aggregation. Add up the total steps over thousands of cycles and
divide by the number of zero-crossings:

```
π ≈ average(total_steps / zero_crossings)
```

Averaging turns a coarse integer counter into a **highly precise estimate**,
overcoming the fundamental graininess of discrete digital time. ⏱️ The longer
you let it run, the more digits you earn. 📈

## 🎲 The Crucial Role of Noise (Dithering)

Here's the counter-intuitive magic ✨: injecting a *tiny, uniform noise floor*
directly into the feedback step acts as **stochastic resonance**. That
randomized jitter makes the wave **"shiver"** across the digital grid — and
that shiver is exactly what lets the time-average resolve the *fractional*
steps a static integer loop could never see. 🔬

The dither does double duty:

- 🧹 **Kills truncation error** — the systematic bias from rounding every step
  down to an integer averages out to zero.
- 🔒 **Breaks limit cycles** — without noise, integer feedback loops can lock
  into short repeating patterns; the jitter keeps the orbit exploring, which
  paradoxically makes the *averaged* output **cleaner**, not dirtier.

## 🎛️ Settings Conglomerates (Profiles)

Archimedes ships three tuned "conglomerate" profiles that trade compute for
precision — pick one by setting the base sample-rate shift:

| Profile | `dtShift` | Character |
|---|---|---|
| 🏎️ **Wavetable Emulator** | 10 | Ultra fast, register-only |
| ⚖️ **Fast Sin** | 12 | Balanced precision & performance |
| 🎯 **Standard std::sin()** | 16 | Hyper-resolution, high precision |

Higher `dtShift` means a finer clock, more steps per cycle, and more π digits
resolved from the average.

## 🎚️ Phase Control API

Two ways to steer the oscillator in real time, both amplitude-preserving:

- `set_phase(θ)` — 🎯 jump instantly to an **absolute** phase angle. Warp to
  π/2 and the sine reads its peak immediately.
- `shift_phase(Δ)` — ↪️ offset **relative** to wherever the wave currently is,
  reconstructed from the running `atan2(x, y)`.

## 🧰 Native C++, freestanding WASM

Like the BLIT module, Archimedes is a self-contained C++ file with **no
standard library dependencies** — even `sqrt`, `sin`, and `atan2` (used only
by the phase API) are implemented locally. It compiles to a freestanding
`wasm32` module with **zero imports**, exposing only `memory` and the
`soemdsp_archimedes_*` functions. 🪶 A lightweight reference for exposing a
clean oscillator to the sandbox's native-module bridge with no runtime baggage.

## 📌 Ports & Taps

`0.1V/Oct` (pitch) in; `Sine`, `Cosine`, and a live **π readout** tap out —
plus `step`, `set_profile`, `set_frequency`, `set_amplitude`, and the phase
API. Native C++/WASM, wired into the offline evaluator and the realtime audio
worklet.

> 🥧 **The takeaway:** most oscillators just make sound. This one makes sound
> *and* hands you π as a free byproduct of keeping time. Not because π was
> programmed in — but because a half-cycle of a circle simply *is* π, and if
> you count carefully enough, the number was hiding in the clock all along. 🏛️✨

## License

This repository is source-available for noncommercial use only. Commercial use
requires a separate written commercial license from Soundemote. See
[`LICENSE`](LICENSE).
