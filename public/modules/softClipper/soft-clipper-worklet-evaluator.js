NodeLiveAudioProcessor.prototype.nativeSoftClipperSample = function nativeSoftClipperSample(input, center = 0, width = 2) {
    const dry = Number(input) || 0;
    if (!this.nativeSoftClipperReady || !this.nativeSoftClipper?.soemdsp_soft_clipper_sample) {
      return dry;
    }
    try {
      return this.safeFilterNumber(
        this.nativeSoftClipper.soemdsp_soft_clipper_sample(
          dry,
          Number(center) || 0,
          Number(width) || 2,
        ),
        null,
      );
    } catch (error) {
      this.nativeSoftClipperReady = false;
      this.port.postMessage({
        type: "nativeModuleStatus",
        name: "soft_clipper",
        status: "disabled",
        message: String(error?.message || error || "native Soft Clipper failed"),
      });
      return dry;
    }
  };

