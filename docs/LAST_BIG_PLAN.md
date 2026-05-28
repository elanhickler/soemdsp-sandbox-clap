# Last Big Plan

Status: recorded as durable plan memory. This plan describes the compiler-level module bypass architecture checkpoint.

# Compiler-Level Module Bypass

## Summary

Add a module bypass button that is an authoring/compiler feature, not DSP-node logic. The patch script stores a list of bypassed module ids. The compiler builds the active execution graph by ignoring bypassed nodes and all wires touching them. No oscillator/gain/noise/bias/output processor gets per-node bypass checks.

## Key Changes

- Add patch state:
  - `bypassedNodes: []`
  - preserve it in clone, serialize, validate, load/save, undo/redo, and Script View.
  - accept missing `bypassedNodes` as `[]` for old scripts.
  - ignore invalid ids during validation or reject them with a clear script validation error; choose clear rejection.
  - do not allow `output` to be bypassed.

- Add module UI:
  - add a small `Bypass` toggle button in each module header, near the wrench.
  - hide/disable it for `Output`.
  - bypassed modules get a visible dimmed/striped state and `aria-pressed="true"`.
  - tooltip/help text: `Mouse: click to bypass this module. Bypassed modules are removed from the compiled engine.`
  - clicking bypass commits a patch history snapshot and updates Script View.

- Update compiler/scheduler:
  - add helpers like `nodeGraphBypassedNodeIds(patch)` and `nodeGraphNodeIsBypassed(nodeId, patch)`.
  - keep all nodes in patch/debug display, but build dependencies only from non-bypassed nodes.
  - exclude all signal and modulation wires where source or destination is bypassed.
  - include bypassed nodes in debug as `bypassedNodes`.
  - count bypassed nodes as inactive in active node/wire summaries.
  - Render Sample and Live Audio naturally use the filtered active graph through the compiled plan.

- Update wire/debug display:
  - draw wires touching bypassed modules as inactive/dimmed instead of deleting them.
  - connection list labels them with `(bypassed)` or `(inactive)`.
  - execution debug JSON includes `bypassedNodes`, active node count, active wire count, and inactive wire reads.

- Keep architecture clean:
  - no per-DSP `if bypassed` checks.
  - no pass-through bypass yet.
  - no backend C++ changes in this pass.
  - no production optimizer/fusion pass yet; this is the active graph view needed before future compiled-circuit polish.

## Test Plan

- Update smoke tests to require:
  - `bypassedNodes` patch serialization/validation support.
  - module bypass button marker and event handler.
  - bypassed CSS state.
  - compiler filters bypassed nodes and wires touching them.
  - live plan and render plan are built from active non-bypassed nodes.
  - execution debug exposes bypassed nodes.

- Run:
  - `python scripts\smoke_test.py`
  - `python -m py_compile scripts\smoke_test.py server.py`
  - `git diff --check`

- Browser verify:
  - default patch renders and live output still works.
  - bypassing Gain dims Gain, marks Osc->Gain and Gain->Bias wires inactive, updates Script View, and blocks render/live because Output loses valid input.
  - un-bypassing Gain restores the graph and render/live behavior.
  - bypassing a side/unconnected module removes it from active count without breaking the main chain.
  - undo/redo toggles bypass state correctly.
  - loading a script with `bypassedNodes` restores bypass visuals and compiler state.

## Assumptions

- UI label is `Bypass`; internal patch field is `bypassedNodes`.
- Bypass means “remove from compiled engine,” not “pass input through to output.”
- Output cannot be bypassed.
- Wires are preserved in the patch while bypassed, so un-bypass restores the previous wiring instantly.
