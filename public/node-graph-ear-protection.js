const nodeGraphEarProtectionDefaults = Object.freeze({
  clipLimit: 0.8,
  decrementTime: 0.15,
  incrementTime: 0.0005,
  highPassFrequency: 1000,
  threshold: Math.pow(10, 6 / 20),
});

const nodeGraphEarProtectionPatchRecoveryStorageKey = "soemdsp.nodeGraph.earProtectionPatchRecovery";

function nodeGraphEarProtectionRecoveryStores() {
  return [window.localStorage, window.sessionStorage].filter(Boolean);
}

function nodeGraphOnePoleHighPassCoefficients(frequency, sampleRate) {
  const rate = Math.max(1, Number(sampleRate) || 44100);
  const frequencyValue = Math.max(0, Number(frequency) || 0);
  const w = Math.min((Math.PI * 2) / rate, 0.000142475857) * frequencyValue;
  const a1 = Math.exp(-w);
  const b0 = 0.5 * (1 + a1);
  return { a1, b0, b1: -b0 };
}

function createNodeGraphEarProtector(sampleRate = nodeGraphMvp.sampleRate, options = {}) {
  const settings = { ...nodeGraphEarProtectionDefaults, ...options };
  const rate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);
  const increment = 1 / Math.max(1, settings.incrementTime * rate);
  const decrement = 1 / Math.max(1, settings.decrementTime * rate);
  const highPass = nodeGraphOnePoleHighPassCoefficients(settings.highPassFrequency, rate);
  let counter = 0;
  let inputBuffer = 0;
  let outputBuffer = 0;

  const run = (left = 0, right = left) => {
    const mono = (Number(left) + Number(right)) * 0.5 || 0;
    outputBuffer = highPass.b0 * mono + highPass.b1 * inputBuffer + highPass.a1 * outputBuffer;
    inputBuffer = mono;
    if (Math.abs(outputBuffer) >= settings.threshold) {
      counter += increment;
    }
    const gain = counter >= 1 ? 0 : 1;
    counter = Math.max(0, Math.min(2, counter)) - decrement;
    return gain;
  };

  return {
    protect(left = 0, right = left) {
      const gain = run(left, right);
      return {
        gain,
        left: nodeGraphClampProtectedSample((Number(left) || 0) * gain, settings.clipLimit),
        muted: gain <= 0,
        right: nodeGraphClampProtectedSample((Number(right) || 0) * gain, settings.clipLimit),
      };
    },
  };
}

function nodeGraphClampProtectedSample(value, limit = nodeGraphEarProtectionDefaults.clipLimit) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(-limit, Math.min(limit, value));
}

function nodeGraphEarProtectionIsTripped() {
  return Boolean(globalThis.nodeGraphEarProtectionTripped);
}

function nodeGraphEarProtectionFaultDetail(details = {}) {
  const source = details.source ? `${details.source} ` : "";
  const count = Number(details.protectionMuteCount ?? details.count) || 0;
  const countText = count ? ` after ${count} protected frame${count === 1 ? "" : "s"}` : "";
  return `${source}audio output locked${countText}. Refresh the page, your patch will be saved.`;
}

function nodeGraphSaveEarProtectionPatchRecovery(details = {}) {
  try {
    if (typeof serializeNodeGraphPatch !== "function" || typeof nodeGraphMvp === "undefined") {
      return false;
    }
    const patchText = serializeNodeGraphPatch();
    const recovery = JSON.stringify({
      details,
      patchText,
      patchFingerprint: typeof nodeGraphPatchFingerprint === "function" ? nodeGraphPatchFingerprint(patchText) : "",
      savedAt: new Date().toISOString(),
      version: 1,
    });
    let saved = false;
    for (const store of nodeGraphEarProtectionRecoveryStores()) {
      try {
        store.setItem(nodeGraphEarProtectionPatchRecoveryStorageKey, recovery);
        saved = true;
      } catch (_error) {
        // Try the next browser storage surface.
      }
    }
    return saved;
  } catch (error) {
    console.warn("Ear protection patch recovery save failed", error);
    return false;
  }
}

function nodeGraphConsumeEarProtectionPatchRecovery() {
  try {
    const stores = nodeGraphEarProtectionRecoveryStores();
    const text = stores
      .map((store) => {
        try {
          return store.getItem(nodeGraphEarProtectionPatchRecoveryStorageKey);
        } catch (_error) {
          return "";
        }
      })
      .find(Boolean);
    if (!text) {
      return null;
    }
    for (const store of stores) {
      try {
        store.removeItem(nodeGraphEarProtectionPatchRecoveryStorageKey);
      } catch (_error) {
        // Storage cleanup is best effort.
      }
    }
    const recovery = JSON.parse(text);
    const patchText = String(recovery.patchText || "");
    if (!patchText || typeof loadNodeGraphPatchFromScript !== "function") {
      return null;
    }
    return {
      ...recovery,
      patch: loadNodeGraphPatchFromScript(patchText),
    };
  } catch (error) {
    console.warn("Ear protection patch recovery load failed", error);
    try {
      for (const store of nodeGraphEarProtectionRecoveryStores()) {
        store.removeItem(nodeGraphEarProtectionPatchRecoveryStorageKey);
      }
    } catch (_error) {
      // Storage cleanup is best effort.
    }
    return null;
  }
}

