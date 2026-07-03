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
| **Second SIMD kernel: Sabrina Reverb stereo delay/diffusion** | Pairs left/right channels (independent within a call) through the serial 6-stage diffusion cascade, one SIMD lane each. Real end-to-end win: ~1.09x (8.3% less time), because unlike geometry this path always runs. |
| **Third kernel attempted, rejected**: `readDelay`'s fractional blend — bit-exact but 0.98x (no win); documented and reverted rather than merged. |
| **Fourth SIMD kernel: Fractal Brownian Noise, biggest win yet** | Restructured X/Y/Z axis computation to share position math (was computed 3x redundantly, now once) and vectorized the ALU-bound integer hash chain across axes. **~2.76x faster (median)**, bit-exact. See [Fractal Brownian Noise SIMD kernel](#fractal-brownian-noise-simd-kernel-the-biggest-win-so-far) below. |

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

## Second SIMD kernel: stereo-paired delay/diffusion path (this one's a real win)

The geometry kernel above pointed at the actual bottleneck: the memory-bound
per-sample work in `delaySample`/`diffuseSample`, which runs on every sample
regardless of modulation state (unlike geometry, which the convergence-skip
optimization can skip entirely). This kernel targets that path directly.

**The parallelism**: not across the 14 delay lines (the 6-stage diffusion
cascade is a serial dependency chain — each stage's output feeds the next,
so lanes can't be independent there). Instead, **left and right stereo
channels** are independent of each other within a single `process()` call
(the only cross-feed is via `ch0`/`ch1` persisted from the *previous* call),
so `delaySamplePairSimd`/`diffuseSamplePairSimd` process both channels
together, one SIMD lane each, through the same 6 cascade stages —
sequential across stages, parallel across channels. This is the standard
stereo-channel-parallel SIMD pattern.

Vectorized: `parabol()` (now `parabolPairSimd`, using `f64x2.floor`/`f64x2.abs`
— both confirmed available), the modulation-increment update, the read-position
calc, and (for diffusion) the feedback combine and clamp. Left as scalar: the
delay-buffer read/write itself — `delayL.buffer` and `delayR.buffer` are two
separate arrays with independently-computed indices, and WASM SIMD128 has no
gather/scatter instruction, so there's no single vector load that could span
both.

**Correctness**: froze the geometry-SIMD build as the new baseline, ran 7
presets (120,000+ samples), including one with deliberately **asymmetric
L/R input** specifically to catch a left/right lane-swap bug. Max deviation:
1e-9 to 1e-12 relative to signal amplitude — consistent with floating-point
reordering, no lane-swap, no behavioral difference.

**Benchmark**: end-to-end pipeline, ordinary (non-modulated) processing,
median of 6 runs each: **~1.09x faster (about 8.3% less time)**, with clean
separation between the two distributions across every run (no overlap).
Unlike the geometry kernel, this shows up in *ordinary* use, not just under
continuous modulation — because this path runs every sample regardless.

**Files**: same two files as the geometry kernel — no new build stanza
needed, `-msimd128` was already enabled for this module.

**Where this leaves SIMD as a strategy for this codebase**: the lesson from
both kernels together is that the parallelism has to be found in what
*actually* runs every sample, not just in what's easy to batch. Geometry
recompute was easy to vectorize (12 independent lanes) but often skipped
entirely; the stereo channel pairing was less obvious (only 2 lanes, and the
per-line cascade itself stays serial) but touches work that always runs.

## Attempted third kernel: readDelay's fractional blend (rejected, not merged)

The obvious next candidate was vectorizing `readDelay`'s final interpolation
(`buffer[before]*(1-mix) + buffer[after]*mix`) across the stereo pair, same
pattern as the other two kernels. Implemented it as `readDelayPairSimd`,
wired into both paired callers, and ran it through the same process:

**Correctness**: bit-exact, zero deviation across all 7 presets. Expected,
in hindsight — this kernel has no cross-lane reduction (each lane's result
depends only on that lane's own inputs), so packing two independent scalar
computations into one SIMD op doesn't reorder any floating-point operations
relative to doing them separately.

**Benchmark**: median of 6 runs, **0.98x — very slightly *slower*, not
faster**, with the two distributions overlapping heavily (noise-level, not
a real regression, but definitely not a win).

**Why it didn't help, and why that's the right outcome to expect**: the
vectorized portion here is only 2 multiplies and an add — the wraparound
branches, the float-to-int truncation, the modulo index arithmetic, and the
scalar buffer gather all stay scalar regardless (WASM SIMD128 has no
gather and no int64x2 modulo), and dominate the real cost. Packing two
scalars into a `v128_t` and unpacking the result back out has its own small
cost that, for a kernel this thin, isn't paid back by the couple of FLOPs
it saves. This is the same shape as the geometry kernel's honest result
(genuinely correct, not a genuine win) but weaker — this one doesn't even
show the "faster in isolation" result the geometry kernel had.

**Decision**: reverted from `sabrina_reverb.cpp`, not merged. Recording it
here rather than silently discarding it, since a negative result reached
by the same rigorous process (baseline, correctness diff, honest benchmark)
is exactly as valuable as a positive one — it closes off a candidate
instead of leaving it as an untested assumption. The real remaining
opportunity, if there is one, is in the parts of `readDelay` that *can't*
vectorize on this ISA (the gather, the branchy wraparound) — which would
need a different approach (e.g. restructuring delay-line storage to make
the gather avoidable) rather than more SIMD intrinsics on the current
layout.

## Does every module need converting?

No. Surveyed all 17 native modules by their per-sample entry signature.
Only Sabrina Reverb has genuine stereo (L/R) parallelism built in — every
other module is a single-scalar-signal `_sample(...)` call. That doesn't
mean nothing else is worth vectorizing (Fractal Brownian Noise below has
no stereo pair at all and still landed the biggest win yet), but it does
mean there's no mechanical "convert everything" move available — each
module needs its own real data-parallel structure identified, the same way
Sabrina's stereo pairing and FBM's X/Y/Z axes were found, not assumed.

Rough classification from the survey (not exhaustively verified for every
module — flagging where a real investigation would be needed before
concluding either way):

| Module | Likely shape | SIMD-relevant? |
| --- | --- | --- |
| `sabrina_reverb` | stereo, delay-line cascade | Yes — done (2 kernels landed, 1 rejected) |
| `fractal_brownian_noise` | 3 independent axes, ALU-bound hash | Yes — done (biggest win, below) |
| `chua_attractor`, `henon_map`, `logistic_map` | single coupled chaotic recursion (2-3 state variables, each step depends on the previous step of the *same* system) | Probably not — no independent lanes within one instance; would need multiple simultaneous instances to pair, which is a different question (voice-parallelism, not touched here) |
| `ladder_filter`, `tb303_filter`, `passive_filter`, `helmholtz` | mono resonant filter, serial IIR-style state | Not as stereo pairs (mono only) — worth checking later whether the sandbox ever runs multiple simultaneous instances that could be voice-paired instead |
| `pll` | single VCO/phase-comparator recursion | No — inherently serial, one phase value |
| `pitch_quantizer`, `soft_clipper` | stateless or near-stateless per-sample function | No — too cheap; SIMD pack/unpack overhead would dominate, same lesson as the rejected `readDelay` kernel |
| `polyblep`, `noise_generator`, `vactrol_envelope`, `shooting_star_explosion`, `ellipsoid` | not investigated this pass | Unknown — flagged for future investigation, not assumed either way |

## Fractal Brownian Noise SIMD kernel: the biggest win so far

`soemdsp_fbm_sample` computes three independent axes (X/Y/Z) per call, each
summing up to 8 independent noise octaves before an amplitude-weighted
average. Two things made this a better candidate than anything in Sabrina:

1. **A real algorithmic redundancy, not just a SIMD opportunity.** At a
   given octave, `time * scale * freq` is *identical* for X, Y, and Z — only
   the seed differs. The scalar code called `fbmAxis()` three times, each
   recomputing the same `left`/`frac`/`smooth` position math from scratch.
   Restructured into `fbmAxesSimd()`, which computes that position math
   **once** per octave instead of three times, independent of SIMD.
2. **The remaining per-axis work (the hash chain) is ALU-bound, not
   memory-bound.** `hashBipolar`'s xor/multiply/shift chain touches no
   memory at all — unlike Sabrina's delay-buffer reads, there's no gather
   to fall back to scalar for. The three axes' hashes batch cleanly into
   `hashBipolarBitsBatch`, using `i32x4` lanes (3 real + 1 unused pad).

**Correctness**: bit-exact, zero deviation, across 6 presets (default,
max octaves, min octaves, high persistence, large seed, and a check on the
position-truncation branch). This is stronger than "floating-point
reordering noise" — every operation in the hash chain is exact 32-bit
modular integer arithmetic (xor, wrapping multiply, logical shift), so
there's nothing to reorder that changes the result at all.

**Benchmark**: median of 6 runs, **~2.76x faster** (1240ms → 449ms for 3M
calls). The SIMD timing was also far more consistent (443-459ms) than
scalar's (868-1264ms, with the buffer-read style noise Sabrina's kernels
showed absent here since there's no buffer at all).

**Why this beat both Sabrina kernels**: the lesson from Sabrina was that
SIMD needs *hot, always-running, ALU-bound* work to pay off — memory-bound
gather-heavy code doesn't vectorize well on an ISA with no gather
instruction. FBM's hash chain is exactly the profile SIMD is built for:
pure register arithmetic, no branches in the hot loop, real independent
lanes, called every sample with no convergence-skip equivalent to reduce
its frequency. Combined with eliminating the 3x redundant position
computation — a win that would have existed even without SIMD — this
produced the largest single result on this branch.

**Files**: `native_modules/fractal_brownian_noise/fractal_brownian_noise.cpp`,
`scripts/build_native_modules.ps1` (added `-msimd128` to FBM's stanza only).
