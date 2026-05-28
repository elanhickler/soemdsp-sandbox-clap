# Plan 2: Module I/O Section

Good idea. Make ports boring, explicit, and readable first. Then we can make them beautiful after the routing language feels right.

## Summary

Add a dedicated I/O strip between the module title/buttons header and the parameter slider body.

## Structure

```text
[module title / buttons]

In                         Out
* In                    Out *
* Left                Right *

[parameter sliders + modulation inputs]
```

## Normal Modules

- Left side: signal inputs, blue port plus left-aligned label.
- Right side: signal outputs, orange label plus right-aligned port.
- Labels use the real port names from the module definition: `In`, `Out`, `Left`, `Right`, etc.
- Ports remain the existing `.node-port.input` / `.node-port.output` elements so wiring behavior stays intact.

## Output Module

- Left side shows `Left` and `Right` inputs.
- Right side can be empty unless monitor/export outputs are added later.

## CSS/Layout

- Add `.dsp-node-io-section`.
- Add `.node-io-column.input` and `.node-io-column.output`.
- Each row is compact:
  - input row: `port label`
  - output row: `label port`
- Keep parameter modulation ports unchanged next to sliders.
- Keep wires using `getBoundingClientRect()`, so endpoint math should naturally follow the new port positions.

## Implementation Scope

- Change `createNodeGraphModuleElement(...)`.
- Replace header/body port rail placement with an explicit I/O section.
- Keep the patch JSON, compiler, scheduler, render, live audio, modulation, bypass, copy/delete behavior unchanged.
- Update smoke tests to require the new section/classes.

## Verification

- Default graph renders with a clear I/O section.
- Signal wires connect from labeled Out ports to labeled In ports.
- Output has labeled Left/Right inputs.
- Modulation inputs remain beside sliders.
- Dragging/zooming still keeps wires aligned.
- Smoke and browser checks pass.

This feels like the right next UI correction: separate signal routing from parameter modulation visually, without changing the engine.
