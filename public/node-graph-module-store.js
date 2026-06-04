const nodeGraphModuleStoreTypes = Object.freeze([
  "osc",
  "distortionOscillator",
  "dsfOscillator",
  "ellipsoid",
  "polyBlep",
  "sineWavetable",
  "jerobeamNyqistShannon",
  "additiveEngine",
  "harmonicBank",
  "drumMachine",
  "kickDrum",
  "snareDrum",
  "clock",
  "clockDivider",
  "delayedTrigger",
  "randomClock",
  "triggerCounter",
  "triggerDivider",
  "stepSequencer",
  "melodySequencer",
  "chordSequencer",
  "arpeggiator",
  "spiral",
  "lorenzAttractor",
  "rosslerAttractor",
  "chuaAttractor",
  "aizawaAttractor",
  "thomasAttractor",
  "halvorsenAttractor",
  "noise",
  "stereoNoise",
  "noiseGenerator",
  "randomWalk",
  "fractalBrownianNoise",
  "codeblock",
  "graph",
  "gain",
  "bias",
  "macroKnob",
  "bipolarKnob",
  "valueSlider",
  "rangeSlider",
  "midiOut",
  "midiNotePitch",
  "midiController",
  "keyboardController",
  "macroControls",
  "pitchModWheel",
  "xyPad",
  "samplePlayer",
  "sampleLooper",
  "highpass",
  "lowpass",
  "bandpass",
  "cookbookFilter",
  "ladderFilter",
  "slewLimiter",
  "delayEffect",
  "reverbEffect",
  "distortionEffect",
  "sampleHold",
  "digitalCurveEnvelope",
  "expAdsr",
  "flowerChildEnvelopeFollower",
  "linearEnvelope",
  "pluckEnvelope",
  "vactrolEnvelope",
  "sandboxVisuals",
  "bloomGlow",
  "rgbaHsla",
  "chromaColor",
  "image",
  "visualOscilloscope",
  "parabol",
  "vibratoGenerator",
  "wowAndFlutter",
  "badvalMonitor",
  "textBox",
]);

const nodeGraphModuleGroupStorageKey = "soemdsp-sandbox.moduleGroups.v1";
const nodeGraphModuleCatalogVisibilityStorageKey = "soemdsp-sandbox.moduleCatalogVisibility.v1";

const nodeGraphModuleStoreDepartments = Object.freeze([
  "Oscillator",
  "Additive Engines",
  "Drum Machines",
  "Filter",
  "Effects",
  "Clock",
  "Melody Sequencer",
  "Chord Sequencer",
  "Arpeggiator",
  "Time",
  "Dynamics",
  "Debug",
  "Envelope Systems",
  "Modulators",
  "Knobs",
  "Sliders",
  "Controllers",
  "Samples",
  "Random",
  "Chaos",
  "Visual",
]);

const nodeGraphModuleStoreDepartmentAds = Object.freeze({
  Oscillator: {
    symbol: "∿",
    title: "Oscillator",
    pitch: "Start with a voice. Tone generators, phase motion, and the raw signal that everything else learns to orbit.",
  },
  "Additive Engines": {
    symbol: "+",
    title: "Additive Engines",
    pitch: "Harmonic engines, partial banks, and tone builders for sculpting sound from summed sine energy.",
  },
  "Drum Machines": {
    symbol: "▥",
    title: "Drum Machines",
    pitch: "Rhythm machines, drum voices, pattern engines, and percussion control surfaces.",
  },
  Filter: {
    symbol: "◫",
    title: "Filter",
    pitch: "Shape the airframe. Carve mass, reveal brightness, and teach a signal where it is allowed to fly.",
  },
  Effects: {
    symbol: "FX",
    title: "Effects",
    pitch: "Delay, reverb, distortion, and performance processors for shaping finished sound.",
  },
  Clock: {
    symbol: "◷",
    title: "Clock",
    pitch: "Pulse generators, dividers, counters, delays, and timing utilities for musical logic.",
  },
  "Melody Sequencer": {
    symbol: "♪",
    title: "Melody Sequencer",
    pitch: "Pitch lanes and melodic pattern tools for generating lines, hooks, and motion.",
  },
  "Chord Sequencer": {
    symbol: "♬",
    title: "Chord Sequencer",
    pitch: "Progression tools for harmonic movement, voicings, and chord-triggered systems.",
  },
  Arpeggiator: {
    symbol: "↟",
    title: "Arpeggiator",
    pitch: "Pattern engines for broken chords, rhythmic note motion, and performance arps.",
  },
  Time: {
    symbol: "◷",
    title: "Time",
    pitch: "Instructions, timing surfaces, labels, and the slow machinery that makes a patch readable in motion.",
  },
  Dynamics: {
    symbol: "⚡",
    title: "Dynamics",
    pitch: "Power routing, level control, offsets, and response shaping for keeping a circuit alive under pressure.",
  },
  Debug: {
    symbol: "DBG",
    title: "Debug",
    pitch: "Inspection tools, sentinels, and safety monitors for catching bad values while a patch is under test.",
  },
  "Envelope Systems": {
    symbol: "⌒",
    title: "Envelop",
    pitch: "Attack, decay, sustain, release, and gate-shaped motion. Make sound and visuals breathe on command.",
  },
  Modulators: {
    symbol: "⇄",
    title: "Modulator",
    pitch: "Motion sources for pitch, amplitude, time, and texture. Small control engines that make patches move.",
  },
  Knobs: {
    symbol: "◎",
    title: "Knobs",
    pitch: "Manual control surfaces for performance, defaults, and expressive patch steering.",
  },
  Sliders: {
    symbol: "▤",
    title: "Sliders",
    pitch: "Continuous control lanes for drawing, trimming, and riding values in real time.",
  },
  Controllers: {
    symbol: "⌘",
    title: "Controllers",
    pitch: "Input devices and control bridges for keyboards, MIDI, gamepads, and external gestures.",
  },
  Samples: {
    symbol: "▣",
    title: "Samples",
    pitch: "Audio clips, one-shots, loops, and sample playback tools.",
  },
  Random: {
    symbol: "✦",
    title: "Noise",
    pitch: "Noise, dust, instability, sparks, and all the useful mess a clean machine secretly needs.",
  },
  Chaos: {
    symbol: "∞",
    title: "Chaos",
    pitch: "All the various attractors and strange motion systems. The wild shelf where math starts looking back.",
  },
  Visual: {
    symbol: "V",
    title: "Visual",
    pitch: "Patch signals into sandbox behavior. Screen shake is the first control port for sound-to-visual routing.",
  },
});

