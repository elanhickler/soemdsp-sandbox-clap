// A 4-input lookup table plus a clocked D flip-flop -- the exact LUT+FF pair
// every real FPGA logic slice is built from. The 16-row truth table is a
// digital signal parameter: bit i of truthTable is the cell's output for
// input combination i, where i = (D<<3 | C<<2 | B<<1 | A). Mirrors
// native_modules/lut_cell exactly.

function createNodeGraphLutCellState() {
  return { clockWasHigh: false, registeredOut: 0 };
}

function nodeGraphLutCellSample(state, options = {}) {
  const a = Number(options.a) > 0 ? 1 : 0;
  const b = Number(options.b) > 0 ? 1 : 0;
  const c = Number(options.c) > 0 ? 1 : 0;
  const d = Number(options.d) > 0 ? 1 : 0;
  const clockHigh = Number(options.clock) > 0;
  const table = Math.max(0, Math.min(0xFFFF, Math.round(Number(options.truthTable) || 0)));

  const index = a | (b << 1) | (c << 2) | (d << 3);
  const combinational = (table >> index) & 1;

  if (clockHigh && !state.clockWasHigh) {
    state.registeredOut = combinational;
  }
  state.clockWasHigh = clockHigh;

  return {
    Out: combinational,
    Q: state.registeredOut,
  };
}
