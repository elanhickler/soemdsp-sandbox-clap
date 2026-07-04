# POWER — combustion, rotors, and fire

**Agent designation:** POWER
**Domain:** rotor engines (helicopter blades), car engines, motorcycle
engines, rocket engines, fire, and anything else whose sound comes from
consuming gas or fuel.
**Weapon of choice, so far:** the spiral generator.

## Listen first

**[🔊 Reference audio](https://drive.google.com/drive/u/0/folders/1uV7w5D-Z_AeKHg_QCjKHevrLL8n-DWha)**

This is a simple filtered noise patch — that's the entire signal chain.
No physical model, no sample, no engine anywhere in it. It sounds
beautiful and complex anyway, and the reason for that isn't the patch —
it's the analog sound design underneath it: the specific character a
real analog filter, real noise, and real gear stamp onto a signal that
is, on paper, about as basic as synthesis gets. That's the whole thesis
of this document in one clip: cheap source, expensive-*sounding*
result, because the "expensive" part was good sound design, not a
complicated equation.

This document is POWER's field notebook — what's been found, what it
sounds/looks like, and what the actual goal is (it is not what you'd
guess).

## The find

![The spiral generator, mid-turn, scoped in PrettyScope laser mode](docs/media/spiral-generator-engine-shell.png)

That's [Jerobeam Fenderson's Spiral module](public/node-graph-jerobeam-spiral.js)
run through a laser-mode oscilloscope. Nobody built it to look like a
turbine housing or a rifled gun barrel or a piece of a jet intake — it's
a phasor folded through trisaw shaping and a couple of rotation stages —
but that's what it looks like anyway. A coiled, banded shell with a
bright throat at the center, winding open. Blade-like. Combustion-like.
That resemblance is the whole reason POWER exists as a designation:
whatever curve produces *that shape* is probably not far from the curve
that produces *that sound*, because both are the same story — energy
spiraling outward from a center, in bands, at a rate that decays or
grows on its way out.

The spiral generator is the current weapon of choice not because it was
designed for this, but because it's the first thing in the sandbox that
visually rhymes with an engine. Everything below is chasing that rhyme
into sound.

## Reference targets

Two videos are the north star for what "engine-like" is supposed to
mean here:

- **[Engine-like effects](https://www.youtube.com/watch?v=jz1s7PF_Cao)**
  — what a rotor/engine timbre actually *is*: layered periodic energy,
  blade-pass thumps riding on top of a droning fundamental, harmonics
  that thicken and roughen as RPM climbs, not a clean tone.
- **[Gas-powered spirals](https://youtu.be/w2mdrUOxADg)** — the visual
  case for the spiral connection above: fuel-driven rotational motion
  that traces spiral paths, the same geometry the Spiral module already
  produces for free.

Both are reference, not spec — the goal isn't to reproduce either video
frame-for-frame, it's to keep checking the work against "does this feel
like the same *kind* of thing."

## What "done" looks like: cars, specifically

A car engine is, underneath the mechanics, a small number of repeating
events happening at a rate you can steer:

- **Firing order / cylinder count** sets a base pulse rate and a
  characteristic "roughness" — a 4-cylinder chugs, a V8 burbles, a
  flat-6 has that off-beat flutter, and it's all the same underlying
  idea (N pulses per revolution) with different N and different pulse
  spacing.
- **RPM** is just frequency. Idle burble, mid-range pull, redline
  scream — one parameter, swept.
- **Load** (throttle) changes *timbre*, not just loudness — harder
  pulls sound rougher and more harmonically dense, off-throttle
  overrun sounds hollower and pops/crackles at the edges.
- **Exhaust/intake resonance** adds a formant-like coloration on top —
  the reason a Civic and a Mustang don't sound alike at the same RPM
  even though both are "an engine."

None of that requires simulating combustion. It requires finding the
small set of oscillator/noise/filter parameters that, driven by RPM and
load, produce the *impression* of all of the above.

## The actual goal: emulation, not simulation

This is the part worth being explicit about, because it's easy to drift
toward the expensive version by accident.

**The goal is not physical modeling.** Nobody here is solving
combustion chemistry, gas dynamics, or finite-element vibration of an
engine block in real time. That's a legitimate field (it's what
full acoustic-simulation engine-sound tools do), and it's also slow,
heavy, and massively overkill for what this is for.

**The goal is emulation: find the *simplest* equation that produces
the *desired* behavior.** Not the most accurate equation — the
simplest one that still fools the ear and the eye. If a spiral phasor
with the right trisaw curve and the right harmonic stacking sounds like
a straight-six at 3000 RPM, that's the answer, even though there is no
straight-six anywhere in the math. This is the same philosophy as
Jerobeam Fenderson's whole catalog in this sandbox: cheap, expressive,
game-plausible curves standing in for things that would otherwise need
a physics engine.

The reason that matters, concretely:

> **Imagine a game where you can tune the engine, and it also tunes
> the sound.**

Not a game that plays back a pre-recorded engine sample pitched up and
down (every racing game since forever) — a game where the *same knobs*
that define the engine's behavior (cylinder count, redline, boost,
displacement, whatever) also drive a synthesis graph that produces the
matching sound, live, with zero samples and zero physical simulation.
Build an engine in a garage, hear it change as you build it. That only
works if the underlying model is cheap enough to run per-sample in
real time and simple enough to expose as a handful of musical
parameters — which is exactly the constraint the spiral generator (and
everything else in this sandbox) already satisfies.

## Status

Early. The spiral generator is confirmed as a promising visual/motion
match for rotor and combustion energy; it has not yet been tuned or
extended into an actual engine-sound patch. Next steps live wherever
POWER picks this back up — this file is the marker for where that
starts.