const nodeGraphModuleStoreCatalog = Object.freeze({
  osc: {
    category: "Oscillator",
    description: "Core tone generator. Turns frequency, phase, and waveform into a controllable voice.",
    notes: ["phase counter", "waveform selection", "frequency control"],
  },
  distortionOscillator: {
    category: "Oscillator",
    description: "Placeholder for a tone source with built-in distortion character and drive-shaped motion.",
    label: "DistortionOscillator",
    notes: ["placeholder", "driven tone", "future oscillator"],
  },
  dsfOscillator: {
    category: "Oscillator",
    description: "Placeholder for a discrete summation formula oscillator with rich harmonic control.",
    label: "DSFOscillator",
    notes: ["placeholder", "harmonic series", "future oscillator"],
  },
  ellipsoid: {
    category: "Oscillator",
    description: "Placeholder for an ellipsoid motion oscillator for rounded spatial signal paths.",
    label: "Ellipsoid",
    notes: ["placeholder", "geometric motion", "future oscillator"],
  },
  polyBlep: {
    category: "Oscillator",
    description: "Placeholder for an anti-aliased PolyBLEP oscillator for clean digital waveform edges.",
    label: "PolyBLEP",
    notes: ["placeholder", "anti-aliasing", "future oscillator"],
  },
  sineWavetable: {
    category: "Oscillator",
    description: "Placeholder for a sine wavetable oscillator with table-driven phase playback.",
    label: "Sinewavetable",
    notes: ["placeholder", "wavetable", "future oscillator"],
  },
  jerobeamNyqistShannon: {
    category: "Oscillator",
    description: "Placeholder for a Jerobeam Nyqist/Shannon oscillator concept and audiovisual sampling study.",
    label: "JerobeamNyqistShannon",
    notes: ["placeholder", "sampling theorem", "future oscillator"],
  },
  additiveEngine: {
    category: "Additive Engines",
    description: "Placeholder for a harmonic additive synth engine built from controllable partials.",
    label: "AdditiveEngine",
    notes: ["placeholder", "partials", "harmonic synthesis"],
  },
  harmonicBank: {
    category: "Additive Engines",
    description: "Placeholder for a bank of sine partials with shared tuning and amplitude controls.",
    label: "HarmonicBank",
    notes: ["placeholder", "sine bank", "partials"],
  },
  drumMachine: {
    category: "Drum Machines",
    description: "Placeholder for a compact pattern-driven drum machine module.",
    label: "DrumMachine",
    notes: ["placeholder", "patterns", "percussion"],
  },
  kickDrum: {
    category: "Drum Machines",
    description: "Placeholder for a synthesized kick voice with pitch drop, body, and click controls.",
    label: "KickDrum",
    notes: ["placeholder", "drum voice", "low punch"],
  },
  snareDrum: {
    category: "Drum Machines",
    description: "Placeholder for a synthesized snare voice with noise, tone, and snap controls.",
    label: "SnareDrum",
    notes: ["placeholder", "drum voice", "noise snap"],
  },
  clock: {
    category: "Clock",
    description: "Timer pulse source. Emits a steady gate for triggering samplers, sequencers, and motion events.",
    notes: ["rate control", "duty cycle", "trigger source"],
  },
  clockDivider: {
    category: "Clock",
    description: "Clock-aware divider. Count incoming clock edges and emit a slower gate for rhythmic subdivision.",
    notes: ["clock input", "division control", "reset input"],
  },
  delayedTrigger: {
    category: "Clock",
    description: "One-shot timer. Catch a trigger, wait a precise delay, then emit a pulse for downstream events.",
    notes: ["delayed pulse", "reset input", "one-shot timing"],
  },
  randomClock: {
    category: "Clock",
    description: "Seeded random interval clock. Emits a short trigger and a duty-controlled gate between minimum and maximum seconds.",
    notes: ["random timing", "trigger and gate outputs", "reset input"],
  },
  triggerCounter: {
    category: "Clock",
    description: "Pulse counter. Count incoming triggers, emit a wrap pulse, and expose the count as modulation.",
    notes: ["count pulses", "wrap output", "reset input"],
  },
  triggerDivider: {
    category: "Clock",
    description: "Divides incoming trigger pulses into slower clocks for envelopes, sequencers, and rhythmic patches.",
    notes: ["trigger division", "reset input", "pulse width"],
  },
  stepSequencer: {
    category: "Melody Sequencer",
    description: "Eight-step trigger sequencer. Advance it with Clock and route stepped control values anywhere.",
    notes: ["trigger input", "reset input", "stepped modulation"],
  },
  melodySequencer: {
    category: "Melody Sequencer",
    description: "Placeholder for a pitch-aware sequencer for hooks, lines, and scale-constrained motion.",
    label: "MelodySequencer",
    notes: ["placeholder", "pitch lane", "scale control"],
  },
  chordSequencer: {
    category: "Chord Sequencer",
    description: "Placeholder for arranging chord progressions and voicing changes inside the graph.",
    label: "ChordSequencer",
    notes: ["placeholder", "progressions", "voicing"],
  },
  arpeggiator: {
    category: "Arpeggiator",
    description: "Placeholder for rhythmic note-pattern generation from held chords or chord sources.",
    label: "Arpeggiator",
    notes: ["placeholder", "note pattern", "arp engine"],
  },
  spiral: {
    category: "Chaos",
    description: "Jerobeam spiral engine. Emits X/Y/Z motion-signal for alien curves and audiovisual flight paths.",
    notes: ["attractor motion", "rotation", "density and morph controls"],
  },
  lorenzAttractor: {
    category: "Chaos",
    description: "Classic butterfly attractor motion for turbulent curls and folding trajectories.",
    label: "LorenzAttractor",
    notes: ["butterfly attractor", "3D chaos", "planned attractor"],
  },
  rosslerAttractor: {
    category: "Chaos",
    description: "Ribbon-like chaotic orbit with spiral rolls and folding motion.",
    label: "RosslerAttractor",
    notes: ["spiral fold", "continuous chaos", "planned attractor"],
  },
  chuaAttractor: {
    category: "Chaos",
    description: "Double-scroll circuit attractor for electric, mirrored, hardware-chaos behavior.",
    label: "ChuaAttractor",
    notes: ["double scroll", "circuit chaos", "planned attractor"],
  },
  aizawaAttractor: {
    category: "Chaos",
    description: "Layered orbital attractor with hovering shells and complex central motion.",
    label: "AizawaAttractor",
    notes: ["orbital shells", "3D motion", "planned attractor"],
  },
  thomasAttractor: {
    category: "Chaos",
    description: "Sine-driven strange attractor for smooth looping chaos and balanced spatial motion.",
    label: "ThomasAttractor",
    notes: ["sine feedback", "smooth chaos", "planned attractor"],
  },
  halvorsenAttractor: {
    category: "Chaos",
    description: "Dense braided attractor motion for tangled audiovisual trajectories.",
    label: "HalvorsenAttractor",
    notes: ["braided chaos", "dense orbit", "planned attractor"],
  },
  noise: {
    category: "Random",
    description: "Unstable broadband energy source for static, wind, percussion dust, and danger texture.",
    notes: ["random source", "amplitude", "texture generator"],
  },
  stereoNoise: {
    category: "Random",
    description: "Two independent broadband noise streams with Left, Right, and summed mono outputs for wide textures.",
    notes: ["stereo source", "independent channels", "amplitude"],
  },
  noiseGenerator: {
    category: "Random",
    description: "Selectable random source for comparing uniform, gaussian, brown, pink, and crackle flavors side by side.",
    notes: ["distribution choices", "seed control", "noise lab"],
  },
  randomWalk: {
    category: "Random",
    description: "Flexible soemdsp-style random walk with white, filtered, random-step, and fixed-step motion modes.",
    notes: ["bounded walk", "jitter curve", "one-pole smoothing"],
  },
  fractalBrownianNoise: {
    category: "Random",
    description: "Three-axis layered fBm motion source with octave, persistence, scale, and seed controls for rough organic drift.",
    notes: ["out x/y/z", "seeded value noise", "slow terrain motion"],
  },
  codeblock: {
    category: "Controllers",
    description: "Patch-local JavaScript signal processor with editable input and output ports.",
    notes: ["dynamic ports", "JavaScript body", "local patch code"],
  },
  graph: {
    category: "Visual",
    description: "Patch-local soemdsp-style graph object with curve nodes and a vertical cursor position.",
    notes: ["curve display", "cursor line", "graph nodes"],
  },
  gain: {
    category: "Dynamics",
    description: "Signal booster and throttle. Use it to push, tame, or route engine power.",
    notes: ["multiplication", "level control", "headroom"],
  },
  bias: {
    category: "Dynamics",
    description: "Offsets a signal away from center. Useful for steering modulation and shifting control lanes.",
    notes: ["addition", "offset", "control lane shift"],
  },
  macroKnob: {
    category: "Knobs",
    description: "Placeholder for a named macro knob that can steer several patch parameters at once.",
    label: "MacroKnob",
    notes: ["placeholder", "manual control", "multi-target"],
  },
  bipolarKnob: {
    category: "Knobs",
    description: "Placeholder for a center-zero knob for offsets, modulation depth, and expressive push/pull controls.",
    label: "BipolarKnob",
    notes: ["placeholder", "center zero", "performance control"],
  },
  valueSlider: {
    category: "Sliders",
    description: "Resizable bias-output slider for manual control in the modular view and UI view.",
    label: "Value Slider",
    notes: ["bias output", "resizable widget", "manual control"],
  },
  rangeSlider: {
    category: "Sliders",
    description: "Placeholder for paired minimum/maximum slider control for constraining modulation ranges.",
    label: "RangeSlider",
    notes: ["placeholder", "min max", "range control"],
  },
  midiOut: {
    category: "Controllers",
    description: "Manual MIDI-number source. Outputs the selected note as a normalized 0..1 signal and as the full 0..127 value.",
    notes: ["midi number", "normalized output", "full value output"],
  },
  midiNotePitch: {
    category: "Controllers",
    description: "MIDI note converter. Applies octave and pitch offsets, then emits normalized pitch, full MIDI pitch, and frequency in Hz.",
    notes: ["midi note input", "frequency output", "pitch conversion"],
  },
  midiController: {
    category: "Controllers",
    description: "Placeholder for mapping MIDI controls into the modular graph.",
    label: "MIDIController",
    notes: ["placeholder", "MIDI input", "external control"],
  },
  keyboardController: {
    category: "Controllers",
    description: "Mouse-playable keyboard source. Emits sustained gate, one-sample gate, key index, quantized key, MIDI pitch, normalized double, phase increment, frequency, numeric pitch, and X/Y gesture values.",
    label: "MIDI Keyboard",
    notes: ["keyboard input", "midi pitch", "gesture signals"],
  },
  macroControls: {
    category: "Controllers",
    description: "Reads the ten macro knobs under the modular view and emits M1 through M10 as live 0..1 control signals.",
    label: "Macro Controls",
    notes: ["macro row", "manual control", "ten outputs"],
  },
  pitchModWheel: {
    category: "Controllers",
    description: "Reads the separate pitch and mod wheel controls beside the keyboard. Pitch emits -1..1, while mod emits 0..1.",
    label: "Pitch / Mod Wheel",
    notes: ["pitch wheel", "mod wheel", "performance control"],
  },
  xyPad: {
    category: "Controllers",
    description: "Placeholder for a two-axis performance pad that outputs X/Y control values.",
    label: "XYPad",
    notes: ["placeholder", "two-axis control", "performance gesture"],
  },
  samplePlayer: {
    category: "Samples",
    description: "Placeholder for loading and triggering one-shot samples from the patch.",
    label: "SamplePlayer",
    notes: ["placeholder", "one-shot", "audio clip"],
  },
  sampleLooper: {
    category: "Samples",
    description: "Placeholder for loop playback with timing controls and modulation-friendly parameters.",
    label: "SampleLooper",
    notes: ["placeholder", "loop playback", "timed sample"],
  },
  highpass: {
    category: "Filter",
    description: "Cuts low-frequency mass so bright signal can escape the hull.",
    notes: ["cutoff frequency", "stateful filter", "bright motion"],
  },
  lowpass: {
    category: "Filter",
    description: "Cuts high-frequency sparks and leaves heavier warm signal behind.",
    notes: ["cutoff frequency", "smoothing", "warm motion"],
  },
  bandpass: {
    category: "Filter",
    description: "Focuses a signal between low and high cut points using the one-pole filter pair.",
    notes: ["low cut", "high cut", "focused band"],
  },
  cookbookFilter: {
    category: "Filter",
    description: "RSMET cookbook biquad cascade with mode, frequency, stages, Q, and gain controls plus an in-module response curve.",
    label: "Multi Stage Filter",
    notes: ["mode selection", "biquad stages", "curve display"],
  },
  ladderFilter: {
    category: "Filter",
    description: "RSMET ladder filter using the gain-compensated getSample path with frequency, resonance, stage depth, and mode controls.",
    label: "Ladder Filter",
    notes: ["RSMET ladder", "gain compensated", "resonant stages"],
  },
  slewLimiter: {
    category: "Modulators",
    description: "Limits rising and falling motion independently, turning abrupt changes into shaped ramps.",
    notes: ["up time", "down time", "asymmetric glide"],
  },
  delayEffect: {
    category: "Effects",
    description: "Placeholder for tempo-aware echo, slapback, and feedback delay effects.",
    label: "DelayEffect",
    notes: ["placeholder", "echo", "feedback"],
  },
  reverbEffect: {
    category: "Effects",
    description: "Placeholder for space, room, tail, and ambience processing.",
    label: "ReverbEffect",
    notes: ["placeholder", "space", "decay"],
  },
  distortionEffect: {
    category: "Effects",
    description: "Placeholder for drive, clipping, saturation, and tone-shaping distortion effects.",
    label: "DistortionEffect",
    notes: ["placeholder", "drive", "saturation"],
  },
  sampleHold: {
    category: "Random",
    description: "Captures an input value when a trigger rises and holds it until the next trigger.",
    notes: ["triggered capture", "held output", "stepped motion"],
  },
  digitalCurveEnvelope: {
    category: "Envelope Systems",
    description: "Programmable curve envelope for drawing sharper motion and custom response shapes.",
    label: "DigitalCurveEnvelope",
    notes: ["curve table", "custom shape", "planned envelope"],
  },
  expAdsr: {
    category: "Envelope Systems",
    description: "Soundemote-style exponential ADSR. Gate it with a clock or pulse and shape the rise and fall curves.",
    label: "ExponentialEnvelope",
    notes: ["gate input", "target-ratio curves", "loopable envelope"],
  },
  flowerChildEnvelopeFollower: {
    category: "Envelope Systems",
    description: "FlowerChild-style rectified envelope follower with attack, hold, and decay slew behavior.",
    label: "FlowerChild Envelope Follower",
    notes: ["audio input", "attack hold decay", "signed follower port"],
  },
  linearEnvelope: {
    category: "Envelope Systems",
    description: "Straight-line envelope for predictable ramps, fades, gates, and simple motion.",
    label: "LinearEnvelope",
    notes: ["gate input", "linear DADSR", "loopable ramp"],
  },
  pluckEnvelope: {
    category: "Envelope Systems",
    description: "Fast feedback pluck contour for struck, picked, pinged, and percussive behaviors.",
    label: "PluckEnvelope",
    notes: ["trigger input", "decay energy", "auto release"],
  },
  vactrolEnvelope: {
    category: "Envelope Systems",
    description: "Optical-style control shaper. Feed it light and get the slow, curved response of a vactrol detector.",
    notes: ["light input", "attack/release lag", "dark current"],
  },
  sandboxVisuals: {
    category: "Visual",
    description: "Sink module for routing patch signals into the screen view. Drive shake, dim, color, scope pause/shutoff, or patch X/Y for direct visual motion.",
    notes: ["visual sink", "shake input", "scope pause"],
  },
  bloomGlow: {
    category: "Visual",
    description: "Visual sink for routing patch signals into screen dimming, brightness, bloom, and glow response.",
    notes: ["visual sink", "dim input", "bloom and glow"],
  },
  rgbaHsla: {
    category: "Visual",
    description: "Precise color sink with RGB channels, HSL channels, an HSL mix control, and alpha for the screen wash.",
    notes: ["visual sink", "rgb channels", "hsla control"],
  },
  chromaColor: {
    category: "Visual",
    description: "Stylized color sink for chroma-driven screen washes with hue drift, spread, alpha, trace brightness, bloom, and glow.",
    notes: ["visual sink", "chroma wash", "moving color"],
  },
  image: {
    category: "Visual",
    description: "Patch-local image asset node. Route it into Screen Visuals Trace Image to texture phosphor trace dots.",
    notes: ["load image", "save image", "trace texture"],
  },
  visualOscilloscope: {
    category: "Visual",
    description: "Square in-world oscilloscope tile. Patch any signal into In and use it as a dedicated visual display.",
    notes: ["square scope", "signal display", "visual sink"],
  },
  parabol: {
    category: "Modulators",
    description: "Curved control motion for sweeps, bends, and non-linear transitions.",
    label: "Parabol",
    notes: ["parabolic curve", "control motion", "planned modulator"],
  },
  vibratoGenerator: {
    category: "Modulators",
    description: "Pitch-motion generator for musical vibrato and animated oscillator control.",
    label: "VibratoGenerator",
    notes: ["pitch modulation", "rate and depth", "planned modulator"],
  },
  wowAndFlutter: {
    category: "Modulators",
    description: "Tape-style slow wow and fast flutter motion for unstable pitch and timing character.",
    label: "WowAndFlutter",
    notes: ["wow motion", "flutter motion", "planned modulator"],
  },
  badvalMonitor: {
    category: "Debug",
    description: "Circuit sentinel. Watches for invalid values before they spread through the machine.",
    notes: ["NaN guard", "infinity guard", "debug safety"],
  },
  textBox: {
    category: "Visual",
    description: "In-world label plate for prompts, lore, instructions, and electric annotations.",
    notes: ["annotation", "layout", "field notes"],
  },
});

