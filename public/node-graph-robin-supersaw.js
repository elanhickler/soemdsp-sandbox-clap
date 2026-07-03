// Shared offline JS mirror of native_modules/robin_supersaw -- RobinSupersaw,
// a proof-of-concept supersaw built on Robin Schmidt's pitch dithering
// technique. See native_modules/robin_supersaw/robin_supersaw.cpp for the
// full derivation and links to the reference implementation
// (RobinSchmidt/RS-MET's rsPitchDitherOsc).

function nodeGraphRobinSupersawCalcCycleDistribution(c) {
  const ci = Math.floor(c);
  const cf = c - ci;
  let c2 = ci;
  if (cf >= 0.5) c2 += 1;
  const c1 = c2 - 1;
  const c3 = c2 + 1;

  const e1 = c1 - c;
  const e2 = c2 - c;
  const e3 = c3 - c;
  const v1 = e1 * e1;
  const v2 = e2 * e2;
  const v3 = e3 * e3;
  const v = 0.25;
  const d1 = v - v1;
  const d2 = v - v2;
  const d3 = v - v3;
  const s = 1 / (e3 * (v1 - v2) - e2 * (v1 - v3) + e1 * (v2 - v3));

  return {
    lenMid: c2,
    probShort: (d2 * e3 - d3 * e2) * s,
    probMid: (d3 * e1 - d1 * e3) * s,
  };
}

function nodeGraphRobinSupersawCreateVoice() {
  return {
    sampleCount: 0,
    lenNow: 100,
    lenMid: 100,
    probShort: 0,
    probMid: 1,
    phaseSlope: 1 / 99,
  };
}

function createNodeGraphRobinSupersawState() {
  const voices = [];
  for (let i = 0; i < 9; i++) voices.push(nodeGraphRobinSupersawCreateVoice());
  return { voices };
}

// rsPitchDitherOsc<T>::updateCycleLength(), transcribed.
function nodeGraphRobinSupersawUpdateCycleLength(voice) {
  const r = Math.random();
  if (r < voice.probShort) {
    voice.lenNow = voice.lenMid - 1;
  } else if (r < voice.probShort + voice.probMid) {
    voice.lenNow = voice.lenMid;
  } else {
    voice.lenNow = voice.lenMid + 1;
  }
  const maxCount = Math.max(1, voice.lenNow - 1);  // phasorRangeClosed = true
  voice.phaseSlope = 1 / maxCount;
}

// rsPitchDitherOsc<T>::getSamplePhasor() + updateSampleCount(), transcribed.
function nodeGraphRobinSupersawGetSamplePhasor(voice) {
  const p = voice.phaseSlope * voice.sampleCount;
  voice.sampleCount += 1;
  if (voice.sampleCount >= voice.lenNow) {
    voice.sampleCount = 0;
    nodeGraphRobinSupersawUpdateCycleLength(voice);
  }
  return p;
}

function nodeGraphRobinSupersawSawFromPhasor(phasor) {
  return 2 * phasor - 1;
}

// options: { frequencyHz, sampleRate, detuneCents (0-100), voices (1-9), level }
function nodeGraphRobinSupersawSample(state, options = {}) {
  const sampleRate = Number(options.sampleRate) > 1 ? Number(options.sampleRate) : 48000;
  const safeFrequency = Number(options.frequencyHz) > 1 ? Number(options.frequencyHz) : 1;
  const numVoices = clampNodeSliderValue(Math.round(Number(options.voices) || 1), 1, 9);
  const spreadCents = clampNodeSliderValue(Number(options.detuneCents) || 0, 0, 100);
  const level = Number(options.level) || 0;

  let sum = 0;
  for (let i = 0; i < numVoices; i++) {
    let centsOffset = 0;
    if (numVoices > 1) {
      const t = i / (numVoices - 1);
      centsOffset = (t - 0.5) * spreadCents;
    }
    const ratio = Math.pow(2, centsOffset / 1200);
    const voiceFreq = safeFrequency * ratio;
    const meanCycleLength = sampleRate / Math.max(1, voiceFreq);

    const voice = state.voices[i];
    const dist = nodeGraphRobinSupersawCalcCycleDistribution(meanCycleLength);
    voice.lenMid = dist.lenMid;
    voice.probShort = dist.probShort;
    voice.probMid = dist.probMid;
    sum += nodeGraphRobinSupersawSawFromPhasor(nodeGraphRobinSupersawGetSamplePhasor(voice));
  }

  let sample = sum / numVoices;
  if (!Number.isFinite(sample)) sample = 0;
  const out = clampNodeSliderValue(sample, -1.5, 1.5) * level;
  return { Out: out };
}
