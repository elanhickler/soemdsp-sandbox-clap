(function (settings) {
  window.nodeUiDevBundledDefaultSettings = settings;
  document.documentElement.dataset.nodeUiDevBundledDefaultSettings = JSON.stringify(settings);
})({
  "format": {
    "kind": "soemdsp-sandbox-user-ui-settings",
    "version": 3
  },
  "controls": {
    "mouseLightEnabled": true,
    "showOriginMarker": false,
    "modularShaderEnabled": false,
    "scopeBloomEnabled": false,
    "settingsHeaderTextSize": 100,
    "uiDevButtonTextSize": 50,
    "liveToggleTextSize": 76,
    "modularHeaderButtonBackground": 62,
    "tooltipTextSize": 14,
    "minimumGridBrightness": 0,
    "moduleLightSpread": 78,
    "textGlowLevel": 18,
    "moduleGridInset": 6,
    "moduleRoundness": 10,
    "gridColor": "#ffffff",
    "workspaceBackgroundColor": "#0d0d0d",
    "settingsHeaderTopRatio": 62,
    "settingsHeaderPadding": 2,
    "floatingWindowHeaderHeight": 30,
    "sliderDotSize": 4,
    "moduleTitleFont": "cascadia",
    "moduleTitleHeight": 26,
    "moduleTitleTextFill": 62,
    "moduleIoSectionHeight": 24,
    "moduleNodeSize": 57,
    "sliderWidth": 100,
    "sliderHeight": 28,
    "sliderLabelColor": "#cfdde5",
    "sliderValueColor": "#ffffff",
    "sliderUnitColor": "#7fc7d9",
    "sliderFillHoverColor": "#7fc7d9",
    "sliderFillHoverAlpha": 28,
    "nodeGlowSize": 50,
    "wirePatchPointSize": 36,
    "wireThickness": 19,
    "traceWireThickness": 1,
    "choiceSlideEmptyBorder": 2,
    "choiceDividerHeight": 35,
    "choiceSlideDebugBoxes": false,
    "bypassIconSize": 36,
    "bypassIconGlowSpread": 40,
    "bypassIconGlowColor": "#f25d5d",
    "bypassIconOnColor": "#f7b758",
    "bypassOnBackgroundColor": "#5c1818",
    "bypassOffBackgroundColor": "#000000",
    "moveSymbolSize": 60,
    "closeIconSize": 50,
    "settingsHeaderHighlights": false
  },
  "exposedControls": {
    "mouseLightEnabled": true,
    "showOriginMarker": false,
    "modularShaderEnabled": true,
    "scopeBloomEnabled": true,
    "settingsHeaderTextSize": false,
    "uiDevButtonTextSize": false,
    "liveToggleTextSize": true,
    "modularHeaderButtonBackground": true,
    "tooltipTextSize": true,
    "minimumGridBrightness": true,
    "moduleLightSpread": true,
    "textGlowLevel": true,
    "moduleGridInset": true,
    "moduleRoundness": true,
    "gridColor": true,
    "workspaceBackgroundColor": true,
    "settingsHeaderTopRatio": false,
    "settingsHeaderPadding": false,
    "floatingWindowHeaderHeight": true,
    "sliderDotSize": true,
    "moduleTitleFont": true,
    "moduleTitleHeight": true,
    "moduleTitleTextFill": true,
    "moduleIoSectionHeight": true,
    "moduleNodeSize": true,
    "sliderWidth": true,
    "sliderHeight": true,
    "sliderLabelColor": true,
    "sliderValueColor": true,
    "sliderUnitColor": true,
    "sliderFillHoverColor": true,
    "sliderFillHoverAlpha": true,
    "nodeGlowSize": true,
    "wirePatchPointSize": true,
    "wireThickness": true,
    "traceWireThickness": true,
    "choiceSlideEmptyBorder": false,
    "choiceDividerHeight": true,
    "choiceSlideDebugBoxes": false,
    "bypassIconSize": false,
    "bypassIconGlowSpread": false,
    "bypassIconGlowColor": false,
    "bypassIconOnColor": false,
    "bypassOnBackgroundColor": false,
    "bypassOffBackgroundColor": false,
    "moveSymbolSize": false,
    "closeIconSize": false,
    "settingsHeaderHighlights": false
  },
  "nodeColors": {
    "--node-module-fill": "#171a1f",
    "--node-module-stroke": "#f3f1ec",
    "--node-module-selected-stroke": "#e2a86d",
    "--node-module-drag-stroke": "#e2a86d",
    "--node-port-idle-fill": "#000000",
    "--node-port-idle-stroke": "#f3f1ec",
    "--node-port-hover-fill": "#f3f1ec",
    "--node-port-hover-stroke": "#f3f1ec",
    "--node-input-fill": "#7fc7d9",
    "--node-input-stroke": "#7fc7d9",
    "--node-output-fill": "#e2a86d",
    "--node-output-stroke": "#e2a86d",
    "--node-mod-input-fill": "#b184ff",
    "--node-mod-input-stroke": "#b184ff",
    "--node-param-output-fill": "#66e0a3",
    "--node-param-output-stroke": "#66e0a3"
  },
  "view": {
    "gridVisible": false,
    "moduleButtonsVisible": true,
    "moduleInterfaceControlsVisible": true,
    "moduleOscilloscopesVisible": true,
    "moduleSlidersVisible": true,
    "moduleScopeBackgroundColor": "#000000",
    "moduleScopeBurn": 0,
    "moduleScopeDecay": 0,
    "globalSmoothingSamples": 44100,
    "globalSmoothingManual": true,
    "moduleScopeDotCore1Enabled": true,
    "moduleScopeDotCore1Size": 0.01,
    "moduleScopeDotCore1Brightness": 0.1,
    "moduleScopeDotCore1Color": "#ffffff",
    "moduleScopeDotCore2Enabled": true,
    "moduleScopeDotCore2Size": 4.29,
    "moduleScopeDotCore2Brightness": 0.1,
    "moduleScopeDotCore2Color": "#5c0000",
    "moduleScopeFramesPerSecond": 60,
    "moduleScopeLineThickness": 1,
    "moduleScopeDiscontinuitySkipSamples": 1,
    "sliderLayout": "text-inside",
    "sliderAmountVisible": false,
    "sliderPositionVisible": true,
    "hideMouseWhileDragging": true,
    "moduleCatalogVisibility": {
      "osc": {
        "developer": true,
        "home": false
      },
      "additiveOsc": {
        "developer": true,
        "home": false
      },
      "gpuAdditiveOsc": {
        "developer": true,
        "home": false
      },
      "distortionOscillator": {
        "developer": true,
        "home": false
      },
      "dsfOscillator": {
        "developer": true,
        "home": false
      },
      "ellipsoid": {
        "developer": true,
        "home": false
      },
      "polyBlep": {
        "developer": true,
        "home": false
      },
      "fbPolyBlepOsc": {
        "developer": true,
        "home": false
      },
      "sineWavetable": {
        "developer": true,
        "home": false
      },
      "jerobeamNyqistShannon": {
        "developer": true,
        "home": false
      },
      "drumMachine": {
        "developer": true,
        "home": false
      },
      "kickDrum": {
        "developer": true,
        "home": false
      },
      "snareDrum": {
        "developer": true,
        "home": false
      },
      "clock": {
        "developer": true,
        "home": false
      },
      "transport": {
        "developer": true,
        "home": false
      },
      "clockDivider": {
        "developer": true,
        "home": false
      },
      "delayedTrigger": {
        "developer": true,
        "home": false
      },
      "buttonEvents": {
        "developer": true,
        "home": false
      },
      "nextPatch": {
        "developer": true,
        "home": false
      },
      "previousPatch": {
        "developer": true,
        "home": false
      },
      "randomClock": {
        "developer": true,
        "home": false
      },
      "triggerCounter": {
        "developer": true,
        "home": false
      },
      "triggerDivider": {
        "developer": true,
        "home": false
      },
      "stepSequencer": {
        "developer": true,
        "home": false
      },
      "melodySequencer": {
        "developer": true,
        "home": false
      },
      "chordSequencer": {
        "developer": true,
        "home": false
      },
      "arpeggiator": {
        "developer": true,
        "home": false
      },
      "spiral": {
        "developer": true,
        "home": false
      },
      "lorenzAttractor": {
        "developer": true,
        "home": false
      },
      "rosslerAttractor": {
        "developer": true,
        "home": false
      },
      "chuaAttractor": {
        "developer": true,
        "home": false
      },
      "aizawaAttractor": {
        "developer": true,
        "home": false
      },
      "thomasAttractor": {
        "developer": true,
        "home": false
      },
      "halvorsenAttractor": {
        "developer": true,
        "home": false
      },
      "noise": {
        "developer": true,
        "home": false
      },
      "stereoNoise": {
        "developer": true,
        "home": false
      },
      "noiseGenerator": {
        "developer": true,
        "home": false
      },
      "randomWalk": {
        "developer": true,
        "home": false
      },
      "fractalBrownianNoise": {
        "developer": true,
        "home": false
      },
      "clapPlugin": {
        "developer": true,
        "home": false
      },
      "codeblock": {
        "developer": true,
        "home": false
      },
      "graph": {
        "developer": true,
        "home": false
      },
      "graph2": {
        "developer": true,
        "home": false
      },
      "gain": {
        "developer": true,
        "home": false
      },
      "bias": {
        "developer": true,
        "home": false
      },
      "rotate3dTo2d": {
        "developer": true,
        "home": false
      },
      "output": {
        "developer": true,
        "home": false
      },
      "macroKnob": {
        "developer": true,
        "home": false
      },
      "bipolarKnob": {
        "developer": true,
        "home": false
      },
      "valueSlider": {
        "developer": true,
        "home": false
      },
      "rangeSlider": {
        "developer": true,
        "home": false
      },
      "midiOut": {
        "developer": true,
        "home": false
      },
      "midiNotePitch": {
        "developer": true,
        "home": false
      },
      "midiController": {
        "developer": true,
        "home": false
      },
      "keyboardController": {
        "developer": true,
        "home": false
      },
      "macroControls": {
        "developer": true,
        "home": false
      },
      "pitchModWheel": {
        "developer": true,
        "home": false
      },
      "xyPad": {
        "developer": true,
        "home": false
      },
      "portalInLeft": {
        "developer": true,
        "home": false
      },
      "portalInRight": {
        "developer": true,
        "home": false
      },
      "portalInMono": {
        "developer": true,
        "home": false
      },
      "portalOutLeft": {
        "developer": true,
        "home": false
      },
      "portalOutRight": {
        "developer": true,
        "home": false
      },
      "portalOutMono": {
        "developer": true,
        "home": false
      },
      "portalGenericInput": {
        "developer": true,
        "home": false
      },
      "portalGenericOutput": {
        "developer": true,
        "home": false
      },
      "groupInput": {
        "developer": true,
        "home": false
      },
      "groupOutput": {
        "developer": true,
        "home": false
      },
      "audioPlayer": {
        "developer": true,
        "home": false
      },
      "samplePlayer": {
        "developer": true,
        "home": false
      },
      "sampleLooper": {
        "developer": true,
        "home": false
      },
      "highpass": {
        "developer": true,
        "home": false
      },
      "lowpass": {
        "developer": true,
        "home": false
      },
      "bandpass": {
        "developer": true,
        "home": false
      },
      "cookbookFilter": {
        "developer": true,
        "home": false
      },
      "ladderFilter": {
        "developer": true,
        "home": false
      },
      "slewLimiter": {
        "developer": true,
        "home": false
      },
      "delayEffect": {
        "developer": true,
        "home": false
      },
      "reverbEffect": {
        "developer": true,
        "home": false
      },
      "distortionEffect": {
        "developer": true,
        "home": false
      },
      "sampleHold": {
        "developer": true,
        "home": false
      },
      "digitalCurveEnvelope": {
        "developer": true,
        "home": false
      },
      "expAdsr": {
        "developer": true,
        "home": false
      },
      "flowerChildEnvelopeFollower": {
        "developer": true,
        "home": false
      },
      "linearEnvelope": {
        "developer": true,
        "home": false
      },
      "pluckEnvelope": {
        "developer": true,
        "home": false
      },
      "vactrolEnvelope": {
        "developer": true,
        "home": false
      },
      "sandboxVisuals": {
        "developer": true,
        "home": false
      },
      "screenSpaceShader": {
        "developer": true,
        "home": false
      },
      "bloomGlow": {
        "developer": true,
        "home": false
      },
      "rgbaHsla": {
        "developer": true,
        "home": false
      },
      "chromaColor": {
        "developer": true,
        "home": false
      },
      "image": {
        "developer": true,
        "home": false
      },
      "canvas": {
        "developer": true,
        "home": false
      },
      "led": {
        "developer": true,
        "home": false
      },
      "visualOscilloscope": {
        "developer": true,
        "home": false
      },
      "traceDisplay": {
        "developer": true,
        "home": false
      },
      "parabol": {
        "developer": true,
        "home": false
      },
      "vibratoGenerator": {
        "developer": true,
        "home": false
      },
      "wowAndFlutter": {
        "developer": true,
        "home": false
      },
      "speakerProtection": {
        "developer": true,
        "home": false
      },
      "badvalMonitor": {
        "developer": true,
        "home": false
      },
      "textBox": {
        "developer": true,
        "home": false
      }
    },
    "sceneContextWindowSize": {
      "width": 144
    },
    "moduleActionWindowSize": {
      "width": 163,
      "height": 355
    },
    "workspaceWindowStatesVersion": 1,
    "workspaceWindowStates": {
      "commandCenter": {
        "open": true,
        "position": {
          "left": 14,
          "top": 126
        },
        "size": {
          "width": 144
        }
      },
      "moduleActions": {
        "open": true
      },
      "metaparameters": {
        "open": false,
        "locked": true
      },
      "oscilloscopeSettings": {
        "open": false
      },
      "patchExplorer": {
        "open": false,
        "position": {
          "left": 179,
          "top": 143
        }
      },
      "moduleBrowser": {
        "open": true,
        "position": {
          "left": 696,
          "top": 120
        },
        "size": {
          "width": 168,
          "height": 625
        }
      },
      "visibilityMenu": {
        "open": false
      },
      "uiSettings": {
        "open": false
      },
      "uiDev": {
        "open": false
      },
      "traceDisplaySettings": {
        "open": false
      }
    },
    "sharedInspectorActive": "moduleActions",
    "sharedInspectorWindowState": {
      "position": {
        "left": 12,
        "top": 417
      },
      "size": {
        "width": 163,
        "height": 355
      }
    },
    "workspaceView": {
      "pan": {
        "x": 36.26206488321313,
        "y": 40.88591846696869
      },
      "zoom": 0.8612761690424068
    },
    "moduleStoreDepartment": "",
    "savedPatchBankIndex": 0,
    "savedPatchBankName": "",
    "savedPatchGridColumns": 3,
    "savedPatchExplorerView": "banks",
    "workingPatch": {
      "activeCameraId": "camera-1",
      "audio": {
        "targetSampleRate": 44100
      },
      "bypassedNodes": [],
      "cameras": [
        {
          "color": "#ff3333",
          "enabled": true,
          "height": 488,
          "id": "camera-1",
          "midiTrigger": null,
          "name": "Camera 1",
          "resolutionHeight": 1080,
          "resolutionWidth": 1920,
          "width": 868,
          "x": 0,
          "y": 0
        }
      ],
      "codeScreen": {
        "helpers": [],
        "patchTools": [],
        "samples": [],
        "script": "",
        "scriptLanguage": "javascript",
        "slots": [],
        "ui": []
      },
      "connections": [],
      "format": {
        "kind": "soemdsp-sandbox-node-patch",
        "version": 1
      },
      "grid": {
        "heightPx": 28,
        "sizePx": 28,
        "widthPx": 28
      },
      "graphConnections": [],
      "info": {
        "author": "",
        "bank": 0,
        "bankName": "",
        "description": "",
        "name": "Init",
        "program": 0,
        "tags": ""
      },
      "modulations": [],
      "monitors": [],
      "nodes": [
        {
          "gx": 1,
          "gy": 1,
          "id": "audioPlayer-1",
          "paramMeta": {
            "level": {
              "alias": "",
              "choices": [],
              "def": 1,
              "displayChoices": false,
              "divideChoicesVisibly": false,
              "kind": "decimal",
              "linearSmoothing": true,
              "max": 1,
              "maxDigits": 3,
              "mid": 0.5,
              "min": 0,
              "nonlinearSlider": false,
              "showSign": false,
              "step": 0,
              "unboundedMax": false,
              "unboundedMin": false,
              "unit": "",
              "wraparound": false
            },
            "speed": {
              "alias": "",
              "choices": [],
              "def": 1,
              "displayChoices": false,
              "divideChoicesVisibly": false,
              "kind": "decimal",
              "linearSmoothing": false,
              "max": 10000,
              "maxDigits": 5,
              "mid": 1,
              "min": -10000,
              "nonlinearSlider": true,
              "showSign": false,
              "step": 0,
              "unboundedMax": true,
              "unboundedMin": true,
              "unit": "x",
              "wraparound": false
            },
            "start": {
              "alias": "",
              "choices": [],
              "def": 0,
              "displayChoices": false,
              "divideChoicesVisibly": false,
              "kind": "decimal",
              "linearSmoothing": false,
              "max": 1,
              "maxDigits": 3,
              "mid": 0.5,
              "min": 0,
              "nonlinearSlider": false,
              "showSign": false,
              "step": 0,
              "unboundedMax": false,
              "unboundedMin": false,
              "unit": "",
              "wraparound": false
            },
            "end": {
              "alias": "",
              "choices": [],
              "def": 1,
              "displayChoices": false,
              "divideChoicesVisibly": false,
              "kind": "decimal",
              "linearSmoothing": false,
              "max": 1,
              "maxDigits": 3,
              "mid": 0.5,
              "min": 0,
              "nonlinearSlider": false,
              "showSign": false,
              "step": 0,
              "unboundedMax": false,
              "unboundedMin": false,
              "unit": "",
              "wraparound": false
            },
            "transport": {
              "alias": "",
              "choices": [
                "Off (reset)",
                "Stop",
                "Pause",
                "Play",
                "Loop"
              ],
              "def": 4,
              "displayChoices": true,
              "divideChoicesVisibly": true,
              "kind": "decimal",
              "linearSmoothing": false,
              "max": 4,
              "maxDigits": 3,
              "mid": 2,
              "min": 0,
              "nonlinearSlider": false,
              "showSign": false,
              "step": 1,
              "unboundedMax": false,
              "unboundedMin": false,
              "unit": "",
              "wraparound": false
            }
          },
          "params": {
            "level": 1,
            "speed": 1,
            "start": 0,
            "end": 1,
            "transport": 4
          },
          "type": "audioPlayer",
          "widthGu": 8
        },
        {
          "gx": 12,
          "gy": 6,
          "id": "output",
          "paramMeta": {
            "volume": {
              "alias": "",
              "choices": [],
              "def": 0.1,
              "displayChoices": false,
              "divideChoicesVisibly": false,
              "kind": "decimal",
              "linearSmoothing": true,
              "max": 1,
              "maxDigits": 3,
              "mid": 0.1,
              "min": 0,
              "nonlinearSlider": false,
              "showSign": false,
              "step": 0,
              "unboundedMax": false,
              "unboundedMin": false,
              "unit": "",
              "wraparound": false
            }
          },
          "params": {
            "volume": 0.8
          },
          "type": "output",
          "widthGu": 6,
          "ui": {
            "buttonsHidden": true,
            "displayHeightOffsetGu": 0,
            "ioHidden": false,
            "interfaceControlsHidden": false,
            "movementLocked": false,
            "oscilloscopeHidden": true,
            "slidersHidden": true,
            "titleHidden": true
          }
        },
        {
          "gx": 15,
          "gy": 13,
          "id": "traceDisplay-1",
          "paramMeta": {
            "gain": {
              "alias": "",
              "choices": [],
              "def": 1,
              "displayChoices": false,
              "divideChoicesVisibly": false,
              "kind": "decimal",
              "linearSmoothing": true,
              "max": 8,
              "maxDigits": 3,
              "mid": 1,
              "min": 0,
              "nonlinearSlider": true,
              "showSign": false,
              "step": 0,
              "unboundedMax": false,
              "unboundedMin": false,
              "unit": "",
              "wraparound": false
            },
            "offset": {
              "alias": "",
              "choices": [],
              "def": 0,
              "displayChoices": false,
              "divideChoicesVisibly": false,
              "kind": "decimal",
              "linearSmoothing": true,
              "max": 1,
              "maxDigits": 3,
              "mid": 0,
              "min": -1,
              "nonlinearSlider": false,
              "showSign": false,
              "step": 0,
              "unboundedMax": false,
              "unboundedMin": false,
              "unit": "",
              "wraparound": false
            }
          },
          "params": {
            "gain": 1,
            "offset": 0
          },
          "type": "traceDisplay",
          "traceDisplaySettings": {
            "brightness": 0.92,
            "color": "#75ebff",
            "dot2Brightness": 0.18,
            "dot2Color": "#184fff",
            "dot2LineThickness": 4,
            "cycles": 2,
            "lineThickness": 1.4,
            "padding": 0,
            "skipSamples": 1,
            "sourceSync": true,
            "zoomSeconds": 0.05
          }
        }
      ],
      "requiredAssets": [],
      "samples": [],
      "timing": {
        "tempoBpm": 120,
        "timeSignatureDenominator": 4,
        "timeSignatureNumerator": 4
      },
      "uiItems": [],
      "view": {
        "heightGu": 22,
        "widthGu": 20,
        "zoom": 0.8612761690424068
      },
      "visual": {
        "background": {
          "h": 210,
          "l": 5,
          "s": 0
        },
        "mode": "auto",
        "scale": 1,
        "style": "glow",
        "theme": "cyan-violet",
        "trail": 0.35
      },
      "windows": {
        "metadata": {
          "left": null,
          "top": null
        },
        "moduleActions": {
          "left": null,
          "top": null
        }
      }
    },
    "currentSavedPatchFilename": "",
    "patchDirtyState": "edited"
  }
});