function defaultNodeGraphModuleCatalogVisibility() {
  return Object.fromEntries(nodeGraphModuleStoreTypes.map((type) => [type, true]));
}

function normalizeNodeGraphModuleCatalogVisibility(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(
    nodeGraphModuleStoreTypes.map((type) => [type, source[type] !== false]),
  );
}

function nodeGraphModuleCatalogVisibility() {
  return normalizeNodeGraphModuleCatalogVisibility(nodeGraphMvp.moduleCatalogVisibility);
}

function nodeGraphModuleIsStoreVisible(type) {
  return nodeGraphModuleCatalogVisibility()[type] !== false;
}

function applyNodeGraphModuleCatalogVisibility(value = {}) {
  nodeGraphMvp.moduleCatalogVisibility = normalizeNodeGraphModuleCatalogVisibility(value);
  renderNodeGraphModuleStoreCatalog();
}

function loadNodeGraphModuleCatalogVisibilityLocal() {
  if (!nodeGraphLocalDefaultPresetAllowed()) {
    return null;
  }
  try {
    const text = window.localStorage.getItem(nodeGraphModuleCatalogVisibilityStorageKey);
    if (!text) {
      return null;
    }
    return normalizeNodeGraphModuleCatalogVisibility(JSON.parse(text));
  } catch {
    return null;
  }
}

