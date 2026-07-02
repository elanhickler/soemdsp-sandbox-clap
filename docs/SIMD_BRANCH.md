# soemdsp-simd branch notes

Working branch off [`soemdsp-sandbox`](https://github.com/soundemote/soemdsp-sandbox)
master for parameter/smoothing architecture investigation and native DSP
binding work. Isolated in its own branch + worktree so this stays reviewable
independent of `master`. Setup, CLAP host prototype, and API reference are
unchanged from [`README.md`](../README.md) — this file only covers what's
specific to this branch.

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
