NodeLiveAudioProcessor.prototype.metallicRatioSample = function metallicRatioSample(index) {
    const n = Number(index) || 0;
    const fallback = () => 0.5 * (n + Math.sqrt(n * n + 4));
    if (!this.nativeMetallicRatioReady || !this.nativeMetallicRatio?.soemdsp_metallic_ratio_sample) {
      return fallback();
    }
    try {
      return this.safeFilterNumber(this.nativeMetallicRatio.soemdsp_metallic_ratio_sample(n), null);
    } catch (error) {
      this.nativeMetallicRatioReady = false;
      this.port.postMessage({
        type: "nativeModuleStatus",
        name: "metallic_ratio",
        status: "disabled",
        message: String(error?.message || error || "native Metallic Ratio failed"),
      });
      return fallback();
    }
  };