function saveNodeGraphModuleCatalogVisibilityLocal(value = nodeGraphModuleCatalogVisibility()) {
  if (!nodeGraphLocalDefaultPresetAllowed()) {
    return false;
  }
  try {
    window.localStorage.setItem(
      nodeGraphModuleCatalogVisibilityStorageKey,
      JSON.stringify(normalizeNodeGraphModuleCatalogVisibility(value)),
    );
    return true;
  } catch {
    return false;
  }
}

function nodeGraphModuleStoreEntries() {
  return nodeGraphModuleStoreTypes
    .map((type) => ({
      ...(nodeGraphModuleStoreCatalog[type] || {}),
      type,
      implemented: Object.hasOwn(nodeGraphModuleDefinitions, type),
      label: nodeGraphModuleStoreCatalog[type]?.label || nodeGraphNodeLabels[type] || type,
      visible: nodeGraphModuleIsStoreVisible(type),
    }));
}

function setNodeGraphModuleCatalogVisibility(type, visible) {
  if (!nodeGraphModuleStoreTypes.includes(type)) {
    return;
  }
  nodeGraphMvp.moduleCatalogVisibility = {
    ...nodeGraphModuleCatalogVisibility(),
    [type]: Boolean(visible),
  };
  saveNodeGraphModuleCatalogVisibilityLocal();
  renderNodeGraphModuleStoreCatalog();
}

