# Future Planning Notes

This file collects project-shaping ideas that should survive day-to-day implementation without becoming immediate scope.

## Trace Pathfinding

Trace-style wires will eventually need pathfinding to become useful as a circuit-board-like connection mode.

Future trace routing should be able to:

- Find orthogonal up/down/left/right paths between patch points.
- Route around modules and reserved UI areas.
- Prefer clean grid-aligned paths with minimal bends.
- Support user-placed trace points as routing constraints or waypoints.
- Keep Cable, Wire, and Trace as distinct visual/interaction modes.

This should wait until trace behavior is ready for a focused design pass. A simple manual trace mode is not enough long term; the useful version needs routing logic.
