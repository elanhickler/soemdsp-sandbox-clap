NodeLiveAudioProcessor.prototype.createChordSequencerState = function createChordSequencerState() {
    return { clockWasHigh: false, resetWasHigh: false, stepIndex: 0, nativeHandle: 0 };
  };

NodeLiveAudioProcessor.prototype.chordSequencerRotateLeft12 = function chordSequencerRotateLeft12(mask, amount) {
    const n = ((amount % 12) + 12) % 12;
    if (n === 0) return mask & 0xFFF;
    return ((mask << n) | (mask >> (12 - n))) & 0xFFF;
  };

NodeLiveAudioProcessor.prototype.chordSequencerSampleJs = function chordSequencerSampleJs(state, options = {}) {
    const progressions = [
      [[0, 0], [7, 0], [9, 1], [5, 0]],
      [[0, 0], [5, 0], [7, 0], [0, 0]],
      [[2, 1], [7, 0], [0, 0], [0, 0]],
      [[9, 1], [5, 0], [0, 0], [7, 0]],
      [[0, 0], [9, 1], [5, 0], [7, 0]],
      [[0, 0], [9, 1], [2, 1], [7, 0]],
    ];
    const majorTriadMask = 0x91;
    const minorTriadMask = 0x89;
    const clockHigh = Number(options.clock) > 0;
    const resetHigh = Number(options.reset) > 0;
    const progressionIndex = Math.max(0, Math.min(progressions.length - 1, Math.round(Number(options.progression) || 0)));
    const level = Number(options.level) || 0;

    if (resetHigh && !state.resetWasHigh) {
      state.stepIndex = 0;
    }
    state.resetWasHigh = resetHigh;

    if (clockHigh && !state.clockWasHigh) {
      state.stepIndex = (state.stepIndex + 1) % progressions[progressionIndex].length;
    }
    state.clockWasHigh = clockHigh;

    const [root, quality] = progressions[progressionIndex][state.stepIndex];
    const baseMask = quality === 0 ? majorTriadMask : minorTriadMask;

    return {
      Scale: this.chordSequencerRotateLeft12(baseMask, root),
      Root: (60 + root) / 120,
      Gate: (clockHigh ? 1 : 0) * level,
    };
  };

NodeLiveAudioProcessor.prototype.chordSequencerSample = function chordSequencerSample(state, options = {}) {
    if (
      this.nativeChordSequencerReady &&
      this.nativeChordSequencer?.soemdsp_chord_sequencer_create &&
      this.nativeChordSequencer?.soemdsp_chord_sequencer_sample &&
      this.nativeChordSequencer?.soemdsp_chord_sequencer_scale &&
      this.nativeChordSequencer?.soemdsp_chord_sequencer_root
    ) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativeChordSequencer.soemdsp_chord_sequencer_create();
        }
        if (state.nativeHandle) {
          const clockHigh = Number(options.clock) > 0 ? 1 : 0;
          const resetHigh = Number(options.reset) > 0 ? 1 : 0;
          const progression = Math.max(0, Math.min(5, Math.round(Number(options.progression) || 0)));
          const level = Number(options.level) || 0;
          this.nativeChordSequencer.soemdsp_chord_sequencer_sample(
            state.nativeHandle,
            clockHigh,
            resetHigh,
            progression,
          );
          const scale = this.nativeChordSequencer.soemdsp_chord_sequencer_scale(state.nativeHandle, progression);
          const root = this.nativeChordSequencer.soemdsp_chord_sequencer_root(state.nativeHandle, progression);
          return {
            Scale: scale,
            Root: root,
            Gate: clockHigh * level,
          };
        }
      } catch (error) {
        this.nativeChordSequencerReady = false;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "chord_sequencer",
          status: "disabled",
          message: String(error?.message || error || "native Chord Sequencer failed"),
        });
      }
    }
    return this.chordSequencerSampleJs(state, options);
  };