function setNodeGraphModuleStoreDepartment(department = "") {
  nodeGraphMvp.moduleStoreDepartment = nodeGraphModuleStoreDepartments.includes(department) ? department : "";
  renderNodeGraphModuleStoreCatalog();
}

function createNodeGraphModuleStorePreview(entry) {
  const preview = document.createElement("span");
  preview.className = "scene-context-store-preview";
  preview.setAttribute("role", "img");
  preview.setAttribute("aria-label", `${entry.label} module preview`);
  preview.dataset.moduleCategory = entry.category || "module";

  const shell = document.createElement("span");
  shell.className = "scene-context-store-preview-shell";
  const header = document.createElement("span");
  header.className = "scene-context-store-preview-header";
  header.textContent = entry.label;
  const body = document.createElement("span");
  body.className = "scene-context-store-preview-body";

  const inputPorts = Math.max(1, (nodeGraphModuleDefinitions[entry.type]?.inputs || []).length);
  const outputPorts = Math.max(1, (nodeGraphModuleDefinitions[entry.type]?.outputs || []).length);
  const leftRail = document.createElement("span");
  leftRail.className = "scene-context-store-preview-ports";
  leftRail.dataset.side = "in";
  for (let index = 0; index < inputPorts; index += 1) {
    leftRail.append(document.createElement("span"));
  }

  const center = document.createElement("span");
  center.className = "scene-context-store-preview-core";
  center.textContent = entry.category === "Chaos" ? "CH" : entry.label.slice(0, 2).toUpperCase();

  const rightRail = document.createElement("span");
  rightRail.className = "scene-context-store-preview-ports";
  rightRail.dataset.side = "out";
  for (let index = 0; index < outputPorts; index += 1) {
    rightRail.append(document.createElement("span"));
  }

  body.append(leftRail, center, rightRail);
  shell.append(header, body);
  preview.append(shell);
  return preview;
}

