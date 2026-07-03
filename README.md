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

## Block-processing proof: FBM as the first SIMD-compatible modular execution boundary

The kernel above is real DSP acceleration. This section is a different kind
of proof: that a module in this sandbox can run through an explicit
block-processing boundary — params resolved once, a whole block computed,
results written to an explicit buffer — with scalar and SIMD
implementations living behind that *same* boundary, and that this can be
wired into the actual real-time execution path, not just benchmarked in
isolation.

**The hidden shape this replaces**: `fractalBrownianNoiseVector` (the JS
bridge) called `soemdsp_fbm_sample` once per audio sample — `sample =
fbm(time, params)` — re-reading and re-clamping every parameter on every
single call, then crossing the JS↔WASM boundary again to read back each of
6 output values individually.

**What was added** (`native_modules/fractal_brownian_noise/fractal_brownian_noise.cpp`):

- `soemdsp_fbm_process_block(handle, ...params..., frameCount, useSimd)` —
  resolves params once, then loops `frameCount` samples internally.
- Two implementations behind that one function: `fbmProcessBlockScalar`
  (the original 3x-`fbmAxis`-per-frame path) and `fbmProcessBlockSimd`
  (the `fbmAxesSimd` kernel from above, per frame). `useSimd` is an
  explicit runtime switch purely so both can be A/B tested through the
  identical entry point — a real caller always passes 1, since SIMD
  support here is a compile-time fact (`-msimd128`), not a runtime one.
- Fixed-size static output buffers (`blockOutX/Y/Z` + `...Raw` variants,
  `kMaxBlockFrames = 2048`) per instance, following the same no-heap
  pattern as Sabrina's delay-line buffers. Exposed via `_ptr` getters
  returning linear-memory byte offsets, so JS reads results as a
  zero-copy `Float64Array` view into WASM memory instead of one function
  call per sample per output.

**Correctness**: ran the original per-sample API for N samples alongside
the new block API for the same N, same params, same seed — output must be
identical whether you ask "one sample, N times" or "N samples, once".
Bit-exact across every preset (default, max octaves, min octaves, high
persistence, and a `level = 0` case that specifically catches a bug where
the raw/un-leveled output buffer could be silently derived from the
leveled one instead of being computed independently). `block-SIMD ==
block-scalar == original-per-sample-API`, at every preset, every frame.

**Real integration, not just a benchmark**: `fractalBrownianNoiseVector`
now maintains a `blockCache` (128 samples, matching the typical
AudioWorklet render quantum) per node instance. On cache exhaustion it
calls `soemdsp_fbm_process_block` once and refills; every other call reads
the next cached sample. Verified live: 3+ seconds of continuous real-time
audio through an actual FBM node (many hundreds of cache refills and
cursor wraparounds), plus a live parameter change mid-stream forcing an
early refill — no errors, no glitches, smoke tests pass.

**Honest tradeoff, stated plainly**: this freezes FBM's parameters for the
duration of one cached 128-sample block (~2.9ms @ 44.1kHz) instead of
resolving them fresh every sample. This is the standard block-rate
parameter tradeoff most real-world audio plugins already make — for a
slowly-evolving noise generator like FBM, sub-3ms parameter latency is not
expected to be audible, but it is a real, deliberate behavior change from
"exact per-sample parameter resolution," not a free lunch.

**Benchmark — two separate, honestly isolated dimensions**:

- *SIMD math alone* (block-SIMD vs. block-scalar, holding the block
  boundary constant): **~2.88x faster**, consistent with the ~2.76x found
  for the per-sample kernel above — confirms the SIMD win is real and
  reproducible at block granularity too.
- *Block boundary alone* (block-SIMD vs. the already-SIMD per-sample API,
  holding the math identical): **~1.14x faster** — the pure win from
  resolving params once per 128 samples and reading results via a
  zero-copy buffer view instead of 128 separate boundary crossings.

These are deliberately reported separately rather than multiplied together
into a single bigger number, since only the SIMD-math dimension was
directly re-measured against a true from-scratch scalar baseline; the
block-boundary dimension was measured holding the (already-optimized) math
constant.

**What this demonstrates, concretely**: one module (FBM) now has an
explicit block-processing entry point, resolves parameters outside the
per-sample hot loop, exposes scalar and SIMD implementations behind an
identical call signature, has measured equivalence and measured
performance for both, and is wired into the real AudioWorklet execution
path rather than sitting as an isolated benchmark. This is the shape a
future execution-order change could generalize from — **if and when that
work is explicitly assigned** — not a claim that the shape has been
generalized yet. No scheduler, no parameter-domain framework, no other
module's dispatch was touched.

## Second proof: Sabrina Reverb through the same block boundary

The FBM proof above answers the question for a self-generating module with
no external input. Sabrina Reverb is structurally different — a real
effect that reads a live, continuously-varying dry L/R signal from
upstream in the node graph — so it's a genuinely separate test of whether
the *same* block-processing shape holds for a second, structurally
different DSP unit, not a second angle on the same one.

