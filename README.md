# soemdsp-simd

Working branch off [`soemdsp-sandbox`](https://github.com/soundemote/soemdsp-sandbox)
master for parameter/smoothing architecture investigation and native DSP
binding work. Isolated in its own branch + worktree so this stays reviewable
independent of `master`.

Setup, the CLAP host prototype, and the full API reference are unchanged from
master — see [`docs/SANDBOX_REFERENCE.md`](docs/SANDBOX_REFERENCE.md) for
those. This file covers what's specific to this branch.

## Quick start

```powershell
git clone https://github.com/soundemote/soemdsp-sandbox.git
cd soemdsp-sandbox
git checkout soemdsp-simd
python server.py
# open http://127.0.0.1:8765
python scripts\smoke_test.py
```

## What lives here

This branch is where the parameter-domain architecture discovery work is
happening: mapping how raw parameter edits, modulation, smoothing, and native
DSP memory sync actually relate to each other in the live sandbox, and
extracting the real seams one at a time rather than guessing at a framework
up front.

### Landed so far

| Change | What it does |
| --- | --- |
| **App-wide smoother convergence skip** | Ports `soemdsp::filter::SmootherBase::needsSmoothing()` — a settled, unmodulated parameter stops paying for a one-pole recompute every sample, in both the JS evaluator and the realtime AudioWorklet. |
| **Sabrina Reverb CPU fix** | The native reverb was recomputing 14 delay-line offsets every sample regardless of whether anything was moving. Gated behind the same convergence check — measured ~1.5x faster steady-state processing in a direct WASM timing test. |
| **`advanceSabrinaSmoothing` documented as DSP safety smoothing** | A/B diagnostic (native ramp vs. snap-to-target, output-buffer discontinuity measured directly) confirmed `delaySize`/`diffusionSize` genuinely need this ramp for hard-step/bypass paths (patch load, script writes) — 5.5–7.6x larger discontinuity without it. No measurable effect during an already edit-smoothed drag. LFO parameter smoothing here is flagged as conservative legacy behavior, not a confirmed need. |
| **`applySabrinaDspBindingIfDirty` extraction (worklet + evaluator)** | The paramKey dirty-check + `soemdsp_sabrina_reverb_set_params` call — previously an inline block, duplicated in both the realtime worklet and the offline/preview evaluator — is now a named helper in each, so the sample function reads as distinct phases: resolve → bind → execute. Pure extraction, no behavior change. |
| **First real SIMD kernel: Sabrina Reverb diffusion geometry** | WASM SIMD128 (`-msimd128`, `wasm_simd128.h`) vectorizes the 12 diffusion delay lines' offset/LFO-speed recompute (`applyDelayGeometry`) using `f64x2` lanes, 2 delay lines per instruction. See [Working SIMD example](#working-simd-example-sabrina-reverb-diffusion-geometry) below for the full result, including the honest finding that it's *not* a net pipeline win in the common case. |

### Why this is a separate branch

Each of the above was validated independently (smoke tests, live browser
checks, direct WASM A/B measurement) before landing, and deliberately scoped
small — one seam at a time, not a framework rewrite. Keeping this off
`master` means the parameter-domain map below can keep evolving without
putting unfinished architecture work in front of the sandbox's other
concurrent contributors.

### Where this is headed (not yet implemented)

```
ParameterState        — stored raw/base value
ParameterMeta          — range, unit, display, default, smoothing config
EditSmoothingRuntime   — smooths ordinary parameter motion
ModulationCombine      — combines base + routed modulation sources
ParameterReadDispatcher — decides what needs visiting this block/sample
DspBinding             — dirty-checks and syncs resolved values into DSP memory
DspSafetySmoothing     — optional, DSP-local protection against unsafe jumps
DspExecution           — the actual audio processing
```

Nothing above this line is committed as a generic framework — it's a map for
where future scoped extractions (like the ones above) should land, not a
spec for a rewrite.

## Working SIMD example: Sabrina Reverb diffusion geometry

The branch is named `soemdsp-simd`, but no actual SIMD work existed on it
until this section landed — everything before this was parameter/smoothing
architecture work. This is the first (and so far only) real vectorization,
done as a complete, measured example rather than a framework.

**ISA**: WASM SIMD128 (`<wasm_simd128.h>`, `-msimd128`). Confirmed the
toolchain (`clang++ 22.1.6 --target=wasm32`) compiles it cleanly, the
compiled module's `target_features` section tags `+simd128`, and it
instantiates and runs correctly in the actual browser this project targets.

**Kernel**: `applyDelayGeometry`'s loop over the 12 diffusion delay lines
(`kDiffusionCount`) — recomputing each line's read `offset` and LFO
`modSpeed` from the ramped/smoothed parameter values every sample they
change. WASM SIMD128 only has 2 lanes for `double` (no `f64x4`), so the 12
lines batch into 6 pairs via `applyDiffusionGeometryPairSimd`, rather than
groups of 4 — kept in double precision to match the scalar path exactly
instead of narrowing to `float` for wider (but lossy) `f32x4` lanes.

**Correctness**: froze a scalar baseline (120,000 samples across 6 parameter
presets — default, extreme diffusion, extreme delay, extreme LFO, near-zero,
and a fixed alternate seed) from the pre-SIMD build, then diffed the SIMD
build's output sample-for-sample against it. Max deviation across every
preset: **1e-10 to 1e-14** relative to signal amplitude — floating-point
reordering noise, not a behavioral difference.

**Benchmark — the honest result**: measured two things, not one.

- *End-to-end pipeline, continuous modulation* (`diffusionSize`/`delaySize`
  swept every sample, forcing geometry recompute constantly): scalar and
  SIMD were statistically indistinguishable, ~0.5% apart — within
  measurement noise.
- *Isolated geometry-recompute cost* (steady-state vs. continuously-modulated
  timing delta, isolating just the vectorized loop + its call overhead from
  the rest of the pipeline): **SIMD is ~1.23x faster (18.7% less time)** for
  that specific piece of work.

Those two results aren't in tension — they explain each other. The earlier
convergence-skip optimization (see the CPU fix above) already means
`applyDelayGeometry` **doesn't run at all** once a patch settles, which is
the common case. The vectorized kernel is real and measurably faster at what
it does, but what it does is now a small, often-skipped slice of the total
per-sample cost — most of that cost is the memory-bound delay-buffer reads
in `delaySample`/`diffuseSample`, not the geometry math. The SIMD kernel
would matter for a patch that continuously modulates `diffusionSize` or
`delaySize` (e.g. an LFO wired directly into either), where geometry
recompute never gets to skip.

**Files**: `native_modules/sabrina_reverb/sabrina_reverb.cpp` (the kernel),
`scripts/build_native_modules.ps1` (added `-msimd128` to Sabrina's build
stanza only — no other module was touched).

**Where this leaves SIMD as a strategy for this codebase**: vectorizing
per-sample-independent recomputation (like delay geometry) is provably
correct and provably faster in isolation, but won't move overall CPU numbers
much where a cheaper fix (skip the work entirely when unmodulated) already
applies. The more promising SIMD target, if this continues, is likely the
memory-bound delay-line read/write path itself — a different, larger kernel
than this example, not yet attempted.