function nodeGraphApplyEarProtectionFaultUi(details = {}) {
  document.body?.classList.add("node-ear-protection-tripped");

  const detail = document.getElementById("nodeEarProtectionFaultDetail");
  if (detail) {
    detail.textContent = nodeGraphEarProtectionFaultDetail(details);
  }

  const fault = document.getElementById("nodeEarProtectionFault");
  if (fault) {
    fault.hidden = false;
  }

  try {
    const renderStatus = document.getElementById("nodeGraphRenderStatus");
    if (renderStatus) {
      renderStatus.textContent = "protection tripped";
      renderStatus.className = "pill warn";
    }
    const audioStats = document.getElementById("nodeAudioStats");
    if (audioStats) {
      audioStats.textContent = `audio locked / protected ${Number(details.protectionMuteCount ?? details.count) || 1}`;
      audioStats.className = "pill warn";
      audioStats.dataset.renderProtectionMutes = String(Number(details.protectionMuteCount ?? details.count) || 1);
    }
    if (typeof labelPrimaryAudioTitle === "function") {
      labelPrimaryAudioTitle("Ear Protection tripped. Refresh the page to reset audio.", false);
    }
    if (typeof labelPrimaryAudio === "function") {
      labelPrimaryAudio("Audio locked until refresh", false);
    }
    if (typeof setNodeGraphLiveStatus === "function") {
      setNodeGraphLiveStatus("protection tripped", "warn");
    }
    if (typeof setNodeGraphLiveEngineStatus === "function") {
      setNodeGraphLiveEngineStatus("audio locked", "warn");
    }
    if (typeof setNodeGraphLiveEngineTitle === "function") {
      setNodeGraphLiveEngineTitle("Ear Protection tripped. Refresh the page to reset audio.");
    }
    if (typeof setNodeGraphLivePlanStatus === "function") {
      setNodeGraphLivePlanStatus("refresh required", "warn");
    }
    if (typeof setNodeGraphLiveScheduleStatus === "function") {
      setNodeGraphLiveScheduleStatus("ear protection tripped; refresh required", "warn");
    }
    if (typeof setNodeGraphLiveMeter === "function") {
      setNodeGraphLiveMeter(0, 0, 0, Number(details.protectionMuteCount ?? details.count) || 1);
    }
    if (typeof renderNodeGraphLiveControls === "function") {
      renderNodeGraphLiveControls(false);
    }
  } catch (_error) {
    // Status surfaces are helpful but not required for the safety latch.
  }
}

function nodeGraphTripEarProtection(details = {}) {
  if (nodeGraphEarProtectionIsTripped()) {
    nodeGraphApplyEarProtectionFaultUi(details);
    return true;
  }
  nodeGraphSaveEarProtectionPatchRecovery(details);
  globalThis.nodeGraphEarProtectionTripped = true;
  nodeGraphApplyEarProtectionFaultUi(details);

  try {
    if (typeof stopNodeGraphRenderedPlayback === "function") {
      stopNodeGraphRenderedPlayback();
    }
  } catch (_error) {
    // Best effort; the latch state below still prevents playback restart.
  }
  try {
    if (typeof clearNodeGraphRenderedAudioElement === "function") {
      clearNodeGraphRenderedAudioElement();
    }
  } catch (_error) {
    // Best effort; live output is the primary speaker path.
  }
  try {
    if (typeof setNodeGraphLiveOutputMuted === "function") {
      setNodeGraphLiveOutputMuted(true);
    }
  } catch (_error) {
    // Best effort; the output engine may not exist.
  }
  try {
    if (typeof nodeGraphMvp !== "undefined") {
      nodeGraphMvp.live.outputEnabled = false;
      nodeGraphMvp.live.outputToggleSerial += 1;
    }
    if (typeof stopNodeGraphLiveAudio === "function") {
      const stopResult = stopNodeGraphLiveAudio();
      if (stopResult && typeof stopResult.finally === "function") {
        stopResult.finally(() => nodeGraphApplyEarProtectionFaultUi(details));
      }
    }
  } catch (_error) {
    // Best effort; refresh is still required to clear the latch.
  }
  return true;
}