**Files inspected**: `native_modules/sabrina_reverb/sabrina_reverb.cpp`
(the existing per-sample `soemdsp_sabrina_reverb_process`, its already-SIMD
paired kernels `delaySamplePairSimd`/`diffuseSamplePairSimd`, and the
original unpaired scalar `delaySample`/`diffuseSample` — still present in
the file but unused by the live per-sample path since it switched to the
paired kernels), and `public/node-live-audio-worklet.js`'s
`nativeSabrinaReverbSample` call site to see exactly how the live graph
feeds it dry input one sample at a time.

**Implementation strategy**: same shape as FBM — fixed-size static
in/out buffers added to `SabrinaState` (`blockInLeft/Right`,
`blockOutLeft/Right`, `kMaxBlockFrames = 2048`), a
`soemdsp_sabrina_reverb_process_block(handle, frameCount, useSimd)`
dispatch boundary, and two block kernels behind it:

- `sabrinaProcessBlockScalar` — loops the frame, calling the original
  unpaired `delaySample`/`diffuseSample` twice per stage (once per
  channel), i.e. the pre-SIMD algorithm, reactivated here specifically to
  serve as the scalar baseline.
- `sabrinaProcessBlockSimd` — identical loop structure, calling the
  already-committed, already-live `delaySamplePairSimd`/
  `diffuseSamplePairSimd` kernels.

Both call `advanceSabrinaSmoothing` once per frame exactly as the
per-sample API does, so DSP safety smoothing behavior is unchanged.
Pointer getters (`_block_input_left_ptr`, `_block_output_left_ptr`, etc.)
expose the buffers as zero-copy `Float64Array` views, same pattern as FBM.

**Output equivalence method**: ran the live per-sample API
(`soemdsp_sabrina_reverb_process` + `_left`/`_right`) as the reference
against a deterministic pseudo-random 500-sample dry L/R signal, across 3
presets (default, heavily modulated, mix=0 dry-bypass-adjacent). Compared
against both block paths called once for the whole 500-sample buffer:

- **Block-SIMD vs. reference: bit-exact (0 difference)** across all 3
  presets — expected, since it's calling the identical paired-kernel code
  the live path already runs, just batched.
- **Block-scalar vs. reference: max diff 5.2e-15** on the heavily-modulated
  preset, 0 on the other two — the same floating-point-reordering noise
  already documented for this module (L and R fully sequential in the
  unpaired scalar calls vs. interleaved via `f64x2` lanes in the paired
  kernels), not a correctness bug.

**Benchmark**: median of 5 runs, 3.072M samples (1024-sample blocks × 3000
iterations, matching FBM's benchmark scale):

- *Block-SIMD vs. block-scalar* (holding the block boundary constant):
  **~0.96x — no measurable win**, within run-to-run noise. This reconfirms
  the existing lesson from the per-sample SIMD kernels above: Sabrina's
  bottleneck is the delay-buffer reads (`readDelay`, memory-bound, no
  gather instruction in WASM SIMD128 to vectorize it), not the arithmetic
  around them — batching into a block doesn't change that structural
  limit.
- *Block-SIMD vs. the live per-sample API* (holding the math identical,
  isolating the boundary): **~1.17x faster** — consistent with FBM's
  ~1.14x boundary-only win, from resolving `advanceSabrinaSmoothing`'s
  per-sample work in a tight native loop and reading results back via one
  buffer view instead of 3072 individual JS↔WASM crossings.

**Deliberately NOT wired into the live worklet path — and why**: FBM's
block cache could refill transparently because FBM has no external input;
delaying its *parameter* resolution by up to 128 samples is inaudible.
Sabrina's block API requires `frameCount` samples of dry input to already
exist *before* the first output sample of that block can be computed —
unlike FBM, this would add up to a full block's worth of real algorithmic
latency (up to 2048 samples, or ~46ms at 44.1kHz for the max block size,
~2.9ms if pinned to a 128-sample block like FBM) to a live audio effect's
input-to-output path. That is an audible, real behavior change to a
real-time effect, not a free optimization, and the sandbox currently has
exactly one Sabrina call site (the live worklet) with no offline/batch
render path to absorb it safely. Wiring it in was out of scope for this
proof without separate, explicit sign-off on accepting that latency
tradeoff for the live reverb.

**How this proves the modular execution boundary, concretely**: a second,
structurally different real DSP unit (a streaming effect with external
input, not a generator) reuses its *already-shipping* production kernels
—not new math — behind the identical `(state, in, out, frameCount,
useSimd)` shape used for FBM, with measured bit-exact equivalence and an
honestly-reported benchmark, including a negative result (no SIMD-math win
at this granularity) reported as plainly as the positive one (a real
boundary win). The boundary shape holds across two structurally different
modules; whether it should also cross the live-latency line for streaming
effects is a distinct, larger decision than this proof.

**Files**: `native_modules/sabrina_reverb/sabrina_reverb.cpp` (block
kernels + dispatch boundary + pointer getters), `scripts/build_native_modules.ps1`
(added the 6 new exports to Sabrina's stanza). No JS integration file
changed for this proof — see the latency note above.
