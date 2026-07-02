# soemdsp-sandbox

## Live Demo: http://soundemote.io/sandbox

Browser sandbox for trying `soemdsp` patching, generated artifacts, waveform
views, Render Sample, and Live Audio.

## Aliasing wars: the Surge Oscillator

This branch (`aliasing-wars`) is a dedicated workspace for anti-aliased
oscillator work, starting with `native_modules/surge_oscillator` — a
saw/square/tri/sine oscillator with hard sync.

**The problem.** Hard sync forces a slave oscillator's phase back to 0 every
time a master signal crosses zero going up. That forced reset is a
discontinuity injected mid-waveform, and rendering it naively (just snapping
`phase = 0`, with no correction) aliases badly — the classic harsh, digital
buzz under a sync sweep.

**The fix, in two parts:**

1. **PolyBLEP correction reused, not reinvented.** This sandbox's existing
   `polyblep.cpp` module already band-limits ordinary cycle wraps with a
   PolyBLEP correction. A sync-forced reset and a natural wrap are the same
   kind of event from the waveform function's point of view — phase lands
   near 0 — so `surge_oscillator.cpp` reuses the identical
   `polyBlep`/`polyBlepSquare`/triangle-integrator functions unchanged. Every
   reset, sync-forced or natural, gets band-limited for free.
2. **Sub-sample sync timing.** Sync input is read once per sample, but a real
   zero-crossing can happen anywhere within that sample. Instead of always
   resetting to exactly `phase = 0` (which quantizes sync timing to the
   sample rate and adds its own jitter/aliasing at high sync ratios), the
   module linearly interpolates the crossing time within the sample and
   starts the new cycle already `frac` of the way in — the same idea Surge
   and other analog-modeling synths use for sync-aware oscillators.

**Verified, not assumed.** The compiled `.wasm` is tested against a
Python + `wasmtime` harness exercising the real artifact directly (27
assertions: pool exhaustion, waveform selection, level scaling, edge-triggered
sync detection, and — the part that actually matters — proof that early vs.
late sync crossings within the same sample produce measurably different
output, confirming the sub-sample interpolation is doing real work and not a
no-op).

**Ports:** `0.1V/Oct` (pitch) and `Sync` (audio-rate signal; a rising
zero-crossing triggers the reset) in; `Out` (the selected waveform), `Saw`,
`Square`, `Tri`, `Sine` (always-on taps, like `polyblep.cpp`'s convention),
`Synced` (a one-sample-wide pulse on the sample where a sync reset fired,
for chaining/visualizing), and `Internal Sync` (the built-in master
oscillator's raw signal, for inspection) out. Native C++/WASM with a JS
fallback, wired into both the offline evaluator and the realtime audio
worklet.

**Built-in sync source.** Patching a real oscillator into `Sync` still
works, but most hard-sync sweeps don't need a second module just to get
one — the oscillator owns its own internal master oscillator (`Sync Freq`,
0–20000 Hz, same range as the audible `Frequency`). With nothing patched
into `Sync`, the internal oscillator's zero-crossings drive the exact same
sub-sample-interpolated reset path external audio would — a self-contained
hard-sync sweep with two knobs and zero patch cables. Patch something into
`Sync` and it takes over completely; the internal oscillator is a
convenience default, not an extra mandatory step.

## Alias-free oscillator study: the DSF technique

Studied `C:\Users\argit\Documents\_PROGRAMMING\soemdsp\include\soemdsp\oscillator\DSFOscillator.hpp`
(Walter Hackett's alias-free oscillator) as a second angle on the aliasing
mission, distinct from PolyBLEP.

**The core idea is fundamentally different from PolyBLEP.** PolyBLEP starts
from a naive discontinuous waveform (a hard saw/square edge) and *corrects*
the discontinuity after the fact with a band-limited step function. DSF
(Discrete Summation Formula) synthesis never generates the discontinuity in
the first place — it computes the waveform directly from a **closed-form
trigonometric sum** of a bounded number of harmonics (`numPartials_ =
Nyquist / frequency`, recalculated on every frequency change). Because the
partial count is derived from the Nyquist limit, the waveform is alias-free
*by construction* — there's nothing above Nyquist to alias, rather than
something being suppressed after the fact.

**What's in the file:**
- `DSFOscillatorBase` — shared machinery: a phase accumulator (`calculateState()`),
  a leaky integrator (`leak_`) that fades in the amplitude-adjusted output
  over time (looks aimed at taming attack transients), and a `Wire`-based
  parameter system (`pointTo()`/`slave()`) that lets multiple oscillator
  instances share phase and morph state — a lightweight master/slave
  patch-cable primitive, conceptually similar to this sandbox's node wires
  but scoped to parameter sharing rather than the whole graph.
- `DSFOscillatorSineSaw` — continuously morphs sine → saw via a single
  `morph_` parameter (0–1), which reshapes a `k_`/`k2_`/`k42_` coefficient
  set feeding the closed-form DSF sum.
- `DSFOscillatorSineSquare` — same idea, sine → square, with its own
  coefficient derivation and partial-count halving (`/ 2.0`).

**The file is honest about its own problems** — the header comment block
lists them directly: attack causes an amplitude spike, volume is
inconsistent across `morph_` and across frequency, harmonics visibly "click"
in and out as frequency rises (consistent with `numPartials_` changing in
integer-ish steps with no smoothing between values), the saw/square volumes
don't match each other, and square gets dull at low frequency. None of these
are aliasing bugs — DSF's alias-free guarantee holds regardless — they're
amplitude-normalization and transient issues layered on top of a
mathematically sound core.

**Takeaway for this mission:** PolyBLEP (what Surge Oscillator uses) and DSF
solve the same problem from opposite directions — correct the edge vs. never
create the edge — and the tradeoffs are different too: DSF needs a live
partial-count recalculation per frequency change (cheap, but is exactly
where this implementation's harmonic "clicking" comes from), while PolyBLEP
needs a correction at every phase discontinuity, natural or sync-forced,
which is what `surge_oscillator.cpp` already does. A DSF-based module here
would be a genuinely different oscillator, not a redundant one — noted as
a real option for future work, not built in this pass.

## License

This repository is source-available for noncommercial use only. Commercial use
requires a separate written commercial license from Soundemote. See
[`LICENSE`](LICENSE).
