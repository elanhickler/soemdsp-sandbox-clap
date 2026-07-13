NodeLiveAudioProcessor.prototype.createEdgeTriggerState = function createEdgeTriggerState() {
    return { wasHigh: false, upPulseSamples: 0, downPulseSamples: 0, nativeHandle: 0 };
  };

NodeLiveAudioProcessor.prototype.edgeTriggerSampleJs = function edgeTriggerSampleJs(state, digitalIn, params, rate) {
    const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
    const pulseTime = Math.max(0, this.safeFilterNumber(params.pulseTime, state));
    const triggerLevel = this.safeFilterNumber(params.triggerLevel, state);
    const pulseLevel = this.safeFilterNumber(params.pulseLevel, state);

    const high = this.safeFilterNumber(digitalIn, state) > 0.5;
    const risingEdge = high && !state.wasHigh;
    const fallingEdge = !high && state.wasHigh;
    state.wasHigh = high;

    let upTrigger = 0;
    if (risingEdge) {
      upTrigger = triggerLevel;
      state.upPulseSamples = Math.max(1, Math.round(pulseTime * safeRate));
    }
    let downTrigger = 0;
    if (fallingEdge) {
      downTrigger = triggerLevel;
      state.downPulseSamples = Math.max(1, Math.round(pulseTime * safeRate));
    }

    const upPulse = state.upPulseSamples > 0 ? pulseLevel : 0;
    const downPulse = state.downPulseSamples > 0 ? pulseLevel : 0;
    state.upPulseSamples = Math.max(0, state.upPulseSamples - 1);
    state.downPulseSamples = Math.max(0, state.downPulseSamples - 1);

    return {
      "Up Trigger": this.safeFilterNumber(upTrigger, state),
      "Up Pulse": this.safeFilterNumber(upPulse, state),
      "Down Trigger": this.safeFilterNumber(downTrigger, state),
      "Down Pulse": this.safeFilterNumber(downPulse, state),
    };
  };

NodeLiveAudioProcessor.prototype.edgeTriggerSample = function edgeTriggerSample(state, digitalIn, params, rate = sampleRate) {
    if (this.nativeEdgeTriggerReady) {
      try {
        if (!state.nativeHandle) {
          state.nativeHandle = this.nativeEdgeTrigger.soemdsp_edge_trigger_create();
        }
        if (state.nativeHandle) {
          const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
          const upTrigger = this.safeFilterNumber(
            this.nativeEdgeTrigger.soemdsp_edge_trigger_sample(
              state.nativeHandle,
              this.safeFilterNumber(digitalIn, state),
              Math.max(0, this.safeFilterNumber(params.pulseTime, state)),
              this.safeFilterNumber(params.triggerLevel, state),
              this.safeFilterNumber(params.pulseLevel, state),
              safeRate,
            ),
            state,
          );
          const upPulse = this.safeFilterNumber(this.nativeEdgeTrigger.soemdsp_edge_trigger_up_pulse?.(state.nativeHandle) || 0, state);
          const downTrigger = this.safeFilterNumber(this.nativeEdgeTrigger.soemdsp_edge_trigger_down_trigger?.(state.nativeHandle) || 0, state);
          const downPulse = this.safeFilterNumber(this.nativeEdgeTrigger.soemdsp_edge_trigger_down_pulse?.(state.nativeHandle) || 0, state);
          return {
            "Up Trigger": upTrigger,
            "Up Pulse": upPulse,
            "Down Trigger": downTrigger,
            "Down Pulse": downPulse,
          };
        }
      } catch (error) {
        this.nativeEdgeTriggerReady = false;
        state.nativeHandle = 0;
        this.port.postMessage({
          type: "nativeModuleStatus",
          name: "edge_trigger",
          status: "disabled",
          message: String(error?.message || error || "native Edge Trigger failed"),
        });
      }
    }
    return this.edgeTriggerSampleJs(state, digitalIn, params, rate);
  };