function appendNodeGraphModuleStoreNotes(target, entry) {
  for (const note of entry.notes || []) {
    const item = document.createElement("span");
    item.className = "scene-context-store-manual-note";
    item.textContent = note;
    target.append(item);
  }
}

function createNodeGraphModuleStoreButton(entry) {
  const card = document.createElement("div");
  card.className = "scene-context-store-card";
  card.dataset.moduleEnabled = String(entry.visible);
  card.title = `${entry.label}: ${entry.description || "Module reference entry."}`;

  const meta = document.createElement("span");
  meta.className = "scene-context-store-card-meta";
  meta.textContent = entry.category || "module";
  const label = document.createElement("strong");
  label.textContent = entry.label;
  const preview = createNodeGraphModuleStorePreview(entry);
  const description = document.createElement("span");
  description.className = "scene-context-store-card-description";
  description.textContent = entry.description || "Module reference entry.";
  const actions = document.createElement("span");
  actions.className = "scene-context-store-card-actions";
  if (entry.visible && entry.implemented) {
    const add = document.createElement("button");
    add.type = "button";
    add.dataset.contextModule = entry.type;
    add.textContent = "Add module";
    add.addEventListener("click", (event) => {
      event.stopPropagation();
      addNodeGraphModuleFromShop(add);
    });
    actions.append(add);
  } else if (entry.visible) {
    const planned = document.createElement("button");
    planned.type = "button";
    planned.disabled = true;
    planned.textContent = "Planned";
    actions.append(planned);
  }
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.dataset.storeToggleModule = entry.type;
  toggle.dataset.visible = String(!entry.visible);
  toggle.textContent = entry.visible ? "Disable" : "Enable";
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setNodeGraphModuleCatalogVisibility(entry.type, !entry.visible);
  });
  actions.append(toggle);

  card.append(meta, label, preview, description);
  appendNodeGraphModuleStoreNotes(card, entry);
  card.append(actions);
  return card;
}

function createNodeGraphModuleDepartmentButton(department, entries) {
  const ad = nodeGraphModuleStoreDepartmentAds[department] || {};
  const titleText = ad.title || department;
  const button = document.createElement("button");
  button.className = "scene-context-store-department-card";
  button.type = "button";
  button.dataset.storeDepartment = department;
  button.title = `${titleText}: module department`;
  button.setAttribute("aria-label", `Open ${titleText} module department.`);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    setNodeGraphModuleStoreDepartment(department);
  });

  const symbol = document.createElement("span");
  symbol.className = "scene-context-store-department-symbol";
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = ad.symbol || "◇";

  const title = document.createElement("strong");
  title.className = "scene-context-store-department-title";
  title.textContent = titleText;

  const preview = document.createElement("span");
  preview.className = "scene-context-store-department-preview";
  preview.textContent = entries
    .slice(0, 4)
    .map((entry) => entry.label)
    .join(" / ");

  button.append(symbol, title, preview);
  return button;
}

function createNodeGraphModuleStoreDepartmentHeading(department) {
  const heading = document.createElement("div");
  heading.className = "scene-context-store-department-heading";
  const label = document.createElement("strong");
  label.textContent = department;
  heading.append(label);
  return heading;
}

function loadNodeGraphModuleGroupsLocal() {
  if (!nodeGraphLocalDefaultPresetAllowed()) {
    return {};
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(nodeGraphModuleGroupStorageKey) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function saveNodeGraphModuleGroupsLocal(groups) {
  if (!nodeGraphLocalDefaultPresetAllowed()) {
    return false;
  }
  try {
    window.localStorage.setItem(nodeGraphModuleGroupStorageKey, JSON.stringify(groups));
    return true;
  } catch {
    return false;
  }
}

function createNodeGraphModuleGroupButton(name, group) {
  const card = document.createElement("div");
  card.className = "scene-context-store-card";
  card.dataset.moduleGroup = name;
  const meta = document.createElement("span");
  meta.className = "scene-context-store-card-meta";
  meta.textContent = "circuit preset";
  const label = document.createElement("strong");
  label.textContent = name;
  const description = document.createElement("span");
  description.className = "scene-context-store-card-description";
  description.textContent = `${group?.nodes?.length || 0} modules saved from the modular view.`;
  const actions = document.createElement("span");
  actions.className = "scene-context-store-card-actions";
  const add = document.createElement("button");
  add.type = "button";
  add.dataset.contextGroup = name;
  add.textContent = "Add group";
  add.addEventListener("click", (event) => {
    event.stopPropagation();
    addNodeGraphModuleGroupFromBrowser(name);
  });
  actions.append(add);
  card.append(meta, label, description, actions);
  return card;
}

function renderNodeGraphModuleGroupCatalog() {
  const shell = document.getElementById("nodeModuleGroups");
  const target = document.getElementById("nodeModuleGroupList");
  if (!shell || !target) {
    return;
  }
  const groups = loadNodeGraphModuleGroupsLocal();
  const names = Object.keys(groups).sort((a, b) => a.localeCompare(b));
  target.innerHTML = "";
  for (const name of names) {
    target.append(createNodeGraphModuleGroupButton(name, groups[name]));
  }
  shell.hidden = names.length === 0;
}

function closeNodeGraphModuleCollectionsMenu() {
  const menu = document.getElementById("nodeModuleCollectionsMenu");
  if (menu) {
    menu.hidden = true;
  }
}

function openNodeGraphModuleCollectionsMenu(event) {
  const target = event.target.closest?.("#nodeModuleDepartmentSearchShell");
  if (!target || document.getElementById("nodeModuleShopView")?.hidden) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  closeNodeSceneContextMenu();
  closeNodeScopeContextMenu();
  positionNodeSceneContextMenu(
    document.getElementById("nodeModuleCollectionsMenu"),
    event.clientX,
    event.clientY,
    false,
  );
  return true;
}

function handleNodeGraphModuleCollectionsPointerDown(event) {
  const menu = document.getElementById("nodeModuleCollectionsMenu");
  if (
    !menu ||
    menu.hidden ||
    event.target.closest?.("#nodeModuleCollectionsMenu, #nodeModuleDepartmentSearchShell")
  ) {
    return;
  }
  closeNodeGraphModuleCollectionsMenu();
}

function renderNodeGraphModuleStoreCatalog() {
  const available = document.getElementById("nodeModuleShopAvailable");
  const shopView = document.getElementById("nodeModuleShopView");
  const departmentList = document.getElementById("nodeModuleDepartmentList");
  const departmentView = document.getElementById("nodeModuleDepartmentView");
  const departmentTitle = document.getElementById("nodeModuleDepartmentTitle");
  const departmentSummary = document.getElementById("nodeModuleDepartmentSummary");
  const departmentBack = document.getElementById("nodeModuleDepartmentBack");
  if (!available || !shopView || !departmentList || !departmentView) {
    return;
  }

  available.innerHTML = "";
  departmentList.innerHTML = "";

  const entries = nodeGraphModuleStoreEntries();
  const activeDepartment = nodeGraphModuleStoreDepartments.includes(nodeGraphMvp.moduleStoreDepartment)
    ? nodeGraphMvp.moduleStoreDepartment
    : "";
  if (departmentBack) {
    departmentBack.onclick = (event) => {
      event.stopPropagation();
      setNodeGraphModuleStoreDepartment("");
    };
  }

  for (const department of nodeGraphModuleStoreDepartments) {
    const departmentEntries = entries.filter((item) => item.category === department);
    if (departmentEntries.length) {
      departmentList.append(createNodeGraphModuleDepartmentButton(department, departmentEntries));
    }
  }

  shopView.hidden = Boolean(activeDepartment);
  departmentView.hidden = !activeDepartment;
  if (departmentTitle) {
    departmentTitle.textContent = activeDepartment || "Departments";
  }
  if (departmentSummary) {
    departmentSummary.textContent = activeDepartment
      ? nodeGraphModuleStoreDepartmentAds[activeDepartment]?.pitch || ""
      : "";
  }

  if (!activeDepartment) {
    renderNodeGraphModuleGroupCatalog();
    return;
  }

  for (const department of nodeGraphModuleStoreDepartments) {
    if (department !== activeDepartment) {
      continue;
    }
    const departmentEntries = entries.filter((item) => item.category === department);
    if (!departmentEntries.length) {
      continue;
    }
    available.append(createNodeGraphModuleStoreDepartmentHeading(department));
    for (const entry of departmentEntries) {
      available.append(createNodeGraphModuleStoreButton(entry));
    }
  }
  renderNodeGraphModuleGroupCatalog();
}

function openNodeGraphModuleShop(point = null) {
  nodeGraphMvp.sceneContextPoint = point;
  nodeGraphMvp.sceneContextTargetNode = null;
  nodeGraphMvp.sceneContextTargetWire = null;
  nodeGraphMvp.moduleStoreDepartment = "";
  closeNodeSceneContextMenu();
  setNodeGraphViewMode("shop");
}

function loadNodeGraphModuleStoreStateLocal() {
  renderNodeGraphModuleStoreCatalog();
}
