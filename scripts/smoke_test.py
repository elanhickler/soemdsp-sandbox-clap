from __future__ import annotations

import argparse
from functools import cache
from html.parser import HTMLParser
import json
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Callable
from wave import Error as WaveError
from wave import open as open_wave


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
DEFAULT_UI_SETTINGS = PUBLIC / "presets" / "useruisettings.json"
DEFAULT_UI_SETTINGS_SCRIPT = PUBLIC / "presets" / "useruisettings.js"
DEFAULT_MANIFEST = (
    ROOT.parent / "soemdsp" / "runtime_dsp_object_bound_wav_resync_demo.manifest.json"
)
JS_CONTENT_TYPES = ("application/javascript", "text/javascript")
PUBLIC_SCRIPT_PATHS = (
    "./public/boot-loading.js",
    "./public/app-state.js",
    "./public/format-utils.js",
    "./public/inspection-utils.js",
    "./public/audio-utils.js",
    "./public/ui-label-utils.js",
    "./public/ui-render-utils.js",
    "./public/inspection-cursor-pills.js",
    "./public/inspection-cursor.js",
    "./public/phase-display-utils.js",
    "./public/phase-audio-analysis.js",
    "./public/level-envelope-canvas.js",
    "./public/level-envelope-view.js",
    "./public/phase-audio-stats-probe.js",
    "./public/phase-audio-stats-view.js",
    "./public/signal-plot-settings.js",
    "./public/signal-plot-metrics.js",
    "./public/signal-plot-view.js",
    "./public/signal-plot-probes.js",
    "./public/signal-plot-readouts.js",
    "./public/signal-plot-controls.js",
    "./public/artifact-report-utils.js",
    "./public/artifact-report-reports.js",
    "./public/artifact-list-view.js",
    "./public/artifact-coverage-view.js",
    "./public/manifest-source-view.js",
    "./public/parameter-summary-view.js",
    "./public/parameter-timeline-probe.js",
    "./public/parameter-views.js",
    "./public/manifest-processing-contracts.js",
    "./public/manifest-phase-contracts.js",
    "./public/manifest-contracts.js",
    "./public/legacy-evidence-checklist-view.js",
    "./public/legacy-evidence-proof-view.js",
    "./public/legacy-evidence-views.js",
    "./public/phase-list-view.js",
    "./public/hands-on-readiness-waveform-labels.js",
    "./public/hands-on-readiness-primary-labels.js",
    "./public/hands-on-readiness-artifact-labels.js",
    "./public/hands-on-readiness-signal-inspection-labels.js",
    "./public/hands-on-readiness-phase-parameter-labels.js",
    "./public/hands-on-readiness-probe-labels.js",
    "./public/hands-on-readiness.js",
    "./public/waveform-canvas.js",
    "./public/waveform-current-parameters.js",
    "./public/waveform-position-view.js",
    "./public/waveform-view.js",
    "./public/waveform-transport.js",
    "./public/waveform-phase-controls.js",
    "./public/waveform-interactions.js",
    "./public/manifest-view.js",
    "./public/manifest-loader.js",
    "./public/node-graph-wires.js",
    "./public/node-graph-file-actions.js",
    "./public/node-graph-default-buttons.js",
    "./public/node-graph-cookbook-filter.js",
    "./public/node-graph-module-definitions.js",
    "./public/node-graph-module-store.js",
    "./public/node-graph-module-sizing.js",
    "./public/node-graph-metadata-kinds.js",
    "./public/node-graph-parameter-metadata.js",
    "./public/node-graph-metadata-defaults.js",
    "./public/node-graph-text-box-utils.js",
    "./public/node-graph-image-utils.js",
    "./public/node-graph-graph-utils.js",
    "./public/node-graph-text-box-rendering.js",
    "./public/node-graph-patch-normalizers.js",
    "./public/node-graph-audio-derivation.js",
    "./public/node-graph-grid-utils.js",
    "./public/node-graph-patch-runtime.js",
    "./public/node-graph-patch-serialization.js",
    "./public/node-graph-settings-fields.js",
    "./public/node-graph-settings-view.js",
    "./public/node-graph-settings-text-fit.js",
    "./public/node-graph-default-preset.js",
    "./public/node-graph-script-status.js",
    "./public/node-graph-ui-view.js",
    "./public/node-graph-view-controls.js",
    "./public/node-graph-workspace-geometry.js",
    "./public/node-graph-workspace-zoom.js",
    "./public/node-graph-workspace-view.js",
    "./public/node-graph-marquee-selection.js",
    "./public/node-graph-node-dragging.js",
    "./public/node-graph-context-menu.js",
    "./public/node-graph-module-actions.js",
    "./public/node-graph-module-scopes.js",
    "./public/node-graph-shader-script.js",
    "./public/node-graph-module-factories.js",
    "./public/node-graph-module-header-rendering.js",
    "./public/node-graph-module-rendering.js",
    "./public/node-graph-history.js",
    "./public/node-graph-visual-utils.js",
    "./public/node-graph-patch-clone.js",
    "./public/node-graph-slider-metadata.js",
    "./public/node-graph-slider-values.js",
    "./public/node-graph-slider-dragging.js",
    "./public/node-graph-node-accessors.js",
    "./public/node-graph-selection.js",
    "./public/node-graph-port-geometry.js",
    "./public/node-graph-slider-readout.js",
    "./public/node-graph-slider-readout-controls.js",
    "./public/node-graph-ghost-sliders.js",
    "./public/node-graph-metadata-editor.js",
    "./public/node-graph-render-settings.js",
    "./public/node-graph-ear-protection.js",
    "./public/node-graph-rendered-audio.js",
    "./public/node-graph-rendered-visual-output.js",
    "./public/node-graph-av-export.js",
    "./public/node-graph-rendered-output-canvases.js",
    "./public/node-graph-execution-wires.js",
    "./public/node-graph-execution-plan.js",
    "./public/node-graph-execution-summary.js",
    "./public/node-graph-wire-actions.js",
    "./public/node-graph-trace-router.js",
    "./public/node-graph-wire-rendering.js",
    "./public/node-graph-render-output.js",
    "./public/node-graph-debug-copy.js",
    "./public/node-graph-execution-debug-api.js",
    "./public/node-graph-execution-debug-view.js",
    "./public/node-graph-tooltips.js",
    "./public/node-graph-interaction-help.js",
    "./public/presets/useruisettings.js",
    "./public/node-graph-ui-settings-definitions.js",
    "./public/node-graph-ui-settings-utils.js",
    "./public/node-graph-user-ui-settings-controls.js",
    "./public/node-graph-ui-settings-panels.js",
    "./public/node-graph-ui-settings-persistence.js",
    "./public/node-graph-ui-settings-sync.js",
    "./public/node-graph-keyboard-shortcuts.js",
    "./public/node-graph-live-status-text.js",
    "./public/node-graph-live-status-controls.js",
    "./public/node-graph-live-meter-controls.js",
    "./public/node-graph-live-input-status.js",
    "./public/node-graph-live-evidence.js",
    "./public/node-graph-live-control-rendering.js",
    "./public/node-graph-default-patch.js",
    "./public/node-graph-state.js",
    "./public/node-graph-patch-core.js",
    "./public/node-graph-live-plan-runtime.js",
    "./public/node-graph-live-parameter-runtime.js",
    "./public/node-graph-oscillator-runtime.js",
    "./public/node-graph-jerobeam-spiral.js",
    "./public/node-graph-live-frame-evaluator.js",
    "./public/node-graph-live-runtime.js",
    "./public/node-graph-wire-controller-bootstrap.js",
    "./public/node-graph-workspace-event-bindings.js",
    "./public/node-graph-render-live-event-bindings.js",
    "./public/node-graph-header-event-bindings.js",
    "./public/node-graph-help-event-bindings.js",
    "./public/node-graph-scene-menu-event-bindings.js",
    "./public/node-graph-uidev-event-bindings.js",
    "./public/node-graph-settings-event-bindings.js",
    "./public/node-graph-slider-event-bindings.js",
    "./public/node-graph-event-bindings.js",
    "./public/node-graph-bootstrap.js",
    "./public/app-event-bindings.js",
    "./public/app.js",
)


def public_script_request_path(script_path: str) -> str:
    return script_path.removeprefix(".")


def public_script_source_path(script_path: str) -> Path:
    if script_path == "./public/presets/useruisettings.js":
        return DEFAULT_UI_SETTINGS_SCRIPT
    return ROOT / script_path.removeprefix("./")


def static_asset_contracts():
    for script_path in PUBLIC_SCRIPT_PATHS:
        yield public_script_request_path(script_path), JS_CONTENT_TYPES, public_script_source_path(script_path)
    yield "/public/node-live-audio-worklet.js", JS_CONTENT_TYPES, PUBLIC / "node-live-audio-worklet.js"
    yield "/public/styles.css", "text/css", PUBLIC / "styles.css"


@cache
def read_public_script_sources() -> dict[str, str]:
    return {
        script_path: public_script_source_path(script_path).read_text(encoding="utf-8")
        for script_path in PUBLIC_SCRIPT_PATHS
    }

SOEMDSP_META_HEADER = ROOT.parent / "soemdsp" / "include" / "soemdsp" / "meta.hpp"
EXPECTED_CONTRACT = "soemdsp-demo-local-sandbox-handoff"
EXPECTED_CONTRACT_VERSION = 1
EXPECTED_INSPECTION_MODE = "mouse-and-ears"
EXPECTED_META_KINDS = {
    "amplitude",
    "bypass",
    "decibels",
    "decimal",
    "decimal_bipolar",
    "descrete",
    "frequency",
    "integer_bipolar",
    "momentary",
    "onoff",
    "phase",
    "pitch",
    "plusminus",
    "seconds",
    "sustain",
    "waveform",
}
REQUIRED_FLAGS = {
    "callerOwnsProcessingOrder": True,
    "callerOwnsDspObjects": True,
    "circuitOwnsDspObjects": False,
    "dspObjectsKnowCircuit": False,
    "serializesPatch": False,
    "ownsAudioEngine": False,
    "ownsScheduler": False,
}
REQUIRED_ARTIFACT_KINDS = {
    "entry-point",
    "audio",
    "manifest",
    "text-summary",
    "wav-report",
}
EXPECTED_DEMOS = {
    "runtime_dsp_object_bound_wav_resync_demo":
        "demo-local-bound-wav-resync-artifacts",
    "runtime_dsp_object_circuit_connected_wav_demo":
        "demo-local-circuit-connected-wav-artifacts",
    "runtime_dsp_object_circuit_connected_bias_wav_demo":
        "demo-local-circuit-connected-bias-wav-artifacts",
}
EXPECTED_CALLER_PROCESSING_STEPS = {
    "runtime_dsp_object_circuit_connected_wav_demo": [
        {
            "index": 0,
            "sourceNode": "Tiny Oscillator",
            "sourcePort": "Out",
            "destinationNode": "Tiny Gain",
            "destinationPort": "A",
            "callerStep": "oscillator.processSample -> gain.processSample",
        },
        {
            "index": 1,
            "sourceNode": "Tiny Gain",
            "sourcePort": "Out",
            "destinationNode": "Audio Out",
            "destinationPort": "In",
            "callerStep": "gain.processSample -> output sample",
        },
    ],
    "runtime_dsp_object_circuit_connected_bias_wav_demo": [
        {
            "index": 0,
            "sourceNode": "Tiny Oscillator",
            "sourcePort": "Out",
            "destinationNode": "Tiny Gain",
            "destinationPort": "A",
            "callerStep": "oscillator.processSample -> gain.processSample",
        },
        {
            "index": 1,
            "sourceNode": "Tiny Gain",
            "sourcePort": "Out",
            "destinationNode": "Tiny Bias",
            "destinationPort": "A",
            "callerStep": "gain.processSample -> bias.processSample",
        },
        {
            "index": 2,
            "sourceNode": "Tiny Bias",
            "sourcePort": "Out",
            "destinationNode": "Audio Out",
            "destinationPort": "In",
            "callerStep": "bias.processSample -> output sample",
        },
    ],
}
REPORT_ARTIFACT_KINDS = {
    "manifest",
    "text-summary",
    "wav-report",
    "phase-report",
}
SUMMARY_PARAMETER_KEYS = (
    "first half frequency",
    "first half amplitude",
    "second half frequency",
    "second half amplitude",
)
REQUIRED_SHELL_IDS = {
    "artifactCoverage",
    "artifactCoverageStatus",
    "artifactList",
    "artifactRoot",
    "artifactStatus",
    "audioPlayer",
    "audioPosition",
    "audioTitle",
    "boundaryFlags",
    "checklist",
    "checklistStatus",
    "circuitChain",
    "circuitChainStatus",
    "contractStatus",
    "currentAmplitude",
    "currentFrequency",
    "currentMeasuredFrequency",
    "currentMeasuredFrequencyDelta",
    "currentMeasuredPeak",
    "currentMeasuredPeakDelta",
    "currentMeasuredStatus",
    "currentParameterStatus",
    "followAudioButton",
    "frameCount",
    "handsOnReadiness",
    "handsOnReadinessStatus",
    "inspectionCursor",
    "inspectionCursorAudio",
    "inspectionCursorDelta",
    "inspectionCursorDivergence",
    "inspectionCursorPlayback",
    "inspectionCursorPreview",
    "inspectionCursorSeek",
    "inspectionCursorSeekTarget",
    "inspectionCursorSeekSync",
    "inspectionCursorSource",
    "inspectionCursorStatus",
    "inspectionCursorTarget",
    "inspectionCursorTransport",
    "inspectionCursorView",
    "inspectionMode",
    "levelEnvelopeCanvas",
    "levelEnvelopeMeta",
    "levelEnvelopePeak",
    "levelEnvelopeProbe",
    "levelEnvelopeRms",
    "levelEnvelopeStatus",
    "manifestBytes",
    "manifestCacheControl",
    "manifestExpires",
    "manifestHttpStatus",
    "manifestLoadedAt",
    "manifestModified",
    "manifestPath",
    "manifestPragma",
    "manifestStatus",
    "loadNodeGraphScriptButton",
    "nodeAudioStats",
    "nodeBadValueMonitorButton",
    "nodeTripEarProtectionButton",
    "nodeBadValueMonitorEvidence",
    "nodeBadValueMonitorStatus",
    "nodeConnectionList",
    "nodeDeleteButton",
    "nodeExecutionPlanDebug",
    "nodeExecutionPolicy",
    "nodeExecutionPlanSummary",
    "nodeExecutionPlanStatus",
    "nodeExecutionOrder",
    "nodeExecutionWireModes",
    "nodeCopyExecutionJsonButton",
    "nodeExecutionJsonStatus",
    "nodeCopyRuntimeSketchButton",
    "nodeRuntimeSketch",
    "nodeRuntimeSketchStatus",
    "nodeGraphNodes",
    "nodeGraphRenderStatus",
    "nodeGraphResizeHandle",
    "nodeGraphSource",
    "nodeGraphStatus",
    "nodeGraphValidation",
    "nodeGraphWorkspace",
    "nodeGraphZoomSurface",
    "nodeGridHeatmap",
    "nodeInteractionHelp",
    "nodeModuleScopeCanvas",
    "nodeModularShaderCanvas",
    "nodeVideoViewButton",
    "nodeVideoViewPanel",
    "nodeVideoViewStatus",
    "nodeMappingViewButton",
    "nodeMappingView",
    "nodeMappingGrid",
    "nodeMappingStatus",
    "nodeMacroControlsPanel",
    "nodeMacroControlsStatus",
    "nodeMacroControlsToggleButton",
    "nodeShaderScriptApply",
    "nodeShaderScriptAmberPreset",
    "nodeShaderScriptButton",
    "nodeShaderScriptClose",
    "nodeShaderScriptCoolWhitePreset",
    "nodeShaderScriptDefault",
    "nodeShaderScriptDialog",
    "nodeShaderScriptEnable",
    "nodeShaderScriptGreenPreset",
    "nodeShaderScriptRgbPixelPreset",
    "nodeShaderScriptRedPreset",
    "nodeShaderScriptSource",
    "nodeShaderScriptStatus",
    "nodeShaderScriptTitle",
    "nodeScriptGridHeightPxValue",
    "nodeScriptGridWidthPxValue",
    "patchGridHeightPxValue",
    "patchGridWidthPxValue",
    "nodeLiveEngineStatus",
    "nodeLiveInputStatus",
    "nodeLiveInputMeter",
    "nodeLiveMicStatus",
    "nodeLiveMeter",
    "nodeLivePlanStatus",
    "nodeLiveRouteStatus",
    "nodeLiveStatus",
    "nodeVisualOutputCanvas",
    "nodeVisualOutputMeta",
    "nodeVideoExportSecondsValue",
    "nodeVisualOutputTargetWidthValue",
    "nodeVisualOutputResolutionValue",
    "nodeRenderWavButton",
    "nodeRenderMp4Button",
    "nodeRenderOggButton",
    "nodeRenderFlacButton",
    "nodeRenderMp4AltButton",
    "nodeRenderMp4VideoOnlyButton",
    "nodeExportVisualVideoButton",
    "nodeSaveVisualOutputButton",
    "nodeVisualOutputStatus",
    "patchVisualScaleValue",
    "patchVisualStyleValue",
    "patchVisualThemeValue",
    "patchVisualTrailValue",
    "nodeZoomInButton",
    "nodeZoomOutButton",
    "nodeModularViewButton",
    "nodeModularOnlyBackButton",
    "nodeSettingsView",
    "nodeSettingsViewButton",
    "nodeParameterMetadataPopover",
    "nodePalette",
    "nodePatchScript",
    "nodePatchScriptFileInput",
    "nodePatchNameHeader",
    "nodePatchTagsHeader",
    "updateDefaultPresetButton",
    "nodeRedoButton",
    "nodeRenderButton",
    "nodeModuleShopView",
    "nodeModuleShopClose",
    "nodeModuleShopAvailable",
    "nodeModuleDepartmentSearch",
    "nodeModuleDepartmentSearchShell",
    "nodeModuleCollectionsMenu",
    "nodeModuleCollectionsClose",
    "nodeModuleCollectionsToolkit",
    "nodeModuleDepartmentList",
    "nodeModuleDepartmentView",
    "nodeModuleDepartmentBack",
    "nodeModuleDepartmentClose",
    "nodeModuleDepartmentTitle",
    "nodeModuleDepartmentSummary",
    "nodeModuleGroups",
    "nodeModuleGroupList",
    "nodeSceneCloseMenu",
    "nodeSceneContextMenu",
    "nodeSceneDragHandle",
    "nodeScopeContextMenu",
    "nodeSceneGainScopeControls",
    "nodeGainScopeMaxBrightness",
    "nodeGainScopeMaxLineThickness",
    "nodeGainScopeMinBrightness",
    "nodeGainScopeMinLineThickness",
    "nodeSceneAddToGroup",
    "nodeScriptView",
    "nodeSettingsScriptViewButton",
    "nodeSignalPlotCanvas",
    "nodeLiveInputButton",
    "nodeLiveOutputButton",
    "nodeUndoButton",
    "nodeWaveformCanvas",
    "nodeWireSvg",
    "patchAuthorValue",
    "patchDescriptionValue",
    "patchNameValue",
    "patchTagsValue",
    "patchVisualModeValue",
    "downloadNodeGraphScriptButton",
    "metadataDefaultValue",
    "metadataDivideChoicesValue",
    "metadataDisplayChoicesValue",
    "metadataKindValue",
    "metadataLinearSmoothingValue",
    "metadataMaxDigitsValue",
    "metadataNonlinearSliderValue",
    "metadataChoicesValue",
    "metadataMaxValue",
    "metadataMidLabel",
    "metadataMidValue",
    "metadataMinValue",
    "metadataPopoverClose",
    "metadataPopoverDragHandle",
    "metadataPopoverTitle",
    "metadataSetDefaultButton",
    "metadataShowSignValue",
    "metadataWraparoundValue",
    "metadataStepValue",
    "metadataUnitValue",
    "parameterSummary",
    "parameterSummaryStatus",
    "parameterTimeline",
    "parameterTimelinePhase",
    "parameterTimelineProbe",
    "parameterTimelineStatus",
    "phaseAudioStats",
    "phaseAudioStatsProbe",
    "phaseAudioStatsStatus",
    "phaseCoverage",
    "phaseCoverageStatus",
    "phaseList",
    "phaseProbe",
    "phaseStatus",
    "producerProof",
    "producerStatus",
    "reportControls",
    "reportStatus",
    "reportViewer",
    "sandboxContract",
    "sandboxContractStatus",
    "sourceDetail",
    "sourceError",
    "sourceStatus",
    "signalPlotCanvas",
    "signalPlotControls",
    "signalPlotLagSummary",
    "signalPlotMeta",
    "signalPlotModeSummary",
    "signalPlotPoint",
    "signalPlotProbe",
    "signalPlotProbeSource",
    "signalPlotStatus",
    "signalPlotWindowSummary",
    "waveformCanvas",
    "waveformMeta",
    "waveformPhase",
    "waveformPhaseControls",
    "waveformPhaseJumpTarget",
    "waveformPhaseRange",
    "waveformPlayButton",
    "waveformPosition",
    "waveformProbe",
    "waveformSample",
    "waveformScrubber",
    "waveformStatus",
    "toggleDebugButton",
}


class ShellContractParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.duplicate_ids: set[str] = set()
        self.elements_by_id: dict[str, tuple[str, dict[str, str]]] = {}
        self.ids: set[str] = set()
        self.inline_script_count = 0
        self.scripts: set[str] = set()
        self.stylesheets: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key: value if value is not None else "" for key, value in attrs}
        element_id = attributes.get("id")
        if element_id:
            if element_id in self.ids:
                self.duplicate_ids.add(element_id)
            self.ids.add(element_id)
            self.elements_by_id[element_id] = (tag, attributes)

        if tag == "script":
            src = attributes.get("src")
            if src:
                self.scripts.add(src)
            else:
                self.inline_script_count += 1

        if tag == "link" and attributes.get("rel") == "stylesheet":
            href = attributes.get("href")
            if href:
                self.stylesheets.add(href)


@dataclass
class Response:
    status: int
    reason: str
    headers: dict[str, str]
    body: bytes


def request(
    url: str,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    data: bytes | None = None,
) -> Response:
    request = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            return Response(
                status=response.status,
                reason=response.reason,
                headers={key.lower(): value for key, value in response.headers.items()},
                body=response.read(),
            )
    except urllib.error.HTTPError as error:
        return Response(
            status=error.code,
            reason=error.reason,
            headers={key.lower(): value for key, value in error.headers.items()},
            body=error.read(),
        )
    except urllib.error.URLError as error:
        return Response(
            status=0,
            reason=str(error.reason),
            headers={},
            body=b"",
        )


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def trace_test_point(value: float) -> float:
    return round(float(value or 0) - 0.5) + 0.5


def normalize_trace_test_points(points: list[dict[str, float]]) -> list[dict[str, float]]:
    return [
        {"x": trace_test_point(point.get("x", 0)), "y": trace_test_point(point.get("y", 0))}
        for point in points
    ]


def push_trace_test_point(points: list[dict[str, float]], point: dict[str, float]) -> None:
    previous = points[-1] if points else None
    if not previous or abs(previous["x"] - point["x"]) > 0.001 or abs(previous["y"] - point["y"]) > 0.001:
        points.append(point)


def trace_test_orthogonal_points(
    start: dict[str, float],
    waypoints: list[dict[str, float]],
    end: dict[str, float],
) -> list[dict[str, float]]:
    anchors = normalize_trace_test_points([start, *normalize_trace_test_points(waypoints), end])
    if len(anchors) < 2:
        return anchors

    routed: list[dict[str, float]] = []
    push_trace_test_point(routed, anchors[0])
    for anchor in anchors[1:]:
        previous = routed[-1]
        if abs(previous["x"] - anchor["x"]) > 0.001 and abs(previous["y"] - anchor["y"]) > 0.001:
            push_trace_test_point(routed, {"x": anchor["x"], "y": previous["y"]})
        push_trace_test_point(routed, anchor)
    return routed


def trace_test_single_move_point(
    start: dict[str, float],
    waypoints: list[dict[str, float]],
    point: dict[str, float],
) -> dict[str, float]:
    anchors = normalize_trace_test_points([start, *normalize_trace_test_points(waypoints)])
    previous = anchors[-1]
    target = normalize_trace_test_points([point])[0]
    dx = abs(target["x"] - previous["x"])
    dy = abs(target["y"] - previous["y"])
    return {"x": target["x"], "y": previous["y"]} if dx >= dy else {"x": previous["x"], "y": target["y"]}


def require_manual_trace_waypoint_contract() -> None:
    waypoints = [
        {"x": 123, "y": 234},
        {"x": 345, "y": 456},
        {"x": 567, "y": 234},
    ]
    routed = trace_test_orthogonal_points({"x": 0, "y": 0}, waypoints, {"x": 700, "y": 500})
    routed_pairs = {(point["x"], point["y"]) for point in routed}
    for point in normalize_trace_test_points(waypoints):
        require(
            (point["x"], point["y"]) in routed_pairs,
            f"manual trace waypoint missing from routed path: {point}",
        )
    for previous, current in zip(routed, routed[1:]):
        require(
            previous["x"] == current["x"] or previous["y"] == current["y"],
            f"manual trace segment is diagonal: {previous} -> {current}",
        )
    normalized_once = normalize_trace_test_points(waypoints)
    normalized_twice = normalize_trace_test_points(normalized_once)
    require(normalized_once == normalized_twice, "manual trace waypoint normalization must be idempotent")

    start = {"x": 0, "y": 0}
    first_click = trace_test_single_move_point(start, [], {"x": 100, "y": 60})
    second_click = trace_test_single_move_point(start, [first_click], {"x": 100, "y": 140})
    require(first_click == {"x": 100.5, "y": 0.5}, "first manual trace click should add only one horizontal move")
    require(second_click == {"x": 100.5, "y": 140.5}, "second manual trace click should add only one vertical move")


def read_soemdsp_meta_kinds() -> set[str]:
    source = SOEMDSP_META_HEADER.read_text(encoding="utf-8")
    enum_start = source.index("enum class MetaType")
    body_start = source.index("{", enum_start) + 1
    body_end = source.index("};", body_start)
    names: set[str] = set()
    for line in source[body_start:body_end].splitlines():
        line = line.split("//", 1)[0].strip().rstrip(",")
        if line:
            names.add(line)
    return names


def require_soemdsp_wire_meta_traits() -> None:
    source = SOEMDSP_META_HEADER.read_text(encoding="utf-8")
    for snippet in [
        "std::string_view unit_;",
        ", unit_(WireTypeTraits::get(type).unit_)",
        ", maxDigits(WireTypeTraits::get(type).maxDigits)",
        ", divideChoicesVisibly(!customchoices.empty() ? true : WireTypeTraits::get(type).divideChoicesVisibly)",
        ", def_(!customchoices.empty() ? 0.0 : WireTypeTraits::get(type).def_)",
        ", min_(!customchoices.empty() ? 0.0 : WireTypeTraits::get(type).min_)",
        "? static_cast<double>(customchoices.size() - 1)",
        ": WireTypeTraits::get(type).max_)",
        'static_assert(WireMeta{ "frequency", "", MetaType::frequency }.unit_ == "Hz");',
        'static_assert(WireMeta{ "frequency", "", MetaType::frequency }.max_ == 20000.0);',
        'static_assert(WireMeta{ "frequency", "", MetaType::frequency }.maxDigits == 5);',
        'static_assert(WireMeta{ "amplitude", "", MetaType::amplitude }.maxDigits == 3);',
        'static_assert(WireMeta{ "waveform", "", MetaType::waveform }.choices.size() == 5);',
        'static_assert(WireMeta{ "waveform", "", MetaType::waveform }.max_ == 4.0);',
        'static_assert(WireMeta{ "custom", "", MetaType::waveform, choice::onoff }.choices.size() == 2);',
        'static_assert(WireMeta{ "custom", "", MetaType::waveform, choice::onoff }.def_ == 0.0);',
        'static_assert(WireMeta{ "custom", "", MetaType::waveform, choice::onoff }.max_ == 1.0);',
    ]:
        require(snippet in source, f"soemdsp WireMeta trait contract missing {snippet}")


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
        server.bind(("127.0.0.1", 0))
        return int(server.getsockname()[1])


def require_port_available(port: int) -> None:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
            server.bind(("127.0.0.1", port))
    except OSError as error:
        raise RuntimeError(f"port {port} is not available: {error}") from error


def run_step(label: str, action: Callable[[], None]) -> None:
    print(f"[smoke] {label}...", flush=True)
    try:
        action()
    except Exception as error:
        raise AssertionError(f"{label} failed: {error}") from error
    print(f"[smoke] {label}: ok", flush=True)


def require_no_store(response: Response, label: str) -> None:
    require(
        "no-store" in response.headers.get("cache-control", ""),
        f"{label} missing no-store cache-control",
    )
    require(
        response.headers.get("pragma") == "no-cache",
        f"{label} missing no-cache pragma",
    )
    require(response.headers.get("expires") == "0", f"{label} missing expires 0")


def require_content_type(response: Response, expected: str | tuple[str, ...], label: str) -> None:
    content_type = response.headers.get("content-type", "")
    expected_values = (expected,) if isinstance(expected, str) else expected
    require(
        any(content_type.startswith(value) for value in expected_values),
        f"{label} content-type was {content_type!r}, expected {expected_values!r}",
    )


def require_json_response_metadata(response: Response, label: str) -> None:
    require_no_store(response, label)
    require_content_type(response, "application/json", label)
    require(
        response.headers.get("content-length") == str(len(response.body)),
        f"{label} content-length mismatch",
    )


def require_manifest_file_info(
  payload: dict[str, object],
  manifest_file: Path,
  label: str,
) -> None:
    manifest_info = payload.get("manifestInfo")
    require(isinstance(manifest_info, dict), f"{label} manifest info missing")
    require(
        manifest_info.get("bytes") == manifest_file.stat().st_size,
        f"{label} manifest byte count mismatch",
    )
    require(
        isinstance(manifest_info.get("modifiedUtc"), str),
        f"{label} manifest modified time missing",
    )


def require_shell_element(
  parser: ShellContractParser,
  element_id: str,
  tag: str,
  expected_attrs: dict[str, str],
) -> None:
    element = parser.elements_by_id.get(element_id)
    require(element is not None, f"shell element {element_id} missing")
    actual_tag, actual_attrs = element
    require(actual_tag == tag, f"shell element {element_id} was {actual_tag}, expected {tag}")
    for key, expected in expected_attrs.items():
        actual = actual_attrs.get(key)
        require(
            actual == expected,
            f"shell element {element_id} {key} was {actual!r}, expected {expected!r}",
        )


def require_shell_contract(html: str) -> None:
    parser = ShellContractParser()
    parser.feed(html)
    script_paths = {urllib.parse.urlsplit(src).path for src in parser.scripts}
    stylesheet_paths = {urllib.parse.urlsplit(href).path for href in parser.stylesheets}

    duplicate_ids = sorted(parser.duplicate_ids)
    require(not duplicate_ids, f"shell duplicate ids: {duplicate_ids}")
    missing_ids = sorted(REQUIRED_SHELL_IDS - parser.ids)
    require(not missing_ids, f"shell missing required ids: {missing_ids}")
    require(parser.inline_script_count == 0, "shell includes inline script")
    require(
        script_paths == set(PUBLIC_SCRIPT_PATHS),
        f"shell scripts were {sorted(parser.scripts)!r}",
    )
    require(
        stylesheet_paths == {"./public/styles.css"},
        f"shell stylesheets were {sorted(parser.stylesheets)!r}",
    )
    require_shell_element(
        parser,
        "audioPlayer",
        "audio",
        {"controls": "", "preload": "metadata"},
    )
    require_shell_element(
        parser,
        "nodeGraphWorkspace",
        "div",
        {"aria-label": "Drag wires between DSP node ports; right-click empty scene space to add modules"},
    )
    require_shell_element(
        parser,
        "nodeWireSvg",
        "svg",
        {"aria-hidden": "true", "focusable": "false"},
    )
    require_shell_element(
        parser,
        "nodeRenderButton",
        "button",
        {"type": "button"},
    )
    require_shell_element(
        parser,
        "nodeLiveInputButton",
        "button",
        {"type": "button", "aria-pressed": "false"},
    )
    require_shell_element(
        parser,
        "nodeLiveOutputButton",
        "button",
        {"type": "button", "aria-pressed": "false"},
    )
    require_shell_element(
        parser,
        "nodeLiveInputStatus",
        "span",
        {},
    )
    require_shell_element(
        parser,
        "nodeLiveInputMeter",
        "span",
        {},
    )
    require_shell_element(
        parser,
        "nodeLiveMicStatus",
        "span",
        {},
    )
    require_shell_element(
        parser,
        "nodeLiveStatus",
        "span",
        {},
    )
    require_shell_element(
        parser,
        "nodeWaveformCanvas",
        "canvas",
        {"width": "720", "height": "180", "aria-label": "Node graph rendered waveform"},
    )
    require_shell_element(
        parser,
        "nodeSignalPlotCanvas",
        "canvas",
        {"width": "720", "height": "300", "aria-label": "Node graph rendered signal plot"},
    )
    require_shell_element(
        parser,
        "nodeVisualOutputCanvas",
        "canvas",
        {"width": "720", "height": "300", "aria-label": "Node graph visual output"},
    )
    require_shell_element(
        parser,
        "followAudioButton",
        "button",
        {"type": "button", "aria-pressed": "true"},
    )
    require_shell_element(
        parser,
        "waveformPlayButton",
        "button",
        {"type": "button", "aria-pressed": "false", "disabled": ""},
    )
    require_shell_element(
        parser,
        "waveformCanvas",
        "canvas",
        {"width": "1120", "height": "180", "aria-label": "Primary WAV waveform"},
    )
    require_shell_element(
        parser,
        "waveformProbe",
        "span",
        {
            "data-probe-source": "none",
            "data-probe-frame": "none",
            "data-tooltip-key": "legacyEvidence.waveformProbeIdle",
        },
    )
    require_shell_element(
        parser,
        "parameterTimelineProbe",
        "span",
        {
            "data-probe-source": "none",
            "data-probe-frame": "none",
            "data-tooltip-key": "legacyEvidence.parameterTimelineProbeIdle",
        },
    )
    require_shell_element(
        parser,
        "phaseAudioStatsProbe",
        "span",
        {
            "data-probe-source": "none",
            "data-probe-frame": "none",
            "data-tooltip-key": "legacyEvidence.phaseAudioStatsProbeIdle",
        },
    )
    require_shell_element(
        parser,
        "phaseProbe",
        "span",
        {
            "data-probe-source": "none",
            "data-probe-frame": "none",
            "data-tooltip-key": "legacyEvidence.phaseListProbeIdle",
        },
    )
    require_shell_element(
        parser,
        "signalPlotCanvas",
        "canvas",
        {"width": "720", "height": "360", "aria-label": "Primary WAV signal plot"},
    )
    require_shell_element(
        parser,
        "signalPlotProbe",
        "span",
        {
            "data-probe-source": "none",
            "data-probe-frame": "none",
            "data-tooltip-key": "legacyEvidence.signalPlotProbeIdle",
        },
    )
    require_shell_element(
        parser,
        "signalPlotProbeSource",
        "span",
        {
            "data-probe-source": "none",
            "data-probe-frame": "none",
            "data-tooltip-key": "legacyEvidence.signalPlotSourceProbeIdle",
        },
    )
    require_shell_element(
        parser,
        "levelEnvelopeCanvas",
        "canvas",
        {"width": "1120", "height": "140", "aria-label": "Primary WAV level envelope"},
    )
    require_shell_element(
        parser,
        "levelEnvelopeProbe",
        "span",
        {
            "data-probe-source": "none",
            "data-probe-frame": "none",
            "data-tooltip-key": "legacyEvidence.levelEnvelopeProbeIdle",
        },
    )
    require_shell_element(
        parser,
        "waveformScrubber",
        "input",
        {
            "type": "range",
            "min": "0",
            "max": "1",
            "step": "0.001",
            "value": "0",
            "aria-label": "Waveform position",
            "aria-valuetext": "0.000s / unknown / phase unknown / follow",
            "data-follow-mode": "follow",
            "data-tooltip-key": "legacyEvidence.waveformPositionIdle",
        },
    )


def require_handoff_contract(payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")
    require(manifest.get("allOk") is True, "manifest allOk was not true")

    handoff = manifest.get("sandboxHandoff")
    require(isinstance(handoff, dict), "sandbox handoff missing")
    require(handoff.get("contract") == EXPECTED_CONTRACT, "handoff contract mismatch")
    require(
        handoff.get("contractVersion") == EXPECTED_CONTRACT_VERSION,
        "handoff contract version mismatch",
    )
    require(
        handoff.get("inspectionMode") == EXPECTED_INSPECTION_MODE,
        "handoff inspection mode mismatch",
    )

    for key, expected in REQUIRED_FLAGS.items():
        require(handoff.get(key) is expected, f"handoff flag {key} mismatch")


def require_producer_proof(payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")
    demo = manifest.get("demo")
    require(demo in EXPECTED_DEMOS, "demo name mismatch")
    require(manifest.get("kind") == EXPECTED_DEMOS[demo], "artifact kind mismatch")
    require(manifest.get("runtimeApi") is False, "runtime API flag mismatch")
    require(manifest.get("scheduler") is False, "scheduler flag mismatch")
    require(manifest.get("audioEngine") is False, "audio engine flag mismatch")

    setters = manifest.get("parameterSetters")
    require(isinstance(setters, dict), "parameter setters missing")
    require(setters.get("frequency") is True, "frequency setter missing")
    require(setters.get("amplitude") is True, "amplitude setter missing")


def require_artifact_contract(payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")
    handoff = manifest.get("sandboxHandoff")
    require(isinstance(handoff, dict), "sandbox handoff missing")

    links = manifest.get("artifactLinks")
    require(isinstance(links, list), "artifact links missing")
    require(all(isinstance(link, dict) for link in links), "artifact link not object")
    require(all(link.get("path") for link in links), "artifact link path missing")

    kinds = {str(link.get("kind")) for link in links}
    missing_kinds = REQUIRED_ARTIFACT_KINDS - kinds
    require(not missing_kinds, f"required artifact kinds missing: {sorted(missing_kinds)}")
    for kind in REQUIRED_ARTIFACT_KINDS - {"phase-report"}:
        count = sum(1 for link in links if link.get("kind") == kind)
        require(count == 1, f"{kind} artifact link count mismatch")

    links_by_kind = {str(link.get("kind")): link for link in links}
    entry_point = handoff.get("entryPoint")
    primary_audio = handoff.get("primaryAudioArtifact")
    require(
        links_by_kind["entry-point"].get("path") == entry_point,
        "entry-point link did not match handoff entry point",
    )
    require(
        links_by_kind["audio"].get("path") == primary_audio,
        "audio link did not match handoff primary audio",
    )

    wav = manifest.get("wav")
    require(isinstance(wav, dict), "wav metadata missing")
    require(wav.get("path") == primary_audio, "wav path did not match primary audio")

    phases = manifest.get("phases")
    require(isinstance(phases, list), "phases missing")
    phase_report_count = sum(1 for link in links if link.get("kind") == "phase-report")
    require(
        phase_report_count == len(phases),
        "phase report count did not match phase count",
    )
    phase_names = {
        str(phase.get("name"))
        for phase in phases
        if isinstance(phase, dict) and phase.get("name")
    }
    report_phases: set[str] = set()
    for index, link in enumerate(links):
        if link.get("kind") != "phase-report":
            continue
        phase = link.get("phase")
        require(isinstance(phase, str) and phase, f"phase report {index} phase missing")
        require(phase in phase_names, f"phase report {index} phase unknown")
        require(phase not in report_phases, f"phase report {index} phase duplicate")
        report_phases.add(phase)
    require(report_phases == phase_names, "phase report phases did not match phases")


def artifact_contract_fixture() -> dict[str, object]:
    return {
        "manifest": {
            "sandboxHandoff": {
                "entryPoint": "runtime_dsp_object_bound_wav_resync_demo.html",
                "primaryAudioArtifact": "runtime_dsp_object_bound_wav_resync_demo.wav",
            },
            "artifactLinks": [
                {
                    "label": "HTML report",
                    "kind": "entry-point",
                    "path": "runtime_dsp_object_bound_wav_resync_demo.html",
                },
                {
                    "label": "Primary WAV",
                    "kind": "audio",
                    "path": "runtime_dsp_object_bound_wav_resync_demo.wav",
                },
                {
                    "label": "Manifest",
                    "kind": "manifest",
                    "path": "runtime_dsp_object_bound_wav_resync_demo.manifest.json",
                },
                {
                    "label": "Summary",
                    "kind": "text-summary",
                    "path": "runtime_dsp_object_bound_wav_resync_demo_summary.txt",
                },
                {
                    "label": "WAV report",
                    "kind": "wav-report",
                    "path": "runtime_dsp_object_bound_wav_resync_demo_wav_report.txt",
                },
                {
                    "label": "Phase report",
                    "kind": "phase-report",
                    "path": "runtime_dsp_object_bound_wav_resync_demo_first_phase.txt",
                    "phase": "first",
                },
            ],
            "wav": {
                "path": "runtime_dsp_object_bound_wav_resync_demo.wav",
            },
            "phases": [
                {
                    "name": "first",
                },
            ],
        },
    }


def require_artifact_contract_failure(
  label: str,
  mutate: Callable[[dict[str, object]], None],
  expected: str,
) -> None:
    payload = json.loads(json.dumps(artifact_contract_fixture()))
    manifest = payload["manifest"]
    require(isinstance(manifest, dict), f"{label} fixture manifest missing")
    mutate(manifest)
    try:
        require_artifact_contract(payload)
    except AssertionError as error:
        require(expected in str(error), f"{label} produced {error}, expected {expected}")
        return

    raise AssertionError(f"{label} did not fail")


def require_artifact_contract_negative_cases() -> None:
    require_artifact_contract(artifact_contract_fixture())
    require_artifact_contract_failure(
        "entry point link mismatch",
        lambda manifest: manifest["artifactLinks"][0].update({"path": "other.html"}),
        "entry-point link did not match handoff entry point",
    )
    require_artifact_contract_failure(
        "audio link mismatch",
        lambda manifest: manifest["artifactLinks"][1].update({"path": "other.wav"}),
        "audio link did not match handoff primary audio",
    )
    require_artifact_contract_failure(
        "wav path mismatch",
        lambda manifest: manifest["wav"].update({"path": "other.wav"}),
        "wav path did not match primary audio",
    )
    require_artifact_contract_failure(
        "duplicate entry point",
        lambda manifest: manifest["artifactLinks"].append(
            {
                "label": "Duplicate HTML report",
                "kind": "entry-point",
                "path": "duplicate.html",
            },
        ),
        "entry-point artifact link count mismatch",
    )
    require_artifact_contract_failure(
        "duplicate audio",
        lambda manifest: manifest["artifactLinks"].append(
            {
                "label": "Duplicate WAV",
                "kind": "audio",
                "path": "duplicate.wav",
            },
        ),
        "audio artifact link count mismatch",
    )
    require_artifact_contract_failure(
        "phase report phase missing",
        lambda manifest: manifest["artifactLinks"][-1].pop("phase"),
        "phase report 5 phase missing",
    )
    require_artifact_contract_failure(
        "phase report phase unknown",
        lambda manifest: manifest["artifactLinks"][-1].update({"phase": "other"}),
        "phase report 5 phase unknown",
    )
    require_artifact_contract_failure(
        "phase report phase duplicate",
        lambda manifest: (
            manifest["phases"].append({"name": "second"}),
            manifest["artifactLinks"].append(
                {
                    "label": "Second phase report",
                    "kind": "phase-report",
                    "path": "runtime_dsp_object_bound_wav_resync_demo.second.txt",
                    "phase": "first",
                },
            ),
        ),
        "phase report 6 phase duplicate",
    )


def require_phase_contract(payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")

    wav = manifest.get("wav")
    require(isinstance(wav, dict), "wav metadata missing")
    wav_frames = int(wav.get("frames", 0))
    require(wav_frames > 0, "wav frame count missing")

    phases = manifest.get("phases")
    require(isinstance(phases, list), "phases missing")
    require(phases, "phases empty")

    total_phase_frames = 0
    expected_start_frame = 0
    for index, phase in enumerate(phases):
        require(isinstance(phase, dict), f"phase {index} not object")
        require(phase.get("name"), f"phase {index} name missing")
        require(phase.get("preflightOk") is True, f"phase {index} preflight failed")
        require(phase.get("applyOk") is True, f"phase {index} apply failed")
        require(phase.get("processOk") is True, f"phase {index} process failed")
        samples = int(phase.get("samplesProcessed", 0))
        require(samples > 0, f"phase {index} samples missing")
        start_frame = int(phase.get("startFrame", -1))
        end_frame = int(phase.get("endFrame", -1))
        require(
            start_frame == expected_start_frame,
            f"phase {index} start frame mismatch",
        )
        require(
            end_frame == start_frame + samples,
            f"phase {index} end frame mismatch",
        )
        expected_start_frame = end_frame
        total_phase_frames += samples

    require(
        total_phase_frames == wav_frames,
        f"phase frames {total_phase_frames} did not match wav frames {wav_frames}",
    )

    measurements = manifest.get("phaseAudioMeasurements")
    require(isinstance(measurements, list), "phase audio measurements missing")
    require(
        len(measurements) == len(phases),
        "phase audio measurement count did not match phase count",
    )
    measurements_by_name = {
        measurement.get("name"): measurement
        for measurement in measurements
        if isinstance(measurement, dict)
    }
    resync = manifest.get("parameterResync")
    require(isinstance(resync, dict), "parameter resync missing")
    frequency = resync.get("frequency")
    amplitude = resync.get("amplitude")
    bias = resync.get("bias", {})
    require(isinstance(frequency, dict), "frequency resync missing")
    require(isinstance(amplitude, dict), "amplitude resync missing")
    require(isinstance(bias, dict), "bias resync invalid")
    for phase in phases:
        require(isinstance(phase, dict), "phase not object")
        name = phase.get("name")
        require(isinstance(name, str) and name, "phase name missing")
        measurement = measurements_by_name.get(name)
        require(isinstance(measurement, dict), f"{name} measurement missing")
        measured_frequency = float(measurement.get("measuredFrequency", 0))
        peak = float(measurement.get("peak", 0))
        rms = float(measurement.get("rms", 0))
        dc_offset = float(measurement.get("dcOffset", 0))
        target_amplitude = float(amplitude.get(name, 0))
        target_bias = float(bias.get(name, 0))
        target_peak = target_amplitude + abs(target_bias)
        require(
            abs(measured_frequency - float(frequency.get(name, 0))) < 0.5,
            f"{name} producer measured frequency mismatch",
        )
        require(
            abs(peak - target_peak) < 0.001,
            f"{name} producer measured peak mismatch",
        )
        require(
            abs(dc_offset - target_bias) < 0.001,
            f"{name} producer measured dc offset mismatch",
        )
        require(rms > 0, f"{name} producer measured rms missing")


def phase_audio_contract_fixture() -> dict[str, object]:
    return {
        "manifest": {
            "wav": {
                "frames": 200,
            },
            "phases": [
                {
                    "name": "first",
                    "preflightOk": True,
                    "applyOk": True,
                    "processOk": True,
                    "samplesProcessed": 100,
                    "startFrame": 0,
                    "endFrame": 100,
                },
                {
                    "name": "second",
                    "preflightOk": True,
                    "applyOk": True,
                    "processOk": True,
                    "samplesProcessed": 100,
                    "startFrame": 100,
                    "endFrame": 200,
                },
            ],
            "parameterResync": {
                "frequency": {
                    "first": 220,
                    "second": 440,
                },
                "amplitude": {
                    "first": 0.2,
                    "second": 0.35,
                },
            },
            "phaseAudioMeasurements": [
                {
                    "name": "first",
                    "measuredFrequency": 220,
                    "peak": 0.2,
                    "rms": 0.141421,
                },
                {
                    "name": "second",
                    "measuredFrequency": 440,
                    "peak": 0.35,
                    "rms": 0.247487,
                },
            ],
        }
    }


def require_phase_audio_contract_failure(
  label: str,
  mutate: Callable[[dict[str, object]], None],
  expected: str,
) -> None:
    payload = json.loads(json.dumps(phase_audio_contract_fixture()))
    manifest = payload["manifest"]
    require(isinstance(manifest, dict), f"{label} fixture manifest missing")
    mutate(manifest)
    try:
        require_phase_contract(payload)
    except AssertionError as error:
        require(expected in str(error), f"{label} produced {error}, expected {expected}")
        return

    raise AssertionError(f"{label} did not fail")


def require_phase_audio_contract_negative_cases() -> None:
    require_phase_contract(phase_audio_contract_fixture())
    require_phase_audio_contract_failure(
        "missing measurements",
        lambda manifest: manifest.pop("phaseAudioMeasurements"),
        "phase audio measurements missing",
    )
    require_phase_audio_contract_failure(
        "measurement count mismatch",
        lambda manifest: manifest["phaseAudioMeasurements"].pop(),
        "phase audio measurement count did not match phase count",
    )
    require_phase_audio_contract_failure(
        "measurement name mismatch",
        lambda manifest: manifest["phaseAudioMeasurements"][0].update({"name": "other"}),
        "first measurement missing",
    )
    require_phase_audio_contract_failure(
        "producer frequency mismatch",
        lambda manifest: manifest["phaseAudioMeasurements"][0].update(
            {"measuredFrequency": 221},
        ),
        "first producer measured frequency mismatch",
    )
    require_phase_audio_contract_failure(
        "producer peak mismatch",
        lambda manifest: manifest["phaseAudioMeasurements"][0].update({"peak": 0.25}),
        "first producer measured peak mismatch",
    )
    require_phase_audio_contract_failure(
        "producer rms missing",
        lambda manifest: manifest["phaseAudioMeasurements"][0].update({"rms": 0}),
        "first producer measured rms missing",
    )


def parameter_resync_contract_fixture() -> dict[str, object]:
    return {
        "manifest": {
            "parameterResync": {
                "frequency": {
                    "changed": True,
                    "first": 220,
                    "second": 440,
                },
                "amplitude": {
                    "changed": True,
                    "first": 0.2,
                    "second": 0.35,
                },
            },
        },
    }


def require_parameter_resync_contract(payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")
    resync = manifest.get("parameterResync")
    require(isinstance(resync, dict), "parameter resync missing")

    for key in ("frequency", "amplitude"):
        values = resync.get(key)
        require(isinstance(values, dict), f"{key} resync missing")
        require(values.get("changed") is True, f"{key} resync changed flag missing")
        first = float(values.get("first", 0))
        second = float(values.get("second", 0))
        require(first > 0, f"{key} first value invalid")
        require(second > 0, f"{key} second value invalid")
        require(second > first, f"{key} did not resync upward")


def require_parameter_resync_contract_failure(
  label: str,
  mutate: Callable[[dict[str, object]], None],
  expected: str,
) -> None:
    payload = json.loads(json.dumps(parameter_resync_contract_fixture()))
    manifest = payload["manifest"]
    require(isinstance(manifest, dict), f"{label} fixture manifest missing")
    mutate(manifest)
    try:
        require_parameter_resync_contract(payload)
    except AssertionError as error:
        require(expected in str(error), f"{label} produced {error}, expected {expected}")
        return

    raise AssertionError(f"{label} did not fail")


def require_parameter_resync_contract_negative_cases() -> None:
    require_parameter_resync_contract(parameter_resync_contract_fixture())
    require_parameter_resync_contract_failure(
        "missing parameter resync",
        lambda manifest: manifest.pop("parameterResync"),
        "parameter resync missing",
    )
    require_parameter_resync_contract_failure(
        "missing frequency",
        lambda manifest: manifest["parameterResync"].pop("frequency"),
        "frequency resync missing",
    )
    require_parameter_resync_contract_failure(
        "frequency changed flag false",
        lambda manifest: manifest["parameterResync"]["frequency"].update(
            {"changed": False},
        ),
        "frequency resync changed flag missing",
    )
    require_parameter_resync_contract_failure(
        "amplitude first invalid",
        lambda manifest: manifest["parameterResync"]["amplitude"].update({"first": 0}),
        "amplitude first value invalid",
    )
    require_parameter_resync_contract_failure(
        "amplitude not upward",
        lambda manifest: manifest["parameterResync"]["amplitude"].update(
            {"second": 0.1},
        ),
        "amplitude did not resync upward",
    )


def caller_processing_order_contract_fixture() -> dict[str, object]:
    demo = "runtime_dsp_object_circuit_connected_wav_demo"
    steps = EXPECTED_CALLER_PROCESSING_STEPS[demo]
    return {
        "manifest": {
            "demo": demo,
            "circuitConnections": {
                "count": len(steps),
                "describesProcessingChain": True,
            },
            "callerProcessingOrderProof": {
                "matchesCircuitConnections": True,
            },
            "callerProcessingOrder": {
                "matchesCircuitConnections": True,
                "callerOwnsProcessingOrder": True,
                "steps": json.loads(json.dumps(steps)),
            },
        },
    }


def require_caller_processing_order_contract(payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")
    expected_steps = EXPECTED_CALLER_PROCESSING_STEPS.get(str(manifest.get("demo")))
    if expected_steps is None:
        return

    connections = manifest.get("circuitConnections")
    require(isinstance(connections, dict), "circuit connections missing")
    require(
        int(connections.get("count", 0)) == len(expected_steps),
        "circuit connection count mismatch",
    )
    require(
        connections.get("describesProcessingChain") is True,
        "circuit connection chain flag missing",
    )

    proof = manifest.get("callerProcessingOrderProof")
    require(isinstance(proof, dict), "caller processing proof missing")
    require(
        proof.get("matchesCircuitConnections") is True,
        "caller processing order mismatch",
    )

    order = manifest.get("callerProcessingOrder")
    require(isinstance(order, dict), "caller processing order missing")
    require(
        order.get("matchesCircuitConnections") is True,
        "caller processing order match flag missing",
    )
    require(
        order.get("callerOwnsProcessingOrder") is True,
        "caller processing ownership missing",
    )

    steps = order.get("steps")
    require(isinstance(steps, list), "caller processing steps missing")
    require(
        len(steps) == len(expected_steps),
        "caller processing step count mismatch",
    )
    for index, expected in enumerate(expected_steps):
        step = steps[index]
        require(isinstance(step, dict), "caller processing step invalid")
        for key, expected_value in expected.items():
            require(
                step.get(key) == expected_value,
                f"caller processing step {index} {key} mismatch",
            )


def require_caller_processing_order_contract_failure(
  label: str,
  mutate: Callable[[dict[str, object]], None],
  expected: str,
) -> None:
    payload = json.loads(json.dumps(caller_processing_order_contract_fixture()))
    manifest = payload["manifest"]
    require(isinstance(manifest, dict), f"{label} fixture manifest missing")
    mutate(manifest)
    try:
        require_caller_processing_order_contract(payload)
    except AssertionError as error:
        require(expected in str(error), f"{label} produced {error}, expected {expected}")
        return

    raise AssertionError(f"{label} did not fail")


def require_caller_processing_order_contract_negative_cases() -> None:
    require_caller_processing_order_contract(caller_processing_order_contract_fixture())
    require_caller_processing_order_contract_failure(
        "missing circuit connections",
        lambda manifest: manifest.pop("circuitConnections"),
        "circuit connections missing",
    )
    require_caller_processing_order_contract_failure(
        "wrong circuit connection count",
        lambda manifest: manifest["circuitConnections"].update({"count": 1}),
        "circuit connection count mismatch",
    )
    require_caller_processing_order_contract_failure(
        "chain flag false",
        lambda manifest: manifest["circuitConnections"].update(
            {"describesProcessingChain": False},
        ),
        "circuit connection chain flag missing",
    )
    require_caller_processing_order_contract_failure(
        "proof false",
        lambda manifest: manifest["callerProcessingOrderProof"].update(
            {"matchesCircuitConnections": False},
        ),
        "caller processing order mismatch",
    )
    require_caller_processing_order_contract_failure(
        "order flag false",
        lambda manifest: manifest["callerProcessingOrder"].update(
            {"matchesCircuitConnections": False},
        ),
        "caller processing order match flag missing",
    )
    require_caller_processing_order_contract_failure(
        "ownership false",
        lambda manifest: manifest["callerProcessingOrder"].update(
            {"callerOwnsProcessingOrder": False},
        ),
        "caller processing ownership missing",
    )
    require_caller_processing_order_contract_failure(
        "step count mismatch",
        lambda manifest: manifest["callerProcessingOrder"]["steps"].pop(),
        "caller processing step count mismatch",
    )
    require_caller_processing_order_contract_failure(
        "step mismatch",
        lambda manifest: manifest["callerProcessingOrder"]["steps"][0].update(
            {"destinationNode": "Audio Out"},
        ),
        "caller processing step 0 destinationNode mismatch",
    )


def require_artifact_reachability(base_url: str, payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")
    artifact_root = payload.get("artifactRoot")
    require(isinstance(artifact_root, str) and artifact_root, "artifact root missing")
    artifact_root_path = Path(artifact_root).resolve()
    links = manifest.get("artifactLinks")
    require(isinstance(links, list), "artifact links missing")

    for index, link in enumerate(links):
        require(isinstance(link, dict), f"artifact link {index} not object")
        path = link.get("path")
        require(isinstance(path, str) and path, f"artifact link {index} path missing")
        local_path = (artifact_root_path / path).resolve()
        require(
            local_path.is_relative_to(artifact_root_path),
            f"artifact link {index} escapes artifact root",
        )
        require(local_path.is_file(), f"artifact link {index} local file missing")
        artifact_response = request(
            f"{base_url}/artifact?path={urllib.parse.quote(path)}",
            method="HEAD",
        )
        require(
            artifact_response.status == 200,
            f"artifact link {index} did not return 200",
        )
        require_no_store(artifact_response, f"artifact link {index}")
        content_length = int(artifact_response.headers.get("content-length", "0"))
        require(
            content_length == local_path.stat().st_size,
            f"artifact link {index} content length mismatch",
        )
        require(
            artifact_response.headers.get("accept-ranges") == "bytes",
            f"artifact link {index} did not advertise byte ranges",
        )
        require(
            bool(artifact_response.headers.get("last-modified")),
            f"artifact link {index} last-modified missing",
        )


def require_report_documents(base_url: str, payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")
    artifact_root = payload.get("artifactRoot")
    require(isinstance(artifact_root, str) and artifact_root, "artifact root missing")
    artifact_root_path = Path(artifact_root).resolve()
    links = manifest.get("artifactLinks")
    require(isinstance(links, list), "artifact links missing")

    report_links = [
        link
        for link in links
        if isinstance(link, dict) and link.get("kind") in REPORT_ARTIFACT_KINDS
    ]
    require(report_links, "report artifact links missing")

    for index, link in enumerate(report_links):
        path = link.get("path")
        kind = link.get("kind")
        require(isinstance(path, str) and path, f"report link {index} path missing")
        local_path = (artifact_root_path / path).resolve()
        require(
            local_path.is_relative_to(artifact_root_path),
            f"report link {index} escapes artifact root",
        )
        expected = local_path.read_bytes()
        response = request(f"{base_url}/artifact?path={urllib.parse.quote(path)}")
        require(response.status == 200, f"report link {index} did not return 200")
        require_no_store(response, f"report link {index}")
        require(
            response.headers.get("content-length") == str(len(expected)),
            f"report link {index} content-length mismatch",
        )
        require(response.body == expected, f"report link {index} did not match local bytes")
        text = response.body.decode("utf-8")
        require(text.strip(), f"report link {index} was empty")
        if kind == "manifest":
            json.loads(text)


def parse_summary_pairs(text: str) -> dict[str, str]:
    pairs: dict[str, str] = {}
    for line in text.splitlines():
        key, separator, value = line.partition(":")
        if separator and key.strip():
            pairs[key.strip()] = value.strip()
    return pairs


def require_parameter_summary(base_url: str, payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")

    resync = manifest.get("parameterResync")
    require(isinstance(resync, dict), "parameter resync missing")
    frequency = resync.get("frequency")
    amplitude = resync.get("amplitude")
    require(isinstance(frequency, dict), "frequency resync missing")
    require(isinstance(amplitude, dict), "amplitude resync missing")
    require(frequency.get("changed") is True, "frequency resync changed flag missing")
    require(amplitude.get("changed") is True, "amplitude resync changed flag missing")

    first_frequency = float(frequency.get("first", 0))
    second_frequency = float(frequency.get("second", 0))
    first_amplitude = float(amplitude.get("first", 0))
    second_amplitude = float(amplitude.get("second", 0))
    require(first_frequency > 0, "manifest first frequency was not positive")
    require(second_frequency > 0, "manifest second frequency was not positive")
    require(first_amplitude > 0, "manifest first amplitude was not positive")
    require(second_amplitude > 0, "manifest second amplitude was not positive")
    require(second_frequency > first_frequency, "manifest frequency did not resync upward")
    require(second_amplitude > first_amplitude, "manifest amplitude did not resync upward")

    links = manifest.get("artifactLinks")
    require(isinstance(links, list), "artifact links missing")
    summary_links = [
        link
        for link in links
        if isinstance(link, dict) and link.get("kind") == "text-summary"
    ]
    require(len(summary_links) == 1, "expected exactly one text summary")

    path = summary_links[0].get("path")
    require(isinstance(path, str) and path, "text summary path missing")
    response = request(f"{base_url}/artifact?path={urllib.parse.quote(path)}")
    require(response.status == 200, "text summary did not return 200")
    require_no_store(response, "text summary")
    pairs = parse_summary_pairs(response.body.decode("utf-8"))

    for key in SUMMARY_PARAMETER_KEYS:
        require(key in pairs, f"text summary missing {key}")
        number = float(pairs[key])
        require(number > 0, f"text summary {key} was not positive")

    require(
        float(pairs["first half frequency"]) == first_frequency,
        "text summary first frequency did not match manifest",
    )
    require(
        float(pairs["second half frequency"]) == second_frequency,
        "text summary second frequency did not match manifest",
    )
    require(
        float(pairs["first half amplitude"]) == first_amplitude,
        "text summary first amplitude did not match manifest",
    )
    require(
        float(pairs["second half amplitude"]) == second_amplitude,
        "text summary second amplitude did not match manifest",
    )


def decode_mono_float_samples(
    frames: bytes,
    channels: int,
    sample_width: int,
) -> list[float]:
    require(sample_width == 2, "WAV sample width was not 16-bit")
    samples: list[float] = []
    frame_width = channels * sample_width
    frame_count = len(frames) // frame_width
    for frame_index in range(frame_count):
        total = 0.0
        for channel in range(channels):
            offset = frame_index * frame_width + channel * sample_width
            total += int.from_bytes(
                frames[offset : offset + sample_width],
                byteorder="little",
                signed=True,
            ) / 32768
        samples.append(total / channels)
    return samples


def estimate_positive_crossing_frequency(
    samples: list[float],
    start_frame: int,
    end_frame: int,
    sample_rate: int,
) -> float | None:
    start = max(0, min(len(samples), start_frame))
    end = max(start, min(len(samples), end_frame))
    if end - start < 2 or sample_rate <= 0:
        return None

    crossings: list[float] = []
    previous = samples[start]
    for frame in range(start + 1, end):
        current = samples[frame]
        if previous < 0 <= current:
            span = current - previous
            offset = 0 if span == 0 else -previous / span
            crossings.append(frame - 1 + offset)
        previous = current

    if len(crossings) < 2:
        return None

    seconds = (crossings[-1] - crossings[0]) / sample_rate
    if seconds <= 0:
        return None
    return (len(crossings) - 1) / seconds


def require_phase_audio_measurements(
    manifest: dict[str, object],
    samples: list[float],
    sample_rate: int,
) -> None:
    phases = manifest.get("phases")
    require(isinstance(phases, list), "phase measurement phases missing")
    resync = manifest.get("parameterResync")
    require(isinstance(resync, dict), "phase measurement resync missing")
    frequency = resync.get("frequency")
    amplitude = resync.get("amplitude")
    bias = resync.get("bias", {})
    require(isinstance(frequency, dict), "phase measurement frequency missing")
    require(isinstance(amplitude, dict), "phase measurement amplitude missing")
    require(isinstance(bias, dict), "phase measurement bias invalid")
    producer_measurements = manifest.get("phaseAudioMeasurements")
    require(
        isinstance(producer_measurements, list),
        "producer phase measurements missing",
    )
    producer_measurements_by_name = {
        measurement.get("name"): measurement
        for measurement in producer_measurements
        if isinstance(measurement, dict)
    }

    for index, phase in enumerate(phases):
        require(isinstance(phase, dict), f"phase measurement {index} not object")
        name = phase.get("name")
        require(isinstance(name, str) and name, f"phase measurement {index} name missing")
        start_frame = int(phase.get("startFrame", -1))
        end_frame = int(phase.get("endFrame", -1))
        require(start_frame >= 0 and end_frame > start_frame, f"{name} range invalid")

        target_frequency = float(frequency.get(name, 0))
        target_amplitude = float(amplitude.get(name, 0))
        target_bias = float(bias.get(name, 0))
        target_peak = target_amplitude + abs(target_bias)
        require(target_frequency > 0, f"{name} target frequency missing")
        require(target_amplitude > 0, f"{name} target amplitude missing")

        measured_frequency = estimate_positive_crossing_frequency(
            samples,
            start_frame,
            end_frame,
            sample_rate,
        )
        require(measured_frequency is not None, f"{name} measured frequency missing")
        require(
            abs(measured_frequency - target_frequency) < 0.5,
            f"{name} measured frequency {measured_frequency} did not match {target_frequency}",
        )

        phase_samples = samples[start_frame:end_frame]
        peak = max(abs(sample) for sample in phase_samples)
        rms = (sum(sample * sample for sample in phase_samples) / len(phase_samples)) ** 0.5
        dc_offset = sum(phase_samples) / len(phase_samples)
        require(
            abs(peak - target_peak) < 0.001,
            f"{name} peak {peak} did not match target peak {target_peak}",
        )
        require(
            abs(dc_offset - target_bias) < 0.001,
            f"{name} dc offset {dc_offset} did not match target bias {target_bias}",
        )
        producer_measurement = producer_measurements_by_name.get(name)
        require(
            isinstance(producer_measurement, dict),
            f"{name} producer measurement missing",
        )
        producer_frequency = float(producer_measurement.get("measuredFrequency", 0))
        producer_peak = float(producer_measurement.get("peak", 0))
        producer_rms = float(producer_measurement.get("rms", 0))
        require(
            abs(producer_frequency - measured_frequency) < 0.5,
            f"{name} producer frequency {producer_frequency} did not match decoded {measured_frequency}",
        )
        require(
            abs(producer_peak - peak) < 0.001,
            f"{name} producer peak {producer_peak} did not match decoded {peak}",
        )
        require(
            abs(producer_rms - rms) < 0.001,
            f"{name} producer rms {producer_rms} did not match decoded {rms}",
        )


def require_primary_audio_wav(base_url: str, payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")

    handoff = manifest.get("sandboxHandoff")
    require(isinstance(handoff, dict), "sandbox handoff missing")
    audio_path = handoff.get("primaryAudioArtifact")
    require(isinstance(audio_path, str) and audio_path, "primary audio artifact missing")

    wav = manifest.get("wav")
    require(isinstance(wav, dict), "wav metadata missing")
    expected_frames = int(wav.get("frames", 0))
    expected_sample_rate = int(wav.get("sampleRate", 0))
    expected_channels = int(wav.get("channels", 0))
    expected_bit_depth = int(wav.get("bitDepth", 0))
    expected_data_bytes = int(wav.get("dataBytes", 0))
    expected_file_bytes = int(wav.get("fileBytes", 0))
    require(expected_frames > 0, "wav frame count missing")
    require(expected_sample_rate > 0, "wav sample rate missing")
    require(expected_channels > 0, "wav channel count missing")
    require(expected_bit_depth > 0, "wav bit depth missing")
    require(expected_data_bytes > 0, "wav data byte count missing")
    require(expected_file_bytes > 0, "wav file byte count missing")

    response = request(f"{base_url}/artifact?path={urllib.parse.quote(audio_path)}")
    require(response.status == 200, "primary audio WAV did not return 200")
    require_no_store(response, "primary audio WAV")
    require(
        response.headers.get("accept-ranges") == "bytes",
        "primary audio WAV did not advertise byte ranges",
    )
    require(len(response.body) == expected_file_bytes, "WAV file byte count mismatch")

    range_url = f"{base_url}/artifact?path={urllib.parse.quote(audio_path)}"
    range_response = request(range_url, headers={"Range": "bytes=0-15"})
    require(range_response.status == 206, "primary audio range did not return 206")
    require_no_store(range_response, "primary audio range")
    require(
        range_response.headers.get("accept-ranges") == "bytes",
        "primary audio range did not advertise byte ranges",
    )
    require(
        range_response.headers.get("content-range")
        == f"bytes 0-15/{expected_file_bytes}",
        "primary audio range content-range mismatch",
    )
    require(len(range_response.body) == 16, "primary audio range byte count mismatch")

    open_range = request(range_url, headers={"Range": "bytes=16-"})
    require(open_range.status == 206, "open-ended primary audio range did not return 206")
    require_no_store(open_range, "open-ended primary audio range")
    require(
        open_range.headers.get("content-range") == f"bytes 16-{expected_file_bytes - 1}/{expected_file_bytes}",
        "open-ended primary audio range content-range mismatch",
    )
    require(
        open_range.body == response.body[16:],
        "open-ended primary audio range bytes mismatch",
    )

    suffix_range = request(range_url, headers={"Range": "bytes=-16"})
    require(suffix_range.status == 206, "suffix primary audio range did not return 206")
    require_no_store(suffix_range, "suffix primary audio range")
    require(
        suffix_range.headers.get("content-range")
        == f"bytes {expected_file_bytes - 16}-{expected_file_bytes - 1}/{expected_file_bytes}",
        "suffix primary audio range content-range mismatch",
    )
    require(suffix_range.body == response.body[-16:], "suffix primary audio range bytes mismatch")

    unsatisfied_range = request(
        range_url,
        headers={"Range": f"bytes={expected_file_bytes + 1}-"},
    )
    require(
        unsatisfied_range.status == 416,
        "unsatisfied primary audio range did not return 416",
    )
    require_no_store(unsatisfied_range, "unsatisfied primary audio range")
    require(
        unsatisfied_range.headers.get("content-range") == f"bytes */{expected_file_bytes}",
        "unsatisfied primary audio range content-range mismatch",
    )
    require(
        unsatisfied_range.headers.get("content-length") == "0",
        "unsatisfied primary audio range content-length mismatch",
    )

    for label, header in [
        ("unsupported unit", "samples=0-15"),
        ("multi range", "bytes=0-1,4-5"),
        ("reversed range", "bytes=15-0"),
        ("zero suffix", "bytes=-0"),
    ]:
        invalid_range = request(range_url, headers={"Range": header})
        require(invalid_range.status == 416, f"{label} primary audio range did not return 416")
        require_no_store(invalid_range, f"{label} primary audio range")
        require(
            invalid_range.headers.get("content-range") == f"bytes */{expected_file_bytes}",
            f"{label} primary audio range content-range mismatch",
        )
        require(
            invalid_range.headers.get("content-length") == "0",
            f"{label} primary audio range content-length mismatch",
        )
        require(invalid_range.body == b"", f"{label} primary audio range returned a body")

    try:
        with tempfile.TemporaryFile() as handle:
            handle.write(response.body)
            handle.seek(0)
            with open_wave(handle, "rb") as wave_file:
                require(wave_file.getnframes() == expected_frames, "WAV frame mismatch")
                require(
                    wave_file.getframerate() == expected_sample_rate,
                    "WAV sample rate mismatch",
                )
                require(
                    wave_file.getnchannels() == expected_channels,
                    "WAV channel count mismatch",
                )
                require(
                    wave_file.getsampwidth() * 8 == expected_bit_depth,
                    "WAV bit depth mismatch",
                )
                require(
                    expected_frames * expected_channels * wave_file.getsampwidth()
                    == expected_data_bytes,
                    "WAV data byte count mismatch",
                )
                wave_file.rewind()
                samples = decode_mono_float_samples(
                    wave_file.readframes(expected_frames),
                    expected_channels,
                    wave_file.getsampwidth(),
                )
                require(len(samples) == expected_frames, "decoded WAV sample count mismatch")
                require_phase_audio_measurements(
                    manifest,
                    samples,
                    expected_sample_rate,
                )
    except WaveError as error:
        raise AssertionError(f"primary audio WAV parse failed: {error}") from error


def require_read_only_method_rejections(base_url: str) -> None:
    for method, path in [
        ("POST", "/api/manifest"),
        ("POST", "/api/node-metadata-kinds"),
        ("PUT", "/artifact?path=runtime_dsp_object_bound_wav_resync_demo.wav"),
        ("PATCH", "/public/app.js"),
        ("DELETE", "/"),
        ("OPTIONS", "/api/manifest"),
    ]:
        response = request(f"{base_url}{path}", method=method)
        label = f"{method} {path}"
        require(response.status == 405, f"{label} did not return 405")
        require_no_store(response, label)

    invalid_default = request(f"{base_url}/api/presets/default", method="POST")
    require(invalid_default.status == 400, "empty default preset update did not return 400")
    require_no_store(invalid_default, "empty default preset update")


def require_user_ui_settings_update_contract(base_url: str) -> None:
    original = DEFAULT_UI_SETTINGS.read_bytes()
    original_script = DEFAULT_UI_SETTINGS_SCRIPT.read_bytes()
    payload = json.loads(original.decode("utf-8"))
    payload["format"] = {
        "kind": "soemdsp-sandbox-user-ui-settings",
        "version": 3,
    }
    payload["view"] = {"gridVisible": False, "sliderLayout": "value-focus"}
    body = json.dumps(payload).encode("utf-8")
    try:
        response = request(
            f"{base_url}/api/presets/useruisettings",
            method="POST",
            headers={"Content-Type": "application/json"},
            data=body,
        )
        require(response.status == 200, "version 3 UI settings update did not return 200")
        require_no_store(response, "version 3 UI settings update")
        saved_payload = json.loads(DEFAULT_UI_SETTINGS.read_text(encoding="utf-8"))
        require(
            saved_payload.get("format", {}).get("version") == 3,
            "version 3 UI settings update was not saved",
        )
        require(
            saved_payload.get("view", {}).get("gridVisible") is False,
            "UI settings update did not preserve view.gridVisible",
        )
        require(
            saved_payload.get("view", {}).get("sliderLayout") == "value-focus",
            "UI settings update did not preserve view.sliderLayout",
        )
        saved_script = DEFAULT_UI_SETTINGS_SCRIPT.read_text(encoding="utf-8")
        require(
            "window.nodeUiDevBundledDefaultSettings" in saved_script,
            "UI settings update did not write bundled script preset",
        )
        require(
            "document.documentElement.dataset.nodeUiDevBundledDefaultSettings" in saved_script,
            "UI settings update did not write DOM-readable bundled script preset",
        )
        require(
            '"gridVisible": false' in saved_script,
            "bundled UI settings script did not preserve view.gridVisible",
        )
        require(
            '"sliderLayout": "value-focus"' in saved_script,
            "bundled UI settings script did not preserve view.sliderLayout",
        )
    finally:
        DEFAULT_UI_SETTINGS.write_bytes(original)
        DEFAULT_UI_SETTINGS_SCRIPT.write_bytes(original_script)


def require_root_shell(base_url: str) -> None:
    expected = (PUBLIC / "index.html").read_bytes()
    expected_size = str(len(expected))
    root_response: Response | None = None
    for path in ["/", "/public/index.html"]:
        response = request(f"{base_url}{path}")
        require(response.status == 200, f"{path} shell did not return 200")
        require_no_store(response, f"{path} shell")
        require_content_type(response, "text/html", f"{path} shell")
        require(
            response.headers.get("content-length") == expected_size,
            f"{path} shell content-length mismatch",
        )
        require(response.body == expected, f"{path} shell did not match local index.html")
        if path == "/":
            root_response = response

    require(root_response is not None, "root shell response missing")
    require_shell_contract(root_response.body.decode("utf-8"))


def require_static_assets(base_url: str) -> None:
    for path, content_type, source_path in static_asset_contracts():
        expected = source_path.read_bytes()
        expected_size = str(len(expected))
        head_response = request(f"{base_url}{path}", method="HEAD")
        require(head_response.status == 200, f"{path} HEAD did not return 200")
        require(head_response.body == b"", f"{path} HEAD returned a body")
        require_no_store(head_response, f"{path} HEAD")
        require_content_type(head_response, content_type, f"{path} HEAD")
        require(
            head_response.headers.get("content-length") == expected_size,
            f"{path} HEAD content-length mismatch",
        )

        get_response = request(f"{base_url}{path}")
        require(get_response.status == 200, f"{path} GET did not return 200")
        require_no_store(get_response, f"{path} GET")
        require_content_type(get_response, content_type, f"{path} GET")
        require(
            get_response.headers.get("content-length") == expected_size,
            f"{path} GET content-length mismatch",
        )
        require(get_response.body == expected, f"{path} GET did not match local file bytes")


def require_waveform_seek_source_contract() -> None:
    script_sources = read_public_script_sources()
    app_source = script_sources["./public/app.js"]
    waveform_source = "\n".join(script_sources.values())
    style_source = (PUBLIC / "styles.css").read_text(encoding="utf-8")
    require(
        "function seekPrimaryAudioToFrame(frame, source = inspectionSources.waveform)" in waveform_source,
        "waveform seek helper missing",
    )
    require(
        "audio.currentTime = targetTime;" in waveform_source,
        "waveform seek helper does not seek primary audio",
    )
    for snippet in [
        "function analyzeWaveform(samples)",
        '["peak", formatCompactNumber(stats.peak)]',
        '["rms", formatCompactNumber(stats.rms)]',
        '["dc offset", formatCompactNumber(stats.dcOffset)]',
        "function analyzeSampleRange(samples, startFrame, endFrame)",
        "function estimateZeroCrossingFrequency(samples, startFrame, endFrame, sampleRate)",
        "function activeParameterValue(name, region)",
        "function producerPhaseAudioMeasurement(region)",
        "function measuredPhaseAudio(region)",
        "function targetPeakFor(targetAmplitude, targetBias)",
        "function measuredPhaseAudioMatches(measurement, targetFrequency, targetAmplitude, targetBias = 0)",
        "function measuredPhaseDelta(measuredValue, targetValue)",
        "const measuredFrequency = document.getElementById(\"currentMeasuredFrequency\")",
        "const measuredPeak = document.getElementById(\"currentMeasuredPeak\")",
        "const measuredFrequencyDelta = document.getElementById(\"currentMeasuredFrequencyDelta\")",
        "const measuredPeakDelta = document.getElementById(\"currentMeasuredPeakDelta\")",
        "const measuredStatus = document.getElementById(\"currentMeasuredStatus\")",
        "measurement?.frequency === null || measurement?.frequency === undefined",
        "`measured ${formatCompactNumber(measurement.frequency)} Hz`",
        "`peak ${formatCompactNumber(measurement.peak)}`",
        "`freq delta ${formatSignedNumber(frequencyDelta)}`",
        "`peak delta ${formatSignedNumber(peakDelta)}`",
        '"measured ok"',
        '"measured mismatch"',
        "Math.abs(measurement.frequency - targetFrequency) <= phaseAudioFrequencyToleranceHz",
        "Math.abs(measurement.peak - targetPeak) <= phaseAudioAmplitudeTolerance",
        "Math.abs(measurement.dcOffset - (targetBias || 0)) <= phaseAudioAmplitudeTolerance",
        "function phaseAudioMeasurementIssues(manifest)",
        "const phaseAudioFrequencyToleranceHz = 0.5",
        "const phaseAudioAmplitudeTolerance = 0.001",
        "const phaseAudioRmsTolerance = 0.001",
        "function renderCurrentParameters(region)",
        "const frames = Math.max(0, region.endFrame - region.startFrame)",
        ")} / ${frames} frames`",
        "waveformProbeSource: null",
        "function labelInspectionCursorPill(element, label, value, stateName)",
        "element.dataset.inspectionPill = label",
        "element.dataset.inspectionValue = value",
        "element.dataset.inspectionState = stateName",
        "function labelInspectionCursorSurface(cursor, value, stateName)",
        'cursor.dataset.inspectionCursorLabel = "inspection cursor"',
        "cursor.dataset.inspectionCursorValue = value",
        "cursor.dataset.inspectionCursorState = stateName",
        'cursor.setAttribute("role", "group")',
        "function setInspectionCursorSource(sourceName, mode)",
        "source.className = `pill inspection-source ${mode}`",
        "labelInspectionCursorPill(source, \"inspection source\", value, mode)",
        "manifestLoading: false",
        "function renderRefreshButton(loading = state.manifestLoading)",
        'const button = document.getElementById("refreshButton")',
        "if (!button) {",
        "button.disabled = loading",
        'button.textContent = loading ? "Loading Manifest" : "Reload Manifest"',
        "button.setAttribute(\"aria-busy\", String(loading))",
        "button.dataset.loading = String(loading)",
        'loading ? "legacyEvidence.manifestReloading" : "legacyEvidence.manifestReload"',
        "if (state.manifestLoading) {",
        "state.manifestLoading = true",
        "state.manifestLoading = false",
        "?.addEventListener(\"click\", loadManifest)",
        "function formatInspectionDelta(deltaFrame, sampleRate)",
        "function setInspectionCursorDelta(deltaFrame, sampleRate)",
        "const inspectionModes = Object.freeze(",
        'none: "none"',
        'transport: "transport"',
        'hover: "hover"',
        'probe: "probe"',
        "deltaFrame === null ? inspectionModes.none : inspectionModes.hover",
        "function formatAudioDuration(duration)",
        "function setInspectionCursorAudio(time, duration)",
        "formatAudioDuration(duration)",
        "const positionText = `audio ${formatSeconds(Number.isFinite(time) ? time : 0)} / ${formatAudioDuration(duration)}`",
        'labelWaveformHeaderPill(',
        '"primary audio position"',
        "Boolean(audio.getAttribute(\"src\"))",
        'labelWaveformHeaderPill(position, "waveform position", "0.000s / unknown", false)',
        "formatAudioDuration(waveform.frames / waveform.sampleRate)",
        'labelWaveformHeaderPill(sample, "waveform sample", "frame 0 / unknown / sample 0", false)',
        "const sampleText = `frame ${state.playheadFrame} / ${waveform.frames} / sample ${formatCompactNumber(",
        "function resetSharedProbeState()",
        "function resetWaveformTransientState()",
        "resetSharedProbeState();",
        "resetWaveformTransientState();",
        "function setProbePillMetadata(probe, source, frame, title)",
        "function resetProbePill(id, text, title)",
        "function resetIdleProbePill(id, title)",
        "resetProbePill(id, inspectionModes.probe, title)",
        "probe.dataset.probeSource = source",
        'probe.dataset.probeFrame = frame === null || frame === undefined ? "none" : String(frame)',
        "probe.title = title",
        'resetIdleProbePill("waveformProbe", "Waveform probe idle")',
        "`Waveform probe ${source}",
        'resetIdleProbePill("levelEnvelopeProbe", "Level envelope probe idle")',
        "`Level envelope probe ${source}",
        'resetIdleProbePill("parameterTimelineProbe", "Parameter timeline probe idle")',
        "`Parameter timeline probe ${source}",
        'resetIdleProbePill("phaseAudioStatsProbe", "Phase audio stats probe idle")',
        "Phase audio stats probe ${source}",
        'resetIdleProbePill("phaseProbe", "Phase list probe idle")',
        "Phase list probe ${source}",
        'resetIdleProbePill("signalPlotProbe", "Signal plot probe idle")',
        'resetProbePill("signalPlotProbeSource", "near frame", "Signal plot source probe idle")',
        "Signal plot probe ${probeSource}",
        "Signal plot source ${probeSource}",
        "function updateWaveformScrubberLabel(scrubber, waveform, activeRegion)",
        "scrubber.setAttribute(\"aria-valuetext\"",
        "scrubber.dataset.followMode = followText",
        'nodeGraphTooltipText("legacyEvidence.waveformPosition"',
        "setInspectionCursorAudio(time, duration)",
        "setInspectionCursorAudio(0, Number.NaN)",
        "function setInspectionCursorPlayback(audio)",
        "labelInspectionCursorPill(playback, \"inspection playback\", value, stateName)",
        "setInspectionCursorPlayback(audio)",
        "setInspectionCursorPlayback(null)",
        'canvas.dataset.waveformSource = "decoded primary WAV"',
        "canvas.dataset.waveformSampleRate = String(state.waveform.sampleRate)",
        "canvas.dataset.waveformChannels = String(state.waveform.channels)",
        "canvas.dataset.waveformBitDepth = String(state.waveform.bitsPerSample)",
        "canvas.dataset.waveformFrames = String(state.waveform.frames)",
        "canvas.dataset.waveformDataBytes = String(state.waveform.dataBytes)",
        "canvas.dataset.waveformFileBytes = String(state.waveform.fileBytes)",
        "canvas.dataset.waveformPeak = formatCompactNumber(stats.peak)",
        "canvas.dataset.waveformRms = formatCompactNumber(stats.rms)",
        "`Primary WAV waveform / ${state.waveform.frames} frames / `",
        "function renderWaveformPlayControl(audio = document.getElementById(\"audioPlayer\"))",
        '"Pause primary audio"',
        '"Replay primary audio from start"',
        '"Play primary audio"',
        "const ended = ready && audio.ended",
        'const value = playing ? "Pause Audio" : ended ? "Replay Audio" : "Play Audio"',
        "const actionValue = playing",
        'const stateName = !ready ? "disabled" : playing ? "playing" : ended ? "ended" : "idle"',
        "button.textContent = value",
        "button.setAttribute(\"aria-pressed\", String(playing))",
        'labelWaveformControlButton(button, "waveform playback", actionValue, stateName)',
        "function togglePrimaryAudioPlayback()",
        "if (audio.ended) {",
        "audio.currentTime = 0;",
        "if (state.followAudio && state.waveform) {",
        "setPlayheadFrame(0);",
        "await audio.play();",
        "audio.pause();",
        "function syncWaveformToAudioEnd()",
        "setPlayheadFrame(state.waveform.frames);",
        '.addEventListener("ended", syncWaveformToAudioEnd)',
        ".addEventListener(\"click\", togglePrimaryAudioPlayback)",
        "function probeSourceText()",
        "function currentProbeSource()",
        "return state.waveformProbeSource || inspectionModes.probe",
        "source === inspectionModes.probe ? inspectionModes.probe : `${inspectionModes.probe} ${source}`",
        "function setInspectionCursorView(followAudio)",
        "labelInspectionCursorPill(view, \"inspection view\", value, stateName)",
        "setInspectionCursorView(state.followAudio)",
        'view.className = `pill inspection-view ${stateName}`',
        '.addEventListener("play", renderAudioPosition)',
        '.addEventListener("pause", renderAudioPosition)',
        '.addEventListener("ended", syncWaveformToAudioEnd)',
        "function setInspectionCursorPreview(active)",
        "labelInspectionCursorPill(preview, \"inspection preview\", value, stateName)",
        'setInspectionCursorPreview(false)',
        "lastSeekSource: null",
        "lastSeekFrame: null",
        "function setInspectionCursorSeek(sourceName)",
        "labelInspectionCursorPill(seek, \"inspection seek\", value, stateName)",
        'seek.className = `pill inspection-seek ${stateName}`',
        "function setInspectionCursorSeekTarget(region, frame, sampleRate)",
        '`seek target ${region.name} / ${formatSeconds(frame / sampleRate)} / frame ${frame}`',
        '"seek target none"',
        'target.className = `pill inspection-seek-target ${hasTarget ? "active" : "none"}`',
        "labelInspectionCursorPill(",
        "function setInspectionCursorSeekSync(match)",
        'match === "aligned"',
        'match === "diverged"',
        '"seek drift"',
        '"seek sync idle"',
        'sync.className = `pill inspection-seek-sync ${match}`',
        "setInspectionCursorSeek(state.lastSeekSource)",
        "setInspectionCursorSeekTarget(lastSeekRegion, lastSeekFrame, waveform.sampleRate)",
        "setInspectionCursorSeekSync(lastSeekTransportMatch)",
        "setInspectionCursorSeekTarget(null, null, 1)",
        'setInspectionCursorSeekSync("none")',
        "setInspectionCursorSeek(null)",
        "const lastSeekFrame =",
        "state.lastSeekFrame === null ? null : clampFrame(state.lastSeekFrame, waveform)",
        '["last seek source", state.lastSeekSource || "none"]',
        '"last seek mode"',
        "state.lastSeekFollowAudio === null",
        '"follow audio"',
        '"free view"',
        "function labelWaveformControlButton(button, label, value, stateName)",
        "button.dataset.waveformControlLabel = label",
        "button.dataset.waveformControlValue = valueText",
        "button.dataset.waveformControlState = stateName",
        'labelWaveformControlButton(button, "waveform playback", actionValue, stateName)',
        'labelWaveformControlButton(button, "waveform view mode", actionValue, stateName)',
        "function waveformControlsLabeled()",
        'return waveformControlButtonsLabeled(["waveformPlayButton", "followAudioButton"])',
        "function waveformPlayControlLabeled()",
        'return waveformControlButtonsLabeled(["waveformPlayButton"])',
        "function followAudioControlLabeled()",
        'return waveformControlButtonsLabeled(["followAudioButton"])',
        "function waveformControlButtonsLabeled(ids)",
        '["last seek frame", lastSeekFrame === null ? "none" : String(lastSeekFrame)]',
        '"last seek time"',
        '["last seek phase", lastSeekRegion?.name || "none"]',
        "const lastSeekTransportDeltaFrame =",
        '"last seek transport match"',
        '"last seek transport delta"',
        "lastSeekTransportDeltaFrame === 0",
        "formatInspectionDelta(lastSeekTransportDeltaFrame, waveform.sampleRate)",
        "const lastSeekHoverDeltaFrame =",
        '"last seek hover match"',
        '"last seek hover delta"',
        "lastSeekHoverDeltaFrame === 0",
        "formatInspectionDelta(lastSeekHoverDeltaFrame, waveform.sampleRate)",
        "state.lastSeekFrame = targetFrame",
        "state.lastSeekFollowAudio = state.followAudio",
        "scrubberPointerActive: false",
        "function beginScrubberDrag(event)",
        "function endScrubberDrag(event)",
        "state.lastSeekFrame = null",
        "state.lastSeekFollowAudio = null",
        "state.scrubberPointerActive = false",
        "const inspectionSources = Object.freeze(",
        'waveform: "waveform"',
        'scrubber: "scrubber"',
        'levelEnvelope: "level envelope"',
        'signalPlot: "signal plot"',
        'parameterTimeline: "parameter timeline"',
        'phaseAudioStats: "phase audio stats"',
        'phaseList: "phase list"',
        'phaseJump: "phase jump"',
        "button.dataset.phaseName = region.name || \"\"",
        "button.dataset.phaseStartFrame = String(region.startFrame)",
        "button.dataset.phaseEndFrame = String(region.endFrame)",
        "button.dataset.phaseStartTime = formatSeconds(region.startFrame / waveform.sampleRate)",
        "button.dataset.phaseEndTime = formatSeconds(region.endFrame / waveform.sampleRate)",
        '`Jump waveform to ${region.name} phase from frame ${region.startFrame} to ${region.endFrame}`',
        "`Jump to ${region.name} from ${button.dataset.phaseStartTime} to ${button.dataset.phaseEndTime}`",
        "seekPrimaryAudioToFrame(region.startFrame, inspectionSources.phaseJump)",
        "seekPrimaryAudioToFrame(waveformFrameAtClientX(clientX), inspectionSources.waveform)",
        "seekPrimaryAudioToFrame(Math.round(ratio * waveform.frames), inspectionSources.scrubber)",
        "function setInspectionCursorTarget(region, frame, sampleRate)",
        '`target ${region.name} / ${formatSeconds(frame / sampleRate)} / frame ${frame}`',
        '"target none"',
        'target.className = `pill inspection-target ${hasTarget ? "active" : "none"}`',
        'labelInspectionCursorPill(target, "inspection target", value, hasTarget ? "active" : "none")',
        "setInspectionCursorTarget(null, null, 1)",
        "function setInspectionCursorTransport(region, frame, sampleRate)",
        '`transport ${region.name} / ${formatSeconds(frame / sampleRate)} / frame ${frame}`',
        '"transport none"',
        'transport.className = `pill inspection-transport ${hasTransport ? "active" : "none"}`',
        "labelInspectionCursorPill(",
        "setInspectionCursorTransport(null, null, 1)",
        "function setInspectionCursorDivergence(transportRegion, targetRegion)",
        "`phase diverged ${transportRegion.name} -> ${targetRegion.name}`",
        '"phase aligned"',
        "divergence.className = `pill inspection-divergence ${diverged ? \"diverged\" : \"aligned\"}`",
        "setInspectionCursorDivergence(null, null)",
        "setInspectionCursorSource(inspectionModes.none, inspectionModes.none)",
        "setInspectionCursorDelta(null, 1)",
        "hoverFrame === null ? inspectionModes.transport : inspectionModes.hover",
        "setInspectionCursorDelta(hoverDeltaFrame, waveform.sampleRate)",
        "setInspectionCursorPreview(hoverFrame !== null)",
        "setInspectionCursorTransport(transportRegion, transportFrame, waveform.sampleRate)",
        "setInspectionCursorTarget(hoverRegion, hoverFrame, waveform.sampleRate)",
        "setInspectionCursorDivergence(transportRegion, hoverRegion)",
        '["hover source", hoverFrame === null ? "none" : hoverSource]',
        "const hoverDeltaFrame = hoverFrame === null ? null : hoverFrame - transportFrame",
        '"hover delta"',
        "state.waveformProbeSource = inspectionSources.waveform",
        "state.waveformProbeSource = inspectionSources.levelEnvelope",
        "function formatProbeFrame(frame, waveform, region = waveformRegionAtFrameFor(waveform, frame))",
        "function probeFrameLabelsReady()",
        "const label = formatProbeFrame(0, waveform)",
        'label.includes("0.000s")',
        'label.includes("frame 0")',
        "function waveformRegionAtFrameFor(waveform, frame)",
        "formatProbeFrame(frame, waveform, region)} / peak ${formatCompactNumber(",
        "state.waveformProbeFrame === null ? null : inspectionSources.signalPlot",
        "state.waveformProbeSource = inspectionSources.parameterTimeline",
        "state.waveformProbeSource = inspectionSources.phaseAudioStats",
        "state.waveformProbeSource = inspectionSources.phaseList",
        "setSharedProbeFrame(region.startFrame, inspectionSources.phaseJump)",
        "function renderSandboxContract(manifest)",
        '["allowed", "display manifest artifacts", Boolean(handoff.entryPoint)]',
        '["allowed", "play browser-native WAV", Boolean(handoff.primaryAudioArtifact)]',
        '["allowed", "inspect decoded WAV data", handoff.inspectionMode === expectedInspectionMode]',
        '["forbidden", "own DSP objects", handoff.circuitOwnsDspObjects === false]',
        '["forbidden", "make DSP know Circuit", handoff.dspObjectsKnowCircuit === false]',
        '["forbidden", "own scheduler", handoff.ownsScheduler === false]',
        '["forbidden", "own audio engine", handoff.ownsAudioEngine === false]',
        '["forbidden", "serialize patches", handoff.serializesPatch === false]',
        '["required", "caller owns processing order", handoff.callerOwnsProcessingOrder === true]',
        "item.dataset.contractKind = kind",
        "item.dataset.contractLabel = label",
        'item.dataset.contractState = rowOk ? "ok" : "check"',
        'item.setAttribute("role", "group")',
        "item.setAttribute(\"aria-label\", `${kind}: ${label} / ${item.dataset.contractState}`)",
        'nodeGraphTooltipText("legacyEvidence.contractRow"',
        "function sandboxContractRowsLabeled()",
        'setStatus("sandboxContractStatus", ok ? "Bounded" : "Check", ok)',
        'frequencyValue === null ? "freq" : `freq ${formatCompactNumber(frequencyValue)} Hz`',
        'amplitudeValue === null ? "amp" : `amp ${formatCompactNumber(amplitudeValue)}`',
        'const statusText = ok ? `params ${region?.name || "synced"}` : "params missing"',
        'labelWaveformHeaderPill(status, "current parameter status", statusText, ok)',
        "function parameterTimelineRows(manifest)",
        "function renderParameterTimeline(manifest)",
        "function renderUnavailableParameterSummary()",
        '["first half frequency", "unavailable"]',
        "renderUnavailableParameterSummary()",
        "function renderUnavailableParameterTimeline()",
        'label.textContent = "resync"',
        'value.textContent = "manifest required"',
        "renderUnavailableParameterTimeline()",
        "function updateParameterTimelinePlayhead(region)",
        'phase.textContent = region',
        '`phase ${region.name} / freq ${',
        '} / amp ${amplitude === null ? "missing" : formatCompactNumber(amplitude)}`',
        "function updateParameterTimelinePreview(region)",
        'segment.classList.toggle("preview", segment.dataset.phaseName === region?.name)',
        "function renderParameterTimelineProbe()",
        "function probeParameterTimelineSegment(event)",
        "function clearParameterTimelineProbe()",
        'marker.id = "parameterTimelinePlayhead"',
        'probeMarker.id = "parameterTimelineProbeMarker"',
        'segment.dataset.phaseName = phase.name || ""',
        "segment.dataset.parameterName = name",
        "segment.dataset.parameterValue = valueText",
        "segment.dataset.startFrame = String(span.startFrame)",
        "segment.dataset.endFrame = String(span.endFrame)",
        "segment.dataset.startTime = startTime",
        "segment.dataset.endTime = endTime",
        'segment.setAttribute("aria-label", segmentLabel)',
        'segment.setAttribute("role", "group")',
        'nodeGraphTooltipText("legacyEvidence.timelineSegment"',
        '.addEventListener("pointermove", probeParameterTimelineSegment)',
        "function buildLevelEnvelope(waveform)",
        "function drawLevelEnvelope()",
        "function renderLevelEnvelope()",
        'canvas.dataset.envelopeSource = "decoded primary WAV"',
        "canvas.dataset.envelopeWindowMs = String(envelope.windowMs)",
        "canvas.dataset.envelopeWindowFrames = String(envelope.windowFrames)",
        "canvas.dataset.envelopeWindows = String(envelope.windows.length)",
        "canvas.dataset.envelopePeak = formatCompactNumber(envelope.peak)",
        "canvas.dataset.envelopeRms = formatCompactNumber(envelope.rms)",
        "canvas.dataset.envelopeFrames = String(waveform.frames)",
        "`Primary WAV level envelope / ${formatCompactNumber(envelope.windowMs)} ms window / `",
        "function renderUnavailableLevelEnvelopeMeta()",
        '["source", "manifest/audio required", "decoded primary WAV"]',
        "renderUnavailableLevelEnvelopeMeta()",
        "function levelEnvelopeWindowAtFrame(frame)",
        "function renderLevelEnvelopeProbe()",
        "function probeLevelEnvelopeAtClientX(clientX)",
        "function clearLevelEnvelopeProbe()",
        'state.waveformProbeFrame = waveformFrameAtClientXForCanvas(clientX, "levelEnvelopeCanvas")',
        '.addEventListener("pointerleave", clearLevelEnvelopeProbe)',
        "function renderPhaseAudioStats()",
        "function renderUnavailablePhaseAudioStats()",
        'name.textContent = "Phase audio stats unavailable"',
        '["producer compare", "unavailable", "present"]',
        "renderUnavailablePhaseAudioStats()",
        "function updatePhaseAudioStatsActive(region)",
        "function updatePhaseProbeTargets()",
        'document.querySelectorAll(".phase, .phase-stat")',
        'item.classList.toggle("preview", item.dataset.phaseName === region?.name)',
        "function renderPhaseAudioStatsProbe()",
        "${probeSourceText()} ${formatProbeFrame(frame, waveform, region)}",
        "function probePhaseAudioStats(event)",
        "function clearPhaseAudioStatsProbe()",
        "item.dataset.startTime = startTime",
        "item.dataset.endTime = endTime",
        "item.dataset.targetFrequency = targetFrequencyText",
        "item.dataset.measuredFrequency = measuredFrequencyText",
        "item.dataset.targetAmplitude = targetPeakText",
        "item.dataset.peak = peakText",
        "item.dataset.rms = rmsText",
        "item.dataset.producerMatch = String(Boolean(producerOk))",
        'item.setAttribute("aria-label", itemLabel)',
        'item.setAttribute("role", "group")',
        "item.dataset.startFrame = String(region.startFrame)",
        'item.addEventListener("pointermove", probePhaseAudioStats)',
        "function renderPhaseProbe()",
        "function probePhaseList(event)",
        "${probeSourceText()} ${formatProbeFrame(frame, waveform, region)}",
        "function clearPhaseListProbe()",
        'item.dataset.phaseIndex = String(index)',
        'item.dataset.phaseName = phase.name || ""',
        "item.dataset.startFrame = String(span.startFrame)",
        "item.dataset.endFrame = String(span.endFrame)",
        "item.dataset.startTime = startTime",
        "item.dataset.endTime = endTime",
        "item.dataset.duration = duration",
        "item.dataset.wavShare = share",
        'item.setAttribute("aria-label", itemLabel)',
        'item.setAttribute("role", "group")',
        'nodeGraphTooltipText("legacyEvidence.phaseListItem"',
        'item.addEventListener("pointermove", probePhaseList)',
        '["window", `${formatCompactNumber(envelope.windowMs)} ms`]',
        '["source", "decoded primary WAV"]',
        '["target freq", targetFrequencyText]',
        '["measured freq", measuredFrequencyText]',
        '["freq delta", frequencyDelta]',
        '["producer freq", Number.isFinite(producerFrequency) ? `${formatCompactNumber(producerFrequency)} Hz` : "missing"]',
        '["producer freq delta", producerFrequencyDeltaText]',
        '["target amp", targetAmplitudeText]',
        '["target bias", formatCompactNumber(biasValue)]',
        '["target peak", targetPeakText]',
        '["peak", peakText]',
        '["peak delta", peakDelta]',
        '["producer peak", Number.isFinite(producerPeak) ? formatCompactNumber(producerPeak) : "missing"]',
        '["producer peak delta", producerPeakDeltaText]',
        '["producer rms", Number.isFinite(producerRms) ? formatCompactNumber(producerRms) : "missing"]',
        '["producer rms delta", producerRmsDeltaText]',
        '["rms", rmsText]',
        'status.textContent = allOk ? "Verified" : "Check"',
        "function renderUnavailableProducerProof()",
        '["runtime API", "unavailable", boolText(false)]',
        "renderUnavailableProducerProof()",
        "function renderUnavailableSandboxContract()",
        '"caller-owned processing order"',
        "renderUnavailableSandboxContract()",
        "function renderUnavailableBoundaryFlags()",
        "requiredFlags.map(([key, expected]) => [",
        "renderUnavailableBoundaryFlags()",
        "function renderUnavailablePhaseCoverage()",
        '["wav frames", "unavailable", "present"]',
        "renderUnavailablePhaseCoverage()",
        "function renderUnavailablePhases()",
        'name.textContent = "Phases unavailable"',
        '["resync proof", "unavailable", "present"]',
        "renderUnavailablePhases()",
        "function renderUnavailableArtifactCoverage()",
        '["artifact links", "unavailable", "available"]',
        "renderUnavailableArtifactCoverage()",
        "function renderUnavailableArtifacts()",
        'label.textContent = "Artifact packet"',
        'path.textContent = "manifest required"',
        "row.dataset.artifactKind = \"unavailable\"",
        "row.dataset.artifactLabel = \"Artifact packet\"",
        'row.setAttribute("aria-label", "Missing artifact packet (unavailable)")',
        "renderUnavailableArtifacts()",
        '["entry-point matches handoff", entryPointPath === handoff.entryPoint]',
        '["audio matches handoff", primaryAudioPath === handoff.primaryAudioArtifact]',
        '["phase report coverage", phaseReportIssue === "" ? "match" : phaseReportIssue, "match"]',
        '["phase report coverage", phaseReportIssue === ""]',
        '["parameter resync", parameterResyncIssue === ""]',
        "function parameterResyncContractIssue(manifest)",
        'return "parameter resync missing"',
        'return `${key} resync changed flag missing`',
        'return `${key} did not resync upward`',
        '["phase audio measurements", phaseAudioIssues.length === 0]',
        "function renderUnavailableChecklist()",
        '["sandbox handoff", false]',
        "renderUnavailableChecklist()",
        "const statusStripLabels = Object.freeze({",
        "function labelStatusStripValue(element, label, value, ok)",
        "element.dataset.statusLabel = label",
        "element.dataset.statusValue = valueText",
        "element.dataset.statusState = stateName",
        "function statusStripItemsLabeled()",
        '["status strip labels", statusStripItemsLabeled()]',
        "function labelPrimaryAudio(path, ok)",
        "audio.dataset.audioLabel = \"Primary Audio\"",
        "audio.dataset.audioPath = pathText",
        "audio.dataset.audioState = stateName",
        "function primaryAudioLabeled(manifest)",
        '["primary audio labels", primaryAudioLabeled(manifest)]',
        "function labelPrimaryAudioTitle(path, ok)",
        "title.dataset.audioTitlePath = pathText",
        "function primaryAudioTitleLabeled(manifest)",
        '["primary audio title labels", primaryAudioTitleLabeled(manifest)]',
        "function primaryAudioPositionLabeled()",
        'return waveformHeaderPillsLabeled(["audioPosition"])',
        '["primary audio position labels", primaryAudioPositionLabeled()]',
        "function labelWaveformHeaderPill(element, label, value, ok)",
        "element.dataset.waveformHeaderLabel = label",
        "element.dataset.waveformHeaderValue = valueText",
        "element.dataset.waveformHeaderState = stateName",
        "function waveformHeaderPillsLabeled(ids)",
        "function currentParameterPillsLabeled()",
        'waveformHeaderPillsLabeled(["currentFrequency", "currentAmplitude", "currentParameterStatus"])',
        "currentMeasuredAudioPillsLabeled()",
        "function currentMeasuredAudioPillsLabeled()",
        '"currentMeasuredFrequency"',
        '"currentMeasuredPeak"',
        '"currentMeasuredFrequencyDelta"',
        '"currentMeasuredPeakDelta"',
        '"currentMeasuredStatus"',
        '["current parameter labels", waveformReady && currentParameterPillsLabeled()]',
        'labelWaveformHeaderPill(position, "waveform position", positionText, true)',
        'labelWaveformHeaderPill(sample, "waveform sample", sampleText, true)',
        'labelWaveformHeaderPill(phase, "waveform phase", phaseText, Boolean(activeRegion))',
        "function waveformTransportPillsLabeled()",
        '["waveform transport labels", waveformReady && waveformTransportPillsLabeled()]',
        'labelWaveformHeaderPill(target, "phase jump target", targetText, Boolean(waveform))',
        "function phaseJumpTargetLabeled()",
        '["phase jump target labels", waveformReady && phaseJumpTargetLabeled()]',
        "function reloadManifestControlLabeled()",
        '["Reload manifest", "Loading manifest"].includes(label)',
        '["reload manifest labels", reloadManifestControlLabeled()]',
        "item.dataset.summaryLabel = label",
        "item.dataset.summaryValue = valueText",
        "item.dataset.summaryKind = kind || \"value\"",
        "item.dataset.summaryState = stateName",
        'item.setAttribute("role", "group")',
        "item.setAttribute(\"aria-label\", `${label}: ${valueText}`)",
        "function parameterSummaryCardsLabeled()",
        "item.dataset.checkLabel = label",
        "item.dataset.checkState = stateName",
        "item.setAttribute(\"aria-label\", `${label}: ${stateName}`)",
        "function checkRowsLabeled(containerId, expectedRows)",
        "function checkRowsHaveUniqueLabels(rows)",
        "new Set(labels).size === labels.length",
        "function consumerChecklistRowsLabeled()",
        'return checkRowsLabeled("checklist", 22)',
        "function setSourceText(id, key, value, expected = \"present\", ok = true)",
        "element.dataset.sourceKey = key",
        "element.dataset.sourceValue = valueText",
        "element.dataset.sourceExpected = expectedText",
        'element.dataset.sourceState = ok ? "ok" : "check"',
        "element.setAttribute(\"aria-label\", `${key}: ${valueText}`)",
        "function sourceRowsLabeled()",
        "function renderKeyValue(container, rows)",
        "dt.dataset.kvKey = key",
        "dd.dataset.kvKey = key",
        "dd.dataset.kvValue = valueText",
        "dd.dataset.kvExpected = expected === undefined ? \"none\" : expectedText",
        "dd.dataset.kvState = stateName",
        "dd.setAttribute(\"aria-label\", `${key}: ${valueText}`)",
        "function keyValueRowsLabeled(containerId, expectedRows)",
        "function producerProofRowsLabeled()",
        'keyValueRowsLabeled("producerProof", 9)',
        'keyValueRowsLabeled("producerProof", 10)',
        "function circuitChainRowsLabeled()",
        'document.querySelectorAll("#circuitChain .chain-row")',
        "function renderCircuitChain(manifest)",
        "function renderUnavailableCircuitChain()",
        "formatCircuitStep(step)",
        "Circuit connection",
        "Caller processing step",
        '["circuit chain rows", circuitChainRowsLabeled()]',
        "function boundaryFlagRowsLabeled()",
        "function phaseCoverageRowsLabeled()",
        "function artifactCoverageRowsLabeled()",
        "function renderReportControls()",
        "const label = `Show report ${report.label}`",
        "button.dataset.reportIndex = String(index)",
        "button.dataset.reportKind = report.kind",
        'button.dataset.reportPath = report.path || ""',
        'button.setAttribute("aria-label", label)',
        'button.setAttribute("aria-pressed", String(active))',
        "button.title = label",
        "function reportControlsLabeled()",
        'label.startsWith("Show report ")',
        '["report control labels", reportControlsLabeled()]',
        "viewer.dataset.reportLabel = report.label || \"\"",
        "viewer.dataset.reportKind = report.kind || \"\"",
        "viewer.dataset.reportState = stateName",
        "viewer.setAttribute(\"aria-label\", `Report viewer ${report.label}: ${stateName}`)",
        "function reportViewerLabeled()",
        '["report viewer labels", state.reports.length > 0 && reportViewerLabeled()]',
        "function artifactRowLabel(link)",
        "row.dataset.artifactKind = link.kind || \"\"",
        "row.dataset.artifactPath = link.path || \"\"",
        "row.dataset.artifactLabel = link.label || \"\"",
        'row.setAttribute("aria-label", rowLabel)',
        "function artifactRowsLabeled(manifest)",
        "rows.length === links.length",
        "label === artifactRowLabel(link)",
        'row.getAttribute("href") === artifactUrl(link.path)',
        '["artifact row labels", artifactRowsLabeled(manifest)]',
        '["artifact coverage row labels", artifactCoverageRowsLabeled()]',
        '["source row labels", sourceRowsLabeled()]',
        "renderHandsOnReadiness(state.response?.manifest, Boolean(state.waveform))",
        "function renderHandsOnReadiness(manifest, waveformReady = Boolean(state.waveform))",
        "function phaseJumpButtonsLabeled(manifest)",
        "function waveformScrubberLabeled()",
        "function waveformCanvasLabeled()",
        "function levelEnvelopeCanvasLabeled()",
        "function probePillLabeled(id)",
        "function probePillsLabeled(ids)",
        "function waveformProbeLabeled()",
        "function levelEnvelopeProbeLabeled()",
        "function parameterTimelineProbeLabeled()",
        "function parameterTimelineSegmentsLabeled()",
        "function parameterTimelinePreviewAvailable()",
        "return parameterTimelineSegmentsLabeled()",
        "function phaseAudioStatsProbeLabeled()",
        "function phaseListProbeLabeled()",
        "function phaseListItemsLabeled()",
        "function phasePreviewTargetAvailable()",
        "return phaseListItemsLabeled() && phaseAudioStatsItemsLabeled()",
        "function phaseAudioStatsItemsLabeled()",
        "function signalPlotPointProbeLabeled()",
        "function signalPlotSourceProbeLabeled()",
        "function signalPlotProbeLabeled()",
        'return probePillLabeled("waveformProbe")',
        'return probePillLabeled("levelEnvelopeProbe")',
        'return probePillLabeled("parameterTimelineProbe")',
        'label.startsWith("Parameter ")',
        '["parameter timeline segment labels", waveformReady && parameterTimelineSegmentsLabeled()]',
        'return probePillLabeled("phaseAudioStatsProbe")',
        'label.startsWith("Phase audio stats ")',
        '["phase audio stats item labels", waveformReady && phaseAudioStatsItemsLabeled()]',
        'return probePillLabeled("phaseProbe")',
        'label.startsWith("Phase ")',
        '["phase list item labels", waveformReady && phaseListItemsLabeled()]',
        'return probePillLabeled("signalPlotProbe")',
        'return probePillLabeled("signalPlotProbeSource")',
        'return probePillsLabeled(["signalPlotProbe", "signalPlotProbeSource"])',
        "function waveformToSignalProbeAvailable()",
        "const probe = signalPlotProbeAtFrame(0)",
        "probe.nearest?.frame === 0",
        "probe.nearest.distance === 0",
        "function signalToWaveformProbeAvailable()",
        "return waveformProbeLabeled()",
        'label.startsWith("Jump waveform to ")',
        'label.includes(" phase from frame ")',
        'button.title.startsWith("Jump to ")',
        'setStatus("handsOnReadinessStatus", ok ? "Ready" : "Check", ok)',
        '"native audio",',
        '["decoded waveform", waveformReady]',
        '["producer proof row labels", producerProofRowsLabeled()]',
        '["boundary flag row labels", boundaryFlagRowsLabeled()]',
        '["phase coverage row labels", phaseCoverageRowsLabeled()]',
        '["waveform seek", waveformReady && Number(manifest?.wav?.frames) > 0]',
        '["waveform canvas labels", waveformReady && waveformCanvasLabeled()]',
        '["waveform play control", waveformPlayControlLabeled()]',
        '["waveform control labels", waveformControlsLabeled()]',
        '["waveform scrubber labels", waveformReady && waveformScrubberLabeled()]',
        '["waveform hover probe", waveformReady && waveformProbeLabeled()]',
        '["waveform probe labels", waveformReady && waveformProbeLabeled()]',
        '["level envelope probe", waveformReady && levelEnvelopeProbeLabeled()]',
        '["level envelope probe labels", waveformReady && levelEnvelopeProbeLabeled()]',
        '["level envelope canvas labels", waveformReady && levelEnvelopeCanvasLabeled()]',
        '["parameter timeline probe", waveformReady && parameterTimelineProbeLabeled()]',
        '["parameter timeline probe labels", waveformReady && parameterTimelineProbeLabeled()]',
        '["parameter timeline segment labels", waveformReady && parameterTimelineSegmentsLabeled()]',
        '["parameter timeline preview", waveformReady && parameterTimelinePreviewAvailable()]',
        '["probe frame labels", waveformReady && probeFrameLabelsReady()]',
        '["follow/free view", followAudioControlLabeled()]',
        '["current measured audio", waveformReady && currentMeasuredAudioPillsLabeled()]',
        '["phase list probe", waveformReady && phaseListProbeLabeled()]',
        '["phase list probe labels", waveformReady && phaseListProbeLabeled()]',
        '["phase list item labels", waveformReady && phaseListItemsLabeled()]',
        '["phase jump preview", waveformReady && phaseJumpButtonsLabeled(manifest)]',
        '["phase jump labels", waveformReady && phaseJumpButtonsLabeled(manifest)]',
        '["phase jump target", waveformReady && phaseJumpTargetLabeled()]',
        '["phase parameter readout", parameterResyncContractIssue(manifest) === ""]',
        '["parameter summary card labels", parameterResyncContractIssue(manifest) === "" && parameterSummaryCardsLabeled()]',
        '["phase preview target", waveformReady && phasePreviewTargetAvailable()]',
        '["producer measurement compare", phaseAudioMeasurementIssues(manifest).length === 0]',
        "function callerProcessingOrderIssue(manifest)",
        "runtime_dsp_object_circuit_connected_bias_wav_demo",
        "callerProcessingOrderProof",
        "matchesCircuitConnections",
        '["caller processing order", callerProcessingIssue === ""]',
        '["caller processing order", boolText(callerProcessingIssue === ""), true]',
        '["phase audio stats probe", waveformReady && phaseAudioStatsProbeLabeled()]',
        '["phase audio stats probe labels", waveformReady && phaseAudioStatsProbeLabeled()]',
        '["phase audio stats item labels", waveformReady && phaseAudioStatsItemsLabeled()]',
        '["signal inspection", waveformReady && signalPlotCanvasLabeled()]',
        '["signal plot probe", waveformReady && signalPlotPointProbeLabeled()]',
        '["signal plot probe labels", waveformReady && signalPlotProbeLabeled()]',
        "function renderUnavailableHandsOnReadiness()",
        '["manifest loaded", false]',
        "renderUnavailableHandsOnReadiness()",
        '["signal plot source probe", waveformReady && signalPlotSourceProbeLabeled()]',
        '["waveform-to-signal probe", waveformReady && waveformToSignalProbeAvailable()]',
        '["signal-to-waveform probe", waveformReady && signalToWaveformProbeAvailable()]',
        '["inspection cursor", waveformReady && inspectionCursorLabeled()]',
        "const inspectionCursorPillIds = [",
        "function inspectionCursorPillLabeled(id)",
        '["inspection source pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorSource")]',
        '["inspection delta pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorDelta")]',
        '["inspection audio pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorAudio")]',
        '["inspection playback pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorPlayback")]',
        '["inspection view pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorView")]',
        '["inspection preview pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorPreview")]',
        '["inspection seek pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorSeek")]',
        '["inspection seek target pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorSeekTarget")]',
        '["inspection seek sync pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorSeekSync")]',
        '["inspection transport pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorTransport")]',
        '["inspection target pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorTarget")]',
        '["inspection divergence pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorDivergence")]',
        "function inspectionCursorPillsLabeled()",
        "function inspectionCursorKeyValueLabeled(key)",
        "function inspectionCursorHoverDeltaLabeled()",
        'return inspectionCursorKeyValueLabeled("hover delta")',
        "function inspectionCursorLabeled()",
        'cursor.dataset.inspectionCursorState === "ok"',
        'inspectionCursorKeyValueLabeled("transport frame")',
        'inspectionCursorKeyValueLabeled("hover signal")',
        '["inspection pill labels", waveformReady && inspectionCursorPillsLabeled()]',
        '["inspection hover delta", waveformReady && inspectionCursorHoverDeltaLabeled()]',
        '["read-only boundary", validateConsumerChecklist(manifest).accepted]',
        '["consumer checklist row labels", validateConsumerChecklist(manifest).accepted && consumerChecklistRowsLabeled()]',
        '["sandbox contract row labels", validateConsumerChecklist(manifest).accepted && sandboxContractRowsLabeled()]',
        '["readiness row labels",',
        "function phaseReportCoverageIssue(manifest)",
        'return "phase report phase missing"',
        'return "phase report phase unknown"',
        'return "phase report phase duplicate"',
        '["entry point path", entryPointMatches ? "match" : "mismatch", "match"]',
        '["audio path", primaryAudioMatches ? "match" : "mismatch", "match"]',
        'countArtifactKind(links, "entry-point") === 1',
        'countArtifactKind(links, "audio") === 1',
        'countArtifactKind(links, "manifest") === 1',
        'countArtifactKind(links, "text-summary") === 1',
        'countArtifactKind(links, "wav-report") === 1',
        'return `${kind} artifact link count mismatch`',
        'return "entry-point link mismatch"',
        'return "audio link mismatch"',
        "function drawSignalPlot()",
        "function renderSignalPlot()",
        'canvas.dataset.signalSource = "decoded primary WAV"',
        "canvas.dataset.signalFocus = focusName",
        "canvas.dataset.signalMode = state.signalPlotMode",
        "canvas.dataset.signalScale = String(state.signalPlotScale)",
        "canvas.dataset.signalWindow = windowName",
        "canvas.dataset.signalWindowMs = String(state.signalPlotWindowMs)",
        "canvas.dataset.signalLagMs = String(state.signalLagMs)",
        "canvas.dataset.signalLagFrames = String(lagFrames)",
        "canvas.dataset.signalPoints = String(pointCount)",
        "canvas.dataset.signalFocusPeak = formatCompactNumber(focusStats.peak)",
        "canvas.dataset.signalFocusRms = formatCompactNumber(focusStats.rms)",
        "`Primary WAV signal plot / ${focusName} / ${state.signalPlotMode} / `",
        "function renderUnavailableSignalPlotMeta()",
        '["source", "manifest/audio required", "decoded primary WAV"]',
        "renderUnavailableSignalPlotMeta()",
        "function renderSignalPlotControls()",
        "function labelSignalPlotButton(button, label, active = false)",
        'button.setAttribute("aria-pressed", String(active))',
        "button.title = label",
        "function signalPlotWindowFrameRange(waveform, drawableFrames)",
        "function signalPlotWindowName(waveform, drawableFrames)",
        "function signalPlotRegions(waveform, drawableFrames)",
        "function signalPlotFocusName(waveform)",
        "function restoreSignalPlotFocusIndex()",
        "function signalPlotPointCount(waveform, drawableFrames)",
        "function signalPlotFocusStats(waveform, drawableFrames)",
        "function signalPlotRegionColor(index)",
        "function renderSignalPlotSummary()",
        "function renderSignalPlotPoint()",
        "function signalPlotLagFrames(waveform)",
        "function signalPlotProbeAtClientPoint(clientX, clientY)",
        "function signalPlotProbeAtFrame(frame)",
        "function renderSignalPlotProbe()",
        "waveformRegionAtFrame(frame)?.name",
        "nearest.frame",
        "`probe ${formatProbeFrame(nearest.frame, state.waveform)} / ${pointText}`",
        "${probeSourceText()} / near frame ${nearest.frame}",
        "state.waveformProbeFrame = state.signalPlotProbe.nearest?.frame ?? null",
        "clampFrame(state.waveformProbeFrame, waveform) / waveform.frames",
        "const nearestProbe = state.signalPlotProbe?.nearest",
        'context.strokeStyle = "#f6c96d"',
        "drawSignalPlot();",
        "state.signalPlotProbe = signalPlotProbeAtFrame(state.waveformProbeFrame)",
        "function probeSignalPlot(event)",
        "function clearSignalPlotProbe()",
        '.addEventListener("pointermove", probeSignalPlot)',
        '.addEventListener("pointerleave", clearSignalPlotProbe)',
        "const signalPlotSettingsKey",
        "function loadSignalPlotSettings()",
        "function saveSignalPlotSettings()",
        "function resetSignalPlotSettings()",
        "signalLagMs: 1",
        "signalPhaseFocusIndex: null",
        'signalPhaseFocusName: "all"',
        'signalPlotMode: "trace"',
        "signalPlotScale: 1",
        'signalPlotWindow: "full"',
        "signalPlotWindowMs: 80",
        "state.signalPhaseFocusIndex = index;",
        "state.signalPhaseFocusName = region.name;",
        "state.signalLagMs = lagMs;",
        "state.signalPlotMode = mode;",
        "state.signalPlotScale = scale;",
        "state.signalPlotWindow = windowMode;",
        "state.signalPlotWindowMs = windowMs;",
        'className = "control-group"',
        'dataset.signalFocus = "all"',
        "dataset.signalFocus = region.name",
        "dataset.signalLagMs = String(lagMs)",
        "dataset.signalMode = mode",
        "dataset.signalScale = String(scale)",
        "dataset.signalWindow = windowMode",
        "dataset.signalWindowMs = String(windowMs)",
        'dataset.signalReset = "settings"',
        "Signal plot focus",
        "Signal plot lag",
        "Signal plot mode",
        "Signal plot scale",
        "Signal plot window",
        "Signal plot window size",
        "Signal plot reset",
        "function signalPlotControlsLabeled()",
        "function signalPlotCanvasLabeled()",
        "groups.length === 7",
        'button.title === label',
        '["signal plot control labels", waveformReady && signalPlotControlsLabeled()]',
        '["signal plot canvas labels", waveformReady && signalPlotCanvasLabeled()]',
        '["focus", focusName]',
        '["mode", state.signalPlotMode]',
        '["scale", `x${state.signalPlotScale}`]',
        '["window", windowName]',
        '["window size", `${state.signalPlotWindowMs} ms`]',
        "frame ${pointFrame} / ${formatSeconds(pointFrame / waveform.sampleRate)} / ${region?.name || \"phase\"} / x ${formatCompactNumber(x)} / y ${formatCompactNumber(y)}",
        '["x", "sample[n]"]',
        '["y", "sample[n + lag]"]',
        '["points", String(pointCount)]',
        '["focus peak", formatCompactNumber(focusStats.peak)]',
        '["focus rms", formatCompactNumber(focusStats.rms)]',
    ]:
        require(snippet in waveform_source, f"waveform analysis source missing {snippet}")
    for snippet in [
        "function beginWaveformDrag(event)",
        "function dragWaveform(event)",
        "function endWaveformDrag(event)",
        "function setSharedProbeFrame(frame, source = inspectionModes.probe)",
        "function clearSharedProbeFrame()",
        "function probePhaseButton(index)",
        "function clearPhaseButtonProbe()",
        "function clearPhaseButtonProbeFromOutside(event)",
        'target.closest("#waveformPhaseControls")',
        'document.addEventListener("pointermove", clearPhaseButtonProbeFromOutside)',
        "function renderPhaseJumpTarget()",
        'target.textContent =',
        '`jump ${region.name} / ${formatSeconds(',
        '} / frame ${region.startFrame}`',
        ': "jump idle";',
        "phaseJumpPreviewIndex: null",
        "state.phaseJumpPreviewIndex = null",
        'button.classList.toggle("preview", index === state.phaseJumpPreviewIndex)',
        "renderPhaseJumpTarget();",
        "function waveformFrameAtClientX(clientX)",
        "function probeWaveformAtClientX(clientX)",
        "function renderWaveformProbe()",
        "function renderUnavailableWaveformMeta()",
        '["data bytes", "unavailable", "present"]',
        "renderUnavailableWaveformMeta()",
        "function renderInspectionCursor()",
        'labelInspectionCursorSurface(cursor, "unavailable", "check")',
        'labelInspectionCursorSurface(',
        '"transport inspection"',
        '"hover inspection"',
        'setStatus("inspectionCursorStatus", hoverFrame === null ? "Transport" : "Hover", true)',
        "const hoverDeltaFrame = hoverFrame === null ? null : hoverFrame - transportFrame",
        'const hoverFrequency = activeParameterValue("frequency", hoverRegion)',
        'const hoverAmplitude = activeParameterValue("amplitude", hoverRegion)',
        "const hoverEnvelope = hoverFrame !== null ? levelEnvelopeWindowAtFrame(hoverFrame) : null",
        '"hover delta"',
        '"hover frequency"',
        '"hover amplitude"',
        '"hover envelope peak"',
        '"hover envelope rms"',
        '["hover signal",',
        "function clearWaveformProbe()",
        "function clampFrame(frame, waveform)",
        '.addEventListener("pointerdown", beginWaveformDrag)',
        '.addEventListener("pointermove", dragWaveform)',
        '.addEventListener("pointerleave", clearWaveformProbe)',
        '.addEventListener("pointerup", endWaveformDrag)',
        '.addEventListener("pointermove", () => probePhaseButton(index))',
        '.addEventListener("focus", () => probePhaseButton(index))',
        '.addEventListener("blur", clearPhaseButtonProbe)',
        'button.dataset.phaseIndex === String(state.phaseJumpPreviewIndex)',
        "button.dataset.phaseName !== undefined",
        "button.dataset.phaseEndFrame !== undefined",
        "button.dataset.phaseEndTime !== undefined",
        'label.includes(" phase from frame ")',
    ]:
        require(snippet in waveform_source, f"waveform drag source missing {snippet}")
    for snippet in [
        'classList.add("dragging")',
        'classList.remove("dragging")',
    ]:
        require(snippet in waveform_source, f"waveform drag state missing {snippet}")
    for snippet in [
        "touch-action: none;",
        "user-select: none;",
        ".waveform.dragging",
        ".control-group",
        ".parameter-timeline",
        ".parameter-segment.active",
        ".parameter-segment.preview",
        ".parameter-timeline-marker",
        ".parameter-timeline-marker.probe",
        ".phase-stat-list",
        ".phase-stat.active",
        ".phase.preview",
        ".phase-stat.preview",
        ".phase-button.preview",
        ".pill.inspection-source.none",
        ".pill.inspection-source.transport",
        ".pill.inspection-source.hover",
        ".pill.inspection-delta.none",
        ".pill.inspection-delta.hover",
        ".pill.inspection-playback.paused",
        ".pill.inspection-playback.playing",
        ".pill.inspection-playback.ended",
        ".pill.inspection-view.follow",
        ".pill.inspection-view.free",
        ".pill.inspection-preview.idle",
        ".pill.inspection-preview.active",
        ".pill.inspection-seek.idle",
        ".pill.inspection-seek.active",
        ".pill.inspection-seek-sync.none",
        ".pill.inspection-seek-sync.aligned",
        ".pill.inspection-seek-sync.diverged",
        ".pill.inspection-target.none",
        ".pill.inspection-target.active",
        ".pill.inspection-transport.none",
        ".pill.inspection-transport.active",
        ".pill.inspection-divergence.aligned",
        ".pill.inspection-divergence.diverged",
        ".contract-list",
        ".contract-row",
        ".readiness-list",
    ]:
        require(snippet in style_source, f"waveform drag style missing {snippet}")
    require(
        "setFollowAudio(false, false);" not in app_source,
        "waveform controls still force free-view mode",
    )


def require_manifest_error_surface_contract() -> None:
    manifest_view_source = (PUBLIC / "manifest-view.js").read_text(encoding="utf-8")
    manifest_loader_source = (PUBLIC / "manifest-loader.js").read_text(encoding="utf-8")
    start = manifest_view_source.index("function renderError(message, details = {})")
    end = len(manifest_view_source)
    render_error = manifest_view_source[start:end]
    for snippet in [
        "function renderRefreshButton(loading = state.manifestLoading)",
        'const button = document.getElementById("refreshButton")',
        "async function loadManifest()",
    ]:
        require(snippet in manifest_loader_source, f"manifest loader missing {snippet}")
    required_unavailable_renderers = [
        "renderUnavailableProducerProof();",
        "renderUnavailableHandsOnReadiness();",
        "renderUnavailableSandboxContract();",
        "renderUnavailableParameterSummary();",
        "renderUnavailableParameterTimeline();",
        "renderUnavailableWaveformMeta();",
        "renderUnavailableLevelEnvelopeMeta();",
        "renderUnavailablePhaseAudioStats();",
        "renderUnavailableSignalPlotMeta();",
        "renderUnavailableBoundaryFlags();",
        "renderUnavailablePhaseCoverage();",
        "renderUnavailablePhases();",
        "renderUnavailableChecklist();",
        "renderUnavailableArtifactCoverage();",
        "renderUnavailableArtifacts();",
    ]
    for renderer in required_unavailable_renderers:
        require(renderer in render_error, f"manifest error surface missing {renderer}")
    for resetter in [
        'resetIdleProbePill("waveformProbe", "Waveform probe idle");',
        'resetIdleProbePill("parameterTimelineProbe", "Parameter timeline probe idle");',
        'resetIdleProbePill("levelEnvelopeProbe", "Level envelope probe idle");',
        'resetIdleProbePill("signalPlotProbe", "Signal plot probe idle");',
        'resetProbePill("signalPlotProbeSource", "near frame", "Signal plot source probe idle");',
        'resetIdleProbePill("phaseAudioStatsProbe", "Phase audio stats probe idle");',
        'resetIdleProbePill("phaseProbe", "Phase list probe idle");',
    ]:
        require(resetter in render_error, f"manifest error surface missing {resetter}")
    require(
        "clearElement(" not in render_error,
        "manifest error surface clears a user-facing panel",
    )


def require_follow_free_seek_contract() -> None:
    waveform_source = "\n".join(read_public_script_sources().values())
    start = waveform_source.index(
        "function seekPrimaryAudioToFrame(frame, source = inspectionSources.waveform)",
    )
    end = waveform_source.index("function seekWaveformAtClientX(clientX)", start)
    seek_function = waveform_source[start:end]
    sync_start = waveform_source.index("function syncWaveformToAudio()")
    sync_end = waveform_source.index(
        "function seekPrimaryAudioToFrame(frame, source = inspectionSources.waveform)",
        sync_start,
    )
    sync_function = waveform_source[sync_start:sync_end]
    require(
        "if (state.followAudio) {" in seek_function,
        "waveform seek no longer gates native audio seeking behind follow mode",
    )
    require(
        "audio.currentTime = targetTime;" in seek_function,
        "waveform seek no longer updates native audio in follow mode",
    )
    require(
        "setPlayheadFrame(targetFrame);" in seek_function,
        "waveform seek no longer updates local inspection playhead",
    )
    require(
        "state.lastSeekFollowAudio = state.followAudio;" in seek_function,
        "waveform seek no longer records follow/free mode at seek time",
    )
    require(
        seek_function.index("audio.currentTime = targetTime;") <
        seek_function.index("setPlayheadFrame(targetFrame);"),
        "waveform seek updates local playhead before native audio",
    )
    require(
        "state.scrubberPointerActive" in sync_function,
        "audio sync no longer defers while the waveform scrubber is being dragged",
    )
    for snippet in [
        "function beginScrubberDrag(event)",
        "function endScrubberDrag(event)",
        "state.scrubberPointerActive = true;",
        "state.scrubberPointerActive = false;",
        '.addEventListener("pointerdown", beginScrubberDrag)',
        '.addEventListener("pointerup", endScrubberDrag)',
        '.addEventListener("pointercancel", endScrubberDrag)',
        '.addEventListener("lostpointercapture", endScrubberDrag)',
    ]:
        require(snippet in waveform_source, f"scrubber drag guard missing {snippet}")


def require_node_graph_mvp_contract() -> None:
    require_manual_trace_waypoint_contract()

    index_source = (PUBLIC / "index.html").read_text(encoding="utf-8")
    script_sources = read_public_script_sources()
    app_source = script_sources["./public/app.js"]
    boot_loading_source = script_sources["./public/boot-loading.js"]
    metadata_defaults_source = script_sources["./public/node-graph-metadata-defaults.js"]
    slider_readout_source = script_sources["./public/node-graph-slider-readout.js"]
    tooltip_utils_source = script_sources["./public/node-graph-tooltips.js"]
    wire_actions_source = script_sources["./public/node-graph-wire-actions.js"]
    server_source = (ROOT / "server.py").read_text(encoding="utf-8")
    node_graph_source = "\n".join(script_sources.values()) + f"\n{server_source}"
    style_source = (PUBLIC / "styles.css").read_text(encoding="utf-8")
    tooltip_source = (PUBLIC / "tooltips.json").read_text(encoding="utf-8")
    worklet_source = (PUBLIC / "node-live-audio-worklet.js").read_text(encoding="utf-8")

    codeblock_contract_sources = {
        "definitions": script_sources["./public/node-graph-module-definitions.js"],
        "store": script_sources["./public/node-graph-module-store.js"],
        "metadata": script_sources["./public/node-graph-parameter-metadata.js"],
        "patch core": script_sources["./public/node-graph-patch-core.js"],
        "actions": script_sources["./public/node-graph-module-actions.js"],
        "menu": index_source,
        "runtime": script_sources["./public/node-graph-live-frame-evaluator.js"],
        "worklet": worklet_source,
    }
    graph_contract_sources = {
        "definitions": script_sources["./public/node-graph-module-definitions.js"],
        "store": script_sources["./public/node-graph-module-store.js"],
        "utils": script_sources["./public/node-graph-graph-utils.js"],
        "default patch": script_sources["./public/node-graph-default-patch.js"],
        "patch core": script_sources["./public/node-graph-patch-core.js"],
        "clone": script_sources["./public/node-graph-patch-clone.js"],
        "actions": script_sources["./public/node-graph-module-actions.js"],
        "rendering": script_sources["./public/node-graph-module-rendering.js"],
        "menu events": script_sources["./public/node-graph-scene-menu-event-bindings.js"],
        "context menu": script_sources["./public/node-graph-context-menu.js"],
        "sizing": script_sources["./public/node-graph-module-sizing.js"],
        "state": script_sources["./public/node-graph-state.js"],
        "style": style_source,
        "index": index_source,
    }
    for name, source, snippets in [
        (
            "definitions",
            graph_contract_sources["definitions"],
            ['graph: "Graph"', "graph: {", 'inputs: ["In"]', 'layout: "graph"', 'outputs: ["Out"]'],
        ),
        (
            "store",
            graph_contract_sources["store"],
            ['"graph"', 'category: "Visual"', "Patch-local soemdsp-style graph object"],
        ),
        (
            "normalizer",
            graph_contract_sources["utils"],
            [
                "const nodeGraphGraphShapes",
                "const nodeGraphDefaultGraphData",
                "function normalizeNodeGraphGraph(value = {})",
                "function nodeGraphGraphValueAt(graphValue, xValue)",
                "function nodeGraphGraphCurvePath(graphValue, sampleCount = 96)",
                "function renderNodeGraphGraphDisplay(element, graphValue)",
                "function syncNodeGraphGraphElement(moduleElement, patchNode)",
                "function nodeGraphGraphSvgToGraphPoint",
                "function nodeGraphGraphConstrainedNodePoint",
                "function beginNodeGraphGraphNodeDrag",
                "function dragNodeGraphGraphNode",
                "function endNodeGraphGraphNodeDrag",
                "function nodeGraphGraphContourHandlePoint",
                "data-graph-node-index",
                "data-graph-contour-index",
                "node-module-graph-node-hit",
                "node-module-graph-contour-handle",
                "nodeGraphGraphRationalCurve(p, contour)",
                "nodeGraphGraphExponentialCurve(p, contour)",
                "cursorX: normalizeNodeGraphGraphNumber",
                ".sort((left, right) => left.x - right.x)",
            ],
        ),
        (
            "patch data",
            "\n".join([
                graph_contract_sources["default patch"],
                graph_contract_sources["patch core"],
                graph_contract_sources["clone"],
                graph_contract_sources["actions"],
            ]),
            [
                "node.graph = normalizeNodeGraphGraph(options.graph)",
                "normalizedNode.graph = normalizeNodeGraphGraph(node.graph)",
                "{ graph: normalizeNodeGraphGraph(node.graph) }",
                "graph: sourceNode.graph",
            ],
        ),
        (
            "render module",
            graph_contract_sources["rendering"],
            [
                'definition.layout === "graph"',
                "graph-node-layout",
                "node-module-graph-display",
                "renderNodeGraphGraphDisplay(graphSection, patchNode.graph)",
                "const inputColumn = createNodeGraphIoColumn(node, type, inputPorts, \"input\")",
                "const outputColumn = createNodeGraphIoColumn(node, type, outputPorts, \"output\")",
            ],
        ),
        (
            "no scope slot",
            graph_contract_sources["rendering"][
                graph_contract_sources["rendering"].find('} else if (definition.layout === "graph") {'):
                graph_contract_sources["rendering"].find('} else if (definition.layout === "filterCurve") {')
            ],
            [
                '} else if (definition.layout === "graph") {',
                "renderNodeGraphGraphDisplay(graphSection, patchNode.graph)",
            ],
        ),
        (
            "sizing and style",
            "\n".join([graph_contract_sources["sizing"], graph_contract_sources["style"]]),
            [
                "layout === \"graph\"",
                "nodeGraphModuleIoSectionHeightGu(type)",
                ".dsp-node.graph-node-layout",
                ".node-module-graph-display",
                ".node-module-graph-cursor",
                ".node-module-graph-curve",
                ".node-module-graph-node",
                ".node-module-graph-node-hit",
                ".node-module-graph-contour-handle",
                ".node-module-graph-display.dragging .node-module-graph-node",
                ".scene-context-graph-node-grid",
                ".scene-context-graph-node-list",
                ".scene-context-graph-node-row",
                ".scene-context-codeblock-controls select",
            ],
        ),
        (
            "actions menu markup",
            graph_contract_sources["index"],
            [
                "nodeSceneGraphControls",
                "nodeSceneGraphCursorX",
                "nodeSceneGraphNodeIndex",
                "nodeSceneGraphNodeShape",
                "nodeSceneGraphNodeList",
                "nodeSceneGraphAddNode",
                "nodeSceneGraphRemoveNode",
                "nodeSceneGraphReset",
                "scene-context-graph-node-grid",
            ],
        ),
        (
            "actions helpers",
            graph_contract_sources["actions"],
            [
                "function nodeGraphGraphTargetFromContext",
                "function syncNodeGraphGraphControls",
                "function commitNodeGraphGraphEdit",
                "function setNodeGraphGraphCursorFromContext",
                "function setNodeGraphGraphNodeFromContext",
                "function addNodeGraphGraphNodeFromContext",
                "function removeNodeGraphGraphNodeFromContext",
                "function resetNodeGraphGraphFromContext",
                "function renderNodeGraphGraphNodeList",
                "function handleNodeGraphGraphNodeListClick",
                "function handleNodeGraphGraphNodeListChange",
                "const hasFallback = Number.isFinite(Number(fallback))",
                "dataset?.graphNodeField",
                "selectedX",
            ],
        ),
        (
            "context menu controls",
            graph_contract_sources["context menu"],
            [
                "graphControls.hidden = !(moduleMode && targetNode?.type === \"graph\")",
                "syncNodeGraphGraphControls(targetNode.graph)",
                "nodeSceneGraphCursorX",
                "nodeSceneGraphNodeShape",
                "nodeSceneGraphNodeList",
                "graphNodeIndex.replaceChildren()",
                "graphNodeList.replaceChildren()",
            ],
        ),
        (
            "event bindings",
            graph_contract_sources["menu events"],
            [
                "setNodeGraphGraphCursorFromContext({ record: false })",
                "setNodeGraphGraphCursorFromContext({ record: true })",
                "selectNodeGraphGraphNodeFromContext",
                "setNodeGraphGraphNodeFromContext({ record: false })",
                "setNodeGraphGraphNodeFromContext({ record: true })",
                "addNodeGraphGraphNodeFromContext",
                "removeNodeGraphGraphNodeFromContext",
                "resetNodeGraphGraphFromContext",
                "handleNodeGraphGraphNodeListClick",
                "handleNodeGraphGraphNodeListChange",
                "beginNodeGraphGraphNodeDrag",
                "dragNodeGraphGraphNode",
                "endNodeGraphGraphNodeDrag",
            ],
        ),
        (
            "script and type count",
            "\n".join([graph_contract_sources["index"], graph_contract_sources["state"]]),
            ["node-graph-graph-utils.js", "graphNodeDragging: null", "graph: 0"],
        ),
    ]:
        for snippet in snippets:
            assert snippet in source, f"missing graph {name} contract: {snippet}"
    graph_render_branch = graph_contract_sources["rendering"][
        graph_contract_sources["rendering"].find('} else if (definition.layout === "graph") {'):
        graph_contract_sources["rendering"].find('} else if (definition.layout === "filterCurve") {')
    ]
    require(
        "registerNodeGraphModuleScopeSlot" not in graph_render_branch,
        "graph module branch must not register an oscilloscope slot",
    )

    for name, source, snippets in [
        (
            "definitions",
            codeblock_contract_sources["definitions"],
            ['codeblock: "Codeblock"', "codeblock: {", 'inputs: ["In1"]', 'outputs: ["Out1"]'],
        ),
        (
            "store",
            codeblock_contract_sources["store"],
            ['"codeblock"', 'category: "Controllers"', "Patch-local JavaScript signal processor"],
        ),
        (
            "dynamic ports",
            codeblock_contract_sources["metadata"],
            [
                "const nodeGraphCodeblockDefaultCode = \"Out1 = In1;\"",
                "function normalizeNodeGraphCodeblock",
                "function nodeGraphPatchNodeInputPorts(node)",
                "function nodeGraphPatchNodeOutputPorts(node)",
                "nodeGraphCodeblockReservedNames",
            ],
        ),
        (
            "patch validation",
            codeblock_contract_sources["patch core"],
            [
                "normalizedNode.codeblock = normalizeNodeGraphCodeblock(node.codeblock)",
                "nodeGraphPatchNodeOutputPorts(nodes.find",
                "nodeGraphPatchNodeInputPorts(nodes.find",
            ],
        ),
        (
            "actions UI",
            codeblock_contract_sources["actions"],
            [
                "function applyNodeGraphCodeblockPortsFromContext",
                "pruneNodeGraphConnectionsForCodeblockPortChange",
                "function setNodeGraphCodeblockSourceFromContext",
                "function nodeGraphCodeblockCompileStatus",
            ],
        ),
        (
            "menu UI",
            codeblock_contract_sources["menu"],
            [
                "nodeSceneCodeblockControls",
                "nodeSceneCodeblockInputs",
                "nodeSceneCodeblockOutputs",
                "nodeSceneCodeblockSource",
                "nodeSceneCodeblockStatus",
            ],
        ),
        (
            "runtime",
            codeblock_contract_sources["runtime"],
            [
                "function nodeGraphEvaluateCodeblock",
                "nodeGraphCompileCodeblockFunction",
                "fn(inputs, output)",
                'node?.type === "codeblock"',
            ],
        ),
        (
            "worklet",
            codeblock_contract_sources["worklet"],
            [
                "evaluateCodeblock(node, mixInput)",
                "compileCodeblockFunction(node)",
                "fn(inputs, output)",
                'node?.type === "codeblock"',
            ],
        ),
    ]:
        for snippet in snippets:
            assert snippet in source, f"missing codeblock {name} contract: {snippet}"

    for snippet in [
        "nodeModularViewButton",
        "nodeModularOnlyViewButton",
        "nodeModularOnlyBackButton",
        "<span>Modular</span><span>View</span>",
        "<span>Modular</span><span>Only</span>",
        "Patch settings",
        "Patch Name",
        "Patch Author",
        "Patch Tags",
        "Patch Description",
        "Current Sample Rate",
        "Oversampling",
        "Target Sample Rate",
        "Engine Sample Rate",
        "Resulting Oversampling",
        "Output Sample Rate",
        "Grid Unit Width PX",
        "Grid Unit Height PX",
        "Grid Unit W PX",
        "Grid Unit H PX",
        "patchGridWidthPxValue",
        "patchGridHeightPxValue",
        "nodeScriptGridWidthPxValue",
        "nodeScriptGridHeightPxValue",
        "data-patch-grid-field",
        "Visual Output Mode",
        "Visual Output Scale",
        "Visual Output Style",
        "Visual Output Theme",
        "Visual Output Trail",
        "<span>Load</span><span>Script</span>",
        "<span>View</span><span>Script</span>",
        "<span>Save</span><span>Script</span>",
        "Update Default",
        "Copy Script",
        "Paste Script",
        "copyNodeGraphScriptButton",
        "downloadNodeGraphScriptButton",
        "pasteNodeGraphScriptButton",
        "updateDefaultPresetButton",
        "loadNodeGraphScriptButton",
        "nodeSettingsScriptViewButton",
        "nodeSettingsSaveScriptButton",
        "nodeUiDevButton",
        "<span>UIDEV</span>",
        "nodeUiDevHelper",
        "copyNodeUiDevSettingsButton",
        "loadNodeUiDevSettingsButton",
        "saveNodeUiDevSettingsButton",
        "updateDefaultNodeUiDevSettingsButton",
        "nodeUiDevSettingsFileInput",
        "nodeUiDevSettingsStatus",
        "user UI settings actions",
        "nodeUiDevModularShaderEnabled",
        "modular shader glow",
        "nodeUiDevScopeBloomEnabled",
        "scope bloom glow",
        "nodeUserUiSettingsButton",
        "<span>UI</span><span>Settings</span>",
        "nodeUserUiSettingsPanel",
        "nodeUserUiSettingsHeading",
        "nodeUserUiSettingsDragHandle",
        "Move UI settings",
        "nodeUserUiSettingsSaveDefault",
        "Save UI Settings",
        "nodeUserUiSettingsStatus",
        "nodeUserUiSettingsControls",
        "exposed from UIDEV",
        "nodeUiDevSettingsHeaderTextSize",
        "nodeUiDevButtonTextSize",
        "nodeUiDevButtonTextSizeValue",
        'id="nodeUiDevButtonTextSize"\n                type="range"\n                min="0"\n                max="100"\n                step="1"\n                value="50"',
        "nodeUiDevButtonTextSizeValue\" for=\"nodeUiDevButtonTextSize\">50%",
        "nodeUiDevLiveToggleTextSize",
        "nodeUiDevLiveToggleTextSizeValue",
        'id="nodeUiDevLiveToggleTextSize"\n                type="range"\n                min="0"\n                max="100"\n                step="1"\n                value="76"',
        "nodeUiDevLiveToggleTextSizeValue\" for=\"nodeUiDevLiveToggleTextSize\">76%",
        "nodeUiDevModularHeaderButtonBackground",
        "nodeUiDevModularHeaderButtonBackgroundValue",
        "modular header button background",
        "nodeUiDevModularHeaderButtonBackgroundValue\" for=\"nodeUiDevModularHeaderButtonBackground\">62%",
        "nodeUiDevTooltipTextSize",
        "nodeUiDevTooltipTextSizeValue",
        "tooltip text size",
        "nodeUiDevTooltipTextSizeValue\" for=\"nodeUiDevTooltipTextSize\">14px",
        "nodeUiDevMinimumGridBrightness",
        "nodeUiDevMinimumGridBrightnessValue",
        "minimum grid brightness",
        "nodeUiDevMinimumGridBrightnessValue\" for=\"nodeUiDevMinimumGridBrightness\">0%",
        "nodeUiDevGridColor",
        "nodeUiDevGridColorValue",
        "grid color",
        "nodeUiDevWorkspaceBackgroundColor",
        "nodeUiDevWorkspaceBackgroundColorValue",
        "modular background color",
        "nodeUiDevSettingsHeaderTopRatio",
        "nodeUiDevSettingsHeaderPadding",
        "nodeUiDevModuleTitleFont",
        "nodeUiDevModuleTitleFontValue",
        "module title font",
        "nodeUiDevModuleTitleFontValue\" for=\"nodeUiDevModuleTitleFont\">Cascadia",
        "nodeUiDevModuleTitleHeight",
        "nodeUiDevModuleTitleHeightValue",
        "nodeUiDevModuleTitleHeightValue\" for=\"nodeUiDevModuleTitleHeight\">26px",
        "nodeUiDevModuleTitleTextFill",
        "nodeUiDevModuleTitleTextFillValue",
        "nodeUiDevModuleTitleTextFillValue\" for=\"nodeUiDevModuleTitleTextFill\">62%",
        "nodeUiDevModuleIoSectionHeight",
        "nodeUiDevModuleIoSectionHeightValue",
        "in/out module section height",
        "nodeUiDevModuleIoSectionHeightValue\" for=\"nodeUiDevModuleIoSectionHeight\">24px",
        "input/output text size",
        "nodeUiDevModuleNodeSize",
        "nodeUiDevModuleNodeSizeValue",
        "module node size",
        "nodeUiDevModuleNodeSizeValue\" for=\"nodeUiDevModuleNodeSize\">57%",
        "nodeUiDevSliderWidth",
        "nodeUiDevSliderWidthValue",
        "slider width",
        "nodeUiDevSliderWidthValue\" for=\"nodeUiDevSliderWidth\">100%",
        "nodeUiDevSliderHeight",
        "nodeUiDevSliderHeightValue",
        "slider height",
        "nodeUiDevSliderHeightValue\" for=\"nodeUiDevSliderHeight\">28px",
        "nodeUiDevSliderLabelColor",
        "nodeUiDevSliderLabelColorValue",
        "slider label color",
        "nodeUiDevSliderValueColor",
        "nodeUiDevSliderValueColorValue",
        "slider value color",
        "nodeUiDevSliderUnitColor",
        "nodeUiDevSliderUnitColorValue",
        "slider unit color",
        "nodeUiDevSliderFillHoverColor",
        "nodeUiDevSliderFillHoverColorValue",
        "slider fill mouseover color",
        "nodeUiDevSliderFillHoverAlpha",
        "nodeUiDevSliderFillHoverAlphaValue",
        "slider fill mouseover alpha",
        "nodeUiDevChoiceDividerHeight",
        "nodeUiDevChoiceDividerHeightValue",
        "choice separator height",
        "nodeUiDevWirePatchPointSize",
        "nodeUiDevWirePatchPointSizeValue",
        "wire patch point size",
        "nodeUiDevWirePatchPointSizeValue\" for=\"nodeUiDevWirePatchPointSize\">36%",
        "nodeUiDevBypassIconSize",
        "nodeUiDevBypassIconSizeValue",
        "nodeUiDevBypassIconPreview",
        "nodeUiDevCloseIconSize",
        "nodeUiDevCloseIconSizeValue",
        "nodeUiDevNodeFillColor",
        "nodeUiDevNodeStrokeColor",
        "nodeUiDevNodeSelectedStrokeColor",
        "nodeUiDevNodeDraggingStrokeColor",
        "nodeUiDevPortIdleFillColor",
        "nodeUiDevPortIdleStrokeColor",
        "nodeUiDevPortHoverFillColor",
        "nodeUiDevPortHoverStrokeColor",
        "nodeUiDevInputFillColor",
        "nodeUiDevInputStrokeColor",
        "nodeUiDevOutputFillColor",
        "nodeUiDevOutputStrokeColor",
        "nodeUiDevModInputFillColor",
        "nodeUiDevModInputStrokeColor",
        "nodeUiDevParamOutputFillColor",
        "nodeUiDevParamOutputStrokeColor",
        'data-node-color-var="--node-module-fill"',
        'data-node-color-var="--node-port-hover-fill"',
        "nodeUiDevSettingsHeaderHighlights",
        "nodePatchScriptFileInput",
        "nodePatchNameHeader",
        "nodePatchTagsHeader",
        'data-patch-header-info-field="name"',
        'data-patch-header-info-field="tags"',
        "Live Audio",
        "nodeLiveInputButton",
        "nodeLiveInputDeviceSelect",
        "nodeLiveInputMeter",
        "nodeLiveInputTestStatus",
        "nodeLiveMicStatus",
        "nodeLiveOutputButton",
        "nodeLiveInputStatus",
        "nodeLiveStatus",
        "nodeLiveEngineStatus",
        "nodeLiveMeter",
        "nodeLivePlanStatus",
        "nodeLiveRouteStatus",
        "nodeBadValueMonitorButton",
        "nodeTripEarProtectionButton",
        "nodeBadValueMonitorStatus",
        "nodeBadValueMonitorEvidence",
        "BADVAL Monitor",
        "Trip Ear Protection",
        "nodeInteractionHelp",
        "nodeModularViewButton",
        "nodeSettingsScriptViewButton",
        "nodeSettingsViewButton",
        "nodeSettingsView",
        "patchNameValue",
        "patchAuthorValue",
        "patchTagsValue",
        "patchDescriptionValue",
        "patchCurrentSampleRateValue",
        "patchOversamplingValue",
        "patchTargetSampleRateValue",
        "patchResultingSampleRateValue",
        "patchResultingOversamplingValue",
        "patchOutputSampleRateValue",
        "data-patch-audio-field",
        "patchVisualModeValue",
        "patchVisualScaleValue",
        "patchVisualStyleValue",
        "patchVisualThemeValue",
        "patchVisualTrailValue",
        "nodeZoomOutButton",
        "nodeZoomInButton",
        "nodeUndoButton",
        "nodeRedoButton",
        "nodeVisibilityMenuButton",
        "Visibility",
        "nodeVisibilityMenu",
        "nodeVisibilityMenuClose",
        "Workspace visibility",
        "nodeGridToggleButton",
        "Show Grid",
        "nodePatchTimingControls",
        "node-patch-timing-controls",
        "nodeModuleButtonsToggleButton",
        "Hide Module Buttons",
        "nodeOscilloscopeToggleButton",
        "Hide Oscilloscopes",
        "nodeGlobalScopeMenuButton",
        "Oscilloscope Settings",
        "nodeMasterScopeBrightness",
        "screen burn",
        "nodeMasterScopeBurn",
        "nodeMasterScopeLineThickness",
        "nodeMasterScopeFps",
        "nodeMasterScopeTraceColor",
        "nodeMasterScopeDotCore1Size",
        "nodeMasterScopeDotCore1Brightness",
        "nodeMasterScopeDotCore1Color",
        "nodeMasterScopeDotCore1Preview",
        "nodeMasterScopeDotCore2Size",
        "nodeMasterScopeDotCore2Brightness",
        "nodeMasterScopeDotCore2Color",
        "nodeMasterScopeDotCore2Preview",
        "Trace dot image layers",
        "Dot 1",
        "Dot 2",
        'id="nodeMasterScopeDotCore1Size" type="number" min="0.01" max="5"',
        'id="nodeMasterScopeDotCore1Color" type="color"',
        'id="nodeMasterScopeDotCore2Size" type="number" min="0.01" max="5"',
        'id="nodeMasterScopeDotCore2Brightness" type="number" min="0" max="4"',
        'id="nodeMasterScopeDotCore2Color" type="color"',
        "nodeMasterScopeDotPreview",
        "Generated oscilloscope dot 1 image preview",
        "Generated oscilloscope dot 2 image preview",
        "Generated oscilloscope combined dot image preview",
        "nodeMasterScopeBackgroundColor",
        "nodeMasterScopeBackgroundOverride",
        "nodeGlobalScopeMenu",
        "node-scope-global-settings",
        "Global Settings",
        "node-scope-local-settings",
        "Local Settings",
        "nodeGlobalScopeDragHandle",
        "nodeGlobalScopeCloseMenu",
        "data-global-scope-input=\"brightness\"",
        "data-global-scope-input=\"burn\"",
        "data-global-scope-input=\"lineThickness\"",
        "data-global-scope-input=\"framesPerSecond\"",
        "data-global-scope-number-drag=\"true\"",
        "data-global-scope-input=\"traceColor\"",
        "data-global-scope-input=\"dotCore1Size\"",
        "data-global-scope-input=\"dotCore1Brightness\"",
        "data-global-scope-input=\"dotCore1Color\"",
        "data-global-scope-input=\"dotCore2Size\"",
        "data-global-scope-input=\"dotCore2Brightness\"",
        "data-global-scope-input=\"dotCore2Color\"",
        "data-global-scope-input=\"backgroundColor\"",
        "data-global-scope-control=\"backgroundOverride\"",
        "nodeModuleSlidersToggleButton",
        "Hide Sliders",
        "nodePatchScript",
        "nodeWaveformCanvas",
        "nodeSignalPlotCanvas",
        "nodeVisualOutputCanvas",
        "nodeVisualOutputMeta",
        "nodeVideoExportSecondsValue",
        "nodeVisualOutputTargetWidthValue",
        "nodeVisualOutputResolutionValue",
        "nodeRenderWavButton",
        "nodeRenderMp4Button",
        "nodeRenderOggButton",
        "nodeRenderFlacButton",
        "nodeRenderMp4AltButton",
        "nodeRenderMp4VideoOnlyButton",
        "nodeExportVisualVideoButton",
        "nodeSaveVisualOutputButton",
        "nodeVisualOutputStatus",
        "nodeVideoViewButton",
        "nodeVideoViewPanel",
        "nodeVideoViewStatus",
        "nodeMacroControlsToggleButton",
        "nodeMacroControlsPanel",
        "nodeMacroControlsStatus",
        "Camera View",
        "Video View",
        "Macro Controls",
        "Selected modular camera output",
        "nodeCopyExecutionJsonButton",
        "nodeExecutionJsonStatus",
        "nodeCopyRuntimeSketchButton",
        "nodeRuntimeSketch",
        "nodeRuntimeSketchStatus",
        "nodeGraphZoomSurface",
        "nodeModuleScopeCanvas",
        "nodeSelectionMarquee",
        "node-selection-marquee",
        "nodePalette",
        "nodeSceneContextMenu",
        "nodeModuleShopView",
        "nodeModuleShopClose",
        "nodeModuleShopAvailable",
        "nodeModuleDepartmentSearch",
        "nodeModuleDepartmentSearchShell",
        "nodeModuleCollectionsMenu",
        "nodeModuleCollectionsClose",
        "nodeModuleCollectionsToolkit",
        "nodeModuleDepartmentList",
        "nodeModuleDepartmentView",
        "nodeModuleDepartmentBack",
        "nodeModuleDepartmentClose",
        "nodeModuleDepartmentTitle",
        "nodeModuleDepartmentSummary",
        "nodeModuleGroups",
        "nodeModuleGroupList",
        "Module Departments",
        "Search departments...",
        "Collections",
        "Toolkit",
        "Department modules",
        "Department modules",
        "nodeModuleShopButton",
        "<span>Module</span><span>Browser</span>",
        "nodeSceneCopyModule",
        "nodeSceneAddToGroup",
        "Add to group",
        "Copy",
        "Ctrl+C",
        "nodeSceneAliasControl",
        "nodeSceneAliasInput",
        "module title alias",
        "nodeSceneWidthControls",
        "nodeSceneWidthDecrease",
        "nodeSceneWidthValue",
        "nodeSceneWidthIncrease",
        "nodeIndividualScopeControls",
        "nodeSceneScopeControls",
        "nodeScopeContextMenu",
        "nodeScopeBurnValue",
        "nodeScopeBrightnessValue",
        "nodeScopeLineThicknessValue",
        "nodeSceneGainScopeControls",
        "gain trace response",
        "nodeGainScopeMinBrightness",
        "nodeGainScopeMaxBrightness",
        "nodeGainScopeMinLineThickness",
        "nodeGainScopeMaxLineThickness",
        "nodeSceneScopeTime",
        "nodeSceneScopeGain",
        "nodeSceneScopeSync",
        "nodeSceneScopeOscillatorTraceMode",
        "<span>cycles</span>",
        'id="nodeSceneScopeTime"',
        'min="0"',
        'max="128"',
        'step="1"',
        "<span>amplitude</span>",
        "screen burn amount",
        "light brightness",
        "line thickness",
        "min brightness",
        "max brightness",
        "min line thickness",
        "max line thickness",
        'value="2"',
        'value="60"',
        'value="0.62"',
        'value="1.5"',
        'value="2.4"',
        'data-scope-input="cycles"',
        'data-scope-input="gain"',
        'data-scope-input="screenBurn"',
        'data-scope-input="brightness"',
        'data-scope-input="lineThickness"',
        'data-scope-input="gainMinBrightness"',
        'data-scope-input="gainMaxBrightness"',
        'data-scope-input="gainMinLineThickness"',
        'data-scope-input="gainMaxLineThickness"',
        'data-scope-control="oscillatorTraceMode"',
        "freq reset",
        "nodeSceneTextBoxHeightControls",
        "nodeSceneTextBoxHeightDecrease",
        "nodeSceneTextBoxHeightValue",
        "nodeSceneTextBoxHeightIncrease",
        "nodeSceneTextBoxTextSizeControls",
        "nodeSceneTextBoxTextSizeDecrease",
        "nodeSceneTextBoxTextSizeValue",
        "nodeSceneTextBoxTextSizeIncrease",
        "nodeSceneTextBoxTextControls",
        "nodeSceneTextBoxTextInput",
        "nodeSceneToggleButtons",
        "nodeSceneToggleTitle",
        "nodeSceneImageControls",
        "nodeSceneImageLoad",
        "nodeSceneImageSave",
        "nodeSceneImageRefresh",
        "nodeSceneImageFileInput",
        "nodeSceneTextBoxControls",
        "nodeSceneTextBoxSingleLine",
        "nodeSceneTextBoxMultiline",
        "nodeSceneTextBoxHorizontalAlignControls",
        "nodeSceneTextBoxAlignLeft",
        "nodeSceneTextBoxAlignCenter",
        "nodeSceneTextBoxAlignRight",
        "nodeSceneTextBoxVerticalAlignControls",
        "nodeSceneTextBoxVerticalAlign",
        "nodeSceneTextBoxVerticalAlignValue",
        "nodeSceneDeleteModule",
        "Delete",
        "nodeSceneCloseMenu",
        "Close module actions",
        "&times;",
        "nodeDeleteButton",
        "nodeRenderSecondsValue",
        "Render Sample",
        "Seconds",
        "toggleDebugButton",
        '<body class="debug-collapsed node-boot-loading">',
        '<script src="./public/boot-loading.js?v=boot-loading-fade-1780340400000"></script>',
        "node-boot-loading-screen",
        "Loading interface",
        "nodeEarProtectionFault",
        "Audio Safety Circuit Open",
        "Ear Protection Tripped",
        "Refresh the page, your patch will be saved.",
        'aria-pressed="false">Show Evidence</button>',
        "nodeParameterMetadataPopover",
        "metadataMinValue",
        "metadataMidLabel",
        "metadataMidValue",
        "metadataMaxValue",
        "metadataDefaultValue",
        "metadataStepValue",
        "metadataMaxDigitsValue",
        "metadataKindValue",
        "metadataUnitValue",
        "metadataChoicesValue",
        "Choices",
        "metadataDisplayChoicesValue",
        "Display choices",
        "metadataDivideChoicesValue",
        "Divide choices visibly",
        "metadataShowSignValue",
        "Always show +/-",
        "metadataWraparoundValue",
        "Wraparound",
        "metadataLinearSmoothingValue",
        "Linear smoothing",
        "metadataNonlinearSliderValue",
        "Nonlinear slider",
        "metadataPopoverDragHandle",
        "Set Defaults from Kind",
        "Module Browser",
        "nodeModuleShopAvailable",
        "node-live-toggle-palette",
        "<span>Input</span>",
        "<span>Output</span>",
        "<span>(Off)</span>",
        "nodeUiViewButton",
        "<span>UI</span><span>View</span>",
        "nodeMidiKeyboardToggleButton",
        "<span>Show</span><span>Keyboard</span>",
        "nodeMidiKeyboardOctaveDown",
        "nodeMidiKeyboardOctaveValue",
        "nodeMidiKeyboardOctaveUp",
        'data-keyboard-signal="octave"',
        "nodeMacroControlsToggleButton",
        "<span>Show</span><span>Macro Controls</span>",
        'data-tooltip-key="settings.makePlugin"',
        'data-tooltip-key="settings.makeModule"',
        'data-tooltip-key="settings.makeWidget"',
        'data-tooltip-key="settings.sharePatchCommunity"',
        'data-tooltip-key="settings.requestFeature"',
        'data-tooltip-key="settings.reportBug"',
        "node-settings-script-action-group",
        "Script actions",
        "node-settings-feedback-action-group",
        "Feedback actions",
        "node-settings-dev-action-group",
        "In-development build actions",
        "makePluginButton",
        "makeModuleButton",
        "makeWidgetButton",
        "sharePatchCommunityButton",
        "<span>Make Plugin</span><span>(in development)</span>",
        "<span>Make Module</span><span>(in development)</span>",
        "<span>Make Widget</span><span>(in development)</span>",
        "<span>Share Patch</span><span>With Community</span>",
    ]:
        require(snippet in index_source, f"node graph shell missing {snippet}")

    scene_context_source = index_source[
        index_source.index('id="nodeSceneContextMenu"'):
        index_source.index('<section class="audio-panel node-sample-panel"')
    ]
    require(
        'id="nodeSceneDeleteModule"' in scene_context_source,
        "module actions delete button should be inside the scene context menu",
    )
    require(
        '</label>\n        </div>\n        <button id="nodeSceneDeleteModule"' not in index_source,
        "module actions delete button should not escape the scene context menu",
    )

    for snippet in [
        '"name": "soemdsp-sandbox tooltip master"',
        '"module"',
        '"wire"',
        '"slider"',
        '"settings"',
        '"audio"',
        '"Mouse: middle-drag to move the modular view freely. Ctrl+middle-drag or Alt+middle-drag slowly zooms, including over modules and controls. Right-click empty space opens the add module dialog. Ctrl+Shift+G aligns the view to the grid."',
        '"Mouse: drag to move modules. Click to select. Ctrl/Shift+click adds or removes from selection; Ctrl/Shift+drag adds to selection while moving."',
        '"Display-only text. Edit content from this module\'s actions menu. Text clips to the box height and scales down to fit width. Mouse wheel zooms the modular view."',
        '"Plain drag between this output and a signal input or modulation input to create a wire."',
        '"view": "Open the patch script editor"',
        "Ctrl+click resets to default",
        '"Mouse: click to copy the full compiled execution JSON."',
        '"Export the current circuit to CLAP/VST/AU/other that turns a sandbox patch into a multiplatform audio plugin. (currently unavailable)"',
    ]:
        require(snippet in tooltip_source, f"tooltip master document missing {snippet}")

    for snippet in [
        "nodeClearButton",
        "Clear Wires",
        'data-palette-node="audioInput"',
        'data-context-module="audioInput"',
        'data-palette-node="osc"',
        'data-palette-node="spiral"',
        'data-palette-node="noise"',
        'data-palette-node="gain"',
        'data-palette-node="bias"',
        'id="nodeSceneAddOsc"',
        'id="nodeSceneAddHighpass"',
        'id="nodeSceneAddLowpass"',
        'data-context-module="osc"',
        'data-context-module="highpass"',
        'data-context-module="lowpass"',
    ]:
        require(snippet not in index_source, f"dangerous clear wires control should be absent: {snippet}")

    require(
        "nodeSceneScopeFps" not in index_source
        and 'data-scope-input="framesPerSecond"' not in index_source,
        "scope FPS should be a master header control, not an individual oscilloscope menu field",
    )

    for snippet in [
        "Browser Patch Proof",
        "Node Wiring MVP",
    ]:
        require(snippet not in index_source, f"static patch header should be absent: {snippet}")

    settings_order = [
        index_source.index("patchNameValue"),
        index_source.index("patchTagsValue"),
        index_source.index("patchAuthorValue"),
        index_source.index("patchDescriptionValue"),
    ]
    require(settings_order == sorted(settings_order), "settings fields should be ordered name, tags, author, description")

    workspace_index = index_source.index("nodeGraphWorkspace")
    require("nodeGraphEmptyModuleButton" in index_source, "empty workspace module browser button missing")
    audio_index = index_source.index("audioPlayer")
    controls_index = index_source.index("nodeRenderButton")
    require(
        workspace_index < audio_index < controls_index,
        "primary audio widget should sit below node workspace and above render controls",
    )

    fallback_index = metadata_defaults_source.index("const fallbackNodeMetadataKindTemplates")
    fallback_waveform_index = metadata_defaults_source.index("waveform: {", fallback_index)
    fallback_waveform_end = metadata_defaults_source.index("bypass: {", fallback_waveform_index)
    fallback_waveform_source = metadata_defaults_source[fallback_waveform_index:fallback_waveform_end]
    for snippet in [
        "max: 4",
        "maxDigits: 3",
        "mid: 2",
        "min: 0",
    ]:
        require(snippet in fallback_waveform_source, f"fallback waveform metadata missing {snippet}")

    for snippet in [
        "const nodeGraphDefaultNodeConfigs = Object.freeze([])",
        "const nodeGraphDefaultConnections = Object.freeze([])",
        "nodes: nodeGraphDefaultNodeConfigs.map((node) => ({ ...node }))",
        "connections: nodeGraphDefaultConnections.map((connection) => ({ ...connection }))",
        "nodeGraphEmptyModuleButton",
        "openNodeGraphModuleShop(null)",
        "workspace?.classList.toggle(\"empty-patch\", visiblePatchNodeCount === 0)",
        "emptyButton.hidden = visiblePatchNodeCount !== 0",
        "timing: {",
        "tempoBpm: 120",
        "timeSignatureDenominator: 4",
        "timeSignatureNumerator: 4",
        "view: { widthGu: 31, heightGu: 20 }",
        "const nodeGraphDefaultPresetUrl = \"./public/presets/default.json\"",
        "defaultPatch: cloneNodeGraphPatch(nodeGraphDefaultPatch)",
        "async function loadNodeGraphDefaultPresetPatch()",
        "return loadNodeGraphPatchFromScript(await response.text())",
        "const nodeGraphAudioBlockSize = 512",
        "const nodeGraphModuleDefinitions",
        "label: \"Volume\"",
        "key: \"volume\"",
        "defaultValue: \"0.1\"",
        "max: \"1\"",
        "mid: \"0.1\"",
        "osc: {",
        'inputs: ["Reset", "Increment"]',
        "scopeInputPort: \"\"",
        "gain: {",
        "label: \"Amplitude\"",
        "bias: {",
        "defaultValue: \"0\"",
        "key: \"offset\"",
        "max: \"1\"",
        "min: \"-1\"",
        "valueSlider: \"Value Slider\"",
        "valueSlider: {",
        'layout: "sliderWidget"',
        'outputs: ["Bias"]',
        'label: "Bias"',
        "highpass: \"Highpass\"",
        "highpass: {",
        "lowpass: \"Lowpass\"",
        "lowpass: {",
        "slewLimiter: \"Up/Down Slew\"",
        "slewLimiter: {",
        "key: \"upTime\"",
        "key: \"downTime\"",
        "clock: \"Clock\"",
        "clock: {",
        "clockDivider: \"Clock Divider\"",
        "clockDivider: {",
        'inputs: ["Clock", "Reset"]',
        "key: \"duty\"",
        "delayedTrigger: \"Delayed Trigger\"",
        "delayedTrigger: {",
        "key: \"delay\"",
        "randomClock: \"Random Clock\"",
        "randomClock: {",
        'outputs: ["Trigger", "Gate"]',
        "key: \"minSeconds\"",
        "key: \"maxSeconds\"",
        "triggerCounter: \"Trigger Counter\"",
        "triggerCounter: {",
        "key: \"countMax\"",
        "triggerDivider: \"Trigger Divider\"",
        "triggerDivider: {",
        "key: \"division\"",
        "key: \"pulseTime\"",
        "stepSequencer: \"Step Sequencer\"",
        "stepSequencer: {",
        'inputs: ["Trigger", "Reset"]',
        'outputs: ["Out", "Gate"]',
        "key: \"step8\"",
        "bandpass: \"Bandpass\"",
        "bandpass: {",
        "highpass: {",
        "lowpass: {",
        "ladderFilter: {",
        "cookbookFilter: \"Multi Stage Filter\"",
        "cookbookFilter: {",
        'layout: "filterCurve"',
        'inputs: ["In"]',
        'outputs: ["Out"]',
        "choices: nodeGraphCookbookFilterModes",
        'key: "mode"',
        'key: "frequency"',
        'key: "stages"',
        'key: "q"',
        'key: "gain"',
        "ladderFilter: \"Ladder Filter\"",
        "ladderFilter: {",
        "const nodeGraphLadderFilterModes = Object.freeze",
        "choices: nodeGraphLadderFilterModes",
        'key: "resonance"',
        "sampleHold: \"Sample & Hold\"",
        "sampleHold: {",
        "midiOut: \"Midi Out\"",
        "midiOut: {",
        'inputs: ["MIDI Number"]',
        'outputs: ["Normalized", "Full Value"]',
        "key: \"midiNumber\"",
        "label: \"MIDI Number\"",
        "max: \"127\"",
        "step: \"1\"",
        "midiNotePitch: \"Midi Note Pitch\"",
        "keyboardController: \"MIDI Keyboard\"",
        "macroControls: \"Macro Controls\"",
        "pitchModWheel: \"Pitch / Mod Wheel\"",
        "midiNotePitch: {",
        'inputs: ["MIDI Note", "Octave Offset", "Pitch Offset"]',
        '"Semitone Offset": "Pitch Offset"',
        'outputs: ["Pitch 0-1", "Pitch 0-127", "Frequency"]',
        "keyboardController: {",
        'outputs: ["Gate", "1 Sample Gate", "Key", "Q", "MIDI", "Double", "Increment", "Frequency", "Pitch", "X", "Y"]',
        "macroControls: {",
        'outputs: ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10"]',
        "pitchModWheel: {",
        'outputs: ["Pitch Wheel", "Mod Wheel"]',
        "expAdsr: \"Exp ADSR\"",
        "expAdsr: {",
        'inputs: ["Gate"]',
        "key: \"attackShape\"",
        "key: \"releaseShape\"",
        "choices: [\"Off\", \"On\"]",
        "linearEnvelope: \"Linear Envelope\"",
        "linearEnvelope: {",
        "key: \"sustain\"",
        "pluckEnvelope: \"Pluck Envelope\"",
        "pluckEnvelope: {",
        "key: \"attackFeedback\"",
        "key: \"decayModFrequency\"",
        "key: \"autoReleaseTime\"",
        "vactrolEnvelope: \"Vactrol Envelope\"",
        "vactrolEnvelope: {",
        'inputs: ["Light"]',
        "key: \"darkCurrent\"",
        "flowerChildEnvelopeFollower: \"FlowerChild Envelope Follower\"",
        "flowerChildEnvelopeFollower: {",
        'inputs: ["In"]',
        "key: \"hold\"",
        "sandboxVisuals: \"Screen Visuals\"",
        "bloomGlow: \"Bloom & Glow\"",
        "rgbaHsla: \"RGBA / HSLA\"",
        "chromaColor: \"Chroma Color\"",
        "image: \"Image\"",
        "visualOscilloscope: \"Visual Oscilloscope\"",
        "sandboxVisuals: {",
        'inputs: ["Shake", "X", "Y", "Dim", "Red", "Green", "Blue", "Scope Off", "Pause", "Trace Image"]',
        "inputAliases: {",
        '"Screen Shake": "Shake"',
        '"Screen Dim": "Dim"',
        '"Turn Off Oscilloscope Traces": "Scope Off"',
        '"Pause Oscilloscopes": "Pause"',
        '"Trace Texture": "Trace Image"',
        "visualInputs: [",
        'key: "screenShake"',
        'label: "Shake"',
        'port: "Shake"',
        'key: "x"',
        'port: "X"',
        'key: "y"',
        'port: "Y"',
        'key: "screenDim"',
        'label: "Dim"',
        'port: "Dim"',
        'key: "red"',
        'port: "Red"',
        'key: "green"',
        'port: "Green"',
        'key: "blue"',
        'port: "Blue"',
        'key: "scopeTracesOff"',
        'label: "Scope Off"',
        'port: "Scope Off"',
        'key: "scopePaused"',
        'label: "Pause"',
        'port: "Pause"',
        'key: "traceImage"',
        'label: "Trace Image"',
        'port: "Trace Image"',
        "visualSink: true",
        "bloomGlow: {",
        'key: "screenDim"',
        'label: "Dim"',
        'key: "visualBrightness"',
        'label: "Brightness"',
        'key: "visualBloom"',
        'label: "Bloom"',
        'key: "visualGlow"',
        'label: "Glow"',
        "rgbaHsla: {",
        'inputs: ["Red", "Green", "Blue", "Hue", "Saturation", "Lightness", "HSL Mix", "Alpha"]',
        '"Screen Alpha": "Alpha"',
        'key: "hslMix"',
        'label: "HSL Mix"',
        'port: "HSL Mix"',
        "chromaColor: {",
        'key: "chromaHue"',
        'label: "Hue"',
        "wraparound: true",
        'key: "chromaSaturation"',
        'label: "Chroma"',
        'key: "chromaLightness"',
        'label: "Light"',
        'key: "chromaAlpha"',
        'label: "Alpha"',
        'key: "chromaDrift"',
        'label: "Drift"',
        'key: "chromaSpread"',
        'label: "Spread"',
        'key: "visualBrightness"',
        'label: "Trace Brightness"',
        'key: "visualBloom"',
        'label: "Bloom"',
        'key: "visualGlow"',
        'label: "Glow"',
        "image: {",
        'layout: "image"',
        'outputs: ["Image"]',
        "visualOscilloscope: {",
        'inputs: ["In"]',
        'layout: "visualScope"',
        'scopeInputPort: "In"',
        'key: "visualOscilloscope"',
        'label: "In"',
        'port: "In"',
        "function nodeGraphModuleVisualInputs(type)",
        "function nodeGraphCanonicalInputPort(type, port)",
        "function nodeGraphModuleVisualInputKey(type, port)",
        "badvalMonitor: \"BADVAL Monitor\"",
        "badvalMonitor: {",
        "monitorSink: true",
        'inputs: ["In"]',
        'outputs: ["Out"]',
        "label: \"Frequency\"",
        "maxDigits: 5",
        "osc: {",
        "defaultValue: \"1\"",
        "max: \"1\"",
        "mid: \"0.5\"",
        "step: \"any\"",
        "noise: {",
        "defaultValue: \"1\"",
        "key: \"level\"",
        "label: \"Amplitude\"",
        "key: \"speed\"",
        "label: \"Speed\"",
        "key: \"seed\"",
        "label: \"Seed\"",
        "maxDigits: 5",
        "stereoNoise: \"Stereo Noise\"",
        "stereoNoise: {",
        'outputs: ["Left", "Right", "Out"]',
        "noiseGenerator: \"Noise Generator\"",
        "noiseGenerator: {",
        "choices: [\"Uniform\", \"Gaussian\", \"Brown\", \"Pink\", \"Crackle\"]",
        "randomWalk: \"Random Walk\"",
        "randomWalk: {",
        "choices: [\"White\", \"Filtered\", \"Random Steps\", \"Fixed Steps\"]",
        "fractalBrownianNoise: \"Fractal Brownian Noise\"",
        "fractalBrownianNoise: {",
        'outputs: ["Out X", "Out Y", "Out Z"]',
        "key: \"octaves\"",
        "key: \"persistence\"",
        "key: \"scale\"",
        "key: \"seed\"",
        "max: \"1\"",
        "mid: \"0.5\"",
        "nonlinearSlider: false",
        "step: \"any\"",
        "spiral: \"Spiral\"",
        "spiral: {",
        "textBox: \"Text Box\"",
        "textBox: {",
        "layout: \"textBox\"",
        "normalizeNodeGraphTextBoxLayout",
        "const nodeGraphImageLayoutKind = \"image\"",
        "function normalizeNodeGraphImageLayout(layout = {})",
        "function createNodeGraphImageBody(nodeId)",
        "function nodeGraphTraceImageDataUrl()",
        "loadNodeGraphImageFromContext",
        "saveNodeGraphImageFromContext",
        "refreshNodeGraphImageFromContext",
        "handleNodeGraphImageFileInputChange",
        'outputs: ["X", "Y", "Z"]',
        "sharpCurveMult",
        "key: \"waveform\"",
        "nodeOscWaveform",
        "choices: [\"Saw\", \"Square\", \"Triangle\", \"Sine\", \"Noise\"]",
        "const nodeGraphOutputInputPorts",
        'inputs: ["Mono", "Left", "Right"]',
        'Object.freeze(["Mono", "Left", "Right"])',
        "const nodeGraphDefaultNodeConfigs",
        "params: nodeGraphDefaultParamsForType",
        "const nodeGraphZoomLimits",
        "max: 10",
        "min: 0.1",
        "const fallbackNodeMetadataKindTemplates",
        "let nodeMetadataKindTemplates = Object.freeze(Object.fromEntries(",
        'amplitude: { def: 1, label: "Amplitude"',
        'label: "Decibels"',
        'decimal_bipolar: {',
        'frequency: { def: 440, label: "Frequency"',
        "frequency: { def: 440, label: \"Frequency\", linearSmoothing: true, max: 20000, maxDigits: 5, mid: 440, min: 0, step: 0",
        'phase: {',
        'label: "Phase"',
        'wraparound: true',
        'descrete: { def: 0, label: "Descrete"',
        'integer_bipolar: {',
        'label: "Integer Bipolar"',
        'waveform: {',
        'bypass: {',
        'plusminus: {',
        'onoff: {',
        'momentary: {',
        'unit: "dB"',
        "const nodeMetadataKindAliases",
        "function normalizeNodeMetadataKind(kind)",
        "function applyNodeMetadataKindTemplates(templates)",
        "async function loadNodeMetadataKindTemplates()",
        'fetch("/api/node-metadata-kinds"',
        "function normalizeNodeGraphPatchInfo(info = {})",
        "function normalizeNodeGraphPatchAudio(audio = {})",
        "targetSampleRate: Number.isFinite(targetSampleRate)",
        "function nodeGraphBaseSampleRate()",
        "function nodeGraphTargetSampleRate(patch = nodeGraphMvp.patch)",
        "const nodeGraphOversamplingPresets = Object.freeze([1, 2, 4])",
        "function nodeGraphOversamplingMultiplier(baseRate, targetRate)",
        "Math.min(4, target / base)",
        "function nodeGraphOversamplingPresetForRatio(ratio)",
        'return "custom"',
        "function nodeGraphTargetSampleRateForOversampling(multiplier, baseRate = nodeGraphBaseSampleRate())",
        "function nodeGraphEffectiveSampleRate(baseRate, multiplier)",
        "function nodeGraphFormatSampleRate(sampleRate)",
        "function nodeGraphFormatOversamplingRatio(ratio)",
        "function nodeGraphAudioDerivation(patch = nodeGraphMvp.patch)",
        "clampedEngineSampleRate",
        "outputSampleRate",
        "oversamplingRatio",
        "function nodeGraphTemporaryPrefilterForResample(samples, sourceRate, outputRate)",
        "function nodeGraphResampleLinear(samples, outputFrames)",
        "function nodeGraphResampleRenderedChannel(samples, sourceRate, outputRate, outputFrames)",
        "function normalizeNodeGraphPatchVisual(visual = {})",
        "function normalizeNodeGraphPatchWindows(windows = {})",
        "function normalizeNodeGraphWindowPosition(position = {})",
        "duplicate connection",
        "duplicate modulation",
        "function syncNodeGraphSettingsView()",
        "function readNodeGraphSettingsView()",
        "function readNodeGraphAudioSettingsView()",
        "function readNodeGraphVisualSettingsView()",
        "audio: normalizeNodeGraphPatchAudio(patch.audio)",
        "visual: normalizeNodeGraphPatchVisual(patch.visual)",
        "windows: normalizeNodeGraphPatchWindows(patch.windows)",
        "nodePatchNameHeader",
        "nodePatchTagsHeader",
        "function handleNodeGraphHeaderInfoInput(event)",
        "dataset?.patchHeaderInfoField",
        'field.addEventListener("input", handleNodeGraphHeaderInfoInput)',
        "function handleNodeGraphSettingsInput(event)",
        "patch.audio = readNodeGraphAudioSettingsView()",
        'field.addEventListener("input", handleNodeGraphSettingsInput)',
        "function commitNodeGraphSettingsHistory()",
        "settings saved",
        "info: normalizeNodeGraphPatchInfo(patch.info)",
        "const nodeGraphWireInteractions = window.createNodeGraphWireInteractionController({",
        "helpers: nodeGraphWireHelpers",
        "function createNodeGraphWireInteractionController(deps)",
        "function beginWireDrag(event)",
        "if (event.button !== 0) {\n    return;",
        "function endpointHitboxClientRect(endpoint, hitboxElement = null)",
        "const rect = element.getBoundingClientRect()",
        "const portDiameter =",
        "const patchPointRatio =",
        "const patchPointSize =",
        'if (!element.classList.contains("connected-port") || patchPointSize <= 0)',
        'element.classList.contains("node-param-port")',
        "function patchPointTargetFromPoint(clientX, clientY)",
        'document.querySelectorAll(".node-port, .node-io-row, .node-param-port.modulation-input")',
        "function beginPatchPointWireDrag(event)",
        "function handlePatchPointHover(event)",
        'target.closest?.(".node-port, .node-io-row, .node-param-port.modulation-input")',
        "patch-point-hover",
        "function dragWire(event)",
        "function endWireDrag(event)",
        "const connected = helpers.connectEndpoints(dragging.endpoint, targetEndpoint);",
        "from: helpers.endpointPoint(endpoint, port)",
        "function straightPath(from, to)",
        "pathData: explicitPathData = null",
        "function createGradient(svg, id, from, to",
        "function drawPath(svg, options)",
        "function nodeGraphTraceSingleMovePoint(from, points, point)",
        "function nodeGraphTraceAppendSingleMovePoint(from, points, point)",
        "function nodeGraphTraceFinalApproachPoint(from, points, point)",
        "function nodeGraphTraceAppendFinalApproachPoint(from, points, point)",
        "return { x: previous.x, y: target.y }",
        "function nodeGraphTraceCleanFinalDestinationPoints(from, points, to)",
        "nodeGraphTracePointBetween(target.y, start.y, end.y)",
        "function nodeGraphSelfTraceModuleRect(nodeId)",
        "function nodeGraphSelfTracePoints(wire, from, to)",
        'node.querySelector(".node-header-title-row")?.getBoundingClientRect()',
        "const distance = Math.max(nodeGraphGridWidth(), nodeGraphGridHeight()) * 0.75",
        "const outX = from.x + fromDirection * distance",
        "const aboveY = Math.max(0.5, rect.top - distance)",
        "const belowTitleY = Math.max(to.y, rect.titleBottom + 0.5)",
        "{ x: outX, y: from.y }",
        "{ x: outX, y: aboveY }",
        "{ x: destinationSideX, y: aboveY }",
        "{ x: destinationSideX, y: belowTitleY }",
        "function nodeGraphManualTracePathOptions(wire, from, to)",
        "const previewPoint = nodeGraphTraceSingleMovePoint(trace.from, trace.points, trace.to)",
        "nodeGraphTracePathFromPoints(from, tracePoints, to)",
        "if (event.ctrlKey || event.metaKey)",
        "function handleManualTracePointerDown(event)",
        "wireType: nodeGraphWireTypes.trace",
        "function animateDestroyedWire(from, to)",
        "path.setAttribute(\"d\", helpers.straightPath(from, to))",
        "animateDestroyedWire(from, to)",
        "deps.burstZap(from)",
        "deps.burstZap(to)",
        "function connectNodeGraphPorts(",
        "function connectNodeGraphModulation(",
        "function nodeGraphConnectionOptionsWithSelfTrace(sourceNode, destinationNode, options = {})",
        "sourceNode !== destinationNode || options.wireType || options.tracePoints?.length",
        "function disconnectNodeGraphConnection(index, kind = \"signal\")",
        "selection.index > index",
        "setNodeGraphSelection({ ...selection, index: selection.index - 1 })",
        "Render current patch sample",
        "Render blocked: ${validation.issues.join(\", \")}",
        "function createNodeSliderReadout(slider)",
        "function updateNodeSliderCurrentValue(slider, rawValue)",
        "function syncNodeGraphPatchParameterFromSlider(slider, options = {})",
        "if (options.deferUi)",
        "function syncNodeSliderReadout(slider)",
        "function syncNodeGraphSliderReadouts()",
        "function limit_decimals(",
        "function formatNodeSliderNumber(value, options = {})",
        "function parseNodeSliderMathExpression(text)",
        "parseExpression()",
        'operator === "*" ? value * right : value / right',
        "nodeSliderNumberFormatSmokeCases",
        '{ value: 1456.6982, maxDigits: 5, expected: "1456.7" }',
        '{ value: 220, maxDigits: 5, expected: "220.00" }',
        '{ value: 1, maxDigits: 3, expected: "1.00" }',
        '{ value: 12.34567, maxDigits: 5, expected: "12.346" }',
        '{ value: 0.123456, maxDigits: 5, expected: "0.1235" }',
        '{ value: -0.123456, maxDigits: 5, expected: "-0.1235" }',
        '{ value: 0.123456, maxDigits: 5, showSign: true, expected: "+0.1235" }',
        '{ value: 0.123456, maxDigits: 5, reserveSignSpace: true, expected: " 0.1235" }',
        "function parseNodeMetadataChoices(value)",
        "function formatNodeMetadataChoices(choices)",
        "function nodeSliderShouldDisplayChoices(slider)",
        "function nodeSliderShouldDivideChoicesVisibly(slider)",
        "function nodeSliderShouldUseLinearSmoothing(slider)",
        "function nodeSliderShouldWraparound(slider)",
        "function nodeSliderChoiceLabel(slider)",
        "function nodeSliderChoiceIndexFromText(slider, value)",
        "prefixMatches.length === 1",
        "function nodeSliderShouldShowSign(slider)",
        "function nodeSliderElementLayoutWidth(element)",
        "function nodeSliderElementLayoutHeight(element)",
        "function nodeSliderElementVisualScale(element)",
        "const x = (clientX - rect.left) / scale",
        "function nodeSliderMetadata(slider)",
        "function formatNodeSliderMetadataTooltip(slider)",
        "reserveSignSpace",
        "showPlusMinus",
        "divideChoicesVisibly",
        "function normalizeNodeMetadataKindTemplate(template = {}, kind = \"decimal\")",
        "function normalizeNodeGraphMetadataMaxDigits(value, kind = \"decimal\")",
        "maxDigits",
        "Boolean(choices.length)",
        "linearSmoothing",
        "wraparound",
        "function syncNodeSliderMetadataTooltip(slider)",
        "function nodeSliderDebugPath(slider)",
        "function nodeGraphNodeType(node)",
        "function nodeGraphReadNodeNumber(node, key)",
        'input[data-param="${CSS.escape(key)}"]',
        "function nodeGraphDefaultParamsForType(type)",
        "function nodeGraphZoom()",
        "function nodeGraphZoomSurface()",
        "function nodeGraphGraphRect()",
        "macroControlsVisible: false",
        "videoViewVisible: false",
        "function renderNodeGraphMacroControls()",
        "function toggleNodeGraphMacroControls()",
        "function renderNodeGraphVideoViewToggle()",
        "function toggleNodeGraphVideoView()",
        "document.getElementById(\"nodeMacroControlsToggleButton\").addEventListener(\"click\", toggleNodeGraphMacroControls)",
        "document.getElementById(\"nodeVideoViewButton\").addEventListener(\"click\", toggleNodeGraphVideoView)",
        "document.getElementById(\"nodeMacroControlsPanel\")",
        "document.getElementById(\"nodeVideoViewPanel\")",
        "function nodeGraphGridWidth()",
        "function nodeGraphGridHeight()",
        "function applyNodeGraphZoom()",
        "syncNodeGraphSliderReadouts();",
        "function setNodeGraphZoom(nextZoom, anchor = null)",
        "x: Number(nextPan.x) || 0",
        "y: Number(nextPan.y) || 0",
        "function zoomNodeGraphBy(delta)",
        "function zoomNodeGraphAt(delta, clientX, clientY)",
        "function handleNodeGraphWorkspaceWheel(event)",
        '.addEventListener("wheel", handleNodeGraphWorkspaceWheel, { passive: false })',
        "const nodeGraphGrid",
        "const nodeGraphPatchFormat",
        "soemdsp-sandbox-node-patch",
        "const nodeGraphDefaultPatch",
        "bypassedNodes: []",
        "view: { widthGu: 31, heightGu: 20 }",
        "function cloneNodeGraphPatch(patch)",
        "bypassedNodes: Array.isArray(patch.bypassedNodes) ? [...patch.bypassedNodes] : []",
        "format: { ...(patch.format || nodeGraphPatchFormat) }",
        "function cloneNodeGraphParamMeta(paramMeta = {})",
        "paramMeta: cloneNodeGraphParamMeta(node.paramMeta)",
        "function nodeGraphDefaultParamMetaForType(type)",
        "function createNodeGraphPatchNode(type, options = {})",
        "node.widthGu = normalizeNodeGraphModuleWidthUnits(type, options.widthGu)",
        "!Object.hasOwn(options, \"ui\")",
        "{ buttonsHidden: true }",
        "!Object.hasOwn(node, \"ui\")",
        "patch.nodes.push(createNodeGraphPatchNode(type",
        "function normalizeNodeGraphPatchParameterMetadata(type, key, metadata = {})",
        "function nodeGraphGridSnapOffset()",
        "return 6;",
        "function normalizeNodeGraphPatchView(view = {})",
        "function normalizeNodeGraphPatchGrid(grid = {})",
        "grid: normalizeNodeGraphPatchGrid(patch.grid)",
        "patch.grid = readNodeGraphGridSettingsView()",
        "nodeScriptGridWidthPxValue",
        "nodeScriptGridHeightPxValue",
        "[data-patch-grid-field]",
        "function withNodeGraphWorkspaceContentAnchored(workspace, update)",
        "function nodeGraphWorkspaceChromeSize(axis)",
        '["borderLeftWidth", "borderRightWidth", "paddingLeft", "paddingRight"]',
        "function nodeGraphWorkspaceWidthCss(widthPx)",
        "function nodeGraphWorkspaceHeightCss(heightPx)",
        "Math.round(widthPx + nodeGraphWorkspaceChromeSize(\"x\"))",
        "Math.round(heightPx + nodeGraphWorkspaceChromeSize(\"y\"))",
        "minHeightGu: 4",
        "minWidthGu: 4",
        "function applyNodeGraphWorkspaceView()",
        "workspace.parentElement?.style.setProperty(\"--node-workspace-view-width\", widthCss)",
        "workspace.parentElement?.style.removeProperty(\"--node-workspace-view-width\")",
        "const contentWidth = Math.max(0, rect.width - nodeGraphWorkspaceChromeSize(\"x\"))",
        "const contentHeight = Math.max(0, rect.height - nodeGraphWorkspaceChromeSize(\"y\"))",
        "function beginNodeGraphWorkspaceResize(event)",
        "function dragNodeGraphWorkspaceResize(event)",
        "drag.startWidthGu + Math.round((event.clientX - drag.startClientX) / nodeGraphGridWidth()) * 2",
        "function endNodeGraphWorkspaceResize(event)",
        "function handleNodeGraphWindowResize()",
        "function beginNodeGraphWorkspacePan(event)",
        "if (event.button !== 1 || event.ctrlKey || event.altKey)",
        "function beginNodeGraphSmoothZoomDrag(event)",
        "const ctrlZoom = event.ctrlKey",
        "const altZoom = event.altKey",
        "event.button !== 1",
        "function preventNodeGraphMiddleMouseDefault(event)",
        "function setNodeGraphPan(x, y)",
        "x: Number.isFinite(Number(x)) ? Number(x) : 0",
        "y: Number.isFinite(Number(y)) ? Number(y) : 0",
        "function alignNodeGraphViewToGrid()",
        "const zoomStep = 1 / Math.max(1, nodeGraphGridSize())",
        "snapPan(unsnappedPan.x, nodeGraphGridWidth())",
        "snapPan(unsnappedPan.y, nodeGraphGridHeight())",
        "View aligned to grid. Hotkey: Ctrl+Shift+G.",
        "event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === \"g\"",
        "function updateNodeGraphGridHeatmap()",
        "nodeGridHeatmap",
        "radial-gradient(ellipse",
        "--node-mouse-light-spread",
        "--node-mouse-light-color-rgb",
        "const mousePoint = nodeGraphMvp.mouseLightPoint",
        "maskLayers.push(",
        "function scheduleNodeGraphGridHeatmapUpdate()",
        "nodeGraphMvp.mouseLightFrame = window.requestAnimationFrame",
        "function updateNodeGraphMouseLight(event)",
        "scheduleNodeGraphGridHeatmapUpdate();",
        "function dragNodeGraphWorkspacePan(event)",
        "function endNodeGraphWorkspacePan(event)",
        "function preventNodeGraphMiddleMouseAuxClick(event)",
        "function nodeGraphGridToPixel(point)",
        "function nodeGraphPixelToGrid(point)",
        "function snapNodeGraphPointToGrid(point)",
        "function applyNodeGraphPatchToDom()",
        "function serializeNodeGraphPatch(patch = nodeGraphMvp.patch)",
        "audio: normalizeNodeGraphPatchAudio(patch.audio)",
        "bypassedNodes: patch.bypassedNodes || []",
        "function nodeGraphRuntimeBypassedNodeIds(patch = nodeGraphMvp.patch)",
        "node.type === \"audioInput\"",
        "format: { ...nodeGraphPatchFormat }",
        "unsupported patch format",
        "view.widthGu must be 0 or at least",
        "view: normalizeNodeGraphPatchView(patch.view)",
        "output module id must be output",
        "output module cannot be bypassed",
        "patchNode.paramMeta?.[parameter.key]",
        "function normalizeNodeGraphPatchParameter(type, key, value, metadata = null)",
        "function nodeGraphReadPatchParameterValue(node, key)",
        "function nodeGraphReadPatchParameterMetadata(node, key)",
        "function nodeGraphPatchChoiceLabel(metadata, value)",
        "function loadNodeGraphPatchFromScript(text)",
        "script JSON parse failed:",
        "script validation failed:",
        "function commitNodeGraphPatch(patch, options = {})",
        "function nodeGraphPatchScriptStatus(message = \"script synced\", ok = true)",
        "message: `${message}; schedule blocked`, ok: false",
        "scriptCommitDelayMs: 250",
        "scriptDirty: false",
        "scriptCommitTimer: 0",
        "function clearNodeGraphScriptCommitTimer()",
        "function scheduleNodeGraphScriptCommit(text)",
        "nodeGraphMvp.scriptDirty = true",
        "setNodeGraphScriptStatus(\"script editing\", true)",
        "function flushNodeGraphScriptCommit()",
        "function nodeGraphScriptReadyForGraphAction(action = \"graph action\")",
        "Fix script before ${action}",
        "function markNodeGraphRenderScriptBlocked()",
        "labelPrimaryAudioTitle(\"Fix script before rendering\", false)",
        "function markNodeGraphLiveScriptBlocked()",
        "fix script before live audio",
        "function clearNodeGraphRenderScriptBlock()",
        "function clearNodeGraphLiveScriptBlock()",
        "function clearNodeGraphScriptBlockedActions()",
        "clearNodeGraphScriptBlockedActions();",
        "schedule blocked: fix script before live audio",
        "nodeGraphScriptReadyForGraphAction(\"render\")",
        "nodeGraphScriptReadyForGraphAction(\"live audio\")",
        "nodeGraphScriptReadyForGraphAction(\"save\")",
        "nodeGraphScriptReadyForGraphAction(\"undo\")",
        "nodeGraphScriptReadyForGraphAction(\"redo\")",
        "if (mode !== \"script\")",
        "function recordNodeGraphHistory()",
        'undo.removeAttribute("title")',
        'redo.removeAttribute("title")',
        "function undoNodeGraphPatch()",
        "function redoNodeGraphPatch()",
        "function setNodeGraphViewMode(mode)",
        "const settingsMode = mode === \"settings\"",
        "const shopMode = mode === \"shop\"",
        "const departmentMode = shopMode && Boolean(nodeGraphMvp.moduleStoreDepartment)",
        "const shopLandingMode = shopMode && !departmentMode",
        "const mappingMode = mode === \"mapping\"",
        "nodeMappingView",
        "nodeMappingViewButton",
        "renderNodeGraphMappingView()",
        "setNodeGraphViewMode(\"mapping\")",
        "closeNodeGraphModuleCollectionsMenu()",
        "nodeModuleShopView",
        "nodeModuleDepartmentView",
        "nodeModuleShopButton",
        "setNodeGraphViewMode(shopVisible ? \"modular\" : \"shop\")",
        "const closeNodeGraphModuleBrowser = () =>",
        "closeNodeGraphModuleCollectionsMenu();",
        "nodeModuleShopClose",
        "nodeModuleDepartmentClose",
        "nodeModuleDepartmentSearchShell",
        "openNodeGraphModuleCollectionsMenu",
        "nodeModuleCollectionsClose",
        "handleNodeGraphModuleCollectionsPointerDown",
        "setNodeGraphViewMode(\"modular\")",
        "nodeSettingsViewButton",
        "settingsVisible ? \"modular\" : \"settings\"",
        "nodeSettingsView",
        "function handleNodePatchScriptInput(event)",
        "scheduleNodeGraphScriptCommit(event.currentTarget.value)",
        "function copyNodeGraphScriptToClipboard()",
        "navigator.clipboard.writeText(text)",
        "function pasteNodeGraphScriptFromClipboard()",
        "navigator.clipboard.readText()",
        "commitNodeGraphScript(text)",
        "function confirmNodeGraphDefaultButtonClick(button, statusCallback)",
        "function nodeGraphDefaultButtonLabel(button)",
        "function nodeGraphDefaultButtonHtml(button)",
        "button.dataset.confirmDefaultHtml",
        "button.textContent = \"Confirm Default\"",
        "function flashNodeGraphDefaultButtonSaved(button)",
        "button.textContent = \"Saved\"",
        "button.innerHTML = originalHtml || originalText",
        "void button.offsetWidth",
        "function updateDefaultNodeGraphPreset()",
        "function handleUpdateDefaultNodeGraphPresetClick(event)",
        "flashNodeGraphDefaultButtonSaved(event.currentTarget);\n  await updateDefaultNodeGraphPreset();",
        "flashNodeGraphDefaultButtonSaved(event.currentTarget);\n  await updateDefaultNodeUiDevSettingsPreset();",
        'fetch("/api/presets/default"',
        "nodeGraphScriptReadyForGraphAction(\"update default\")",
        "nodeGraphMvp.defaultPatch = cloneNodeGraphPatch(nodeGraphMvp.patch)",
        "updateDefaultPresetButton",
        "function nodeGraphPatchFileName()",
        "const tagName = info.tags && info.tags !== \"tags\"",
        "function saveNodeGraphScript()",
        "function loadNodeGraphScript()",
        "function handleNodeGraphScriptFileLoad(event)",
        'field.addEventListener("change", commitNodeGraphSettingsHistory)',
        "serializeNodeGraphPatch()",
        "function syncNodeGraphPatchMetadataFromSlider(slider, options = {})",
        "syncNodeGraphPatchParameterFromSlider(slider)",
        "window.setTimeout(() => URL.revokeObjectURL(url), 0)",
        "loadNodeGraphPatchFromScript(String(reader.result || \"\"))",
        "readAsText(file)",
        "[data-patch-info-field]",
        "[data-patch-audio-field]",
        "modulations: []",
        "patch.modulations || []",
        "nodeGraphMvp.patch.modulations.map",
        "function createNodeParameterModulationPort(node, type, parameter)",
        "function createNodeParameterOutputPort(node, type, parameter)",
        "function createNodeGraphIoColumn(node, type, ports, io)",
        "node-param-port modulation-input",
        "node-param-port parameter-output node-port output",
        "row.dataset.node = node",
        "row.dataset.port = port",
        "row.dataset.io = io",
        "dataset.io = \"modulation\"",
        "dataset.io = \"output\"",
        "button.dataset.alias = nodeGraphLabel(node, port)",
        "button.dataset.alias = `${nodeGraphNodeDisplayName(node)}.${parameter.key} slider`",
        "button.dataset.alias = `${nodeGraphNodeDisplayName(node)}.${parameter.key} mod`",
        "function ensureNodeGraphDragHandle(node)",
        "function handleNodeGraphIoRowWirePointerDown(event)",
        "function attachNodeGraphNodeEvents(node)",
        'for (const row of node.querySelectorAll(".node-io-row"))',
        'for (const port of node.querySelectorAll(".node-param-port.modulation-input"))',
        "function createNodeGraphModuleElement(type, node)",
        "function createNodeGraphTextBoxBody(node)",
        "function syncNodeGraphTextBoxElement(element, patchNode)",
        "function syncNodeGraphTextBoxContentAlignment(field",
        "function nodeGraphTextBoxWidthFitScale(field",
        "function syncNodeGraphTextBoxVisualFit(field",
        "lineCount * lineHeight",
        "const nodeGraphTextBoxFitLayouts = new WeakMap()",
        "function scheduleNodeGraphTextBoxVisualFit(field, layout = normalizeNodeGraphTextBoxLayout())",
        "requestAnimationFrame(syncIfConnected)",
        "document.fonts?.ready?.then(() => requestAnimationFrame(syncIfConnected))",
        "function observeNodeGraphTextBoxVisualFit(field, layout = normalizeNodeGraphTextBoxLayout())",
        "nodeGraphTextBoxResizeObserver = new ResizeObserver",
        "observeNodeGraphTextBoxVisualFit(field, layout)",
        "function handleNodeGraphTextBoxWheel(event)",
        'replacement.addEventListener("pointerdown", (event) => {',
        "event.preventDefault();\n      event.stopPropagation();",
        "replacement.readOnly = true",
        "replacement.tabIndex = -1",
        'replacement.addEventListener("wheel", handleNodeGraphTextBoxWheel, { passive: false })',
        'const desiredTag = "TEXTAREA"',
        "function setNodeGraphTextBoxModeFromContext(textMode)",
        "function setNodeGraphTextBoxTextFromContext",
        "function nodeGraphTextBoxOneLineText(value)",
        "function normalizeNodeGraphTextBoxHorizontalAlign(value)",
        "function normalizeNodeGraphTextBoxVerticalAlignPercent(value)",
        "function normalizeNodeGraphTextBoxTextSizePercent(value)",
        "textSizePercent: normalizeNodeGraphTextBoxTextSizePercent",
        'return ["left", "center", "right"].includes(align) ? align : "center"',
        "horizontalAlign: normalizeNodeGraphTextBoxHorizontalAlign",
        "verticalAlignPercent: normalizeNodeGraphTextBoxVerticalAlignPercent",
        "function setNodeGraphTextBoxHorizontalAlignFromContext(value)",
        "function setNodeGraphTextBoxVerticalAlignFromContext",
        "function normalizeNodeGraphPatchNodeUi(ui = {})",
        "function normalizeNodeGraphPatchNodeAlias(alias)",
        "function nodeGraphPatchNodeTitle(node)",
        "function setNodeGraphModuleAliasFromContext",
        "function toggleNodeGraphModuleButtonsFromContext()",
        "function toggleNodeGraphModuleTitleFromContext()",
        "targetNode.alias = alias",
        "delete targetNode.alias",
        "buttonsHidden",
        "titleHidden",
        "node-text-box-body",
        "node-text-box-input",
        "body.dataset.textVerticalAlign",
        "field.dataset.textAlign",
        "--node-text-box-font-scale",
        "--node-text-box-content-offset",
        "function nodeGraphModuleBodyRowCount(type)",
        "return definition?.parameters?.length || 0",
        "function nodeGraphModuleVisibleBodyRowCount(type)",
        "return nodeGraphModuleBodyRowCount(type)",
        "function nodeGraphModuleGridWidthUnits(type)",
        "const nodeGraphModuleWidthLimits",
        "function normalizeNodeGraphModuleWidthUnits(type, widthGu)",
        "function normalizeNodeGraphTextBoxHeightUnits(heightGu)",
        "function nodeGraphPatchNodeGridWidthUnits(node)",
        "function nodeGraphPatchNodeGridHeightUnits(node)",
        "const nodeGraphModuleLayout",
        "bodyRowGapGu: 1 / 28",
        "ioPaddingYGu: 4 / 28",
        "ioRowGapGu: 1 / 28",
        "ioSectionMinHeightGu: 24 / 28",
        "moduleScopeHeightGu: 2",
        "textBoxBodyMinGu: 4",
        "function nodeGraphModuleSliderBodyHeightGu(type)",
        "if (rows <= 0)",
        "function nodeGraphModuleIoRowCount(type)",
        "function nodeGraphModuleIoSectionHeightGu(type)",
        "function nodeGraphModuleRequiredHeightUnits(type)",
        "function nodeGraphModuleGridHeightUnits(type)",
        "const roughGridUnits = 4 + nodeGraphModuleVisibleBodyRowCount(type) * 1.25",
        "Math.max(roughGridUnits, requiredGridUnits)",
        "function createNodeGraphSliderWidgetBody(node, type)",
        "slider-widget-layout",
        "node-slider-widget-body",
        "node-slider-widget-row",
        "node-slider-widget-io-section",
        "if (definition.parameters?.length && definition.layout !== \"sliderWidget\")",
        "node-header-actions",
        "node-header-title-row",
        "node-header-title",
        "node-action-button",
        "node-bypass-button",
        "function nodeGraphBypassGlyph(bypassed)",
        'return "\\u{1F5F2}"',
        "bypassButton.textContent = nodeGraphBypassGlyph(bypassed)",
        "node-execution-order-badge",
        "toggleNodeGraphModuleBypass",
        "adjustNodeGraphModuleWidthFromContext",
        "adjustNodeGraphTextBoxHeightFromContext",
        "adjustNodeGraphTextBoxTextSizeFromContext",
        'nodeGraphApplyTooltip(actionButton, "module.actionsTitle", {}, { title: false })',
        "--node-grid-width-units",
        "--node-grid-height-units",
        "function registerExistingNodeGraphNodes()",
        "metadataEditorTarget",
        "metadataDragging",
        "metadataPopoverPosition",
        "moduleActionWindowPosition",
        "function syncNodeGraphPatchWindowPosition(key, position)",
        "function setNodeSliderMetadata(slider, metadata)",
        "function normalizedNodeSliderMid(slider)",
        "function nodeSliderSkewExponent(slider)",
        "function nodeSliderShouldUseNonlinearSlider(slider)",
        "function nodeSliderValueFromTravel(slider, travel)",
        "function nodeSliderTravelFromValue(slider, value)",
        "function wrapNodeSliderValue(value, min, max)",
        "function shortestNodeGraphWrapDelta(from, to, min, max)",
        "function createNodeGraphParameterSmoother(initialValue",
        "function updateNodeGraphParameterSmoother(smoother",
        "function readNodeGraphSmoothedParameter(smoother, frame, frames)",
        "function finishNodeGraphParameterSmoothing(smoothers)",
        "function normalizeNodeSliderValue(slider, value",
        "function openNodeMetadataPopover(event, readout)",
        "function beginNodeMetadataPopoverDrag(event)",
        "function dragNodeMetadataPopover(event)",
        "function endNodeMetadataPopoverDrag(event)",
        "nodeGraphMvp.metadataPopoverPosition = { left, top }",
        "savedPosition?.left ?? event.clientX",
        "savedPosition?.top ?? event.clientY",
        "function populateNodeMetadataKindChoices()",
        "function readNodeMetadataEditorValues(slider)",
        "function syncNodeMetadataMidVisibility()",
        "function applyNodeMetadataEditor()",
        "function closeNodeMetadataPopover()",
        "function closeNodeSceneContextMenu()",
        "function positionNodeSceneContextMenu(menu, x, y, remember = false)",
        "function positionNodeScopeContextMenuAtSavedOr(menu, x, y)",
        "function beginNodeSceneContextMenuDrag(event)",
        "function dragNodeSceneContextMenu(event)",
        "function endNodeSceneContextMenuDrag(event)",
        "function beginNodeScopeContextMenuDrag(event)",
        "function dragNodeScopeContextMenu(event)",
        "function endNodeScopeContextMenuDrag(event)",
        "function stopNodeGraphRenderedPlayback()",
        "stopNodeGraphRenderedPlayback();",
        "function markNodeGraphRenderPending(summary = \"\")",
        "clearNodeGraphRenderedModuleScopeBuffers();",
        "function nodeGraphOutputClipCountText(count = 0)",
        "function nodeGraphClampOutputSample(value)",
        "function nodeGraphOutputSampleClipped(value)",
        "!Number.isFinite(Number(value))",
        "function nodeGraphOnePoleHighPassCoefficients(frequency, sampleRate)",
        "0.000142475857",
        "const b0 = 0.5 * (1 + a1)",
        "return { a1, b0, b1: -b0 }",
        "function createNodeGraphEarProtector(sampleRate = nodeGraphMvp.sampleRate",
        "function nodeGraphEarProtectionIsTripped()",
        "function nodeGraphTripEarProtection(details = {})",
        "nodeGraphApplyEarProtectionFaultUi(details)",
        "const nodeGraphEarProtectionPatchRecoveryStorageKey",
        "function nodeGraphEarProtectionRecoveryStores()",
        "function nodeGraphSaveEarProtectionPatchRecovery(details = {})",
        "function nodeGraphConsumeEarProtectionPatchRecovery()",
        "nodeGraphSaveEarProtectionPatchRecovery(details)",
        "ear protection patch restored",
        "Refresh the page, your patch will be saved.",
        'nodeGraphTripEarProtection({ source: "manual", protectionMuteCount: 1 })',
        "setNodeGraphAudioStats();",
        "audioStats.dataset.renderClips = String(clipCount)",
        "audioStats.dataset.renderProtectionMutes = String(protectionMuteCount)",
        "audioStats.dataset.renderBadNumbers = String(badNumberCount)",
        "nodeGraphOutputClipCountText(clipCount)",
        "ear protection muted",
        "outputSummary.textContent = summary",
        "drawNodeRenderedAudio();",
        "function setNodeMetadataDefaultsFromKind()",
        "const template = nodeMetadataKindTemplates[kind] || nodeMetadataKindTemplates.decimal",
        "const choices = template.choices || []",
        "document.getElementById(\"metadataMinValue\").value = String(template.min)",
        "document.getElementById(\"metadataMidValue\").value = String(template.mid)",
        "document.getElementById(\"metadataMaxValue\").value = String(template.max)",
        "document.getElementById(\"metadataMaxDigitsValue\").value =",
        "document.getElementById(\"metadataUnitValue\").value = template.unit",
        "document.getElementById(\"metadataChoicesValue\").value = formatNodeMetadataChoices(choices)",
        "function handleNodeMetadataKindChange()",
        "metadataSetDefaultButton",
        'classList.add("armed")',
        'classList.remove("armed")',
        "function handleNodeMetadataEditorInput()",
        "metadataNonlinearSliderValue",
        "nodeParameterMetadataPopover",
        "metadataPopoverDragHandle",
        "sceneContextPoint",
        "function positionNodeGraphNode(node, point, options = {})",
        "function openNodeSceneContextMenu(event)",
        "modulePlacement: null",
        "function showNodeGraphModule(node, point = null, options = {})",
        "return id",
        "function beginNodeGraphModulePlacement(type, point = null)",
        "function dragNodeGraphModulePlacement(event)",
        "function completeNodeGraphModulePlacement(event)",
        "finishNodeGraphModulePlacementAtCurrentPosition()",
        "clearNodeGraphSelection();",
        'element?.classList.add("placing", "dragging")',
        'commitNodeGraphPatch(patch, { status: options.status || "module added" })',
        "function nodeGraphFindCopiedModuleGridPoint(sourceNode, nodes = nodeGraphMvp.patch.nodes)",
        "function nodeGraphPatchNodeGridRect(node)",
        "function nodeGraphBypassedNodeIds(patch = nodeGraphMvp.patch)",
        "function nodeGraphNodeIsBypassed(nodeId, patch = nodeGraphMvp.patch)",
        "function nodeGraphGridRectsOverlap(a, b)",
        "function addNodeGraphModuleFromContext(event)",
        "const nodeGraphModuleStoreTypes = Object.freeze([",
        "\"distortionOscillator\"",
        "\"dsfOscillator\"",
        "\"ellipsoid\"",
        "\"polyBlep\"",
        "\"sineWavetable\"",
        "\"jerobeamNyqistShannon\"",
        "\"additiveEngine\"",
        "\"harmonicBank\"",
        "\"drumMachine\"",
        "\"kickDrum\"",
        "\"snareDrum\"",
        "\"clock\"",
        "\"clockDivider\"",
        "\"delayedTrigger\"",
        "\"randomClock\"",
        "\"triggerCounter\"",
        "\"triggerDivider\"",
        "\"stepSequencer\"",
        "\"melodySequencer\"",
        "\"chordSequencer\"",
        "\"arpeggiator\"",
        "\"stereoNoise\"",
        "\"noiseGenerator\"",
        "\"randomWalk\"",
        "\"fractalBrownianNoise\"",
        "\"highpass\"",
        "\"lowpass\"",
        "\"bandpass\"",
        "\"ladderFilter\"",
        "\"slewLimiter\"",
        "\"delayEffect\"",
        "\"reverbEffect\"",
        "\"distortionEffect\"",
        "\"sampleHold\"",
        "\"lorenzAttractor\"",
        "\"rosslerAttractor\"",
        "\"chuaAttractor\"",
        "\"aizawaAttractor\"",
        "\"thomasAttractor\"",
        "\"halvorsenAttractor\"",
        "\"digitalCurveEnvelope\"",
        "\"expAdsr\"",
        "\"linearEnvelope\"",
        "\"pluckEnvelope\"",
        "\"vactrolEnvelope\"",
        "\"flowerChildEnvelopeFollower\"",
        "\"bloomGlow\"",
        "\"rgbaHsla\"",
        "\"chromaColor\"",
        "\"visualOscilloscope\"",
        "\"sandboxVisuals\"",
        "\"parabol\"",
        "\"vibratoGenerator\"",
        "\"wowAndFlutter\"",
        "\"macroKnob\"",
        "\"bipolarKnob\"",
        "\"valueSlider\"",
        "\"rangeSlider\"",
        "\"midiOut\"",
        "\"midiNotePitch\"",
        "\"midiController\"",
        "\"keyboardController\"",
        "\"macroControls\"",
        "\"pitchModWheel\"",
        "\"xyPad\"",
        "\"samplePlayer\"",
        "\"sampleLooper\"",
        "\"badvalMonitor\"",
        "\"Debug\"",
        "Debug: {",
        'category: "Debug"',
        "Visual: {",
        'category: "Visual"',
        "Screen Visuals",
        "Image",
        "Visual Oscilloscope",
        "shake input",
        "scope pause",
        "trace texture",
        "square scope",
        "function renderNodeGraphModuleStoreCatalog()",
        "function createNodeGraphModuleDepartmentButton(department, entries)",
        "function setNodeGraphModuleStoreDepartment(department = \"\")",
        "function createNodeGraphModuleStorePreview(entry)",
        "function appendNodeGraphModuleStoreNotes(target, entry)",
        "function saveNodeGraphSelectionAsModuleGroup()",
        "function addNodeGraphModuleGroupFromBrowser(name)",
        "function openNodeGraphModuleCollectionsMenu(event)",
        "function closeNodeGraphModuleCollectionsMenu()",
        "function handleNodeGraphModuleCollectionsPointerDown(event)",
        "positionNodeSceneContextMenu(",
        "const nodeGraphModuleGroupStorageKey",
        "const nodeGraphModuleCatalogVisibilityStorageKey",
        "function loadNodeGraphModuleCatalogVisibilityLocal()",
        "function saveNodeGraphModuleCatalogVisibilityLocal(value = nodeGraphModuleCatalogVisibility())",
        "data-context-group",
        "data-store-department",
        "data-store-back",
        "data-store-toggle-module",
        "scene-context-store-preview",
        "scene-context-store-preview-shell",
        "scene-context-store-preview-core",
        "scene-context-store-manual-note",
        "setAttribute(\"role\", \"img\")",
        "function setNodeGraphModuleCatalogVisibility(type, visible)",
        "const nodeGraphModuleStoreDepartments = Object.freeze([",
        "\"Oscillator\"",
        "\"Additive Engines\"",
        "\"Drum Machines\"",
        "\"Filter\"",
        "\"Effects\"",
        "\"Clock\"",
        "\"Melody Sequencer\"",
        "\"Chord Sequencer\"",
        "\"Arpeggiator\"",
        "\"Time\"",
        "\"Dynamics\"",
        "\"Envelope Systems\"",
        "\"Modulators\"",
        "\"Knobs\"",
        "\"Sliders\"",
        "\"Controllers\"",
        "\"Samples\"",
        "\"Random\"",
        "\"Chaos\"",
        "function createNodeGraphModuleStoreDepartmentHeading(department)",
        "DistortionOscillator",
        "DSFOscillator",
        "Ellipsoid",
        "PolyBLEP",
        "Sinewavetable",
        "JerobeamNyqistShannon",
        "AdditiveEngine",
        "HarmonicBank",
        "DrumMachine",
        "KickDrum",
        "SnareDrum",
        "MelodySequencer",
        "ChordSequencer",
        "Arpeggiator",
        "DelayEffect",
        "ReverbEffect",
        "DistortionEffect",
        "DigitalCurveEnvelope",
        "ExponentialEnvelope",
        "LinearEnvelope",
        "PluckEnvelope",
        "Parabol",
        "VibratoGenerator",
        "WowAndFlutter",
        "MacroKnob",
        "BipolarKnob",
        "Value Slider",
        "rangeSlider",
        "MIDIController",
        "MIDI Keyboard",
        "XYPad",
        "SamplePlayer",
        "SampleLooper",
        "LorenzAttractor",
        "RosslerAttractor",
        "ChuaAttractor",
        "AizawaAttractor",
        "ThomasAttractor",
        "HalvorsenAttractor",
        "moduleCatalogVisibility",
        "moduleStoreDepartment",
        "view.moduleCatalogVisibility",
        "nodeTypeCounts",
        "slider.dataset.mid",
        "slider.dataset.default",
        "slider.dataset.step",
        'slider.step = "any"',
        "slider.dataset.kind",
        "slider.dataset.unit",
        "slider.dataset.choices",
        "slider.dataset.displayChoices",
        "slider.dataset.divideChoicesVisibly",
        "slider.dataset.linearSmoothing",
        "slider.dataset.nonlinearSlider",
        "slider.dataset.showSign",
        "slider.dataset.wraparound",
        "function beginNodeSliderReadoutEdit(readout)",
        "function commitNodeSliderReadoutEdit(input)",
        'input.type = "text"',
        'input.inputMode = "text"',
        "const normalizedValue = String(rawValue).trim()",
        "const choiceIndex = nodeSliderChoiceIndexFromText(slider, normalizedValue)",
        "const value = choiceIndex ?? parseNodeSliderMathExpression(normalizedValue)",
        "function quantizeNodeSliderDragValue(slider, value)",
        "function setNodeSliderValue(slider, value)",
        "function nodeSliderSegmentValueFromPointer(slider, surface, clientX)",
        "function setNodeChoiceSliderFromPointer(slider, surface, clientX)",
        "function nodeSliderValueFromPointer(slider, surface, clientX)",
        "function nodeSliderFineTuneScale(event)",
        "event.ctrlKey && event.shiftKey",
        "return 0.001",
        "return 0.01",
        "return 0.1",
        "function reanchorNodeSliderDragAtPointer(drag, event)",
        "const resetToDefaultOnClick = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey",
        "const pointerMode = event.altKey ? \"absolute\" : \"relative\"",
        "pointerMode === \"absolute\"",
        "pointerMode,",
        "fineScale: nodeSliderFineTuneScale(event)",
        "resetToDefaultOnClick,",
        "drag.resetToDefaultOnClick && !drag.moved",
        "setNodeSliderValue(drag.slider, Number(drag.slider.dataset.default))",
        "parameter reset to default",
        "drag.fineScale",
        "Math.floor(progress * choices.length)",
        "syncNodeGraphPatchParameterFromSlider(slider, { deferUi: true })",
        "function populateNodeSliderReadoutShell(readout)",
        "markNodeGraphRenderPending();",
        "function beginNodeSliderDrag(event)",
        "function dragNodeSlider(event)",
        "function endNodeSliderDrag(event)",
        "let startTravel = nodeSliderTravelFromValue(slider, Number(slider.value))",
        "!resetToDefaultOnClick && nodeSliderShouldDisplayChoices(slider)",
        "setNodeChoiceSliderFromPointer(slider, surface, event.clientX)",
        "startTravel = nodeSliderTravelFromValue(slider, Number(slider.value))",
        "if (drag.pointerMode === \"absolute\")",
        "nodeSliderValueFromPointer(drag.slider, drag.surface, event.clientX)",
        "const verticalDelta = drag.startY - event.clientY",
        "const visualTravelWidth = Math.max(1, drag.width * (Number(drag.visualScale) || 1))",
        "const travelDelta = ((horizontalDelta + verticalDelta) / visualTravelWidth) * drag.fineScale",
        "const nextTravel = drag.startTravel + travelDelta",
        "nodeSliderValueFromTravel(drag.slider, nextTravel)",
        "reanchorNodeSliderDragAtPointer(drag, event)",
        'document.body.classList.add("node-slider-dragging")',
        'document.body.classList.remove("node-slider-dragging")',
        'document.addEventListener("mousemove", dragNodeSlider)',
        'document.addEventListener("mouseup", endNodeSliderDrag)',
        'readout.addEventListener("contextmenu"',
        "node-slider-readout",
        "node-slider-readout-portal",
        "node-slider-readout-value",
        "node-slider-readout-unit",
        "function syncNodeSliderPortalHandle",
        "function nodeSliderChoiceDividerBackground",
        "function nodeSliderChoiceSquareRects",
        "function syncNodeSliderChoiceDebugSquares",
        "readout.classList.toggle(\"wraparound-slider\"",
        "nodeSliderShouldWraparound(slider) && !usesChoices",
        "unitText.classList.toggle(\"is-empty\", !unit)",
        "readout.dataset.choiceCount = usesChoices ? String(choices.length) : \"0\"",
        "readout.classList.toggle(\"choices-divided\", dividesChoices)",
        "--value-start",
        "--value-end",
        "readout.style.setProperty(\"--choice-divider-background\"",
        "function nodeGraphValidate()",
        "function nodeGraphModuleOutputPorts(type)",
        "function nodeGraphParameterOutputPort(type, port)",
        "function compileNodeGraphExecutionPlan(patch = nodeGraphMvp.patch)",
        "const passthroughTypes = new Set([\"badvalMonitor\", \"bandpass\", \"bias\", \"cookbookFilter\", \"gain\", \"highpass\", \"ladderFilter\", \"lowpass\", \"sampleHold\", \"slewLimiter\"])",
        "nodeGraphModuleDefinitions[node.type]?.visualSink",
        "nodeGraphModuleDefinitions[node.type]?.monitorSink",
        "function nodeGraphCompiledVisualSinks(graph, reachableNodes)",
        "const visualSinks = nodeGraphCompiledVisualSinks(graph, reachableNodes)",
        "function nodeGraphActiveVisualSinkExists(visualSinks = [])",
        "sink.hasParameters || (sink.inputs || []).some",
        "hasParameters: (nodeGraphModuleDefinitions[node.type]?.parameters || []).length > 0",
        "function nodeGraphValidateRuntimeRoute(issues, options = {})",
        "type !== \"visualOscilloscope\"",
        "const hasActiveVisualSink = nodeGraphActiveVisualSinkExists(visualSinks)",
        "nodeGraphValidateRuntimeRoute(issues, {",
        "const nodeGraphMidiKeyboardMinOctave = -4",
        "const nodeGraphMidiKeyboardMaxOctave = 4",
        "function nodeGraphMidiKeyboardSignalFromRaw(rawMidi, options = {})",
        "function renderNodeGraphMidiKeyboardKeyLabels()",
        "nodeGraphMidiKeyboardPitchLabel(nodeGraphMidiKeyboardShiftMidi(rawMidi, octave))",
        "function changeNodeGraphMidiKeyboardOctave(delta)",
        "rawMidi",
        "octave",
        'type !== "bloomGlow"',
        'type !== "chromaColor"',
        'type !== "keyboardController"',
        'type !== "midiNotePitch"',
        'type !== "midiOut"',
        'type !== "rgbaHsla"',
        'type !== "sandboxVisuals"',
        'type === "keyboardController"',
        "function compileValidatedNodeGraphExecutionPlan(patch = nodeGraphMvp.patch)",
        "function nodeGraphBuildDependencyMap(patch = nodeGraphMvp.patch)",
        "const bypassedNodes = nodeGraphRuntimeBypassedNodeIds(patch)",
        "bypassedNodes.has(connection.sourceNode) || bypassedNodes.has(connection.destinationNode)",
        "bypassedNodes.has(modulation.sourceNode) || bypassedNodes.has(modulation.destinationNode)",
        "function nodeGraphTopologicalOrder(nodes, dependencies, reachableNodes)",
        "function nodeGraphDependencyPathExists(dependencies, startNode, targetNode)",
        "function nodeGraphNodeOrderIndexes(nodes)",
        "function nodeGraphCompareSchedulingEdges(a, b)",
        "function nodeGraphSchedulingEdge(sourceNode, destinationNode, kind, index, payload, nodeOrder)",
        "function nodeGraphBuildSchedulingDependencies(planGraph, reachableNodes)",
        "const orderDependencies = new Map",
        "const nodeOrder = nodeGraphNodeOrderIndexes(planGraph.nodes)",
        "const schedulingEdges = []",
        "const validSignalWires = new Set",
        "for (const [index, connection] of planGraph.connections.entries())",
        "nodeGraphDependencyPathExists(orderDependencies, edge.sourceNode, edge.destinationNode)",
        "for (const [index, modulation] of planGraph.modulations.entries())",
        "schedulingEdges.sort(nodeGraphCompareSchedulingEdges)",
        "nodeGraphTopologicalOrder(graph.nodes, scheduling.orderDependencies, reachableNodes)",
        "function readNodeGraphRuntimeOutput(runtime, frameValues, nodeId, port = \"Out\")",
        "output[port] ?? output.Out",
        "function readNodeGraphRuntimePortOutput(runtime, frameValues, nodeId, port = \"Out\"",
        "function normalizeNodeGraphParameterOutputValue(value, metadata = {})",
        "function nodeGraphSignalWireIdentity(connection)",
        "function nodeGraphModulationWireIdentity(modulation)",
        "function nodeGraphFeedbackIdentitySets(plan)",
        "function nodeGraphActiveNodeIds(plan)",
        "function nodeGraphPlanBypassedNodeIds(plan)",
        "function nodeGraphWireTouchesBypassed(wire, plan)",
        "function nodeGraphActiveSignalConnections(plan)",
        "function nodeGraphActiveModulations(plan)",
        "function nodeGraphInactiveWireReads(plan)",
        "function nodeGraphExecutionWireReads(plan)",
        "function nodeGraphExecutionWireRows(plan)",
        "function nodeGraphWireModeHelp(mode)",
        "function renderNodeGraphExecutionSummarySelection()",
        "function markNodeGraphPortConnected(node, port, io)",
        "function markNodeGraphModulationPortConnected(node, parameter)",
        'port.classList.remove("connected-port")',
        'markNodeGraphPortConnected(connection.sourceNode, connection.sourcePort, "output")',
        'markNodeGraphModulationPortConnected(modulation.destinationNode, modulation.destinationParam)',
        "function nodeGraphStateReadCount(plan)",
        "function nodeGraphStateReadText(count)",
        "function nodeGraphActiveNodeText(plan)",
        "function nodeGraphActiveWireCount(plan)",
        "function nodeGraphPatchWireCount(plan)",
        "function nodeGraphActiveWireText(plan)",
        "Execution model: single-pass stored-output",
        "connections: graph.connections",
        "inactiveNodes,",
        "modulations: graph.modulations",
        "reachableNodes: [...reachableNodes]",
        "speakerOutputActive: hasOutputNode && hasOutputSpeakerInput",
        "visualSinks,",
        "function nodeGraphExecutionParameterSnapshot(plan)",
        "const nodesById = new Map((plan.nodes || []).map",
        "function nodeGraphLastRenderDebug()",
        "function nodeGraphRuntimeBoundaryDebug(plan)",
        "function nodeGraphSoemdspRuntimeMapping(plan)",
        "nodeGraphSoemdspObjectConcept",
        "Binding syncs parameter/control memory; DSP objects do not know Circuit",
        "Circuit/patch describes nodes, parameters, and raw connections; it does not own concrete DSP objects",
        "Compiler filters authoring state and emits order, active wires, parameter bindings, and state-read edges",
        "Caller owns concrete DSP objects and invokes them in compiled order",
        "soemdspMapping: nodeGraphSoemdspRuntimeMapping(plan)",
        "soemdspMapping(patch = nodeGraphMvp.patch)",
        "function nodeGraphSoemdspRuntimeSketch(plan)",
        "soemdspRuntimeSketch: nodeGraphSoemdspRuntimeSketch(plan)",
        "soemdspRuntimeSketch(patch = nodeGraphMvp.patch)",
        "processCallerOwnedDspObject(node, externalParameterMemory, storedOutputs);",
        "Binding::apply(circuit, externalParameterMemory);",
        "const sketch = document.getElementById(\"nodeRuntimeSketch\")",
        "const jsonStatus = document.getElementById(\"nodeExecutionJsonStatus\")",
        "const sketchStatus = document.getElementById(\"nodeRuntimeSketchStatus\")",
        "sketch.textContent = plan.valid",
        "runtime sketch blocked:",
        "Caller-owned C++ runtime mapping sketch",
        "function fallbackCopyTextToClipboard(text)",
        "async function copyTextToClipboard(text)",
        "async function copyNodeGraphRuntimeSketch()",
        "async function copyNodeGraphExecutionJson()",
        "navigator.clipboard?.writeText",
        "Clipboard API unavailable",
        "clipboard fallback failed",
        "document.execCommand(\"copy\")",
        "range.selectNodeContents(sketch)",
        "selection.addRange(range)",
        "sketchStatus.textContent = \"selected\"",
        "jsonStatus.textContent = \"selected\"",
        'document.getElementById("nodeCopyExecutionJsonButton").addEventListener("click", copyNodeGraphExecutionJson)',
        'document.getElementById("nodeCopyRuntimeSketchButton").addEventListener("click", copyNodeGraphRuntimeSketch)',
        'nodeGraphTooltipText("actions.copyExecutionJson")',
        'nodeGraphTooltipText("actions.copyRuntimeSketch")',
        'nodeGraphTooltipText("module.executionActive"',
        'nodeGraphTooltipText("module.executionListItem"',
        'nodeGraphTooltipText("module.drag")',
        "item.dataset.executionOrder = String(index + 1)",
        'nodeGraphTooltipText("module.executionBypassed")',
        'nodeGraphTooltipText("module.executionInactive")',
        "slider.removeAttribute(\"title\")",
        "readout.removeAttribute(\"title\")",
        "function nodeGraphPatchFingerprint(patch = nodeGraphMvp.patch)",
        "lastRender: nodeGraphLastRenderDebug()",
        "connectionCount: Number(rendered.connectionCount) || 0",
        "clipCount: Number(rendered.clipCount) || 0",
        "feedbackConnectionCount: Number(rendered.feedbackConnectionCount) || 0",
        "feedbackModulationCount: Number(rendered.feedbackModulationCount) || 0",
        "modulationCount: Number(rendered.modulationCount) || 0",
        "nodeCount: Number(rendered.nodeCount) || 0",
        "matchesCurrentPatch: rendered.patchFingerprint === currentPatchFingerprint",
        "patchFingerprint,",
        "renderNodeGraphExecutionPlanDebug();\n    drawNodeRenderedAudio();",
        "renderNodeGraphExecutionPlanDebug();\n  drawNodeRenderedAudio();",
        "function drawNodeRenderedVisualOutput(options = {})",
        "options.canvas || document.getElementById(\"nodeVisualOutputCanvas\")",
        "const includePlaybackCursor = options.includePlaybackCursor !== false",
        "const updateUi = options.updateUi !== false",
        "function renderNodeVisualOutputMeta(entries = {})",
        "drawNodeRenderedVisualOutput();",
        "canvas.dataset.visualSource = \"node graph rendered audio\"",
        "canvas.dataset.visualMode = visualMode",
        "canvas.dataset.visualModeSetting = visualSettings.mode",
        "canvas.dataset.visualPlaybackFrame",
        "canvas.dataset.visualPlaybackProgress",
        "canvas.dataset.visualPlaybackState",
        "canvas.dataset.visualExportIncludesPlaybackCursor",
        "canvas.dataset.visualExportReady",
        "canvas.dataset.visualPatchFingerprint",
        "canvas.dataset.visualScale = String(visualSettings.scale)",
        "canvas.dataset.visualStyle = visualSettings.style",
        "canvas.dataset.visualTheme = visualSettings.theme",
        "canvas.dataset.visualTrail = String(visualSettings.trail)",
        "context.globalAlpha = visualSettings.trail",
        "function startNodeGraphRenderedPlaybackCursor()",
        "function tickNodeGraphRenderedPlaybackCursor()",
        "function resetNodeGraphRenderedPlaybackCursor(redraw = true)",
        "function nodeGraphRenderedPlaybackFrame(maxFrames = 0)",
        "function nodeGraphVisualOutputFileName(fingerprint = nodeGraphMvp.rendered?.patchFingerprint || nodeGraphPatchFingerprint())",
        "const fingerprintSuffix = fingerprint ? `-${fingerprint}` : \"\"",
        "function setNodeVisualOutputExportReady(ready, title = \"\")",
        "function nodeGraphVisualOutputTargetSize(sourceCanvas = nodeGraphVisualOutputSourceCanvas())",
        "function syncNodeGraphVisualOutputResolutionControls()",
        "function createNodeGraphVisualOutputExportCanvas(options = {})",
        "function saveNodeGraphVisualOutputPng()",
        "function exportNodeGraphVisualOutputWebm(options = {})",
        "function saveNodeGraphRenderedWav()",
        "function exportNodeGraphRenderedMp4(options = {})",
        "function exportNodeGraphRenderedOgg()",
        "function exportNodeGraphRenderedFlac()",
        'document.getElementById("nodeTripEarProtectionButton")',
        'document.getElementById("nodeRenderWavButton").addEventListener("click", saveNodeGraphRenderedWav)',
        'document.getElementById("nodeVisualOutputTargetWidthValue")',
        'document.getElementById("nodeExportVisualVideoButton").addEventListener("click", exportNodeGraphVisualOutputWebm)',
        "const exportCanvas = document.createElement(\"canvas\")",
        "canvas: exportCanvas",
        "includePlaybackCursor: false",
        "updateUi: false",
        'document.getElementById("nodeSaveVisualOutputButton").addEventListener("click", saveNodeGraphVisualOutputPng)',
        "exportCanvas.toBlob((blob) =>",
        "function nodeGraphVisualThemeColors(theme = \"cyan-violet\")",
        "visualTheme.trace",
        "const visualScale = 0.42 * visualSettings.scale",
        "function drawVisualTrace({ lineWidth, strokeStyle })",
        "visualSettings.style === \"points\"",
        "renderNodeVisualOutputMeta({",
        "function serializeNodeGraphExecutionPlanDebug(plan)",
        "function serializeNodeGraphExecutionPlanApiDebug(plan)",
        "currentPatchFingerprint: nodeGraphPatchFingerprint()",
        "function installNodeGraphDebugApi()",
        "window.soemdspSandboxDebug = Object.freeze",
        "compileExecutionPlan(patch = nodeGraphMvp.patch)",
        "compileValidatedNodeGraphExecutionPlan(patch)",
        "currentPatchFingerprint()",
        "lastRender()",
        "live()",
        "function renderNodeGraphExecutionPlanDebug(plan = compileNodeGraphExecutionPlan())",
        "function renderNodeGraphExecutionOrderBadges(plan)",
        "function renderNodeGraphExecutionPlanSummary(plan)",
        "badge.dataset.executionState = \"active\"",
        "badge.dataset.executionState = \"bypassed\"",
        "setNodeGraphSelection({ type: \"wire\", kind: row.kind, index: row.index })",
        "nodeGraphWireModeHelp(row.mode)",
        "item.dataset.connectionKind = row.kind",
        "item.dataset.wireMode = row.mode",
        "const activeNodeText = nodeGraphActiveNodeText(plan)",
        "const activeWireText = nodeGraphActiveWireText(plan)",
        "].filter(Boolean).join(\" / \")",
        "function evaluateNodeGraphPlanFrame(runtime, sampleRate, frame, frames)",
        "function jerobeamSpiralSample(options)",
        "function spiralRender(inX, inY, inZ, zDepth)",
        "function spiralShape(lophas, phasor, dense, div, morph)",
        "function spiralRotate(inX, inY, inZ, rotX, rotY)",
        "function spiralNextPhasor(state, key, frequency, offset, sampleRate, bipolar = false)",
        "spiralStates",
        "function createNodeGraphHighpassState()",
        "function createNodeGraphLowpassState()",
        "function createNodeGraphBandpassState()",
        "function createNodeGraphLadderFilterState()",
        "function createNodeGraphOscResetState()",
        "function createNodeGraphSlewLimiterState()",
        "function createNodeGraphClockState()",
        "function createNodeGraphDelayedTriggerState()",
        "function createNodeGraphSampleHoldState()",
        "function createNodeGraphStepSequencerState()",
        "function createNodeGraphTriggerCounterState()",
        "function createNodeGraphTriggerDividerState()",
        "function createNodeGraphExpAdsrState()",
        "function createNodeGraphLinearEnvelopeState()",
        "function createNodeGraphPluckEnvelopeState()",
        "function createNodeGraphVactrolEnvelopeState()",
        "function createNodeGraphFlowerChildEnvelopeFollowerState()",
        "function createNodeGraphNoiseGeneratorState()",
        "function createNodeGraphRandomWalkState()",
        "function createNodeGraphFractalBrownianNoiseState()",
        "const nodeGraphBadValueExplosionLimit = 999999999",
        "const nodeGraphBadValueDenormalLimit = 1.1754943508222875e-38",
        "function nodeGraphBadValueReason(value)",
        "return \"exploded\"",
        "return \"inf\"",
        "return \"NaN\"",
        "return \"denormal\"",
        "function nodeGraphMarkRuntimeBadNumber(runtime, nodeId, source = \"dsp\")",
        "function nodeGraphSafeFilterNumber(value, runtime, nodeId, state, source)",
        "function nodeGraphVisualControlIntensity(value, runtime, nodeId, source = \"visual control\")",
        "function nodeGraphVisualControlSigned(value, runtime, nodeId, source = \"visual control\")",
        "function nodeGraphVisualHslToRgb(hue, saturation, lightness)",
        "chromaAlpha: 0",
        "chromaHue: 0",
        "chromaSaturation: 0",
        "visualBloom: 0",
        "visualBrightness: 0",
        "visualGlow: 0",
        "function nodeGraphSmoothVisualControl(runtime, key, target, sampleRate, seconds = 0.045, min = 0, max = 1)",
        "function nodeGraphBadValueMonitorSample(value, runtime, nodeId)",
        "function nodeGraphOnePoleHighpassSample(state, input, frequency, sampleRate, runtime = null, nodeId = \"\")",
        "function nodeGraphOnePoleLowpassSample(state, input, frequency, sampleRate, runtime = null, nodeId = \"\")",
        "function nodeGraphOnePoleBandpassSample(state, input, lowFrequency, highFrequency, sampleRate, runtime = null, nodeId = \"\")",
        "function nodeGraphLadderFilterSample(state, input, params, sampleRate, runtime = null, nodeId = \"\")",
        "function nodeGraphLadderFilterCoefficients(frequency, resonance, mode, stages, sampleRate, runtime = null, nodeId = \"\", state = null)",
        "nodeGraphLadderFilterComputeFeedbackFactor",
        "y[0] = coeff.g * safeInput - coeff.k * y[4]",
        "function nodeGraphSlewLimiterSample(state, input, upTime, downTime, sampleRate, runtime = null, nodeId = \"\")",
        "function nodeGraphClockSample(state, rate, duty, level, sampleRate, runtime = null, nodeId = \"\")",
        "function createNodeGraphRandomClockState()",
        "function nodeGraphRandomClockSample(state, reset, params, sampleRate, runtime = null, nodeId = \"\")",
        "function nodeGraphDelayedTriggerSample(state, trigger, reset, params, sampleRate, runtime = null, nodeId = \"\")",
        "function nodeGraphSampleHoldSample(state, input, trigger, threshold, runtime = null, nodeId = \"\")",
        "function nodeGraphStepSequencerSample(state, trigger, reset, params, runtime = null, nodeId = \"\")",
        "function nodeGraphTriggerCounterSample(state, trigger, reset, params, sampleRate, runtime = null, nodeId = \"\")",
        "function nodeGraphTriggerDividerSample(state, trigger, reset, params, sampleRate, runtime = null, nodeId = \"\")",
        "function nodeGraphPluckEnvelopeSample(state, trigger, release, params, sampleRate, runtime = null, nodeId = \"\")",
        "function nodeGraphLinearEnvelopeSample(state, gate, params, sampleRate, runtime = null, nodeId = \"\")",
        "function nodeGraphVactrolEnvelopeCoefficient(seconds, sampleRate)",
        "function nodeGraphVactrolEnvelopeSample(state, light, params, sampleRate, runtime = null, nodeId = \"\")",
        "1 - Math.exp(-1 / samples)",
        "function nodeGraphFlowerChildSecondsToSamples(seconds, sampleRate)",
        "function nodeGraphFlowerChildEnvelopeFollowerSample(state, input, params, sampleRate, runtime = null, nodeId = \"\")",
        "Math.abs(nodeGraphSafeFilterNumber(input",
        "state.holdCounter = holdSamples",
        "function nodeGraphExponentialCurve(value, skew)",
        "function nodeGraphNoiseGeneratorSample(state, params, runtime = null, nodeId = \"\")",
        "function nodeGraphRandomWalkSample(state, params, sampleRate, runtime = null, nodeId = \"\")",
        "function nodeGraphFractalBrownianNoiseAxisState(state, axis)",
        "function nodeGraphFractalBrownianNoiseSample(state, params, sampleRate, runtime = null, nodeId = \"\", axis = \"x\")",
        "function nodeGraphFractalBrownianNoiseVector(state, params, sampleRate, runtime = null, nodeId = \"\")",
        "\"Out X\": nodeGraphFractalBrownianNoiseSample(state, params, sampleRate, runtime, nodeId, \"x\")",
        "\"Out Y\": nodeGraphFractalBrownianNoiseSample(state, params, sampleRate, runtime, nodeId, \"y\")",
        "\"Out Z\": nodeGraphFractalBrownianNoiseSample(state, params, sampleRate, runtime, nodeId, \"z\")",
        "function nodeGraphRationalCurve(value, skew)",
        "function nodeGraphSmoothNoise1d(x, seed)",
        "function nodeGraphExpAdsrCalcCoef(rate, targetRatio)",
        "function nodeGraphExpAdsrSample(state, gate, params, sampleRate, runtime = null, nodeId = \"\")",
        "Math.exp(-Math.log((1 + safeRatio) / safeRatio) / safeRate)",
        "b0 * safeInput + b1 * state.inputBuffer + a1 * state.outputBuffer",
        "b0 * safeInput + a1 * state.outputBuffer",
        'node?.type === "highpass"',
        'node?.type === "lowpass"',
        'node?.type === "bandpass"',
        'node?.type === "slewLimiter"',
        'node?.type === "ladderFilter"',
        'node?.type === "clockDivider"',
        'node?.type === "randomClock"',
        'node?.type === "delayedTrigger"',
        'node?.type === "sampleHold"',
        'node?.type === "midiOut"',
        'node?.type === "midiNotePitch"',
        'node?.type === "keyboardController"',
        'node?.type === "macroControls"',
        'node?.type === "pitchModWheel"',
        'node?.type === "valueSlider"',
        "value = { Bias: offset, Out: offset, offset }",
        'node?.type === "stepSequencer"',
        'node?.type === "triggerCounter"',
        'node?.type === "triggerDivider"',
        'node?.type === "expAdsr"',
        'node?.type === "linearEnvelope"',
        'node?.type === "pluckEnvelope"',
        'node?.type === "vactrolEnvelope"',
        'node?.type === "flowerChildEnvelopeFollower"',
        'node?.type === "sandboxVisuals"',
        'node?.type === "bloomGlow"',
        'node?.type === "rgbaHsla"',
        'node?.type === "chromaColor"',
        '"screen visuals shake"',
        '"sandbox visuals x"',
        '"sandbox visuals y"',
        '"screen visuals dim"',
        '"sandbox visuals red"',
        '"sandbox visuals green"',
        '"sandbox visuals blue"',
        '"screen visuals scope off"',
        'read("screenDim", 0)',
        'read("visualBrightness", 0.55)',
        'read("visualBloom", 0.45)',
        'read("visualGlow", 0.6)',
        '"rgba hsla hsl mix"',
        '"rgba hsla alpha"',
        'read("chromaHue", 0.58)',
        'read("visualBrightness", 0.55)',
        '"Full Value": outputMidiNumber',
        "Normalized: outputMidiNumber / 127",
        "440 * (2 ** ((pitch - 69) / 12))",
        '"Pitch 0-1": pitch / 127',
        '"Pitch 0-127": pitch',
        "const keyboardRate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);",
        "Increment: frequency / keyboardRate",
        "ScopeOff: scopeTracesOff",
        'node?.type === "noiseGenerator"',
        'node?.type === "stereoNoise"',
        'type !== "stereoNoise"',
        'type === "stereoNoise"',
        'node?.type === "randomWalk"',
        'node?.type === "fractalBrownianNoise"',
        'node?.type === "badvalMonitor"',
        "BADVAL Monitor input",
        "runtime.highpassStates",
        "runtime.lowpassStates",
        "runtime.bandpassStates",
        "runtime.cookbookFilterStates",
        "runtime.ladderFilterStates",
        "runtime.slewLimiterStates",
        "runtime.clockStates",
        "runtime.clockDividerStates",
        "runtime.randomClockStates",
        "runtime.delayedTriggerStates",
        "runtime.sampleHoldStates",
        "runtime.stepSequencerStates",
        "runtime.triggerCounterStates",
        "runtime.triggerDividerStates",
        "runtime.expAdsrStates",
        "runtime.linearEnvelopeStates",
        "runtime.pluckEnvelopeStates",
        "runtime.vactrolEnvelopeStates",
        "runtime.flowerChildEnvelopeFollowerStates",
        "function createNodeGraphVisualControlState()",
        "function createNodeGraphNoiseSampleHoldState()",
        "function resetNodeGraphRuntimeVisualControls(runtime)",
        "const visualControlState = createNodeGraphVisualControlState()",
        "resetNodeGraphRuntimeVisualControls(runtime)",
        "runtime.visualControls",
        "runtime.visualControlStates",
        "runtime.noiseGeneratorStates",
        "runtime.noiseSampleHoldStates",
        "nextNodeGraphNoiseSample(runtime, `${nodeId}:left`)",
        "runtime.randomWalkStates",
        "runtime.fractalBrownianNoiseStates",
        "nodeGraphFeedbackText(feedbackConnections = [], feedbackModulations = [])",
        "renderNodeGraphExecutionPlanDebug(plan)",
        "function nodeGraphRenderPendingSummary()",
        "function renderedNodeGraphWavBlob(rendered)",
        "function syncNodeGraphRenderedAudioElement()",
        "function setNodeGraphAudioStats(peak = 0, rms = 0, details = {})",
        "audioStats.dataset.renderFrames = String(frames)",
        "audioStats.dataset.renderStateReads = String(stateReadCount)",
        "const earProtector = createNodeGraphEarProtector(engineSampleRate)",
        "const protectedFrame = earProtector.protect(frameOutput.left, frameOutput.right)",
        "nodeGraphTripEarProtection({ source: \"render\", protectionMuteCount })",
        "stateReadCount",
        "Rendered sample:",
        "outputSummary.textContent = summary || nodeGraphRenderPendingSummary()",
        "if (outputSummary) {\n      outputSummary.textContent = validation.scheduleText;\n    }",
        "syncNodeGraphRenderedAudioElement();",
        "signalInputs",
        "modulationInputs",
        "feedbackSignals",
        "feedbackModulations",
        "inactiveNodes: plan.inactiveNodes || []",
        "bypassedNodes: plan.bypassedNodes || []",
        "inactiveWireReads: nodeGraphInactiveWireReads(plan)",
        "patchNodeCount: plan.nodes?.length || 0",
        "activeNodeCount: plan.reachableNodes?.length || 0",
        "patchWireCount: nodeGraphPatchWireCount(plan)",
        "activeWireCount: nodeGraphActiveWireCount(plan)",
        "wireReads: nodeGraphExecutionWireReads(plan)",
        "nodeGraphActiveSignalConnections(plan).map",
        "nodeGraphActiveModulations(plan).map",
        'executionModel: "single-pass stored-output"',
        'schedulerPolicy: "same-pass acyclic edges; patch-node-order cycle-closing edges read stored outputs"',
        "samePassDependencies",
        "stateReadCount: nodeGraphStateReadCount(plan)",
        "storedOutputInitialValue: 0",
        "mode: feedbackSets.signal.has",
        '"state-read"',
        '"same-pass"',
        "parameters: nodeGraphExecutionParameterSnapshot(plan)",
        "runtimeBoundary: nodeGraphRuntimeBoundaryDebug(plan)",
        "DSP nodes do not know patch authoring or display fields",
        "partialOrder: plan.valid ? [] : plan.order",
        "schedule:",
        "schedule blocked:",
        "function beginNodeGraphNodeDrag(event)",
        "event.button !== undefined && event.button !== 0",
        "node.querySelector(\".node-drag-handle\")?.addEventListener(\"pointerdown\", beginNodeGraphNodeDrag)",
        "node.querySelector(\".node-header-title-row\")?.addEventListener(\"pointerdown\", beginNodeGraphNodeDrag)",
        "node.querySelector(\".node-bypass-button\")?.addEventListener(\"click\", toggleNodeGraphModuleBypass)",
        '".node-drag-handle, .node-header-title-row"',
        "node.querySelector(\".node-action-button\")?.addEventListener(\"click\", openNodeModuleActionMenu)",
        "handle.setPointerCapture(event.pointerId)",
        "handle.classList.add(\"dragging\")",
        "wasSelectedAtStart",
        "new Set([node.dataset.node])",
        "Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1",
        "if (!moved) {",
        "setNodeGraphSelection(null)",
        "function dragNodeGraphNode(event)",
        "positionNodeGraphNode(dragged.element, {\n      x: dragged.startX + deltaX,\n      y: dragged.startY + deltaY,\n    }, { clamp: false });",
        "function endNodeGraphNodeDrag(event)",
        "node.style.setProperty(\"--node-x\"",
        "node.style.setProperty(\"--node-y\"",
        "function renderNodeGraphAudio()",
        "function clampNodeGraphRenderSeconds(value)",
        "function syncNodeGraphRenderSecondsFromInput(options = {})",
        "function handleNodeGraphRenderSecondsInput(event)",
        "syncNodeGraphRenderSecondsFromInput({ normalize: true })",
        'document.getElementById("nodeRenderButton").addEventListener("click", renderNodeGraphAudio)',
        'document.getElementById("nodeRenderSecondsValue").addEventListener("input", handleNodeGraphRenderSecondsInput)',
        "function nodeGraphBuildLivePlan()",
        "const activeSignalConnections = nodeGraphActiveSignalConnections(compiled)",
        "const activeModulations = nodeGraphActiveModulations(compiled)",
        "modulations: activeModulations",
        "feedbackConnections: compiled.feedbackConnections.map",
        "feedbackModulations: compiled.feedbackModulations.map",
        "order: [...compiled.order]",
        "function createNodeGraphLiveRuntime(plan)",
        "const modulationConnections = new Map()",
        "nodeOutputs: new Map",
        "state read",
        "function updateNodeGraphLiveRuntimePlan(runtime, plan)",
        "runtime.modulationConnections = new Map()",
        "runtime.order = [...(plan.order || [])]",
        "function nodeGraphApplyParameterBounds(value, metadata = {})",
        "function nodeGraphParameterValueToNormalizedSignal(value, metadata = {})",
        "function nodeGraphNormalizedSignalToParameterValue(signal, metadata = {})",
        "function normalizeNodeGraphParameterModulationInput(value, metadata = {})",
        "function nodeGraphApplyParameterModulation(base, modulationSignal, metadata = {})",
        "function readNodeGraphLiveEffectiveParam(",
        "normalizeNodeMetadataKind(metadata.kind) === \"frequency\" && metadata.nonlinearSlider",
        "const octaves = (Number(modulationSignal) || 0) / 0.1",
        "normalizeNodeGraphParameterModulationInput(readNodeGraphRuntimePortOutput(",
        "nodeGraphApplyParameterModulation(base, modulationSignal, metadata)",
        "function evaluateNodeGraphPlanFrame(",
        "function renderNodeGraphLiveScriptBlock(event)",
        "function nodeGraphPhaseRadians(value)",
        "function createNodeGraphOscResetState()",
        "function nodeGraphPolyBlep(phaseCycle, phaseIncrement)",
        "function nodeGraphPolyBlepSquare(phaseCycle, phaseIncrement)",
        "function nodeGraphOscillatorWaveformSample(runtime, nodeId, phase, phaseIncrement, waveform)",
        "return 1 - phaseCycle * 2 + nodeGraphPolyBlep(phaseCycle, phaseIncrement)",
        "triangleStates",
        "runtime.oscResetStates",
        "const resetEdge = resetState.lastReset <= 0 && resetValue > 0",
        "runtime.triangleStates.set(nodeId, 0)",
        "mixInput(nodeId, \"Increment\")",
        "const phaseIncrement = (frequency / sampleRate) + incrementInput",
        "function nextNodeGraphNoiseSample(runtime, nodeId)",
        'node?.type === "spiral"',
        "function readNodeGraphLiveSmoothedParam(runtime, node, key, fallback, frame, frames)",
        'readNodeGraphLiveEffectiveParam(',
        "function setNodeGraphLiveMeter(",
        "meter.dataset.liveClips = String(clipCount)",
        "meter.dataset.liveProtectionMutes = String(protectionMuteCount)",
        "meter.dataset.liveBadNumbers = String(badNumberCount)",
        "protected ${protectionMuteCount}",
        "nodeGraphOutputSampleClipped(frameOutput.left)",
        "nodeGraphClampOutputSample(protectedFrame.left)",
        "runtime.earProtector?.protect(frameOutput.left, frameOutput.right)",
        "nodeGraphTripEarProtection({",
        "runtime.meterClipCount",
        "runtime.meterProtectionMuteCount",
        "function setNodeGraphLiveOutputMuted(muted)",
        "Ear Protection tripped. Refresh the page to reset audio.",
        "Refresh Required",
        "function setNodeGraphLiveEngineStatus(text = \"engine idle\", state = \"\")",
        "function setNodeGraphLiveEngineTitle(text = \"\")",
        "function clearNodeGraphLiveStatusTitle()",
        "function setNodeGraphLiveProcessorError(message = \"AudioWorklet processor error\")",
        "function setNodeGraphLivePlanStatus(text = \"plan idle\", state = \"\")",
        "function setNodeGraphLivePlanTitle(text = \"\")",
        "function setNodeGraphLiveEvidence(kind = \"idle\", details = {})",
        "function nodeGraphBadValueMonitorEnabled()",
        "function renderNodeGraphBadValueMonitorEvidence()",
        "function nodeGraphRecordBadValueEvent(details = {})",
        "nodeGraphMvp.badValueMonitor",
        "nodeBadValueMonitorEvidence",
        "function nodeGraphLiveDebug()",
        "connectionCount: Number(details.connectionCount ?? planEvidence.connectionCount) || 0",
        "engineSampleRate: Number(details.engineSampleRate ?? planEvidence.engineSampleRate) || 0",
        "feedbackConnectionCount: Number(details.feedbackConnectionCount ?? planEvidence.feedbackConnectionCount) || 0",
        "feedbackModulationCount: Number(details.feedbackModulationCount ?? planEvidence.feedbackModulationCount) || 0",
        "feedbackModulations: [",
        "feedbackSignals: [",
        "message: String(details.message || \"\")",
        "modulationCount: Number(details.modulationCount ?? planEvidence.modulationCount) || 0",
        "oversamplingRatio: Number(details.oversamplingRatio ?? planEvidence.oversamplingRatio) || 1",
        "sampleRate: Number(details.sampleRate ?? planEvidence.sampleRate) || 0",
        "stateReadCount: Number(details.stateReadCount ?? planEvidence.stateReadCount) || 0",
        "visualControls: {",
        "speakerOutputActive: Boolean(details.speakerOutputActive ?? planEvidence.speakerOutputActive)",
        "visualSinkCount: Number(details.visualSinkCount ?? planEvidence.visualSinkCount) || 0",
        "visualSinks: (details.visualSinks || planEvidence.visualSinks || []).map",
        "function nodeGraphLivePlanEvidenceDetails(plan, details = {})",
        "nodeGraphMvp.live.lastEvidence",
        "connectionCount: plan.connections.length",
        "feedbackConnectionCount: plan.feedbackConnections.length",
        "feedbackModulationCount: plan.feedbackModulations.length",
        "feedbackModulations: plan.feedbackModulations.map",
        "feedbackSignals: plan.feedbackConnections.map",
        "modulationCount: plan.modulations.length",
        "stateReadCount: nodeGraphStateReadCount(plan)",
        "visualSinkCount: (plan.visualSinks || []).length",
        "speakerOutputActive: Boolean(plan.speakerOutputActive)",
        "visualSinks: (plan.visualSinks || []).map",
        "setNodeGraphLiveEvidence(\"plan-sent\"",
        "setNodeGraphLiveEvidence(\"plan-applied\"",
        "nodeGraphMvp.live.lastEvidence.visualControls",
        "setNodeGraphLiveEvidence(\"params-sent\"",
        "setNodeGraphLiveEvidence(\"params-applied\"",
        "setNodeGraphLiveEvidence(\"script-blocked\"",
        "setNodeGraphLiveEvidence(\"processor-error\"",
        "setNodeGraphLiveEvidence(\"stopped\");",
        "setNodeGraphLiveEvidence(\"stopped\")",
        "function nodeGraphLivePlanStatusText(plan, serial = nodeGraphMvp.live.planSerial)",
        "visual-only",
        "const fingerprintText = plan.patchFingerprint ?",
        "function nodeGraphLiveBlockedStatusText(kind, error)",
        "function setNodeGraphLiveBlockedError(kind, error, options = {})",
        "function nodeGraphLivePlanScheduleTitle(order = [])",
        "worklet order:",
        "function nodeGraphLivePlanSentStatusText(serial = nodeGraphMvp.live.planSerial)",
        "function nodeGraphLiveParameterCount(nodes = [])",
        "function nodeGraphLiveParametersSentStatusText(nodes = [], serial = nodeGraphMvp.live.planSerial)",
        "function nodeGraphLiveParametersAppliedStatusText(message)",
        "function nodeGraphLivePlanAppliedStatusText(message)",
        "feedbackConnectionCount",
        "feedbackModulationCount",
        "nodeGraphFormatOversamplingRatio(oversamplingRatio)",
        "message.patchFingerprint ?",
        "function nodeGraphBuildLiveParameterNodes(activeNodeIds = null)",
        "nodeGraphMvp.live.activeNodeIds = new Set(plan.order)",
        "patchFingerprint: nodeGraphPatchFingerprint()",
        "nodeGraphBuildLiveParameterNodes(activeNodeIds)",
        "nodeGraphBuildLiveParameterNodes(nodeGraphMvp.live.activeNodeIds)",
        "function updateNodeGraphLiveRuntimeParameters(runtime, nodes)",
        "`plan${serialText}",
        "return `plan${serialText} sent`",
        "return `params${serialText} sent ${nodes.length} nodes / ${nodeGraphLiveParameterCount(nodes)} params`",
        "parameterCount: nodeGraphLiveParameterCount(nodes)",
        'message.type === "paramsApplied"',
        "function sendNodeGraphLiveParameterUpdate()",
        "function scheduleNodeGraphLiveParameterSync()",
        "const audio = nodeGraphAudioDerivation(nodeGraphMvp.patch);",
        "engineSampleRate: audio.clampedEngineSampleRate",
        "oversamplingRatio: audio.oversamplingRatio",
        "error.issues = [...compiled.issues]",
        "setNodeGraphLiveOutputMuted(false)",
        "setNodeGraphLiveOutputMuted(true)",
        "renderNodeGraphLiveControls(true)",
        "setNodeGraphLiveBlockedError(\"plan\", error)",
        "setNodeGraphLiveBlockedError(\"params\", error, { schedule: false })",
        "message.sessionId !== nodeGraphMvp.live.sessionId",
        "message.planSerial !== nodeGraphMvp.live.planSerial",
        "planSerial: nodeGraphMvp.live.planSerial",
        "patchFingerprint,",
        "sessionId: nodeGraphMvp.live.sessionId",
        "engine worklet",
        "engine fallback",
        "engine error",
        "workletNode.onprocessorerror",
        "function setNodeGraphLiveScheduleStatus(",
        "function nodeGraphLiveOutputIsActive(",
        "function syncNodeGraphOutputBypassButton(",
        "function renderNodeGraphLiveControls(",
        "const statusText = document.getElementById(\"nodeLiveStatus\")?.textContent || \"\"",
        "const outputActive = nodeGraphLiveOutputIsActive(running)",
        "syncNodeGraphOutputBypassButton(outputEnabled)",
        "createScriptProcessor(nodeGraphAudioBlockSize, 2, 2)",
        'audioInput: "Input"',
        "audioInput: {",
        'defaultValue: "0.35"',
        'max: "1"',
        "audioInput: counts.audioInput || 0",
        "nodeLiveInputStatus",
        "inputStatus: \"off\"",
        "inputDeviceId: \"\"",
        "inputPermissionStatus: \"unknown\"",
        "inputMeterRms",
        "inputStream: null",
        "inputSource: null",
        "function setNodeGraphLiveInputStatus(",
        "function setNodeGraphLiveMicStatus(",
        "function nodeGraphLivePermissionStatusText(",
        "async function refreshNodeGraphLiveMicrophonePermissionState()",
        "navigator.permissions.query({ name: \"microphone\" })",
        "Microphone permission is allowed. Start OUTPUT to connect it.",
        "nodeGraphMvp.live.micStatus === \"blocked\"",
        "mic allowed",
        "mic ask ready",
        "mic permission unknown",
        "function syncNodeGraphInputModuleLiveState()",
        "function nodeGraphLiveMicStatusText(",
        "node-live-input-state-badge",
        "dataset.micState",
        "mic waits output",
        "mic asking",
        "mic live",
        "mic blocked",
        "function setNodeGraphLiveInputMeter(",
        "function updateNodeGraphLiveInputTestStatus()",
        "input test off",
        "start output",
        "allow mic",
        "input signal",
        "function refreshNodeGraphLiveInputDevices()",
        "function handleNodeGraphLiveInputDeviceChange(event)",
        "function nodeGraphLiveInputErrorMessage(error)",
        "function setNodeGraphMockInputFactory(options = {})",
        "function startNodeGraphMockInput(options = {})",
        "function stopNodeGraphMockInput()",
        "function startNodeGraphMockInputDebug(options = {})",
        "function stopNodeGraphMockInputDebug()",
        "startMockInput(options = {})",
        "stopMockInput()",
        "nodeStartMockInputDebugButton",
        "nodeStopMockInputDebugButton",
        "document.documentElement.dataset.soemdspMockInput",
        "nodeGraphMvp.live.inputStreamFactory",
        "function nodeGraphLiveInputDeviceIsUnavailable(error)",
        "function requestNodeGraphLiveInputStream(deviceId = nodeGraphMvp.live.inputDeviceId)",
        "error.nodeGraphInputError = true",
        "const inputError = Boolean(error.nodeGraphInputError)",
        "setNodeGraphLiveBlockedError(\"input\", error, { schedule: false })",
        "Selected input unavailable; retrying default input.",
        "Microphone permission was blocked. Allow microphone access in the browser, then press Output again.",
        "Browser audio input needs HTTPS or localhost.",
        "navigator.mediaDevices.enumerateDevices",
        "device.kind === \"audioinput\"",
        "nodeGraphMvp.live.inputDeviceId",
        "nodeGraphMvp.live.inputMeterPeak",
        "nodeGraphMvp.live.inputMeterRms",
        "dataset.inputPeak",
        "--node-live-input-peak",
        "deviceId: { exact: deviceId }",
        'document.getElementById("nodeLiveInputDeviceSelect")',
        "devicechange",
        "input peak",
        "inputMeterPeak",
        "inputMeterSquareSum",
        "function nodeGraphLiveInputRouteState()",
        "input connected",
        "input blocked",
        "input asking",
        "input wired",
        "input unwired",
        "function nodeGraphModuleShouldBeVisible(node)",
        "function normalizeNodeGraphPatchTiming(timing = {})",
        "function createNodeGraphHeaderTimingWidgets()",
        "function renderNodeGraphPatchTimingControls()",
        "function bindNodeGraphHeaderTimingWidgets(root = document)",
        "function updateNodeGraphPatchTimingFromHeader(input)",
        "syncNodeGraphHeaderTimingWidgets()",
        "nodePatchTimingControls",
        "node-header-timing-widgets",
        ".node-header-timing-input",
        "type !== \"audioInput\" || Boolean(nodeGraphMvp.live.inputActive)",
        "function nodeGraphPatchNodeIsVisible(nodeId)",
        "function ensureNodeGraphLiveInputModule()",
        "function nodeGraphFindFreeModuleGridPoint(type",
        "nodeGraphFindFreeModuleGridPoint(\"audioInput\"",
        "input module shown",
        "const addedInputModule = nodeGraphMvp.live.inputActive",
        'nodeGraphTooltipText("audio.liveInputVisible")',
        'nodeGraphTooltipText("audio.liveInputShow")',
        "function stopNodeGraphLiveInputSource()",
        "function syncNodeGraphLiveInputSource()",
        "navigator.mediaDevices.getUserMedia",
        "context.createMediaStreamSource(stream)",
        "function startNodeGraphLiveAudio(outputSerial = nodeGraphMvp.live.outputToggleSerial)",
        "function nodeGraphLiveOutputStartCancelled(serial)",
        "function stopNodeGraphLiveAudio()",
        'typeof clearNodeGraphModuleScopeBuffers === "function"',
        "clearNodeGraphModuleScopeBuffers();",
        "if (nodeGraphMvp.live.node || nodeGraphMvp.live.context)",
        "function scheduleNodeGraphLivePlanSync()",
        "function sendNodeGraphLivePlan()",
        "function handleNodeGraphLiveWorkletMessage(event)",
        "nodeGraphRecordBadValueEvent({",
        "lastBadValueNodeId",
        "lastBadValueSource",
        "function createNodeGraphLiveWorkletNode(context)",
        'context.audioWorklet.addModule("./public/node-live-audio-worklet.js?v=',
        "new AudioWorkletNode(",
        "numberOfInputs: 1",
        "function createNodeGraphLiveScriptProcessorNode(context, plan)",
        'document.getElementById("nodeLiveInputButton").addEventListener("click", toggleNodeGraphLiveInput)',
        'document.getElementById("nodeLiveOutputButton").addEventListener("click", toggleNodeGraphLiveOutput)',
        "function nodeGraphStableSeed(text)",
        "function drawNodeRenderedWaveform()",
        "function drawNodeRenderedSignalPlot()",
        "function setNodeGraphSelection(selection)",
        "function nodeGraphSelectedNodeIds(selection = nodeGraphMvp.selected)",
        "function setNodeGraphNodeSelection(ids)",
        "function selectAllNodeGraphModules()",
        "setNodeGraphNodeSelection(nodeGraphMvp.patch.nodes.map((node) => node.id))",
        "function toggleNodeGraphNodeSelection(id, additive = false)",
        "const additiveSelection = event.ctrlKey || event.metaKey || event.shiftKey",
        "function nodeGraphSelectionHelpText()",
        "function composeNodeInteractionHelpText(text = \"\")",
        "modules selected",
        "function renderNodeGraphMarqueeSelection()",
        "function nodeGraphWireSelectionExists(selection = nodeGraphMvp.selected)",
        "function nodeGraphNodeCanBeDeleted(node)",
        'return Boolean(node && node.type !== "output")',
        "function nodeGraphNodeDeleteHidesOnly(node)",
        "function nodeGraphSelectionCanDelete(selection = nodeGraphMvp.selected)",
        "function nodeGraphDeleteTitle(selection = nodeGraphMvp.selected)",
        'nodeGraphTooltipText("actions.deleteUnavailableOutput")',
        'nodeGraphTooltipText("actions.deleteWireShort")',
        "function pruneNodeGraphSelectionAfterPatch()",
        "function beginNodeGraphMarqueeSelection(event)",
        "function dragNodeGraphMarqueeSelection(event)",
        "function endNodeGraphMarqueeSelection(event)",
        "const additive = event.shiftKey || event.ctrlKey || event.metaKey",
        "startSelectedIds: [...nodeGraphSelectedNodeIds()]",
        "if (!additive) {\n    setNodeGraphSelection(null)",
        "drag.additive\n    ? [...new Set([...(drag.startSelectedIds || []), ...nodeGraphNodesInsideRect(rect)])]",
        "} else if (!drag.additive) {\n    setNodeGraphSelection(null)",
        "draggedNodes",
        "function selectNodeGraphWire(event, index, kind = \"signal\")",
        "function drawPath(svg, options)",
        "alias = \"\"",
        "mode = \"same-pass\"",
        "hitPath.dataset.alias = alias",
        "hitPath.dataset.interactionMode = mode",
        "renderedPath.dataset.alias = alias",
        "renderedPath.dataset.interactionMode = mode",
        "const activeNodeIds = nodeGraphActiveNodeIds(plan)",
        "const isInactive = !nodeGraphSignalConnectionIsActive(connection, activeNodeIds)",
        "const isInactive = !nodeGraphModulationIsActive(modulation, activeNodeIds)",
        "isInactive ? \"inactive-wire\" : \"\"",
        "isBypassed ? \" (bypassed)\" : isInactive ? \" (inactive)\" : \"\"",
        "function configureNodeSceneContextMenu(mode)",
        "function openNodeModuleActionMenu(event)",
        "function openNodeScopeContextMenu(event)",
        'event.target.closest?.(".node-module-scope-window")',
        'document.getElementById("nodeGlobalScopeMenu")',
        "positionNodeGlobalScopeMenuAtSavedOr(",
        "closeNodeScopeContextMenu()",
        "const contextNode = event.target.closest(\".dsp-node\")",
        "configureNodeSceneContextMenu(\"module\")",
        "title.textContent = wireMode ? \"WIRE ACTIONS\" : \"ACTIONS\"",
        "WIRE ACTIONS",
        "menu.setAttribute(\"aria-label\", wireMode ? \"Wire actions\"",
        "nodeSceneWireTypeControl",
        "nodeSceneSelectedModule",
        "function nodeGraphWireFromSelection(selection = nodeGraphMvp.selected)",
        "function nodeGraphWireSelectionLabel(selection = nodeGraphMvp.selected)",
        "function nodeGraphSingleSelectedNodeId(selection = nodeGraphMvp.selected)",
        "function nodeGraphModuleActionTargetNodeId()",
        "function syncNodeGraphModuleActionTargetFromSelection()",
        "configureNodeSceneContextMenu(\"wire\")",
        "const targetNodeId = moduleMode ? nodeGraphModuleActionTargetNodeId() : null",
        "selectedModule.querySelector(\"strong\").textContent",
        "selectedModule.querySelector(\"span\").textContent = selectedWire?.kind === \"modulation\"",
        'nodeGraphTooltipText("actions.copyModule")',
        'nodeGraphTooltipText("actions.deleteModule")',
        'nodeGraphTooltipText("actions.deleteWire")',
        "function deleteNodeGraphSelectionFromContext()",
        "function copyNodeGraphModule(sourceNode)",
        "function copyNodeGraphModuleFromContext()",
        "const copiedNodeId = copyNodeGraphModule(sourceNode)",
        "function copySelectedNodeGraphModule()",
        "const gridPoint = nodeGraphFindCopiedModuleGridPoint(sourceNode, patch.nodes)",
        "module copied",
        'nodeGraphTooltipText("actions.copyUnavailableOutput")',
        "function deleteNodeGraphModuleFromContext()",
        "const targetNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId())",
        "function path(from, to)",
        "function normalizeNodeGraphTracePoints(points)",
        "Math.round((Number(value) || 0) - 0.5) + 0.5",
        "function nodeGraphTraceWaypointAttribute(points)",
        "function nodeGraphTracePushPoint(points, point)",
        "function nodeGraphTraceSingleMovePoint(from, points, point)",
        "function nodeGraphTraceAppendSingleMovePoint(from, points, point)",
        "function nodeGraphTraceFinalApproachPoint(from, points, point)",
        "function nodeGraphTraceAppendFinalApproachPoint(from, points, point)",
        "return { x: previous.x, y: target.y }",
        "function nodeGraphTraceCleanFinalDestinationPoints(from, points, to)",
        "nodeGraphTracePointBetween(target.y, start.y, end.y)",
        "function nodeGraphTraceOrthogonalPoints(from, points, to)",
        "function nodeGraphTracePathFromPoints(from, points, to)",
        "manualTrace: null",
        "function beginManualTrace(event, port)",
        "function cancelManualTrace()",
        "wireType: nodeGraphWireTypes.trace",
        "const tracePoints = normalizeNodeGraphTracePoints(trace.points)",
        "nodeGraphTraceAppendFinalApproachPoint(trace.from, tracePoints, endpointPoint)",
        "const cleanedTracePoints = nodeGraphTraceCleanFinalDestinationPoints(",
        "tracePoints: cleanedTracePoints",
        "nodeGraphTraceAppendSingleMovePoint(trace.from, trace.points, deps.clientPoint(event))",
        "trace.to = nodeGraphTraceLastPoint(trace.from, trace.points)",
        "replaceDuplicate: true",
        "path.dataset.tracePoints = nodeGraphTraceWaypointAttribute(trace.points)",
        "function nodeGraphSelfTraceModuleRect(nodeId)",
        "function nodeGraphSelfTracePoints(wire, from, to)",
        'node.querySelector(".node-header-title-row")?.getBoundingClientRect()',
        "const distance = Math.max(nodeGraphGridWidth(), nodeGraphGridHeight()) * 0.75",
        "const outX = from.x + fromDirection * distance",
        "const aboveY = Math.max(0.5, rect.top - distance)",
        "const belowTitleY = Math.max(to.y, rect.titleBottom + 0.5)",
        "{ x: outX, y: from.y }",
        "{ x: outX, y: aboveY }",
        "{ x: destinationSideX, y: aboveY }",
        "{ x: destinationSideX, y: belowTitleY }",
        "manualTracePoints.length",
        "pathData: nodeGraphTracePathFromPoints(from, tracePoints, to)",
        "tracePoints: normalizeNodeGraphTracePoints(connection.tracePoints)",
        "tracePoints: normalizeNodeGraphTracePoints(modulation.tracePoints)",
        "function createGradient(svg, id, from, to, stopClass = \"node-wire-gradient-stop\", colors = null)",
        "linearGradient",
        "gradientUnits",
        '["48%", "0.36", fromColor]',
        "function nodeGraphPortWireColor(node, port, io)",
        "wireColors: [",
        "const nodeSliderHandleHalfWidthPx = 8",
        "const nodeSliderHandleLeftWallClearancePx = 1",
        "const nodeSliderHandleRightWallClearancePx = 3",
        "function nodeSliderVisualLane(surface, slider)",
        "function nodeSliderHandleRangeFromTravel(slider, surface, travel)",
        "function nodeSliderTravelFromPointer(slider, surface, clientX)",
        "function nodeGraphParameterGhostSignal(node, key)",
        "const targetSlider = nodeGraphSliderForParameter(node, key)",
        "const sourceSlider = nodeGraphSliderForParameter(modulation.sourceNode, modulation.sourcePort)",
        "function syncNodeGraphGhostSliders()",
        "syncNodeGraphGhostSliders();",
        "has-ghost-slider",
        "nodeSliderHandleRangeFromTravel(",
        '`${range.start}px`',
        '`${range.end}px`',
        "data-connection-row-index",
        "event.stopPropagation();",
        "function deleteSelectedNodeGraphItem()",
        "const hideOnlyNodeIds = new Set()",
        "const removableNodeIds = new Set()",
        "input module hidden; script preserved",
        "function nodeGraphEventTargetIsEditable(target)",
        "target.closest(\"input, textarea, select, [contenteditable='true']\")",
        "if (nodeGraphEventTargetIsEditable(event.target))",
        "(event.ctrlKey || event.metaKey) && event.key.toLowerCase() === \"a\"",
        "selectAllNodeGraphModules()",
        "(event.ctrlKey || event.metaKey) && event.key.toLowerCase() === \"c\"",
        "function showPaletteNode(node)",
        'addEventListener("contextmenu", openNodeSceneContextMenu)',
        'addEventListener("auxclick", preventNodeGraphMiddleMouseAuxClick)',
        'addEventListener("mousedown", preventNodeGraphMiddleMouseDefault, true)',
        'addEventListener("pointerdown", beginNodeGraphWorkspacePan, true)',
        'addEventListener("pointerdown", beginNodeGraphMarqueeSelection)',
        'addEventListener("pointermove", dragNodeGraphMarqueeSelection)',
        'addEventListener("pointerup", endNodeGraphMarqueeSelection)',
        'addEventListener("pointerdown", beginNodeGraphWorkspaceResize)',
        'addEventListener("pointermove", dragNodeGraphWorkspaceResize)',
        'addEventListener("pointerup", endNodeGraphWorkspaceResize)',
        'window.addEventListener("resize", handleNodeGraphWindowResize)',
        'addEventListener("pointermove", dragNodeGraphWorkspacePan)',
        'addEventListener("pointerup", endNodeGraphWorkspacePan)',
        'getElementById("nodeGridToggleButton")',
        'getElementById("nodeVisibilityMenuButton")',
        'getElementById("nodeVisibilityMenuClose")',
        "function renderNodeGraphVisibilityMenuButton()",
        "function setNodeGraphVisibilityMenuOpen(open)",
        "function toggleNodeGraphVisibilityMenu()",
        "function resetNodeGraphStartupView()",
        "setNodeGraphViewMode(\"modular\")",
        "function renderNodeGraphGridToggle()",
        "function renderNodeGraphModuleVisibilityToggles()",
        "function normalizeNodeGraphModuleScopeBrightness(value)",
        "function normalizeNodeGraphModuleScopeBurn(value)",
        "function normalizeNodeGraphModuleScopeLineThickness(value)",
        "function normalizeNodeGraphModuleScopeTraceColor(value)",
        "function normalizeNodeGraphModuleScopeDotCoreColor(value, fallback = \"#fff6e1\")",
        "function normalizeNodeGraphModuleScopeDotCoreSize(value, fallback = 0.18)",
        "clampNodeSliderValue(number, 0.01, 5) : fallback",
        "function normalizeNodeGraphModuleScopeDotCoreBrightness(value, fallback = 1)",
        "clampNodeSliderValue(number, 0, 4) : fallback",
        "function renderNodeGraphModuleScopeDotPreview(",
        "nodeGraphModuleScopeGeneratedDotTextureData(",
        "context.putImageData(imageData, 0, 0)",
        "function renderNodeGraphModuleScopeBrightnessControl()",
        "function setNodeGraphModuleScopeBrightness(value)",
        "function handleNodeGraphModuleScopeBrightnessInput(event)",
        "function setNodeGraphModuleScopeBurn(value)",
        "function handleNodeGraphModuleScopeBurnInput(event)",
        "function setNodeGraphModuleScopeLineThickness(value)",
        "function setNodeGraphModuleScopeTraceColor(value)",
        "function setNodeGraphModuleScopeDotCore1Size(value)",
        "function setNodeGraphModuleScopeDotCore1Brightness(value)",
        "function setNodeGraphModuleScopeDotCore1Color(value)",
        "function setNodeGraphModuleScopeDotCore2Size(value)",
        "function setNodeGraphModuleScopeDotCore2Brightness(value)",
        "function setNodeGraphModuleScopeDotCore2Color(value)",
        "function handleNodeGraphModuleScopeLineThicknessInput(event)",
        "function toggleNodeGraphGridVisibility()",
        "function toggleNodeGraphModuleButtonsVisibility()",
        "function toggleNodeGraphOscilloscopeVisibility()",
        "renderNodeGraphGridToggle();",
        "renderNodeGraphModuleVisibilityToggles();",
        "renderNodeGraphModuleScopeBrightnessControl();",
        'getElementById("nodeSceneDeleteModule")',
        'getElementById("nodeSceneCopyModule")',
        'getElementById("nodeSceneCloseMenu")',
        'event.target.closest(".dsp-node")',
        'event.target.closest(".node-port, .node-param-port, .node-slider-readout")',
        'for (const port of node.querySelectorAll(".node-port"))',
        'for (const row of node.querySelectorAll(".node-io-row"))',
        'for (const port of node.querySelectorAll(".node-param-port.modulation-input"))',
        "const visualPort = helpers.dragVisualElement(port)",
        "function visualEndpointElement(element)",
        "dragVisualElement: visualEndpointElement",
        'element.classList?.contains("node-io-row")',
        "from: helpers.endpointPoint(endpoint, port)",
        "function endpointFromElement(element)",
        "parameterOutput: element.classList.contains(\"parameter-output\")",
        "function connectEndpoints(a, b, options = {})",
        "function nodeGraphConnectionOptionsWithSelfTrace(sourceNode, destinationNode, options = {})",
        "sourceNode !== destinationNode || options.wireType || options.tracePoints?.length",
        "options.replaceDuplicate",
        "status: \"wire traced\"",
        "status: \"modulation traced\"",
        "function endpointsAreDuplicate(a, b)",
        "function endpointsShouldBurst(a, b)",
        "function endpointsShareNode(a, b)",
        "if (endpointsShareNode(a, b))",
        "endpointsAreDuplicate(a, b)",
        "return patchPointTargetFromPoint(clientX, clientY)",
        "const target = helpers.dropTargetFromPoint(event.clientX, event.clientY)",
        "return deps.connectModulation(a.node, a.port, b.node, b.param, options)",
        "return deps.connectModulation(b.node, b.port, a.node, a.param, reversedOptions())",
        'a.io === "output" && b.io === "output"',
        'a.io === "input" && b.io === "input"',
        "function burstNodeGraphZap(point)",
        "deps.connectPorts(b.node, b.port, a.node, a.port, reversedOptions())",
        "particle.textContent = \"\\u2301\"",
        "--zap-color",
        "--zap-glow",
        "--zap-rotate",
        "--zap-scale",
        '!document.getElementById("nodeSceneContextMenu").hidden',
        'getElementById("nodeSceneCloseMenu")\n    .addEventListener("click", closeNodeSceneContextMenu)',
        'addEventListener("click", () => zoomNodeGraphBy(-nodeGraphZoomLimits.step))',
        'addEventListener("click", () => zoomNodeGraphBy(nodeGraphZoomLimits.step))',
        'document.getElementById("nodeModuleButtonsToggleButton").addEventListener("click", toggleNodeGraphModuleButtonsVisibility)',
        'document.getElementById("nodeOscilloscopeToggleButton").addEventListener("click", toggleNodeGraphOscilloscopeVisibility)',
        'getElementById("nodeMasterScopeBrightness")',
        'addEventListener("input", handleNodeGraphModuleScopeBrightnessInput)',
        'getElementById("nodeMasterScopeBurn")',
        'addEventListener("input", handleNodeGraphModuleScopeBurnInput)',
        'getElementById("nodeMasterScopeFps")',
        'addEventListener("input", handleNodeGraphModuleScopeFramesPerSecondInput)',
        'typeof resetNodeGraphModuleScopeFrameClocks === "function"',
        'getElementById("nodeMasterScopeDotCore1Size")',
        "setNodeGraphModuleScopeDotCore1Size(event.currentTarget.value)",
        'getElementById("nodeMasterScopeDotCore1Brightness")',
        "setNodeGraphModuleScopeDotCore1Brightness(event.currentTarget.value)",
        'getElementById("nodeMasterScopeDotCore1Color")',
        "setNodeGraphModuleScopeDotCore1Color(event.currentTarget.value)",
        'getElementById("nodeMasterScopeDotCore2Size")',
        "setNodeGraphModuleScopeDotCore2Size(event.currentTarget.value)",
        'getElementById("nodeMasterScopeDotCore2Brightness")',
        "setNodeGraphModuleScopeDotCore2Brightness(event.currentTarget.value)",
        'getElementById("nodeMasterScopeDotCore2Color")',
        "setNodeGraphModuleScopeDotCore2Color(event.currentTarget.value)",
        "querySelectorAll(\"#nodeGlobalScopeMenu input[type='number'][data-global-scope-input]\")",
        'getElementById("nodeMasterScopeLineThickness")',
        'addEventListener("input", handleNodeGraphModuleScopeLineThicknessInput)',
        "[data-context-module]",
        "const nodeGraphTooltipSourceUrl",
        "const sandboxNativeTitleStorageAttribute = \"data-native-title-disabled\"",
        "function installSandboxNativeTooltipBan()",
        "setAttributeWithoutNativeTitle",
        "sandboxStripNativeTitleAttributes()",
        "async function loadNodeGraphTooltips()",
        "function nodeGraphTooltipText(key, context = {})",
        "function nodeGraphApplyTooltip(element, key, context = {}, options = {})",
        "function applyNodeGraphStaticTooltips(root = document)",
        "function nodeInteractionHelpText(target)",
        "[data-interaction-help], [data-tooltip-key]",
        "function nodeInteractionMouseHint(element)",
        "nodeGraphElementTooltipText(element)",
        "const alias = element.dataset.alias || \"\"",
        "Alias: ${alias}",
        'nodeGraphTooltipText("wire.selected")',
        'nodeGraphTooltipText("wire.output")',
        'nodeGraphTooltipText("wire.input")',
        'nodeGraphTooltipText("wire.modulationInput")',
        'nodeGraphTooltipText("slider.numeric")',
        'nodeGraphTooltipText("slider.choices")',
        'nodeGraphTooltipText("module.actions")',
        'nodeGraphTooltipText("view.snapGrid")',
        'nodeGraphTooltipText("settings.uiSettingsOpen")',
        "function setNodeInteractionHelp(text = \"\")",
        "const composedText = composeNodeInteractionHelpText(text)",
        "if (help.textContent === composedText)",
        "function handleNodeInteractionHelp(event)",
        "function attachNodeInteractionHelpTarget(element)",
        "function normalizeNodeUiDevColor(value",
        "function nodeUiDevHexColorToRgbTriplet(value",
        "const nodeUiDevFontFamilyOptions",
        "function nodeUiDevSelectLabel(definition, value)",
        "function nodeUiDevSelectCssValue(definition, value)",
        "function nodeUiDevExposeCheckboxId(key)",
        "function installNodeUiDevExposeControls()",
        "function renderNodeUserUiSettingsControls()",
        "function setNodeUserUiSettingsVisible(visible)",
        "function toggleNodeUserUiSettings()",
        "let nodeUserUiSettingsActiveMirrorKey = null",
        "function syncNodeUserUiSettingsMirrorControls()",
        "let nodeUserUiSettingsDragging = null",
        "function beginNodeUserUiSettingsDrag(event)",
        "function dragNodeUserUiSettings(event)",
        "function endNodeUserUiSettingsDrag(event)",
        "const nodeUiDevDefaultSettingsUrl = \"./public/presets/useruisettings.json\"",
        "const nodeUiDevDefaultSettingsStorageKey = \"soemdsp-sandbox.userUiSettings.startup.v5\"",
        "soemdsp-sandbox-user-ui-settings",
        "settings_format.get(\"version\") not in (1, 2, 3)",
        "sliderLayout",
        "text-inside",
        "label-value-slider",
        "value-unit-left",
        "value-unit-right",
        "label-outside",
        "label-outside-no-unit",
        "value-outside",
        "unit-only",
        "value-focus",
        "Text Inside",
        "Label Outside",
        "Label Outside No Unit",
        "Unit Only",
        "Value Focus",
        "moduleButtonsVisible",
        "moduleOscilloscopesVisible",
        "moduleSlidersVisible",
        "moduleScopeBrightness",
        "moduleScopeBurn",
        "moduleScopeFramesPerSecond",
        "moduleScopeLineThickness",
        "moduleScopeTraceColor",
        "moduleScopeDotCore1Size",
        "moduleScopeDotCore1Brightness",
        "moduleScopeDotCore1Color",
        "moduleScopeDotCore2Size",
        "moduleScopeDotCore2Brightness",
        "moduleScopeDotCore2Color",
        "moduleScopeBackgroundColor",
        "moduleScopeBackgroundOverride",
        "sliderAmountVisible",
        "sliderPositionVisible",
        "nodeGlobalScopeMenuButton",
        "nodeGlobalScopeMenu",
        "nodeGlobalScopeDragHandle",
        "nodeGlobalScopeCloseMenu",
        "nodeMasterScopeBrightness",
        "nodeMasterScopeBurn",
        "nodeMasterScopeLineThickness",
        "nodeMasterScopeFps",
        "nodeMasterScopeDotCore1Size",
        "nodeMasterScopeDotCore2Brightness",
        "nodeMasterScopeBackgroundColor",
        "nodeMasterScopeBackgroundOverride",
        "function toggleNodeGlobalScopeMenu()",
        "function openNodeGlobalScopeMenu()",
        "function closeNodeGlobalScopeMenu()",
        "function beginNodeGlobalScopeMenuDrag(event)",
        "function dragNodeGlobalScopeMenu(event)",
        "function endNodeGlobalScopeMenuDrag(event)",
        'getElementById("nodeMasterScopeTraceColor")',
        "function setNodeGraphModuleScopeBackgroundColor(value)",
        "function setNodeGraphModuleScopeBackgroundOverride(enabled)",
        "normalizeNodeGraphModuleScopeBackgroundColor",
        "--node-scope-background",
        "nodeModuleButtonsToggleButton",
        "nodeOscilloscopeToggleButton",
        "nodeModuleSlidersToggleButton",
        "nodeSliderAmountToggleButton",
        "nodeSliderPositionToggleButton",
        "module-buttons-hidden",
        "module-oscilloscopes-hidden",
        "module-sliders-hidden",
        "function renderNodeGraphSliderVisibilityToggles()",
        "function toggleNodeGraphModuleSlidersVisibility()",
        "createNodeUserUiSettingsModuleSlidersControl",
        "function toggleNodeGraphSliderAmount()",
        "function toggleNodeGraphSliderPosition()",
        "function normalizeNodeGraphSliderLayout(value)",
        "function cycleNodeGraphSliderLayout()",
        "function createNodeUserUiSettingsSliderLayoutControl()",
        "nodeUserSliderLayoutCycleButton",
        "ui settings view must be an object",
        "function serializeNodeUiDevSettings()",
        "function loadNodeUiDevSettingsFromScript(text)",
        "function applyNodeUiDevSettings(settings)",
        "function loadNodeUiDevBundledDefaultSettings()",
        "window.nodeUiDevBundledDefaultSettings",
        "document.documentElement.dataset.nodeUiDevBundledDefaultSettings",
        "./public/presets/useruisettings.js",
        "const nodeUiDevSettingSections = Object.freeze([",
        "function loadNodeUiDevDefaultSettings()",
        "function copyNodeUiDevSettingsToClipboard()",
        "function saveNodeUiDevSettingsFile()",
        "function loadNodeUiDevSettingsFile()",
        "function handleNodeUiDevSettingsFileLoad(event)",
        "function updateDefaultNodeUiDevSettingsPreset()",
        "function handleUpdateDefaultNodeUiDevSettingsPresetClick(event)",
        "function handleSaveNodeUserUiSettingsDefaultClick(event)",
        "saveNodeUiDevLocalDefaultSettings(text);",
        'fetch("/api/presets/useruisettings"',
        "\"useruisettings.json\"",
        "let nodeLiveToggleTextResizeObserver = null",
        "function fitNodeLiveToggleText()",
        "document.querySelectorAll(\".node-live-toggle-palette .node-live-toggle span\")",
        "function scheduleNodeLiveToggleTextFit()",
        "function installNodeLiveToggleTextFitObserver()",
        "function organizeNodeUiDevSections()",
        "for (const section of nodeUiDevSettingSections)",
        'title: "modules and nodes"',
        '"nodeUiDevModuleIoSectionHeight"',
        '"nodeUiDevLiveToggleTextSize"',
        '"nodeUiDevModuleNodeSize"',
        "function syncNodeUiDevNodeColorControls()",
        "workspace.style.setProperty(property, color)",
        "document.querySelectorAll(\"[data-node-color-var]\")",
        "--node-bypass-icon-size-ratio",
        "const liveToggleTextPercent = Math.max(0, Math.min(100, Number(liveToggleTextSizeInput.value) || 0))",
        'getElementById("nodeUiDevLiveToggleTextSize")',
        'getElementById("nodeUiDevModularHeaderButtonBackground")',
        'getElementById("nodeUiDevTooltipTextSize")',
        'getElementById("nodeUiDevMinimumGridBrightness")',
        'getElementById("nodeUiDevMouseLightEnabled")',
        'getElementById("nodeUiDevModularShaderEnabled")',
        'getElementById("nodeUiDevScopeBloomEnabled")',
        "const modularShaderEnabled = Boolean(modularShaderEnabledInput.checked)",
        "const scopeBloomEnabled = Boolean(scopeBloomEnabledInput.checked)",
        "nodeGraphMvp.scopeBloomEnabled = scopeBloomEnabled",
        "setNodeGraphShaderScriptEnabled(modularShaderEnabled, { persist: false })",
        "controls.showGrid ?? nodeGraphMvp.gridVisible",
        'getElementById("nodeUiDevGridColor")',
        'getElementById("nodeUiDevWorkspaceBackgroundColor")',
        "--node-workspace-bg",
        'getElementById("nodeUiDevModuleTitleFont")',
        "--node-header-title-font-family",
        "modularHeaderButtonBackgroundPercent",
        "--node-toolbar-button-bg-alpha",
        "tooltipTextSizePx",
        "--node-tooltip-text-size",
        "minimumGridBrightnessPercent",
        "--node-min-grid-brightness-alpha",
        'getElementById("nodeUiDevTextGlowLevel")',
        'key: "textGlowLevel"',
        "textGlowLevelPercent",
        "--node-text-light-level",
        "node-light-source",
        "node-light-text",
        "node-no-light",
        "setNodeGraphElementLightRole",
        "clearNodeGraphElementLightRole",
        "nodeUiDevHexColorToRgbTriplet(gridColor)",
        "const bypassIconSizePercent = Math.max(0, Math.min(100, Number(bypassIconSizeInput.value) || 0))",
        'getElementById("nodeUiDevBypassIconSize")',
        'getElementById("nodeUiDevBypassIconPreview")',
        "--node-ui-dev-bypass-preview-size",
        'getElementById("nodeUiDevModuleIoSectionHeight")',
        "--node-io-section-min-height",
        'getElementById("nodeUiDevModuleNodeSize")',
        'getElementById("nodeUiDevSliderWidth")',
        'getElementById("nodeUiDevSliderHeight")',
        'getElementById("nodeUiDevSliderLabelColor")',
        'getElementById("nodeUiDevSliderValueColor")',
        'getElementById("nodeUiDevSliderUnitColor")',
        'getElementById("nodeUiDevSliderFillHoverColor")',
        'getElementById("nodeUiDevSliderFillHoverAlpha")',
        "--node-port-diameter",
        "--node-slider-width-ratio",
        "--node-slider-readout-height",
        "--node-slider-label-color",
        "--node-slider-value-color",
        "--node-slider-unit-color",
        "--node-slider-fill-hover-rgb",
        "--node-slider-fill-hover-alpha",
        'getElementById("nodeUiDevWirePatchPointSize")',
        "--node-wire-patch-point-size",
        'getElementById("nodeUiDevTraceWireThickness")',
        'getElementById("nodeUiDevChoiceDividerHeight")',
        "--node-trace-wire-thickness",
        "--node-choice-divider-height",
        "function nodeSliderChoiceDividerHeight(readout, layerHeight)",
        'getElementById("nodeUiDevChoiceSlideDebugBoxes")',
        'getElementById("nodeUiDevCloseIconSize")',
        "--panel-close-glyph-size-ratio",
        'getElementById("copyNodeUiDevSettingsButton").addEventListener("click", copyNodeUiDevSettingsToClipboard)',
        'getElementById("loadNodeUiDevSettingsButton").addEventListener("click", loadNodeUiDevSettingsFile)',
        'getElementById("saveNodeUiDevSettingsButton").addEventListener("click", saveNodeUiDevSettingsFile)',
        'getElementById("updateDefaultNodeUiDevSettingsButton")',
        'getElementById("nodeUiDevSettingsFileInput")',
        'getElementById("nodeUserUiSettingsButton").addEventListener("click", toggleNodeUserUiSettings)',
        'getElementById("nodeUserUiSettingsSaveDefault")',
        '.addEventListener("click", handleSaveNodeUserUiSettingsDefaultClick)',
        'getElementById("nodeUserUiSettingsClose").addEventListener("click", () => setNodeUserUiSettingsVisible(false))',
        'getElementById("nodeUserUiSettingsDragHandle")',
        'getElementById("nodeUserUiSettingsHeading")',
        "document.addEventListener(\"pointermove\", dragNodeUserUiSettings)",
        "installNodeUiDevExposeControls()",
        "await loadNodeUiDevDefaultSettings()",
        "element.dataset.interactionHelpReady = \"true\"",
        "const showHelp = () => setNodeInteractionHelp(nodeInteractionHelpText(element))",
        ".addEventListener(\"pointerover\", handleNodeInteractionHelp)",
        ".addEventListener(\"pointermove\", handleNodeInteractionHelp)",
        ".addEventListener(\"pointerover\", showHelp)",
        ".addEventListener(\"mouseover\", handleNodeInteractionHelp)",
        ".addEventListener(\"mousemove\", handleNodeInteractionHelp)",
        ".addEventListener(\"mouseover\", showHelp)",
        ".addEventListener(\"pointerdown\", handleNodeInteractionHelp)",
        ".addEventListener(\"pointerdown\", showHelp)",
        ".addEventListener(\"click\", showHelp)",
        ".addEventListener(\"click\", handleNodeInteractionHelp)",
        ".addEventListener(\"focusin\", handleNodeInteractionHelp)",
        "data-ready",
        "attachNodeInteractionHelpTarget(element)",
        "function toggleDebugSections()",
        "document.addEventListener(\"keydown\", handleNodeGraphKeydown)",
        "missing Output speaker input",
        "const mixInput = (nodeId, port = \"In\")",
        "scopeInputPort: Object.hasOwn(definition, \"scopeInputPort\")",
        "? definition.scopeInputPort",
        "scopeInputs: new Map()",
        "runtime.scopeInputs.set(nodeId, mixInput(nodeId, node.scopeInputPort))",
        "const scopeValue = node?.scopeInputPort && runtime.scopeInputs?.has?.(nodeId)",
        "readNodeGraphRuntimePortOutput(",
        "modulation.sourcePort",
        'node?.type === "graph"',
        "nodeGraphGraphValueAt(node.graph, mixInput(nodeId))",
        "const outputVolume = outputNode",
        'const outputMono = mixInput(runtime.outputNode || "output", "Mono")',
        'left: (outputMono + mixInput(runtime.outputNode || "output", "Left")) * outputVolume',
        'right: (outputMono + mixInput(runtime.outputNode || "output", "Right")) * outputVolume',
        "\"waveform\"",
        "nodeGraphOscillatorWaveformSample(",
        "function nodeGraphNoiseSeedKey(nodeId, seedValue, channel = \"\")",
        "function nextNodeGraphSeededNoiseSample(runtime, nodeId, seedValue, channel = \"\")",
        "function nodeGraphNoiseSampleHoldSample(runtime, state, nodeId, seedValue, speed, sampleRate)",
        "runtime.noiseSeedKeys ||= new Map()",
        "runtime.noiseSeeds.set(noiseId, nodeGraphStableSeed(seedKey))",
        "const clockRate = safeSpeed * rate * 0.5",
        "state.held = nextNodeGraphSeededNoiseSample(runtime, nodeId, seedValue)",
        "nextNodeGraphSeededNoiseSample(",
        "\"seed\"",
        "sourceNodes",
        "stateReadCount,",
        "connectionCount: plan.connections.length",
        "feedbackConnectionCount: plan.feedbackConnections.length",
        "feedbackModulationCount: plan.feedbackModulations.length",
        "modulationCount: plan.modulations.length",
        "nodeCount: plan.nodes.length",
        "leftSamples",
        "rightSamples",
        "durationSeconds: outputFrames / outputSampleRate",
        "engineSampleRate",
        "sampleRate: outputSampleRate",
        "channels: 2",
        "const frameOutput = evaluateNodeGraphPlanFrame(",
        'node?.type === "gain"',
        'value = mixInput(nodeId) * readNodeGraphLiveEffectiveParam(',
        'node?.type === "bias"',
        'value = mixInput(nodeId) + readNodeGraphLiveEffectiveParam(',
        "disconnect-wire-button",
        "const nodeGraphModuleScopeState",
        "animationDeltaSeconds: 1 / 60",
        "animationLastTime: 0",
        "clockLedStates: new Map()",
        "oscillatorFrozenBuffers: new Map()",
        "oscillatorPhasors: new Map()",
        "function nodeGraphModuleScopeCanvas()",
        "const nodeGraphShaderScriptStorageKey",
        "function nodeGraphShaderScriptCameraPhosphorFragment(preset)",
        "const nodeGraphShaderScriptDefaultFragmentSource",
        "const nodeGraphShaderScriptState = {\n  animationFrame: 0,\n  enabled: false",
        "function setNodeGraphShaderScriptEnabled(enabled, options = {})",
        "function clearNodeGraphShaderScriptCanvas()",
        "const nodeGraphShaderScriptGreenFragmentSource",
        "const nodeGraphShaderScriptAmberFragmentSource",
        "const nodeGraphShaderScriptCoolWhiteFragmentSource",
        "const nodeGraphShaderScriptRedFragmentSource",
        "const nodeGraphShaderScriptRgbPixelFragmentSource",
        "function applyNodeGraphShaderScriptPreset(fragmentSource)",
        "function applyNodeGraphShaderScriptGreenPreset()",
        "function applyNodeGraphShaderScriptAmberPreset()",
        "function applyNodeGraphShaderScriptCoolWhitePreset()",
        "function applyNodeGraphShaderScriptRgbPixelPreset()",
        "function applyNodeGraphShaderScriptRedPreset()",
        'document.getElementById("nodeShaderScriptGreenPreset")?.addEventListener("click", applyNodeGraphShaderScriptGreenPreset)',
        'document.getElementById("nodeShaderScriptAmberPreset")?.addEventListener("click", applyNodeGraphShaderScriptAmberPreset)',
        'document.getElementById("nodeShaderScriptCoolWhitePreset")?.addEventListener("click", applyNodeGraphShaderScriptCoolWhitePreset)',
        'document.getElementById("nodeShaderScriptRgbPixelPreset")?.addEventListener("click", applyNodeGraphShaderScriptRgbPixelPreset)',
        'document.getElementById("nodeShaderScriptRedPreset")?.addEventListener("click", applyNodeGraphShaderScriptRedPreset)',
        "vec3 rgbTriadMask(vec2 pixelCoord, float reveal)",
        "float reveal = smoothstep(1.18, 2.75, uZoom)",
        "vec3 mask = rgbTriadMask(gl_FragCoord.xy, reveal)",
        "glowColor: \"0.72, 0.16, 0.08\"",
        "roomColor: \"0.002, 0.010, 0.004\"",
        "roomColor: \"0.014, 0.009, 0.002\"",
        "roomColor: \"0.006, 0.008, 0.010\"",
        "uniform vec4 uScopeRects[32]",
        "function createNodeGraphShaderProgram(gl, fragmentSource)",
        "function nodeGraphShaderScriptRects(canvas)",
        "function drawNodeGraphShaderScriptFrame()",
        "function bindNodeGraphShaderScriptEvents()",
        "bindNodeGraphShaderScriptEvents();",
        "function setNodeGraphModuleScopesEnabled(enabled)",
        "function registerNodeGraphModuleScopeSlot(moduleElement, options = {})",
        "bindNodeGraphModuleScopeViewDrag(scopeElement)",
        "ensureNodeGraphModuleScopeViewDragEvents()",
        "function nodeGraphModuleScopeSlots()",
        "function beginNodeGraphRenderedScopeCapture(options = {})",
        "function nodeGraphDefaultModuleScopeMonitors(patch = nodeGraphMvp?.patch)",
        'node?.type === "osc" && nodeGraphPatchNodeOutputPorts(node).includes("Out")',
        'io: "output"',
        'port: "Out"',
        "const inputs = nodeGraphPatchNodeInputPorts(node)",
        "io: \"input\"",
        "const nodeGraphModuleScopeSettingsStorageKey",
        "function normalizeNodeGraphModuleScopeSetting(value = {})",
        "function nodeGraphNormalizeScopeTraceColor(value)",
        "function nodeGraphScopeHexColorToRgb(color)",
        "brightness: 1",
        "gainMaxBrightness: 1",
        "gainMaxLineThickness: 2.4",
        "gainMinBrightness: 0",
        "gainMinLineThickness: 1.5",
        "clampNodeSliderValue(number, 0, 16)",
        "function normalizeNodeGraphModuleScopeFramesPerSecond(value)",
        "clampNodeSliderValue(Math.round(number), 1, 240)",
        "clampNodeSliderValue(number, 0.25, 4)",
        "clampNodeSliderValue(cycles, 0, 128)",
        "clampNodeSliderValue(gain, 0.01, 100)",
        "clampNodeSliderValue(gainMaxBrightness, 0, 4)",
        "clampNodeSliderValue(gainMaxLineThickness, 0.5, 8)",
        "clampNodeSliderValue(gainMinBrightness, 0, 4)",
        "clampNodeSliderValue(gainMinLineThickness, 0.5, 8)",
        "clampNodeSliderValue(lineThickness, 0.5, 6)",
        "clampNodeSliderValue(pan, -128, 128)",
        "startSync: setting.sync !== false",
        "const rawPan = clampNodeSliderValue(",
        "const nextPan = drag.startSync ? Math.round(rawPan) : rawPan",
        "clampNodeSliderValue(screenBurn, 0, 1)",
        "clampNodeSliderValue(timeMs, 0, 10000)",
        "function applyNodeGraphModuleScopeSettings(value = {})",
        "function loadNodeGraphModuleScopeSettingsLocal()",
        "function updateNodeGraphModuleScopeSetting(nodeId, patch = {})",
        "function nodeGraphFormatScopeNumber(value)",
        "function nodeGraphScopeControlTargetNodeId()",
        "nodeGraphMvp.scopeContextTargetNode",
        "nodeGraphMvp.scopeContextDragging",
        "nodeGraphMvp.scopeContextWindowPosition",
        "nodeGraphMvp.globalScopeDragging",
        "nodeGraphMvp.globalScopeWindowPosition",
        "function renderNodeGraphSceneScopeControls(nodeId = nodeGraphScopeControlTargetNodeId())",
        "nodeGraphFormatScopeNumber(setting.cycles)",
        "Scope horizontal window in detected cycles. Use 0 to show the full captured buffer.",
        "Scope vertical amplitude multiplier.",
        "Scope phosphor persistence amount. Use 0 for no screen smear.",
        "Scope trace light brightness multiplier. Use 0 for no emitted trace light.",
        "Scope trace line thickness in pixels.",
        "Gain scope brightness at Amplitude 0.",
        "Gain scope brightness at Amplitude 1.",
        "Gain scope line thickness at Amplitude 0.",
        "Gain scope line thickness at Amplitude 1.",
        "timeMs: Number.isFinite(timeMs)",
        "timeMs > 0",
        "function handleNodeGraphSceneScopeNumericInput(event)",
        'input.dataset.scopeInput === "cycles"',
        "updateNodeGraphModuleScopeSetting(nodeId, { cycles: value })",
        'input.dataset.scopeInput === "screenBurn"',
        "updateNodeGraphModuleScopeSetting(nodeId, { screenBurn: value })",
        'input.dataset.scopeInput === "brightness"',
        "updateNodeGraphModuleScopeSetting(nodeId, { brightness: value })",
        'input.dataset.scopeInput === "lineThickness"',
        "updateNodeGraphModuleScopeSetting(nodeId, { lineThickness: value })",
        'input.dataset.scopeInput === "gainMinBrightness"',
        "updateNodeGraphModuleScopeSetting(nodeId, { gainMinBrightness: value })",
        'input.dataset.scopeInput === "gainMaxBrightness"',
        "updateNodeGraphModuleScopeSetting(nodeId, { gainMaxBrightness: value })",
        'input.dataset.scopeInput === "gainMinLineThickness"',
        "updateNodeGraphModuleScopeSetting(nodeId, { gainMinLineThickness: value })",
        'input.dataset.scopeInput === "gainMaxLineThickness"',
        "updateNodeGraphModuleScopeSetting(nodeId, { gainMaxLineThickness: value })",
        "function handleNodeGraphSceneScopeNumericKeydown(event)",
        "function nodeGraphScopeNumberInputSnapValue(input, value)",
        "input.value = nodeGraphScopeNumberInputSnapValue(input, value).toString()",
        'input.dataset.scopeInput === "cycles"',
        "const baseCycles = Math.max(step / 8, (max - min) / 960)",
        "function beginNodeGraphScopeNumberDrag(event)",
        "function bindNodeGraphModuleScopeViewDrag(scopeElement)",
        "function beginNodeGraphModuleScopeViewDrag(event)",
        "nodeGraphMvp.scopeViewDragging",
        "function dragNodeGraphModuleScopeView(event)",
        "const rawCycles = clampNodeSliderValue(",
        "drag.startCycles * Math.pow(2, dy / 160)",
        "const nextCycles = drag.startSync",
        "? Math.max(1, Math.round(rawCycles))",
        ": rawCycles",
        "drag.startPan + (dx / drag.width) * Math.max(0.125, nextCycles)",
        "function endNodeGraphModuleScopeViewDrag(event)",
        "function dragNodeGraphScopeNumber(event)",
        "function endNodeGraphScopeNumberDrag(event)",
        "function beginNodeGraphScopeNumberEdit(event)",
        "nodeGraphMvp.scopeNumberDragging",
        "scopeViewDragging: null",
        "setNodeGraphScopeNumberInputValue(",
        "function handleNodeGraphSceneScopeControlClick(event)",
        "querySelectorAll(\"#nodeGlobalScopeMenu [data-scope-input]\")",
        "input.addEventListener(\"change\", handleNodeGraphSceneScopeNumericInput)",
        "input.addEventListener(\"keydown\", handleNodeGraphSceneScopeNumericKeydown)",
        "input.addEventListener(\"dblclick\", beginNodeGraphScopeNumberEdit)",
        "input.addEventListener(\"pointerdown\", beginNodeGraphScopeNumberDrag)",
        "document.addEventListener(\"pointermove\", dragNodeGraphScopeNumber)",
        "document.addEventListener(\"pointermove\", dragNodeScopeContextMenu)",
        "function beginNodeGraphLiveModuleScopeCapture(plan = {}, options = {})",
        "function updateNodeGraphLiveModuleScopeFingerprint(patchFingerprint = nodeGraphPatchFingerprint())",
        "nodeGraphModuleScopeState.patchFingerprint = fingerprint",
        "function nodeGraphModuleScopeScalarValue(value)",
        "\"Out X\", \"Out Y\", \"Out Z\"",
        "modelFrameTimes: new Map()",
        "function resetNodeGraphModuleScopeFrameClocks()",
        "function nodeGraphModuleScopeAdvanceFixedFrameClock(state, now, fps)",
        "lastUpdate: nextLastUpdate",
        "time: nextTime",
        "function nodeGraphModuleScopeModelFrameTime(slot)",
        "nodeGraphModuleScopeState.modelFrameTimes.get(nodeId)",
        "const tick = nodeGraphModuleScopeAdvanceFixedFrameClock(state, now, fps)",
        "nodeGraphModuleScopeState.modelFrameTimes.set(nodeId, state)",
        "function nodeGraphModuleScopeStableSeed(text)",
        "Math.imul(seed ^ character.charCodeAt(0), 16777619)",
        "function nodeGraphModuleScopeAdvanceNoiseSeed(seed, steps)",
        "Math.imul(1664525",
        "function nodeGraphModuleScopeNoiseSeedToSample(seed)",
        "function nodeGraphModuleScopeNoiseSeedKey(nodeId, seedValue)",
        "function nodeGraphModuleScopeLinearToDb(value)",
        "20 * Math.log10(amplitude)",
        "function nodeGraphModuleScopeFormatDb(value)",
        "function nodeGraphModuleScopeBufferStats(buffer)",
        "function renderNodeGraphModuleScopeAnalyzer(slot, buffer = null)",
        "querySelector?.(\".node-module-scope-analyzer\")",
        "metrics.gainDb",
        "metrics.peakDb",
        "metrics.rmsDb",
        "function nodeGraphModuleScopeOfflineSourceFrequency(nodeId",
        "function updateNodeGraphModuleClockLed(slot)",
        "slot?.type !== \"clock\"",
        "const led = slot.scopeElement.querySelector(\".node-clock-led\")",
        "const buffer = nodeGraphModuleScopeState.buffers.get(slot.nodeId)",
        "const latestSample = buffer?.length ? Number(buffer[buffer.length - 1]) || 0 : 0",
        "1 - Math.exp(-dt / tau)",
        "led.style.setProperty(\"--node-clock-led-brightness\"",
        "led.style.setProperty(\"--node-clock-led-glow\"",
        "function nodeGraphModuleScopeOfflineSignalSample(context, nodeId, localTime, sampleIndex",
        "function nodeGraphModuleScopeOfflineOscillatorSample(waveform, phaseCycle)",
        "function nodeGraphModuleScopeOscillatorPhasor(slot, frequency, cycles, modelTime",
        "nodeGraphModuleScopeState.oscillatorPhasors.get(nodeId)",
        "nodeGraphModuleScopeState.oscillatorPhasors.set(nodeId, phasor)",
        "if (phasor.renderTime === now)",
        "const previousSweep = Number(phasor.sweep) || 0",
        "phasor.previousSweep = previousSweep",
        "phasor.sweepDelta = sweepDelta",
        "phasor.signal = wrapNodeSliderValue",
        "phasor.sweep = wrapNodeSliderValue",
        "function nodeGraphModuleScopeOfflineOscillatorBuffer(slot)",
        "const frequency = Math.max(0, nodeGraphModuleScopeNodeParam(node, \"frequency\", 0))",
        "const level = nodeGraphModuleScopeNodeParam(node, \"level\", 0.5)",
        "const requestedCycles = settings.cycles > 0 ? settings.cycles : nodeGraphModuleScopeDefaultSettings.cycles",
        "const visibleCycles = requestedCycles",
        "const sweepCycles = visibleCycles",
        "const frequencyMoving = frequency > 0",
        "nodeGraphModuleScopeModelFrameTime(slot)",
        "const sweepPhase = frequencyMoving && sweepCycles > 0 ? Number(phasor.sweep) || 0 : 0",
        "const sweepStartPhase = frequencyMoving && sweepCycles > 0 ? Number(phasor.previousSweep) || 0 : 0",
        "const frozenBuffer = nodeGraphModuleScopeState.oscillatorFrozenBuffers.get(slot.nodeId)",
        "return frozenBuffer",
        'const windowStartPhase = settings.oscillatorTraceMode === "window"',
        "phase + (Number(phasor.signal) || 0) - sweepPhase * visibleCycles",
        "nodeGraphModuleScopeOfflineOscillatorSample(waveform, phaseCycle) * level",
        "buffer.nodeGraphScopeDrawFullWindow = !frequencyMoving || sweepDelta >= 1",
        "buffer.nodeGraphScopeDrawProgress = frequencyMoving ? sweepPhase : 1",
        "buffer.nodeGraphScopeDrawStartProgress = frequencyMoving ? sweepStartPhase : 0",
        "buffer.nodeGraphScopeDrawWrap = frequencyMoving && !buffer.nodeGraphScopeDrawFullWindow && sweepPhase < sweepStartPhase",
        "buffer.nodeGraphScopeUseFullWindow = true",
        "nodeGraphModuleScopeState.oscillatorFrozenBuffers.set(slot.nodeId, buffer)",
        "slot?.type !== \"osc\"",
        "function nodeGraphModuleScopeOfflineNoiseBuffer(slot)",
        "slot?.type !== \"noise\"",
        "const level = clampNodeSliderValue(nodeGraphModuleScopeNodeParam(node, \"level\", 0.5), 0, 1)",
        "const seedValue = nodeGraphModuleScopeNodeParam(node, \"seed\", 1)",
        "const speed = nodeGraphModuleScopeNodeParam(node, \"speed\", 1)",
        "const startSample = 0",
        "function nodeGraphModuleScopeNoiseHoldSample(nodeId, seedValue, speed, sampleIndex, sampleRate)",
        "const clockRate = safeSpeed * safeSampleRate * 0.5",
        "nodeGraphModuleScopeNoiseHoldSample(slot.nodeId, seedValue, speed, startSample + index, sampleRate) * level",
        "buffer.nodeGraphScopeDrawProgress = 1",
        "buffer.nodeGraphScopeMinPointSpacingPx = 0.5",
        "buffer.nodeGraphScopeVisualPointLimit = 16384",
        "nodeGraphModuleScopeOfflineNoiseBuffer(slot)",
        "function nodeGraphModuleScopeOfflineStereoNoiseXyBuffer(slot)",
        "slot?.type !== \"stereoNoise\"",
        "const x = new Float32Array(frames)",
        "const y = new Float32Array(frames)",
        "nodeGraphModuleScopeStableSeed(`${slot.nodeId}:left`)",
        "nodeGraphModuleScopeStableSeed(`${slot.nodeId}:right`)",
        "nodeGraphScopeXy: true",
        "nodeGraphModuleScopeOfflineStereoNoiseXyBuffer(slot)",
        "function nodeGraphModuleScopeOfflineGainAnalyzerBuffer(slot)",
        "slot?.type !== \"gain\"",
        "sourceFrequency > 0",
        "const inputBuffer = new Float32Array(frames)",
        "const inputConnections = nodeGraphModuleScopeConnectionsTo(node.id, \"In\")",
        "inputBuffer[index] = inputConnections.reduce((sum, connection) => sum + nodeGraphModuleScopeOfflineSignalSample(",
        "buffer[index] = inputBuffer[index]",
        "buffer.nodeGraphScopeAnalyzer = {",
        "gainDb: nodeGraphModuleScopeLinearToDb(amount)",
        "inputRmsDb: inputStats.rmsDb",
        "...nodeGraphModuleScopeBufferStats(buffer)",
        "buffer.nodeGraphScopePeriodSamples = sourceFrequency > 0 ? sampleRate / sourceFrequency : 0",
        "buffer.nodeGraphScopeSourceFrequency = sourceFrequency",
        "buffer.nodeGraphScopeSyncBuffer = inputBuffer",
        "nodeGraphModuleScopeOfflineGainAnalyzerBuffer(slot)",
        "function nodeGraphModuleScopeLiveInputBuffer(slot, capturedBuffer = null)",
        "nodeGraphModuleScopeSlotHasInputs(slot)",
        "nodeGraphModuleScopeLiveInputBuffer(slot, capturedBuffer)",
        "function nodeGraphModuleScopeDisplayBuffer(slot, capturedBuffer = null)",
        "function nodeGraphModuleScopeHasModelDisplay()",
        "slot.type === \"clock\"",
        "slot.type === \"stereoNoise\"",
        "nodeGraphModuleScopeState.mode = \"model\"",
        "function pushNodeGraphLiveModuleScopeSnapshot(values, options = {})",
        "updateNodeGraphLiveModuleScopeFingerprint(patchFingerprint)",
        "function captureNodeGraphLiveModuleScopeFrame(runtime, sampleRate)",
        "return Boolean(nodeGraphMvp?.live?.node);",
        "function nodeGraphModuleScopeThreshold(buffer, start = 0, end = buffer.length)",
        "function nodeGraphModuleScopeRisingCrossings(buffer, threshold, start = 1, end = buffer.length)",
        "function nodeGraphModuleScopeMedianPeriod(crossings)",
        "function nodeGraphModuleScopeLowpassSyncTrace(buffer, start, end, periodSamples = 0)",
        "const cutoff = clampNodeSliderValue(fundamental * 4, 20, sampleRate * 0.45)",
        "y4 += (y3 - y4) * alpha",
        "function nodeGraphModuleScopeTraceRisingCrossings(trace, start = 1, end = trace?.length || 0, offset = 0)",
        "function nodeGraphModuleScopeSyncBuffer(buffer)",
        "buffer?.nodeGraphScopeSyncBuffer?.length === buffer?.length",
        "function nodeGraphModuleScopeEstimatedCycle(buffer)",
        "const syncBuffer = nodeGraphModuleScopeSyncBuffer(buffer)",
        "const hintedPeriodSamples = Number(buffer?.nodeGraphScopePeriodSamples)",
        "periodSamples: hintedPeriodSamples",
        "function nodeGraphModuleScopeTriggeredStart(syncBuffer, cycleEstimate, visibleSamples)",
        "Math.max(visibleSamples + periodSamples * 6, 1024)",
        "const start = crossing - visibleSamples",
        "function nodeGraphModuleScopeVisibleSamples(buffer, settings, cycleEstimate)",
        "function nodeGraphModuleScopeBufferView(buffer, slot)",
        "if (buffer?.nodeGraphScopeUseFullWindow)",
        "const cycleEstimate = settings.sync",
        "? nodeGraphModuleScopeEstimatedCycle(buffer)",
        ": null",
        "const triggeredStart = nodeGraphModuleScopeTriggeredStart(syncBuffer, cycleEstimate, visibleSamples)",
        "const rawPanCycles = Number(settings.pan) || 0",
        "const panCycles = settings.sync && cycleEstimate",
        "? Math.round(rawPanCycles)",
        "start = clampNodeSliderValue(start - panSamples",
        "nodeGraphModuleScopeDisplayBuffer(",
        "previous <= threshold && current > threshold",
        "(index - 1) + fraction",
        "cycleEstimate.periodSamples * settings.cycles",
        "nodeGraphModuleScopeDefaultSettings.cycles",
        "function nodeGraphModuleScopeInterpolatedSample(buffer, position)",
        "nodeGraphModuleScopeBufferValue(buffer, position, view)",
        "normalizeNodeGraphModuleScopeTraceColor(nodeGraphMvp?.moduleScopeTraceColor ?? \"#3de0ff\")",
        "const halo = nodeGraphModuleScopeMixColor(base, [0, 0, 0], 0.55)",
        "core: base",
        "function nodeGraphModuleScopeTraceColors(setting)",
        "function nodeGraphModuleScopeZoomScale()",
        "function nodeGraphModuleScopeUnzoomedLength(value, zoomScale = nodeGraphModuleScopeZoomScale())",
        "function nodeGraphModuleScopeRenderedSampleWidth(rect, zoomScale = nodeGraphModuleScopeZoomScale())",
        "sampleWidth * zoom",
        "function nodeGraphModuleScopeGeneratedDotTextureData(\n  core1SizeValue,\n  core1BrightnessValue,\n  size = 64,",
        "function nodeGraphModuleScopeGeneratedDotTexture(renderer)",
        "normalizeNodeGraphModuleScopeDotCoreSize(nodeGraphMvp?.moduleScopeDotCore1Size ?? 0.18, 0.18)",
        "normalizeNodeGraphModuleScopeDotCoreBrightness(nodeGraphMvp?.moduleScopeDotCore2Brightness ?? 0.45, 0.45)",
        "const key = `generated:${core1Size.toFixed(3)}:${core1Brightness.toFixed(3)}:${core1Color}:${core2Size.toFixed(3)}:${core2Brightness.toFixed(3)}:${core2Color}`",
        "const core1Falloff = 2.6 / Math.max(0.0001, core1Radius * core1Radius)",
        "normalizeNodeGraphModuleScopeDotCoreColor(nodeGraphMvp?.moduleScopeDotCore1Color ?? \"#fff6e1\", \"#fff6e1\")",
        "normalizeNodeGraphModuleScopeDotCoreColor(nodeGraphMvp?.moduleScopeDotCore2Color ?? \"#ffd28b\", \"#ffd28b\")",
        "function nodeGraphModuleScopeDotSizeScale()",
        "nodeGraphModuleScopeDotSizeScale() * pixelRatio",
        "gl.texImage2D(\n    gl.TEXTURE_2D,\n    0,\n    gl.RGBA,\n    64,\n    64",
        "function nodeGraphModuleScopePhosphorFrameReady(slot)",
        "const tick = nodeGraphModuleScopeAdvanceFixedFrameClock(state, now, fps)",
        "lastUpdate: tick.lastUpdate",
        "typeof nodeGraphZoom === \"function\"",
        "Number(nodeGraphMvp?.zoom)",
        "beamProgram",
        "vec2 centered = gl_PointCoord * 2.0 - 1.0",
        "uniform sampler2D uDotTexture",
        "uniform bool uUseDotTexture",
        "texture2D(uDotTexture, gl_PointCoord)",
        "vec3 traceColor = uUseDotTexture ? dotSample.rgb : uColor",
        "float textureAlpha = uUseDotTexture ? dotSample.a : 1.0",
        "gl_FragColor = vec4(traceColor * alpha, alpha)",
        "gl_PointSize = clamp(uSize, 1.0, 96.0)",
        "traceImageTexture: {",
        "function nodeGraphModuleScopePixelPoints(points, canvas)",
        "function nodeGraphModuleScopeDotVertices(points, canvas, ageStart = 0, ageEnd = 1)",
        "function nodeGraphModuleScopeBufferDotVertices(buffer, rect, canvas, pixelRatio, slot)",
        "function nodeGraphModuleScopeBufferProgressRanges(buffer)",
        "function nodeGraphModuleScopeBufferSegmentPoints(buffer, rect, canvas, pixelRatio, slot, startProgress, endProgress)",
        "function nodeGraphModuleScopeCenteredSquareRect(rect)",
        "const size = Math.max(1, Math.min(Number(rect?.width) || 0, Number(rect?.height) || 0))",
        "function nodeGraphModuleScopeXyPoints(buffer, rect, canvas, pixelRatio, slot)",
        "if (!buffer?.nodeGraphScopeXy || !buffer.x?.length || !buffer.y?.length",
        "const square = nodeGraphModuleScopeCenteredSquareRect(rect)",
        "const radius = Math.max(1, square.width * 0.44)",
        "clampNodeSliderValue((Number(buffer.x[index]) || 0) * gain, -1, 1)",
        "clampNodeSliderValue((Number(buffer.y[index]) || 0) * gain, -1, 1)",
        "const drawProgress = Number.isFinite(Number(buffer?.nodeGraphScopeDrawProgress))",
        "clampNodeSliderValue(Number(buffer.nodeGraphScopeDrawProgress), 0.002, 1)",
        "const minPointSpacingPx = clampNodeSliderValue(Number(buffer.nodeGraphScopeMinPointSpacingPx) || 0.5, 0.25, 32)",
        "const sampleWidth = nodeGraphModuleScopeRenderedSampleWidth(rect)",
        "const visualPointLimit = Math.max(2, Math.min(32768, Math.floor(Number(buffer.nodeGraphScopeVisualPointLimit) || 32768)))",
        "Math.ceil((sampleWidth * drawSpan) / minPointSpacingPx)",
        "const progress = start + ((pointIndex + 0.5) / pointCount) * drawSpan",
        "const samplePosition = view.start + progress * visibleSamples",
        "sampleWidth: nodeGraphModuleScopeUnzoomedLength(rect.width, zoomScale)",
        "sampleHeight: nodeGraphModuleScopeUnzoomedLength(rect.height, zoomScale)",
        "function captureNodeGraphRenderedScopeFrame(",
        "function finishNodeGraphRenderedScopeCapture(capture)",
        'oscillatorTraceMode: "frequencyReset"',
        'source.oscillatorTraceMode === "window" ? "window" : "frequencyReset"',
        'button.dataset.scopeControl === "oscillatorTraceMode"',
        'oscillatorTraceMode: setting.oscillatorTraceMode === "window" ? "frequencyReset" : "window"',
        "const requestedCycles = settings.cycles > 0 ? settings.cycles : nodeGraphModuleScopeDefaultSettings.cycles",
        "const visibleCycles = requestedCycles",
        "const sweepCycles = visibleCycles",
        'const windowStartPhase = settings.oscillatorTraceMode === "window"',
        "function drawNodeGraphModuleScopes()",
        "nodeGraphModuleScopeState.animationDeltaSeconds = clampNodeSliderValue(",
        "nodeGraphModuleScopeState.animationLastTime = animationTime",
        "nodeGraphMvp.moduleOscilloscopesVisible === false",
        "function scheduleNodeGraphModuleScopeDraw()",
        "function createNodeGraphModuleScopeWebGlRenderer(canvas)",
        "const nodeGraphModuleScopeUnipolarTypes = new Set([",
        "\"vactrolEnvelope\"",
        "function nodeGraphModuleScopeShouldDrawZeroLine(slot, buffer)",
        "buffer?.nodeGraphScopeXy",
        "buffer.nodeGraphScopeUnipolar === true",
        "return !nodeGraphModuleScopeUnipolarTypes.has(slot?.type)",
        "function drawNodeGraphModuleScopeCenterOverlayLineWebGl(renderer, rect, pixelRatio, slot, buffer, options = {})",
        "gl.uniform4f(renderer.colorLocation, 0.42, 0.58, 0.62, 0.22)",
        "gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)",
        "compositeNodeGraphModuleScopePhosphor(renderer);\n  gl.bindFramebuffer(gl.FRAMEBUFFER, null)",
        "drawNodeGraphModuleScopeCenterOverlayLineWebGl(",
        "function nodeGraphModuleScopeTracesOff()",
        "nodeGraphMvp?.visualControls?.scopeTracesOff",
        "function nodeGraphModuleScopeCircuitRunning()",
        "function nodeGraphModuleScopePaused()",
        "nodeGraphMvp?.visualControls?.scopePaused",
        "if (nodeGraphModuleScopeTracesOff())",
        "nodeGraphModuleScopeState.scopeTracesOffActive",
        "clearNodeGraphModuleScopeCanvas();",
        "if (nodeGraphModuleScopePaused())",
        "nodeGraphMvp?.moduleOscilloscopesVisible === false || nodeGraphModuleScopePaused()",
        "function nodeGraphModuleScopeTraceImageTexture(renderer)",
        "nodeGraphTraceImageDataUrl()",
        "return nodeGraphModuleScopeGeneratedDotTexture(renderer)",
        "gl.uniform1i(renderer.beamUseDotTextureLocation, dotTexture ? 1 : 0)",
        "function drawNodeGraphModuleScopeBufferWebGl(renderer, rect, buffer, pixelRatio, slot, options = {})",
        "const vertices = nodeGraphModuleScopeBufferDotVertices(buffer, rect, canvas, pixelRatio, slot)",
        "gl.drawArrays(gl.POINTS, 0, vertices.length / 3)",
        "function drawNodeGraphModuleScopePhosphorFade(",
        "function nodeGraphModuleScopeShouldDecaySlot(slot, buffer, settings)",
        'slot?.type === "osc"',
        'settings?.oscillatorTraceMode !== "window"',
        "return Boolean(buffer?.nodeGraphScopeDrawWrap || buffer?.nodeGraphScopeDrawFullWindow)",
        "function nodeGraphModuleScopeDecayRegions(items)",
        "nodeGraphModuleScopeShouldDecaySlot(item.slot, item.buffer, item.settings)",
        "function nodeGraphModuleScopeScissorRect(gl, canvas, rect, pixelRatio = window.devicePixelRatio || 1)",
        "drawNodeGraphModuleScopeTexturedQuad(",
        "gl.clearColor(0, 0, 0, 0)",
        "gl.clear(gl.COLOR_BUFFER_BIT)",
        "gl.enable(gl.SCISSOR_TEST)",
        "function nodeGraphModuleScopeBurnDecaySettings(settings)",
        "const masterBurn = typeof normalizeNodeGraphModuleScopeBurn === \"function\"",
        "function nodeGraphModuleScopeTraceBurn(settings)",
        "const burn = bloomEnabled ? nodeGraphModuleScopeTraceBurn(scopeSettings) : 0",
        "phosphorFrame: {",
        "nodeGraphModuleScopeState.phosphorFrame = {",
        "if (!nodeGraphModuleScopePhosphorFrameReady(firstVisibleSlot))",
        "const decayRegions = nodeGraphModuleScopeDecayRegions(visibleItems)",
        "drawNodeGraphModuleScopePhosphorFade(\n    renderer,\n    nodeGraphModuleScopeSetting(firstVisibleSlot?.nodeId || \"\"),\n    decayRegions,\n  );",
        "compositeNodeGraphModuleScopePhosphor(renderer);",
        "function nodeGraphModuleScopeBloomEnabled()",
        "Boolean(nodeGraphMvp?.scopeBloomEnabled)",
        "function nodeGraphModuleScopeGainTravel(slot)",
        "function nodeGraphModuleScopeTraceBrightness(slot, settings)",
        "const masterBrightness = normalizeNodeGraphModuleScopeBrightness(nodeGraphMvp?.moduleScopeBrightness ?? 1)",
        "return clampNodeSliderValue(brightness * masterBrightness, 0, 16)",
        "function nodeGraphModuleScopeTraceLineThickness(slot, settings)",
        "const masterLineThickness = normalizeNodeGraphModuleScopeLineThickness(",
        "function nodeGraphModuleScopeLerpRange(minValue, maxValue, amount)",
        'slot?.type === "gain"',
        'nodeGraphModuleScopeNodeParam(node, "amount", 1)',
        "nodeGraphReadPatchParameterMetadata(node, \"amount\")",
        "return clampNodeSliderValue((value - min) / (max - min), 0, 1)",
        "settings?.gainMinBrightness",
        "settings?.gainMaxBrightness",
        "settings?.gainMinLineThickness",
        "settings?.gainMaxLineThickness",
        "return clampNodeSliderValue(lineThickness * masterLineThickness, 0.25, 32)",
        "if (burn <= 0)",
        "fast: 0",
        "floor: 1",
        "slow: 0",
        "fast,",
        "floor,",
        "slow,",
        "gl.blendFunc(gl.ONE, gl.ONE)",
        "updateNodeGraphModuleClockLed(slot)",
        "nodeGraphModuleScopeTraceColors(scopeSettings)",
        "const zoomScale = nodeGraphModuleScopeZoomScale()",
        "const brightness = nodeGraphModuleScopeTraceBrightness(slot, scopeSettings)",
        "const lineThickness = nodeGraphModuleScopeTraceLineThickness(slot, scopeSettings)",
        "const bloomEnabled = nodeGraphModuleScopeBloomEnabled()",
        "if (bloomEnabled) {",
        "intensity: (0.028 + burn * 0.016) * brightness",
        "intensity: (0.18 + (bloomEnabled ? burn * 0.08 : 0)) * brightness",
        "thicknessPx: lineThickness * 3.25 * zoomScale",
        "thicknessPx: lineThickness * 1.25 * zoomScale",
        "const dotThicknessPx = Math.max(1, Number(options.thicknessPx) || 1) * nodeGraphModuleScopeDotSizeScale() * pixelRatio",
        "gl.uniform1f(renderer.beamSizeLocation, dotThicknessPx)",
        "Number.isFinite(intensity) ? Math.max(0, intensity) : 0.1",
        "Number.isFinite(decayFast) ? decayFast : 0.94",
        "gl.uniform1f(renderer.beamSizeLocation",
        "gl.uniform1f(renderer.beamIntensityLocation",
        "gl.vertexAttribPointer(renderer.beamPointAgeLocation, 1, gl.FLOAT, false, 12, 8)",
        "module-scopes-webgl-unavailable",
        "gl.enable(gl.SCISSOR_TEST)",
        "function normalizeNodeGraphPatchMonitors(monitors = [], patch = nodeGraphMvp?.patch)",
        "function toggleNodeGraphMonitorFromPortEvent(event)",
        "function syncNodeGraphMonitorIndicators(patch = nodeGraphMvp?.patch)",
        "function syncNodeGraphModuleScopeCanvas()",
        "monitors: normalizeNodeGraphPatchMonitors(patch.monitors, patch)",
        "port.addEventListener(\"pointerdown\", toggleNodeGraphMonitorFromPortEvent, true)",
        "function createNodeGraphModuleScopeSection(node, type)",
        "className = \"node-module-scope-window\"",
        "definition.layout === \"visualScope\" ? \" visual-scope-layout\" : \"\"",
        "definition.layout === \"filterCurve\" ? \" filter-curve-layout\" : \"\"",
        "scopeSection.classList.add(\"node-module-square-scope-window\")",
        "createNodeGraphFilterCurveDisplay(node, type)",
        "function drawNodeGraphFilterCurveDisplay(section)",
        "function nodeGraphOnePoleLowpassMagnitudeAt(cutoff, frequency, sampleRate)",
        "function nodeGraphOnePoleHighpassMagnitudeAt(cutoff, frequency, sampleRate)",
        "function nodeGraphBandpassMagnitudeAt(lowCut, highCut, frequency, sampleRate)",
        "function nodeGraphLadderFilterMagnitudeAt(params, frequency, sampleRate)",
        "function nodeGraphFilterCurveResponseAt(node, frequency, sampleRate)",
        "function nodeGraphFilterCurveCutoffFrequencies(node)",
        "function scheduleNodeGraphFilterCurveDraw()",
        "function syncNodeGraphFilterCurveDisplays()",
        "node-filter-curve-display",
        "node-filter-curve-canvas",
        "node-filter-curve-endpoint-input",
        "node-filter-curve-endpoint-output",
        "syncNodeGraphFilterCurveDisplays()",
        "syncNodeGraphPatchParameterFromSlider(slider, { deferUi: true })",
        "ioSection.append(inputColumn || document.createElement(\"div\"))",
        "section.dataset.tooltipKey = \"module.scopeWindow\"",
        "nodeGraphApplyTooltip(section, \"module.scopeWindow\")",
        "className = \"node-clock-led-shell\"",
        "className = \"node-clock-led\"",
        "led.dataset.ledState = \"off\"",
        "className = \"node-module-scope-analyzer\"",
        "registerNodeGraphModuleScopeSlot(article, { nodeId: node, type, scopeElement: scopeSection })",
        "nodeShaderScriptButton",
        "nodeShaderScriptDialog",
        "nodeShaderScriptSource",
        "nodeModularShaderCanvas",
        "const scopeCapture = beginNodeGraphRenderedScopeCapture({",
        "captureNodeGraphRenderedScopeFrame(",
        "finishNodeGraphRenderedScopeCapture(scopeCapture)",
        "captureNodeGraphLiveModuleScopeFrame(runtime, sampleRate);",
        "scheduleNodeGraphModuleScopeDraw();",
        "pushNodeGraphLiveModuleScopeSnapshot(message.values || [],",
        "sampleRate: message.sampleRate",
        "beginNodeGraphLiveModuleScopeCapture(plan, {",
        "updateNodeGraphLiveModuleScopeFingerprint(patchFingerprint);",
        "clearNodeGraphModuleScopeBuffers();",
        "renderedNodeGraphWavBlob(nodeGraphMvp.rendered)",
        "initNodeGraphMvp();",
    ]:
        require(snippet in node_graph_source, f"node graph source missing {snippet}")

    scope_draw_source = node_graph_source[
        node_graph_source.index("function drawNodeGraphModuleScopes()"):
        node_graph_source.index("function scheduleNodeGraphModuleScopeDraw()")
    ]
    fps_gate_start = scope_draw_source.index("if (!nodeGraphModuleScopePhosphorFrameReady(firstVisibleSlot)) {")
    fps_gate_end = scope_draw_source.index("  drawNodeGraphModuleScopePhosphorFade(", fps_gate_start)
    fps_gate_source = scope_draw_source[fps_gate_start:fps_gate_end]
    require(
        "scheduleNodeGraphModuleScopeDraw();" in fps_gate_source
        and "return;" in fps_gate_source,
        "master oscilloscope FPS gate should reschedule without drawing when not ready",
    )
    require(
        "drawNodeGraphModuleScopePhosphorFade(" not in fps_gate_source
        and "compositeNodeGraphModuleScopePhosphor(" not in fps_gate_source,
        "master oscilloscope FPS gate should prevent all phosphor drawing between global frames",
    )
    fixed_clock_source = node_graph_source[
        node_graph_source.index("function nodeGraphModuleScopeAdvanceFixedFrameClock("):
        node_graph_source.index("function nodeGraphModuleScopeModelFrameTime(")
    ]
    require(
        "const resyncDuration = Math.max(0.5, frameDuration * 4);" in fixed_clock_source
        and "elapsed > resyncDuration" in fixed_clock_source,
        "scope fixed-frame clock should scale its resync threshold with the requested FPS",
    )
    require(
        "elapsed > 0.5" not in fixed_clock_source,
        "scope fixed-frame clock should not force 1 FPS scopes to update at 2 FPS",
    )

    for function_name in [
        "setNodeGraphModuleScopeBurn",
        "setNodeGraphModuleScopeBackgroundColor",
        "setNodeGraphModuleScopeTraceColor",
        "refreshNodeGraphModuleScopeGeneratedDot",
        "setNodeGraphModuleScopeBackgroundOverride",
    ]:
        start = node_graph_source.find(f"function {function_name}")
        require(start >= 0, f"node graph source missing {function_name}")
        next_function = node_graph_source.find("\nfunction ", start + 1)
        body = node_graph_source[start: next_function if next_function >= 0 else len(node_graph_source)]
        require(
            "clearNodeGraphModuleScopeCanvas" not in body,
            f"{function_name} should update scope settings without clearing phosphor canvas",
        )

    require(
        "nodeGraphCycleOption" not in node_graph_source
        and "nodeGraphModuleScopeTimeOptions" not in node_graph_source
        and "nodeGraphModuleScopeGainOptions" not in node_graph_source,
        "module scope time/gain settings should use typed numeric fields rather than cycle buttons",
    )

    require(
        "actionRow.append(createNodeGraphHeaderTimingWidgets())" not in node_graph_source,
        "patch timing controls should live in the modular header, not every module header",
    )

    require(
        "timeMs: value * 1000" not in node_graph_source
        and 'data-scope-input="time"' not in index_source
        and "<span>sec</span>" not in index_source,
        "module scope horizontal setting should be typed as detected cycles, not seconds",
    )

    require(
        "time * frequency" not in node_graph_source,
        "oscillator model scopes should advance from stored phasors, not wall-time frequency products",
    )

    require(
        'const sweepCycles = settings.oscillatorTraceMode === "window" ? visibleCycles : 1' not in node_graph_source,
        "oscillator frequency-reset scope should sweep the same cycle count it draws",
    )

    oscillator_scope_source = node_graph_source[
        node_graph_source.find("function nodeGraphModuleScopeOfflineOscillatorBuffer"):
        node_graph_source.find("function nodeGraphModuleScopeOfflineNoiseBuffer")
    ]
    require(
        "requestedCycles * 4" not in oscillator_scope_source,
        "oscillator window mode cycles should use the requested cycle count directly",
    )

    require(
        "buffer[index] = inputBuffer[index] * amount" not in node_graph_source,
        "gain module scope should not change trace height when the Gain/Amplitude slider moves",
    )

    require(
        "setNodeGraphNodeSelection([placement.nodeId])" not in node_graph_source,
        "placing a newly added module should not leave that module selected",
    )

    require(
        "monitored-port" in style_source
        and "--node-monitor-color" in style_source
        and "data-monitor-state" in node_graph_source,
        "monitored ports should have a visible indicator contract",
    )

    require(
        'data-wire-type="trace"' in index_source
        and 'data-wire-type="wire"' not in index_source,
        "wire actions should expose Trace but not unfinished Wire",
    )
    require(
        'trace: "trace",' in wire_actions_source
        and 'wire: "wire"' not in wire_actions_source
        and '"actions.wireType.wire"' not in node_graph_source,
        "production wire types should be limited to Cable and Trace",
    )

    choice_divider_helper_source = slider_readout_source[
        slider_readout_source.index("function nodeSliderChoiceDividerBackground"):
        slider_readout_source.index("function syncNodeSliderReadout")
    ]
    require(
        "Array.from({ length: Math.max(0, choices.length - 1)" in choice_divider_helper_source,
        "choice slider dividers should be generated only for internal choice boundaries",
    )
    require(
        "const selectedCellRects = cellRects" in slider_readout_source
        and "index === activeChoiceIndex" in slider_readout_source
        and "syncNodeSliderChoiceDebugSquares(readout, choices, true, Number(slider.value))" in slider_readout_source,
        "choice slider should draw only the selected choice cell",
    )
    require(
        "const debugCellStrokes = cellRects.map((cell, index) => {" in slider_readout_source
        and "node-choice-debug-cell-debug" in slider_readout_source,
        "choice slider debug mode should keep red cell boxes for every choice",
    )
    require(
        "const debugWalls = cellWallXs.map((wallX, index) => {" in slider_readout_source
        and "node-choice-debug-wall" in slider_readout_source
        and "...debugWalls" in slider_readout_source,
        "choice slider debug mode should draw the source wall positions",
    )
    require(
        "const engineSliderWallXs = [" in slider_readout_source
        and "node-choice-debug-slider-wall" in slider_readout_source
        and "...debugSliderWalls" in slider_readout_source,
        "choice slider debug mode should draw explicit slider wall positions",
    )
    require(
        'marker.setAttribute("class", "node-choice-debug-square node-choice-debug-cell node-choice-debug-cell-stroke")' in slider_readout_source
        and 'marker.setAttribute("x", cell.left.toFixed(3))' in slider_readout_source
        and 'marker.setAttribute("height", cell.height.toFixed(3))' in slider_readout_source
        and "zeroBorderOutset" not in slider_readout_source
        and "trailingStrokeOutset" not in slider_readout_source,
        "choice slider selected stroke should use the same cell rect as debug boxes",
    )
    require(
        "const segmentRects = nodeSliderChoiceCellRects(layerWidth, layerHeight, choices)" in slider_readout_source
        and "const cellWallXs = [" in slider_readout_source
        and "const cellRects = nodeSliderChoiceCellRectsFromWalls(" in slider_readout_source
        and "layerRect.top" in slider_readout_source
        and "...dividerLines.map((divider) => divider.x)" in slider_readout_source,
        "choice slider cells should derive from the painted divider walls",
    )
    require(
        "const strokeInset = 0.5;" in slider_readout_source
        and "const trailingPixelCorrection = boundedEmptyPixelBorder > 0 ? 1 : 0;" in slider_readout_source
        and "visualScale = 1" in slider_readout_source
        and "nodeSliderSnapStrokeCoordinate(" in slider_readout_source,
        "choice slider cell rect should account for SVG stroke painting outside the rect",
    )
    require(
        "nodeUiDevChoiceSlideEdgeBrightness" not in node_graph_source
        and "nodeUiDevChoiceSlideGlowLevel" not in node_graph_source
        and "nodeUiDevChoiceSlideColor" not in node_graph_source
        and "nodeUiDevChoiceSlideEdgeBrightness" not in index_source
        and "nodeUiDevChoiceSlideGlowLevel" not in index_source
        and "nodeUiDevChoiceSlideColor" not in index_source
        and "--node-choice-slide-color" not in style_source
        and "--node-choice-slide-edge-brightness" not in style_source
        and "--node-slider-fill-rgb: 127 199 217;" in style_source
        and "--node-slider-fill-alpha: 0.14;" in style_source
        and "background: rgb(var(--node-slider-fill-rgb) / var(--node-slider-fill-alpha));" in style_source
        and "fill: rgb(var(--node-slider-fill-rgb) / var(--node-slider-fill-alpha));" in style_source
        and ".node-slider-readout.choices-divided.value-hovering .node-choice-debug-cell-fill" in style_source,
        "choice slider slide element should inherit normal slider styling controls",
    )
    require(
        "((index + 1) / choices.length) * 100" in choice_divider_helper_source,
        "choice slider dividers should skip the leftmost and rightmost edges",
    )
    choice_divider_source = slider_readout_source[
        slider_readout_source.index("if (dividesChoices)"):
        slider_readout_source.index("syncNodeSliderPortalHandle(readout, slider, position, false);")
    ]
    require(
        'readout.style.removeProperty("--value-start")' in choice_divider_source,
        "choice slider should clear the numeric selected-handle start marker",
    )
    require(
        'readout.style.removeProperty("--value-end")' in choice_divider_source,
        "choice slider should clear the numeric selected-handle end marker",
    )
    require(
        'readout.style.setProperty("--value-start"' not in choice_divider_source,
        "choice slider should not draw a selected choice start marker",
    )
    require(
        'readout.style.setProperty("--value-end"' not in choice_divider_source,
        "choice slider should not draw a selected choice end marker",
    )
    require(
        "--choice-divider-width" not in slider_readout_source,
        "choice slider should not use edge-prone repeating divider widths",
    )

    choice_divider_style = style_source[
        style_source.index(".node-slider-readout.choices-divided {"):
        style_source.index(".node-slider-readout.choices-divided::before")
    ]
    require(
        "repeating-linear-gradient" not in choice_divider_style,
        "choice slider should not use a repeating gradient that paints the outer edge",
    )
    require(
        "var(--choice-divider-background, none)" in choice_divider_style,
        "choice slider should draw only explicit internal divider layers",
    )
    choice_selected_marker_start = style_source.index("\n.node-slider-readout.choices-divided::before")
    choice_selected_marker_style = style_source[
        choice_selected_marker_start:
        style_source.index("\n.node-slider-readout-label", choice_selected_marker_start)
    ]
    require(
        "display: none;" in choice_selected_marker_style,
        "choice slider selected marker should not draw an extra rectangle stroke",
    )

    action_menu_source = node_graph_source[
        node_graph_source.index("function openNodeModuleActionMenu(event)"):
        node_graph_source.index("function openNodeSceneContextMenu(event)")
    ]
    require(
        "setNodeGraphNodeSelection" not in action_menu_source,
        "module action button should not change module selection",
    )

    require(
        "Math.max(68" not in app_source,
        "node graph wire path should not enforce the old 68px minimum span",
    )

    require(
        "feedback cycle unsupported at" not in app_source,
        "node graph scheduler should allow feedback cycles as state reads",
    )

    require(
        "if (!menu.hidden && !menu.contains(event.target))" not in app_source,
        "node scene context menu should close by explicit Close button, not outside click",
    )

    require(
        "scopeElement.classList.add(\"view-dragging\");\n  closeNodeScopeContextMenu();" not in node_graph_source,
        "oscilloscope context menu should not close when clicking or dragging outside it",
    )

    scope_number_drag_source = node_graph_source[
        node_graph_source.find("function beginNodeGraphScopeNumberDrag(event)"):
        node_graph_source.find("function beginNodeGraphScopeNumberEdit(event)")
    ]
    require(
        "function beginNodeGraphScopeNumberDrag(event)" in scope_number_drag_source
        and "document.body.classList.add(\"node-slider-dragging\")" not in scope_number_drag_source
        and "updateNodeSliderDotCursor(event)" not in scope_number_drag_source
        and "clearNodeSliderDotCursor()" not in scope_number_drag_source,
        "oscilloscope number dragging should not hide or replace the mouse cursor",
    )

    require(
        ".scene-context-scope-fields input {\n  box-sizing: border-box;" in style_source
        and ".scene-context-scope-fields input.value-dragging {\n  border-color:" in style_source
        and "cursor: ew-resize" not in style_source[
            style_source.find(".scene-context-scope-fields input {"):
            style_source.find(".scene-context-text-box-text-control,")
        ],
        "oscilloscope controls should not set a custom resize cursor",
    )

    require(
        ".node-graph-workspace:not(.module-scopes-enabled):not(.module-oscilloscopes-hidden) .node-module-scope-window-surface" not in style_source,
        "paused oscilloscopes should not switch to a special powered-off screen style",
    )

    phosphor_fade_source = node_graph_source[
        node_graph_source.index("function drawNodeGraphModuleScopePhosphorFade("):
        node_graph_source.index("function compositeNodeGraphModuleScopePhosphor(")
    ]
    region_branch_start = phosphor_fade_source.index("} else if (Array.isArray(regions)) {")
    region_branch_end = phosphor_fade_source.index("  } else {", region_branch_start)
    region_branch_source = phosphor_fade_source[region_branch_start:region_branch_end]
    require(
        "gl.clearColor(0, 0, 0, 0);" in region_branch_source
        and "gl.clear(gl.COLOR_BUFFER_BIT);" in region_branch_source,
        "region-scoped phosphor fade should clear screen-space pixels outside active scope panes",
    )
    require(
        "drawNodeGraphModuleScopeTexturedQuad(renderer, read.texture, 0);" not in region_branch_source,
        "region-scoped phosphor fade should not preserve the full screen-space phosphor texture",
    )

    clear_scope_source = node_graph_source[
        node_graph_source.index("function clearNodeGraphModuleScopeBuffers()"):
        node_graph_source.index("function clearNodeGraphRenderedModuleScopeBuffers()")
    ]
    require(
        "window.cancelAnimationFrame(nodeGraphModuleScopeState.drawFrame);" in clear_scope_source
        and "nodeGraphModuleScopeState.drawFrame = 0;" in clear_scope_source,
        "clearing module scope buffers should cancel any pending scope draw frame",
    )

    require(
        "nodeGraphMvp.moduleOscilloscopesVisible === false) {\n    setNodeGraphModuleScopesEnabled(false)" not in node_graph_source
        and "typeof clearNodeGraphModuleScopeCanvas === \"function\") {\n      clearNodeGraphModuleScopeCanvas();" not in node_graph_source,
        "hiding oscilloscopes should pause drawing rather than clearing or changing the screen",
    )

    require(
        "route: plan.order" not in app_source,
        "node graph validation should expose schedule order, not stale route aliases",
    )

    for snippet in [
        "nodeHoverTooltip",
        "node-hover-tooltip",
        "nodeHoverTooltipText",
        "nodeHoverTooltipMouseHint",
        "handleNodeHoverTooltip",
        "attachNodeHoverTooltipTarget",
        'addEventListener("mouseout"',
    ]:
        require(snippet not in app_source, f"node graph obsolete interaction code should be absent: {snippet}")

    for snippet in [
        "element.title = text",
        "dataset.tooltipTitle",
        "tooltipTitle",
        "title !== false",
    ]:
        require(snippet not in tooltip_utils_source, f"native hover tooltip path should be absent: {snippet}")

    for snippet in [
        "nodeGraphFindWirePickup",
        "dropPickedWire",
        "function findPickup(",
        "function pickupFromCandidate(",
        "function removeWireFromPatch(",
        "pickup?.anchorEndpoint",
        "nodeGraphMvp.dragging?.pickup",
        "wire reconnected",
        "modulation reconnected",
        "Alt+drag moves this patch point",
        "Plain drag reroutes wires",
    ]:
        require(snippet not in app_source, f"wire pickup/reroute code should be absent: {snippet}")
        require(snippet not in node_graph_source, f"wire pickup/reroute helper should be absent: {snippet}")
        require(snippet not in tooltip_source, f"wire pickup/reroute tooltip should be absent: {snippet}")

    require(
        'node.addEventListener("pointerdown", beginNodeGraphNodeDrag)' not in app_source,
        "module body should not start node drag",
    )
    require(
        'node.querySelector(".dsp-node-io-section")?.addEventListener("pointerdown", beginNodeGraphNodeDrag)' not in app_source,
        "module I/O section should not start node drag",
    )
    require(
        '".node-drag-handle, .node-header-title-row, .dsp-node-io-section"' not in app_source,
        "node drag handle selector should not include module I/O section",
    )

    for snippet in [
        'item.addEventListener("click", () => setNodeGraphSelection({ type: "node", id: nodeId }))',
        'setNodeGraphSelection({ type: "node", id })',
    ]:
        require(snippet not in app_source, f"module selection should be limited to move handles or marquee, not {snippet}")

    require(
        ".node-slider-readout {\n  border-color: transparent;" in style_source,
        "parameter readout border should disappear when not hovered",
    )
    require(
        ".node-slider-readout:hover,\n.node-slider-readout:focus,\n.node-slider-readout:focus-visible,\n.node-slider-readout:active {\n  border-color: transparent;\n  box-shadow: none;\n  outline: none;" in style_source,
        "parameter readout button states should not inherit global button hover strokes",
    )
    require(
        ".node-slider-readout.value-hovering::before {\n  border-color: transparent;\n  box-shadow: none;\n  outline: none;" in style_source
        and ".node-slider-readout.value-dragging::before {\n  border-color: transparent;\n  box-shadow: none;\n  outline: none;" in style_source,
        "slider hover/drag fill should not change stroke highlight",
    )
    require(
        ".node-slider-readout::before {\n  left: var(--value-start, calc(0% - 4px));\n  right: calc(100% - var(--value-end, calc(0% + 4px)));\n  border: 1px solid transparent;" in style_source,
        "slider fill slide element should not draw a stroke highlight",
    )
    require(
        ".node-slider-readout.value-hovering,\n.node-slider-readout.value-dragging {\n  border-color: transparent;\n  box-shadow: none;\n  outline: none;" in style_source,
        "slider hovering/dragging should not change readout stroke highlight",
    )
    require(
        "--node-slider-fill-hover-rgb" in style_source
        and "--node-slider-fill-hover-alpha" in style_source,
        "slider hover fill color/alpha variables missing",
    )
    require(
        "#nodeSnapGridViewButton.active {\n  border-color: transparent;" in style_source
        and "box-shadow: none;\n}" in style_source[
            style_source.index("#nodeSnapGridViewButton.active {"):
            style_source.index(".node-under-construction-view-button {")
        ],
        "active snap-to-grid button should not draw a stroke highlight",
    )
    require(
        'document.body.classList.remove("node-boot-loading")' in boot_loading_source
        and 'document.body.classList.add("node-boot-fading")' in boot_loading_source
        and 'document.body.classList.remove("node-boot-fading")' in boot_loading_source
        and 'document.body.classList.add("node-boot-ready")' in boot_loading_source
        and "}, 333);" in boot_loading_source
        and "}, 1000);" in boot_loading_source,
        "boot loading veil should fade for one third of a second after the one-second hold",
    )
    require(
        "--node-module-primary-text-color: rgba(243, 241, 236, 0.76);" in style_source
        and ".node-text-box-input" in style_source
        and ".node-header-title" in style_source
        and "color: var(--node-module-primary-text-color);" in style_source[
            style_source.index(".node-text-box-input {"):
            style_source.index(".node-text-box-input::-webkit-scrollbar")
        ]
        and "color: var(--node-module-primary-text-color);" in style_source[
            style_source.index(".node-header-title {"):
            style_source.index(".dsp-node-io-section")
        ],
        "text box text and module title should share the halfway brightness token",
    )
    require(
        "color-mix(in srgb, var(--node-slider-unit-color, #7fc7d9) 58%" in style_source
        and ".node-slider-readout:hover .node-slider-readout-unit" in style_source
        and ".node-slider-readout.value-dragging .node-slider-readout-unit" in style_source,
        "slider unit readout should be dim at rest and brighten on interaction",
    )

    for snippet in [
        'if (event.key === "Escape" && nodeGraphMvp.metadataEditorTarget)',
        "closeNodeMetadataPopover();\n  nodeGraphMvp.sceneContextPoint",
        "!popover.contains(event.target)",
    ]:
        require(snippet not in app_source, f"metadata popover should not close implicitly via {snippet}")

    for snippet in [
        ".node-graph-workspace",
        "body.node-boot-loading",
        "body.node-boot-fading",
        "body.node-boot-loading .shell",
        ".node-boot-loading-screen",
        "transition: opacity 333ms ease",
        "body.node-boot-loading .node-boot-loading-screen",
        "body.node-boot-fading .node-boot-loading-screen",
        "body.node-boot-ready .node-boot-loading-screen",
        "body.node-ear-protection-tripped",
        ".node-ear-protection-fault",
        "body.node-ear-protection-tripped .node-ear-protection-fault",
        "@keyframes nodeEarProtectionVeil",
        "@keyframes nodeEarProtectionPanel",
        "--node-toolbar-button-bg-alpha: 0.62",
        "--node-min-grid-brightness-alpha: 0.045",
        "background-color: rgba(32, 37, 42, var(--node-toolbar-button-bg-alpha))",
        "background: rgba(127, 199, 217, calc(var(--node-toolbar-button-bg-alpha) * 0.13))",
        "--node-graph-zoom: 1",
        "--node-graph-pan-x: 0px",
        "--node-graph-pan-y: 0px",
        "--node-visual-shake-x: 0px",
        "--node-visual-shake-y: 0px",
        "--node-visual-wash-alpha: 0",
        "--node-visual-wash-rgb: 0 0 0",
        ".node-graph-workspace::after",
        "background: rgb(var(--node-visual-wash-rgb) / var(--node-visual-wash-alpha))",
        "--node-grid-color-rgb: 255 255 255",
        "--node-header-height: calc(var(--node-grid-size) * 2.7142857)",
        "--node-body-row-height: calc(var(--node-grid-size) * 1.0714286)",
        "--node-grid-height: 28px",
        "--node-grid-width: 28px",
        "--node-port-size-ratio: 0.57",
        "--node-port-area-size: var(--node-grid-height)",
        "--node-port-diameter: calc(var(--node-port-area-size) * var(--node-port-size-ratio))",
        "--node-port-radius: calc(var(--node-port-diameter) * 0.5)",
        "--node-port-area-radius: calc(var(--node-port-area-size) * 0.5)",
        "--node-port-column-width: var(--node-port-area-radius)",
        "--node-wire-patch-point-size: 36%",
        "--node-signal-port-height: var(--node-port-diameter)",
        "--node-signal-port-width: var(--node-port-radius)",
        "width: calc(100% - 6px)",
        "height: max(560px, calc(100vh - 230px))",
        "min-width: calc(var(--node-grid-width) * 4)",
        "min-height: calc(var(--node-grid-height) * 4)",
        "margin: 3px auto 0",
        ".node-graph-workspace.panning",
        "cursor: grabbing",
        ".node-zoom-label",
        ".node-zoom-buttons",
        ".node-graph-zoom-surface",
        "left: var(--node-graph-pan-x)",
        "top: var(--node-graph-pan-y)",
        "background: transparent",
        ".node-grid-heatmap",
        "--node-grid-heatmap",
        "--node-grid-heatmap-mask",
        ".node-graph-workspace.grid-visible",
        ".node-module-scope-canvas",
        ".node-graph-workspace.module-scopes-enabled .node-module-scope-canvas",
        ".node-graph-workspace.module-oscilloscopes-hidden",
        ".node-graph-workspace.module-oscilloscopes-hidden .node-module-scope-canvas",
        ".node-graph-workspace.module-oscilloscopes-hidden .node-module-scope-window",
        ".node-scope-master-brightness-control",
        ".node-scope-master-brightness-control input",
        ".node-graph-workspace.module-buttons-hidden .dsp-node",
        ".node-graph-workspace.module-sliders-hidden .dsp-node",
        "height: auto",
        ".node-modular-shader-canvas",
        ".node-graph-workspace.shader-enabled .node-modular-shader-canvas",
        "--node-module-scope-height: calc(var(--node-grid-height) * 2)",
        ".dsp-node.visual-scope-layout",
        ".visual-scope-layout .node-module-square-scope-window",
        "aspect-ratio: 1 / 1",
        ".node-module-scope-window",
        ".node-module-scope-window-surface",
        "--node-scope-background",
        "background: var(--node-scope-background, #000)",
        "var(--node-visual-shake-x)",
        "var(--node-visual-shake-y)",
        ".node-clock-led-shell",
        ".node-clock-led",
        "--node-clock-led-brightness: 0",
        "--node-clock-led-glow: 0",
        ".node-clock-led::before",
        ".node-clock-led::after",
        ".node-module-scope-analyzer",
        ".node-module-scope-analyzer[hidden]",
        ".node-module-scope-analyzer span",
        "z-index: 2",
        "background-image:",
        "var(--node-min-grid-brightness-alpha)",
        "rgb(var(--node-grid-color-rgb) / var(--node-min-grid-brightness-alpha))",
        "rgb(var(--node-mouse-light-color-rgb) / 0.2)",
        "background-position: var(--node-graph-pan-x) var(--node-graph-pan-y)",
        "calc(var(--node-grid-width) * var(--node-graph-zoom))",
        "calc(var(--node-grid-height) * var(--node-graph-zoom))",
        "cursor: default",
        ".node-help-stack",
        "display: flex",
        "width: var(--node-workspace-view-width, calc(100% - 6px))",
        "max-width: none",
        "margin: 3px auto 0",
        ".node-help-stack.tips-hidden .node-interaction-help",
        ".node-interaction-help",
        ".node-interaction-help:empty",
        "--node-tooltip-text-size",
        "font-size: var(--node-tooltip-text-size)",
        "justify-content: center",
        "min-height: 72px",
        "height: 72px",
        "white-space: pre-line",
        "--node-module-grid-inset: calc(var(--node-grid-size) * 0.2142857)",
        "--node-grid-width-units",
        "--node-grid-height-units",
        ".node-settings-view",
        ".node-module-shop-view",
        ".node-module-shop-view[hidden]",
        ".node-module-shop-heading",
        ".node-module-shop-column",
        ".node-module-department-search-placeholder",
        ".node-module-department-search-placeholder input:disabled",
        ".node-scene-context-menu.node-module-collections-menu",
        ".node-module-collection-card",
        ".node-module-shop-section",
        ".node-module-shop-section-title",
        ".node-module-shop-section-title small",
        ".node-module-shop-heading .node-module-department-back-button",
        ".node-module-shop-heading .panel-close-button",
        ".node-video-view-panel",
        ".node-video-view-panel[hidden]",
        ".node-video-view-heading",
        ".node-video-view-frame",
        ".node-video-view-reticle",
        ".node-video-view-empty",
        ".node-settings-actions",
        "--node-front-button-hover-border",
        "--node-front-button-hover-bg",
        "--node-front-construction-hover-bg",
        ".node-view-toolbar button:not(:disabled):not(.active):hover",
        ".node-patch-community-control",
        ".node-graph-controls button:not(.node-debug-hidden-control)",
        ".node-settings-actions button:not(.node-settings-disabled-action)",
        ".node-under-construction-view-button[aria-disabled=\"true\"]:hover",
        ".node-settings-feature-action:hover",
        "background: var(--node-front-button-hover-bg)",
        "background: var(--node-front-construction-hover-bg)",
        "minmax(0, 4fr)",
        ".node-settings-script-action-group",
        "grid-template-columns: repeat(3, minmax(0, 1fr))",
        ".node-settings-feedback-action-group",
        "overflow: visible",
        ".node-settings-script-action-group button + button",
        ".node-settings-script-action-group button:hover",
        ".node-settings-dev-action-group .node-settings-disabled-action:hover",
        "z-index: 2",
        ".node-settings-feedback-action-group .node-settings-link-action + .node-settings-link-action",
        ".node-ui-dev-actions",
        ".node-ui-dev-actions button",
        ".node-ui-dev-actions .pill",
        ".node-user-ui-settings-panel",
        ".node-user-ui-settings-heading",
        ".node-user-ui-settings-drag-handle",
        ".node-user-ui-settings-controls",
        ".node-user-ui-setting-control",
        ".node-ui-dev-control.has-expose",
        ".node-ui-dev-color-control.has-expose",
        ".node-ui-dev-expose",
        ".node-settings-grid",
        "grid-template-columns: minmax(0, 1fr)",
        ".node-settings-sample-rate-row",
        ".node-settings-grid-unit-row",
        ".node-script-grid-settings",
        ".node-mapping-view",
        ".node-mapping-grid",
        ".node-mapping-cell",
        ".node-mapping-cell.active",
        "grid-template-columns: repeat(4, minmax(0, 1fr))",
        "scale(var(--node-graph-zoom))",
        ".node-graph-workspace.resizing",
        ".node-graph-resize-handle",
        ".node-graph-empty-module-button",
        ".node-graph-workspace:not(.empty-patch) .node-graph-empty-module-button",
        "cursor: nwse-resize",
        ".node-wiring-panel .audio-panel",
        ".node-patch-header-fields",
        ".node-patch-community-control",
        ".node-patch-header-field",
        ".node-patch-header-field.name",
        ".node-patch-header-field.tags",
        ".node-wire-svg",
        ".node-wire-path",
        ".node-wire-gradient-stop",
        ".node-modulation-wire-gradient-stop",
        ".node-modulation-wire-path",
        ".node-wire-path.state-read",
        ".node-wire-path.inactive-wire",
        ".node-wire-path.inactive-wire.selected",
        ".node-wire-path.selected",
        ".node-wire-hit-path",
        ".node-wire-path.temp",
        ".node-wire-path.destroyed",
        "@keyframes node-wire-destroyed",
        ".node-selection-marquee",
        ".dsp-node",
        ".dsp-node-header",
        "box-sizing: border-box;",
        "min-width: 0;",
        "grid-template-rows: var(--node-header-title-row-height) minmax(0, 1fr)",
        "border-radius: 5px",
        "grid-template-rows: var(--node-header-height) var(--node-module-scope-height) auto minmax(0, 1fr)",
        ".dsp-node-body",
        "grid-auto-rows: minmax(var(--node-body-row-height), 1fr)",
        "gap: var(--node-body-row-gap)",
        ".dsp-node-io-section",
        ".node-io-column",
        ".node-io-column.input",
        ".node-io-column.output",
        ".node-io-row.input",
        ".node-io-row.output",
        ".node-io-label",
        "cursor: crosshair",
        ".node-io-row:hover",
        ".node-io-row.patch-point-hover",
        ".node-header-actions",
        "align-self: stretch",
        "align-items: stretch",
        "grid-template-columns: repeat(15, minmax(0, 1fr))",
        ".node-under-construction-view-button",
        "repeating-linear-gradient(",
        "width: 100%",
        "height: 100%",
        "margin: 0",
        "overflow: hidden",
        ".node-header-title-row",
        "justify-content: center",
        "linear-gradient(180deg, rgba(2, 4, 7, 0.98), rgba(8, 10, 13, 0.92))",
        ".node-header-title",
        ".scene-context-alias-control",
        ".scene-context-alias-control input",
        ".dsp-node.buttons-hidden",
        ".node-graph-workspace.module-buttons-hidden .dsp-node .node-header-actions",
        ".node-graph-workspace.module-sliders-hidden .dsp-node-body",
        ".dsp-node.title-hidden",
        ".node-graph-workspace.module-buttons-hidden .dsp-node:not(.title-hidden)",
        ".dsp-node.buttons-hidden.title-hidden",
        ".dsp-node.placing",
        ".node-graph-workspace.module-buttons-hidden .dsp-node.title-hidden",
        "visibility: hidden",
        "text-align: center",
        "text-transform: none",
        "--node-module-fill",
        "--node-module-stroke",
        "--node-module-selected-stroke",
        "--node-port-hover-fill",
        "--node-port-hover-stroke",
        "--node-hover-glow-spread",
        "--node-input-fill",
        "--node-output-fill",
        "--node-mod-input-fill",
        "--node-param-output-fill",
        "--node-bypass-icon-size-ratio: 0.36",
        ".node-ui-dev-color-section",
        ".node-ui-dev-bypass-icon-control .node-ui-dev-control-row",
        ".node-ui-dev-bypass-icon-preview",
        'font-size: calc(var(--node-ui-dev-bypass-preview-size, 0.36) * 28px)',
        "font-size: calc(var(--panel-close-glyph-size-ratio, 0.5) * 100cqh)",
        ".node-ui-dev-color-control",
        "color-mix(in srgb, var(--node-module-stroke)",
        "color-mix(in srgb, var(--node-port-hover-fill)",
        ".node-wiring-panel.settings-header-layout-debug .node-parameter-metadata-popover",
        ".node-wiring-panel.settings-header-layout-debug .node-scene-context-menu",
        ".node-wiring-panel.settings-header-layout-debug .metadata-popover-heading",
        ".node-wiring-panel.settings-header-layout-debug .scene-context-heading",
        ".node-wiring-panel.settings-header-layout-debug .metadata-popover-grid",
        ".node-wiring-panel.settings-header-layout-debug .scene-context-selected-module",
        ".node-wiring-panel.settings-header-layout-debug .scene-context-alias-control",
        ".node-parameter-row",
        "grid-template-columns: var(--node-port-column-width) minmax(0, 1fr) var(--node-port-column-width)",
        "grid-template-rows: var(--node-slider-readout-height)",
        "column-gap: 0",
        "height: max(",
        "calc(var(--node-slider-readout-height) + (var(--node-slider-row-padding-block) * 2))",
        "height: var(--node-slider-readout-height)",
        "/* TODO: temporary hardcoded value */",
        "transform: translateY(2px)",
        "align-self: stretch",
        "align-items: center",
        "padding: var(--node-slider-row-padding-block) 0",
        ".node-slider-readout-label",
        "font-family: \"Cascadia Mono\", \"Cascadia Code\", Consolas, \"Courier New\", monospace",
        ".node-parameter-control",
        ".dsp-node.dragging",
        ".dsp-node.selected",
        ".dsp-node.bypassed",
        ".dsp-node.removed",
        ".node-drag-handle",
        ".node-drag-handle.dragging",
        ".node-drag-handle:hover",
        ".node-action-button",
        ".node-action-button:hover",
        "color: color-mix(in srgb, var(--accent) 58%",
        ".node-bypass-button",
        "container-type: size",
        'content: "\\1F5F2"',
        "font-size: calc(var(--node-bypass-icon-size-ratio) * 100cqh)",
        ".node-bypass-button:hover",
        "border-color: transparent",
        ".node-bypass-button[aria-pressed=\"true\"]",
        ".node-bypass-button[aria-pressed=\"true\"]:hover",
        "rgba(122, 28, 28, 0.72)",
        ".node-execution-order-badge",
        ".node-execution-order-badge:hover",
        "color: color-mix(in srgb, var(--good) 62%",
        "width: 100%",
        "height: 100%",
        "min-height: 0",
        ".node-execution-order-badge[data-execution-state=\"bypassed\"]",
        ".node-execution-order-badge[data-execution-state=\"inactive\"]",
        ".node-live-input-state-badge",
        "--node-live-input-peak",
        "#nodeLiveInputTestStatus",
        ".node-live-input-state-badge[data-mic-state=\"connected\"]",
        ".node-runtime-sketch-heading",
        ".node-runtime-sketch",
        "max-height: 260px",
        "pointer-events: auto;",
        ".node-port.output",
        ".node-port.input",
        ".node-port.output.connected-port",
        ".node-port.input.connected-port",
        ".node-port.connected-port::after",
        ".node-param-port.connected-port::after",
        ".node-port:not(.node-param-port).connected-port::before",
        ".node-param-port.connected-port::before",
        "display: none",
        "--node-patch-point-color",
        "width: var(--node-wire-patch-point-size)",
        "0 0 var(--node-hover-glow-size) var(--node-hover-glow-spread)",
        ".node-port.connected-port.patch-point-hover::after",
        ".node-param-port",
        "grid-column: 1",
        "grid-row: 1",
        "align-self: center",
        "width: var(--node-port-area-radius)",
        "min-width: var(--node-port-area-radius)",
        "height: var(--node-port-area-size)",
        ".node-param-port.modulation-input",
        "border-radius: 0 999px 999px 0",
        ".node-param-port.modulation-input.connected-port",
        ".node-param-port.parameter-output",
        "border-radius: 999px 0 0 999px",
        ".node-param-port.parameter-output.connected-port",
        "grid-column: 3",
        ".node-zap-particle",
        "@keyframes node-zap-burst",
        "border-left-width: 0",
        "rgba(177, 132, 255",
        ".node-modular-only-back-button",
        ".node-wiring-panel.modular-only-view .node-modular-only-back-button",
        ".node-palette",
        ".node-live-toggle-palette",
        "grid-template-columns: repeat(2, minmax(0, 1fr))",
        ".node-live-toggle-palette .node-live-toggle + .node-live-toggle",
        "margin-left: -1px",
        ".node-live-toggle-palette .node-live-toggle span",
        ".node-live-toggle.active",
        "box-shadow: inset 0 0 0 1px rgba(242, 93, 93, 0.76)",
        ".node-live-toggle.active:hover",
        ".node-render-duration-control",
        ".node-render-duration-control input",
        ".node-live-controls",
        ".node-visual-output",
        ".node-visual-output-heading",
        ".node-visual-output-meta",
        ".node-execution-plan-summary",
        ".node-execution-policy",
        ".node-bad-value-monitor-evidence",
        ".node-bad-value-monitor-evidence li",
        ".node-bad-value-monitor-evidence li[data-bad-value-reason]",
        ".node-execution-order",
        ".node-execution-wire-modes",
        ".node-execution-order li.selected",
        ".node-execution-wire-modes li.selected",
        ".node-execution-wire-modes li.state-read",
        ".node-execution-wire-modes li.bypassed",
        ".node-execution-plan-debug",
        "body.debug-collapsed",
        "body.debug-collapsed .status-strip",
        ".node-slider-readout",
        ".node-slider-readout.choices-divided",
        ".node-slider-amount-fill",
        ".node-graph-workspace.show-slider-amount .node-slider-amount-fill",
        ".node-graph-workspace.hide-slider-position .node-slider-readout::before",
        '[data-slider-layout="label-value-slider"] .node-slider-readout-label',
        '[data-slider-layout="label-value-slider"] .node-slider-readout-value',
        '[data-slider-layout="label-value-slider"] .node-slider-readout-unit',
        '[data-slider-layout="value-unit-left"] .node-slider-readout-value',
        '[data-slider-layout="value-unit-left"] .node-slider-readout-unit',
        '[data-slider-layout="value-unit-right"] .node-slider-readout-value',
        '[data-slider-layout="value-unit-right"] .node-slider-readout-unit',
        '[data-slider-layout="label-outside-no-unit"] .node-slider-readout-label',
        '[data-slider-layout="label-outside-no-unit"] .node-slider-readout-value',
        '[data-slider-layout="label-outside-no-unit"] .node-slider-readout-unit',
        '[data-slider-layout="value-outside"] .node-slider-readout-label',
        '[data-slider-layout="value-outside"] .node-slider-readout-value',
        '[data-slider-layout="value-outside"] .node-slider-readout-unit',
        '[data-slider-layout="value-focus"] .node-slider-readout-label',
        '[data-slider-layout="value-focus"] .node-slider-readout-value',
        '[data-slider-layout="value-focus"] .node-slider-readout-unit',
        ".node-choice-debug-layer",
        ".node-choice-debug-square",
        ".node-choice-debug-cell-debug",
        ".node-choice-debug-wall",
        ".node-choice-debug-slider-wall",
        ".node-wiring-panel.choice-slider-debug .node-choice-debug-cell-debug",
        ".node-wiring-panel.choice-slider-debug .node-choice-debug-wall",
        ".node-wiring-panel.choice-slider-debug .node-choice-debug-slider-wall",
        "height: 100%",
        "padding: var(--node-slider-padding-block) var(--node-slider-padding-inline)",
        "var(--value-start",
        "var(--value-end",
        "var(--choice-divider-background",
        "var(--ghost-start",
        "var(--portal-left-width",
        "var(--portal-right-width",
        ".node-slider-readout::after",
        ".node-slider-readout.has-ghost-slider::after",
        ".node-slider-readout-portal",
        ".node-slider-readout-portal-left",
        ".node-slider-readout-portal-right",
        "grid-template-columns: minmax(0, 1fr) auto",
        "grid-template-rows: minmax(0, 1fr) minmax(0, 1fr)",
        "row-gap: 0",
        ".node-slider-readout.value-dragging",
        ".node-slider-readout-label",
        ".node-slider-readout-value",
        "white-space: pre;",
        ".node-slider-readout-unit",
        ".node-slider-readout-unit.is-empty",
        ".node-slider-readout-input",
        "scrollbar-width: none",
        ".node-text-box-input::-webkit-scrollbar",
        "--node-text-box-font-fit-scale",
        "overflow: hidden",
        ".scene-context-text-box-text-control",
        ".scene-context-range-control",
        ".scene-context-text-box-text-control textarea",
        ".scene-context-range-control input[type=\"range\"]",
        ".node-parameter-metadata-popover",
        ".metadata-popover-title-group",
        ".metadata-popover-drag-handle",
        ".metadata-popover-drag-handle.dragging",
        ".metadata-choices-label",
        ".metadata-checkbox-label",
        ".metadata-popover-grid",
        ".metadata-popover-grid button.armed",
        "button.confirming-default",
        "button.saved-default",
        ".node-script-actions button.saved-default",
        ".node-ui-dev-actions button.saved-default",
        "@keyframes node-default-saved-pulse",
        ".node-scene-context-menu",
        ".node-visibility-menu",
        ".node-visibility-menu-list",
        "width: min(430px, calc(100vw - 28px))",
        "max-height: min(760px, calc(100vh - 28px))",
        ".node-scene-context-menu[hidden]",
        ".scene-context-heading",
        ".scene-context-drag-handle",
        ".scene-context-drag-handle.dragging",
        ".scene-context-title",
        "min-height: 2.1em",
        ".scene-context-store-ledger",
        ".scene-context-store-department-list",
        ".scene-context-store-department-card",
        ".scene-context-store-department-symbol",
        ".scene-context-store-department-title",
        ".scene-context-store-list",
        ".scene-context-store-row",
        ".scene-context-store-department-heading",
        ".scene-context-store-department-heading:first-child",
        ".scene-context-store-card",
        ".scene-context-store-card-description",
        ".scene-context-store-manual-note",
        ".scene-context-store-preview",
        ".scene-context-store-preview-shell",
        ".scene-context-store-preview-header",
        ".scene-context-store-preview-body",
        ".scene-context-store-preview-ports",
        ".scene-context-store-preview-core",
        ".scene-context-store-preview[data-module-category=\"Chaos\"] .scene-context-store-preview-core",
        ".scene-context-store-empty",
        ".scene-context-store-card-actions",
        ".scene-context-width-controls",
        ".scene-context-width-controls[hidden]",
        ".scene-context-scope-fields",
        ".node-scope-settings-section",
        ".node-scope-settings-section-title",
        ".node-individual-scope-controls[hidden]",
        ".scene-context-text-box-controls > div.four",
        ".scene-context-text-box-controls > div.five",
        ".scene-context-scope-fields input",
        ".scene-context-scope-fields input.value-dragging",
        ".node-master-scope-dot-preview-shell",
        ".node-master-scope-dot-preview",
        ".node-master-scope-dot-core-title",
        "background: #000",
        ".node-shader-script-dialog",
        ".node-shader-script-panel",
        ".node-shader-script-dialog textarea",
        ".node-shader-script-actions",
        ".panel-close-button",
        "aspect-ratio: 1 / 1",
        "max-inline-size: 2em",
        "max-block-size: 2em",
        "container-type: size",
        ".scene-context-danger",
        ".node-scene-context-menu button kbd",
        "display: none;",
        ".disconnect-wire-button",
        ".node-connection-list li.selected",
        ".node-connection-list li.state-read",
        ".node-connection-list li.inactive-wire",
        ".node-connection-list li.inactive-wire.selected",
        ".node-graph-output",
        ".node-waveform",
        ".node-signal-plot",
    ]:
        require(snippet in style_source, f"node graph style missing {snippet}")

    for snippet in [
        "class NodeLiveAudioProcessor extends AudioWorkletProcessor",
        'registerProcessor("node-live-audio-processor", NodeLiveAudioProcessor)',
        'message.type === "setPlan"',
        'message.type === "setParams"',
        'message.type === "stop"',
        "setParams(nodes, message = {})",
        "const patchFingerprint = message.patchFingerprint || plan?.patchFingerprint || \"\"",
        "const patchFingerprint = message.patchFingerprint || \"\"",
        "this.planSerial = message.planSerial || 0",
        "this.sessionId = message.sessionId || 0",
        "let parameterCount = 0",
        "parameterCount += Object.keys(current.params || {}).length",
        "planSerial: this.planSerial",
        "sessionId: this.sessionId",
        "stateReadCount:",
        "feedbackModulations: (Array.isArray(plan?.feedbackModulations)",
        "feedbackSignals: (Array.isArray(plan?.feedbackConnections)",
        "parameterCount,",
        "patchFingerprint,",
        'type: "planApplied"',
        'type: "paramsApplied"',
        'type: "meter"',
        'type: "scope"',
        "this.meterClipCount = 0",
        "this.meterProtectionMuteCount = 0",
        "this.engineSampleRate = sampleRate",
        "this.hostSampleRate = sampleRate",
        "this.oversamplingRatio = 1",
        "this.badNumberCount = 0",
        "this.lastBadValueReason = \"\"",
        "this.lastBadValueNodeId = \"\"",
        "this.lastBadValueSource = \"\"",
        "this.earProtector = this.createEarProtector(sampleRate)",
        "createEarProtector(rate = sampleRate)",
        "const b0 = 0.5 * (1 + a1)",
        "const b1 = -b0",
        "outputSampleClipped(value)",
        "badValueReason(value)",
        "scopeScalarValue(value)",
        "captureModuleScopeFrame()",
        "postModuleScopeSnapshot()",
        "this.scopeBuffers = new Map()",
        "this.scopeInputs = new Map()",
        "scopeInputPort: node.scopeInputPort || \"\"",
        "const scopeValue = node?.scopeInputPort && this.scopeInputs.has(nodeId)",
        "samples.push(this.scopeScalarValue(scopeValue))",
        "this.scopeInputs.set(nodeId, mixInput(nodeId, node.scopeInputPort))",
        "values.push([nodeId, samples])",
        "sampleRate: this.engineSampleRate",
        "const requestedRatio = Number(message.oversamplingRatio)",
        "this.oversamplingRatio = Math.max(1, Math.min(4, Math.round(requestedRatio) || 1))",
        "Math.abs(number) > 999999999",
        "Math.abs(number) < 1.1754943508222875e-38",
        "clipCount: this.meterClipCount",
        "badNumberCount: this.badNumberCount",
        "lastBadValueReason: this.lastBadValueReason",
        "lastBadValueNodeId: this.lastBadValueNodeId",
        "lastBadValueSource: this.lastBadValueSource",
        "protectionMuteCount: this.meterProtectionMuteCount",
        "buildModulationConnectionMap(modulations, ids)",
        "normalizeParameterModulationInput(value, metadata = {})",
        "applyParameterModulation(base, modulationSignal, metadata = {})",
        "metadata?.kind === \"frequency\" && metadata.nonlinearSlider",
        "const octaves = (Number(modulationSignal) || 0) / 0.1",
        "this.normalizeParameterModulationInput(this.readRuntimePortOutput(",
        "this.applyParameterModulation(base, modulationSignal, metadata)",
        "this.nodeOutputs = new Map()",
        "this.noiseSeedKeys = new Map()",
        "this.bandpassStates = new Map()",
        "this.cookbookFilterStates = new Map()",
        "this.ladderFilterStates = new Map()",
        "this.clockDividerStates = new Map()",
        "this.clockStates = new Map()",
        "this.delayedTriggerStates = new Map()",
        "this.expAdsrStates = new Map()",
        "this.fractalBrownianNoiseStates = new Map()",
        "this.flowerChildEnvelopeFollowerStates = new Map()",
        "this.highpassStates = new Map()",
        "this.linearEnvelopeStates = new Map()",
        "this.lowpassStates = new Map()",
        "this.noiseGeneratorStates = new Map()",
        "this.noiseSampleHoldStates = new Map()",
        "this.oscResetStates = new Map()",
        "this.noiseSeeds.set(`${id}:left`, this.stableSeed(`${id}:left`))",
        "this.randomClockStates = new Map()",
        "this.randomWalkStates = new Map()",
        "this.sampleHoldStates = new Map()",
        "this.slewLimiterStates = new Map()",
        "this.stepSequencerStates = new Map()",
        "this.triggerCounterStates = new Map()",
        "this.triggerDividerStates = new Map()",
        "this.vactrolEnvelopeStates = new Map()",
        "createVisualControlState()",
        "resetVisualControls()",
        "this.resetVisualControls()",
        "this.pluckEnvelopeStates = new Map()",
        "this.spiralStates = new Map()",
        "this.triangleStates = new Map()",
        "polyBlep(phaseCycle, phaseIncrement)",
        "polyBlepSquare(phaseCycle, phaseIncrement)",
        "oscillatorSample(nodeId, phase, phaseIncrement, waveform)",
        "const phaseIncrement = (frequency / safeRate) + incrementInput",
        "return 1 - phaseCycle * 2 + this.polyBlep(phaseCycle, phaseIncrement)",
        "this.oscResetStates",
        "this.triangleStates.set(nodeId, 0)",
        "noiseSeedKey(nodeId, seedValue, channel = \"\")",
        "nextSeededNoiseSample(nodeId, seedValue, channel = \"\")",
        "noiseSampleHoldSample(state, nodeId, seedValue, speed, rate = sampleRate)",
        "this.noiseSeedKeys.get(noiseId) !== seedKey",
        "this.noiseSeeds.set(noiseId, this.stableSeed(seedKey))",
        "createHighpassState()",
        "createLowpassState()",
        "createBandpassState()",
        "createCookbookFilterState()",
        "createLadderFilterState()",
        "cookbookFilterCoefficients(mode, frequency, q, gainDb",
        "cookbookFilterSample(state, input, mode, frequency, q, gainDb, stages",
        "ladderFilterCoefficients(frequency, resonance, mode, stages",
        "ladderFilterSample(state, input, params, rate = sampleRate)",
        "y[0] = coeff.g * safeInput - coeff.k * y[4]",
        'node?.type === "cookbookFilter"',
        'node?.type === "ladderFilter"',
        "createOscResetState()",
        "createSlewLimiterState()",
        "createClockState()",
        "createRandomClockState()",
        "createDelayedTriggerState()",
        "createSampleHoldState()",
        "createStepSequencerState()",
        "createTriggerCounterState()",
        "createTriggerDividerState()",
        "createExpAdsrState()",
        "createLinearEnvelopeState()",
        "createPluckEnvelopeState()",
        "createVactrolEnvelopeState()",
        "createFlowerChildEnvelopeFollowerState()",
        "createNoiseGeneratorState()",
        "createNoiseSampleHoldState()",
        "createRandomWalkState()",
        "createFractalBrownianNoiseState()",
        "onePoleHighpassSample(state, input, frequency, rate = sampleRate)",
        "onePoleLowpassSample(state, input, frequency, rate = sampleRate)",
        "onePoleBandpassSample(state, input, lowFrequency, highFrequency, rate = sampleRate)",
        "slewLimiterSample(state, input, upTime, downTime, rate = sampleRate)",
        "Math.max(-maxFall, Math.min(maxRise, delta))",
        "clockSample(state, rate, duty, level, rateHz = sampleRate)",
        "randomClockSample(state, reset, params, rateHz = sampleRate, nodeId = \"\")",
        "const incomingClockRate = (nodeId) =>",
        "this.inputConnections.get(this.inputKey(nodeId, \"Clock\"))",
        "delayedTriggerSample(state, trigger, reset, params, rateHz = sampleRate)",
        "sampleHoldSample(state, input, trigger, threshold)",
        "stepSequencerSample(state, trigger, reset, params)",
        "triggerCounterSample(state, trigger, reset, params, rate = sampleRate)",
        "triggerDividerSample(state, trigger, reset, params, rate = sampleRate)",
        "pluckEnvelopeSample(state, trigger, release, params, rate = sampleRate)",
        "linearEnvelopeSample(state, gate, params, rate = sampleRate)",
        "vactrolEnvelopeCoefficient(seconds, rate = sampleRate)",
        "vactrolEnvelopeSample(state, light, params, rate = sampleRate)",
        "flowerChildSecondsToSamples(seconds, rate = sampleRate)",
        "flowerChildEnvelopeFollowerSample(state, input, params, rate = sampleRate)",
        "exponentialCurve(value, skew)",
        "noiseGeneratorSample(state, params, nodeId)",
        "randomWalkSample(state, params, rate = sampleRate, nodeId = \"\")",
        "fractalBrownianNoiseAxisState(state, axis)",
        "fractalBrownianNoiseSample(state, params, rate = sampleRate, nodeId = \"\", axis = \"x\")",
        "fractalBrownianNoiseVector(state, params, rate = sampleRate, nodeId = \"\")",
        "\"Out X\": this.fractalBrownianNoiseSample(state, params, rate, nodeId, \"x\")",
        "\"Out Y\": this.fractalBrownianNoiseSample(state, params, rate, nodeId, \"y\")",
        "\"Out Z\": this.fractalBrownianNoiseSample(state, params, rate, nodeId, \"z\")",
        "rationalCurve(value, skew)",
        "smoothNoise1d(x, seed)",
        "expAdsrCalcCoef(rate, targetRatio)",
        "expAdsrSample(state, gate, params, rate = sampleRate)",
        "Math.exp(-Math.log((1 + safeRatio) / safeRatio) / safeRate)",
        "monitorBadValueSample(value, nodeId)",
        "visualControlIntensity(value, nodeId, source = \"visual control\")",
        "visualControlSigned(value, nodeId, source = \"visual control\")",
        "smoothVisualControl(key, target, rate = sampleRate, seconds = 0.045, min = 0, max = 1)",
        "postVisualControls()",
        "blue: this.clampValue(this.visualControls.blue, 0, 1)",
        "chromaAlpha: this.clampValue(this.visualControls.chromaAlpha, 0, 1)",
        "chromaHue: this.clampValue(this.visualControls.chromaHue, 0, 1)",
        "chromaSaturation: this.clampValue(this.visualControls.chromaSaturation, 0, 1)",
        "visualBloom: this.clampValue(this.visualControls.visualBloom, 0, 1)",
        "visualBrightness: this.clampValue(this.visualControls.visualBrightness, 0, 1)",
        "visualGlow: this.clampValue(this.visualControls.visualGlow, 0, 1)",
        "scopePaused: this.clampValue(this.visualControls.scopePaused, 0, 1)",
        "scopeTracesOff: this.clampValue(this.visualControls.scopeTracesOff, 0, 1)",
        "screenDim: this.clampValue(this.visualControls.screenDim, 0, 1)",
        "x: this.clampValue(this.visualControls.x, -1, 1)",
        'node?.type === "valueSlider"',
        "value = { Bias: offset, Out: offset, offset }",
        'type: "visualControls"',
        "visualSinkCount: Array.isArray(plan?.visualSinks) ? plan.visualSinks.length : 0",
        "speakerOutputActive: Boolean(plan?.speakerOutputActive)",
        "visualSinks: Array.isArray(plan?.visualSinks) ? plan.visualSinks : []",
        "b0 * safeInput + b1 * state.inputBuffer + a1 * state.outputBuffer",
        "b0 * safeInput + a1 * state.outputBuffer",
        "evaluateFrame(frame, frames, inputs = [], rate = this.engineSampleRate || sampleRate, inputFrame = frame)",
        "const engineFrames = frames * oversamplingRatio",
        "const subframeOutput = this.evaluateFrame(engineFrame, engineFrames, inputs, engineSampleRate, frame)",
        "left: leftSum / oversamplingRatio",
        "readRuntimeOutput(frameValues, nodeId, port = \"Out\")",
        "output[port] ?? output.Out",
        "readRuntimePortOutput(frameValues, nodeId, port = \"Out\"",
        "normalizeParameterOutputValue(value, metadata = {})",
        "parameterValueToNormalizedSignal(value, metadata = {})",
        "normalizedSignalToParameterValue(signal, metadata = {})",
        "jerobeamSpiralSample(options)",
        "spiralRender(inX, inY, inZ, zDepth)",
        "spiralShape(lophas, phasor, dense, div, morph)",
        "spiralRotate(inX, inY, inZ, rotX, rotY)",
        "spiralNextPhasor(state, key, frequency, offset, sampleRate, bipolar = false)",
        'node?.type === "audioInput"',
        'this.readEffectiveParameter(node, "level", 1',
        'node?.type === "spiral"',
        'node?.type === "highpass"',
        'node?.type === "lowpass"',
        'node?.type === "bandpass"',
        'node?.type === "slewLimiter"',
        'node?.type === "randomClock"',
        'node?.type === "clockDivider"',
        'node?.type === "delayedTrigger"',
        'node?.type === "sampleHold"',
        'node?.type === "midiOut"',
        'node?.type === "midiNotePitch"',
        'node?.type === "keyboardController"',
        'node?.type === "macroControls"',
        'node?.type === "pitchModWheel"',
        'node?.type === "stepSequencer"',
        'node?.type === "triggerCounter"',
        'node?.type === "triggerDivider"',
        'node?.type === "expAdsr"',
        'node?.type === "linearEnvelope"',
        'node?.type === "pluckEnvelope"',
        'node?.type === "vactrolEnvelope"',
        'node?.type === "flowerChildEnvelopeFollower"',
        "this.flowerChildEnvelopeFollowerSample(",
        'node?.type === "sandboxVisuals"',
        'node?.type === "bloomGlow"',
        'node?.type === "rgbaHsla"',
        'node?.type === "chromaColor"',
        "this.visualControlIntensity(mixInput(nodeId, \"Shake\"), nodeId, \"screen visuals shake\")",
        "this.visualControlSigned(mixInput(nodeId, \"X\"), nodeId, \"sandbox visuals x\")",
        "this.visualControlIntensity(mixInput(nodeId, \"Dim\"), nodeId, \"screen visuals dim\")",
        "this.visualControlIntensity(mixInput(nodeId, \"Scope Off\"), nodeId, \"screen visuals scope off\")",
        "this.visualControlIntensity(mixInput(nodeId, \"Pause\"), nodeId, \"screen visuals pause\")",
        'read("screenDim", 0)',
        'read("visualBrightness", 0.55)',
        'read("visualBloom", 0.45)',
        'read("visualGlow", 0.6)',
        "this.visualControlIntensity(mixInput(nodeId, \"HSL Mix\"), nodeId, \"rgba hsla hsl mix\")",
        "this.visualControlIntensity(mixInput(nodeId, \"Alpha\"), nodeId, \"rgba hsla alpha\")",
        'read("chromaHue", 0.58)',
        'read("visualBrightness", 0.55)',
        '"Full Value": outputMidiNumber',
        "Normalized: outputMidiNumber / 127",
        "440 * (2 ** ((pitch - 69) / 12))",
        '"Pitch 0-1": pitch / 127',
        '"Pitch 0-127": pitch',
        "const outputFrequency = Math.max(0, Number(signal.frequency) || frequency);",
        "Increment: outputFrequency / safeRate",
        "Pause: scopePaused",
        "ScopeOff: scopeTracesOff",
        'node?.type === "noiseGenerator"',
        'node?.type === "stereoNoise"',
        'this.readEffectiveParameter(node, "seed", 1',
        'this.readEffectiveParameter(node, "speed", 1',
        "this.noiseSampleHoldStates.get(nodeId)",
        "this.noiseSampleHoldSample(",
        'this.nextNoiseSample(`${nodeId}:left`)',
        'node?.type === "randomWalk"',
        'node?.type === "fractalBrownianNoise"',
        'node?.type === "badvalMonitor"',
        "this.monitorBadValueSample(mixInput(nodeId), nodeId)",
        "normalizeGraph(value = {})",
        "graphRationalCurve(position, contour = 0)",
        "graphExponentialCurve(position, contour = 0)",
        "graphValueAt(graphValue, xValue)",
        'node?.type === "graph"',
        "this.graphValueAt(node.graph, mixInput(nodeId))",
        'this.readEffectiveParameter(node, "frequency", 1000',
        "readEffectiveParameter(node, key, fallback, frame, frames, frameValues)",
        "evaluateFrame(frame, frames, inputs = [], rate = this.engineSampleRate || sampleRate, inputFrame = frame)",
        "process(inputs, outputs)",
        "const input = inputs[0] || []",
        "inputPeak: this.inputMeterPeak",
        "inputRms: Math.sqrt(this.inputMeterSquareSum / Math.max(1, this.inputMeterSamples))",
        "const outputVolume = outputNode",
        'const outputMono = mixInput(this.outputNode || "output", "Mono")',
        'left: (outputMono + mixInput(this.outputNode || "output", "Left")) * outputVolume',
        'right: (outputMono + mixInput(this.outputNode || "output", "Right")) * outputVolume',
        "modulation.sourcePort",
        "const protectedFrame = this.earProtector.protect(frameOutput.left, frameOutput.right)",
        "this.clampValue(protectedFrame.left, -0.95, 0.95)",
        "for (const channel of output)",
    ]:
        require(snippet in worklet_source, f"live audio worklet source missing {snippet}")


def require_readme_scheduler_contract() -> None:
    readme_source = (ROOT / "README.md").read_text(encoding="utf-8")
    readme_text = " ".join(readme_source.split())
    for snippet in [
        "git clone https://github.com/soundemote/soemdsp-sandbox.git",
        "cd soemdsp-sandbox",
        "python server.py",
        "http://127.0.0.1:8765",
        "python scripts\\smoke_test.py",
        "No package install is required for the sandbox server.",
        "The server is read-only.",
        "The browser patch graph is demo-scoped state.",
        "The browser compiler is not the production soemdsp scheduler.",
        "The WebUI does not instantiate real C++ DSP objects yet.",
        "Patch files can save current module instances and settings.",
        "Patch files cannot define new module types by themselves.",
    ]:
        require(snippet in readme_text, f"README scheduler contract missing {snippet}")
    for snippet in [
        "Feedback routing remains blocked",
        "acyclic browser patches",
    ]:
        require(snippet not in readme_text, f"README scheduler contract still has stale text: {snippet}")


def fetch_valid_manifest_payload(base_url: str) -> dict[str, object]:
    manifest_response = request(f"{base_url}/api/manifest")
    require(manifest_response.status == 200, "manifest endpoint did not return 200")
    require_json_response_metadata(manifest_response, "manifest endpoint")
    payload = json.loads(manifest_response.body.decode("utf-8"))
    require(isinstance(payload, dict), "manifest response payload was not object")
    require(payload.get("ok") is True, "manifest payload was not ok")
    manifest_path = payload.get("manifestPath")
    artifact_root = payload.get("artifactRoot")
    require(isinstance(manifest_path, str) and manifest_path, "manifest path missing")
    require(isinstance(artifact_root, str) and artifact_root, "artifact root missing")
    manifest_file = Path(manifest_path).resolve()
    require(manifest_file.is_file(), "manifest path does not point to a file")
    require(Path(artifact_root).resolve() == manifest_file.parent, "artifact root mismatch")
    require_manifest_file_info(payload, manifest_file, "manifest endpoint")
    return payload


def require_node_metadata_kinds_transport(base_url: str) -> None:
    response = request(f"{base_url}/api/node-metadata-kinds")
    require(response.status == 200, "node metadata kinds endpoint did not return 200")
    require_json_response_metadata(response, "node metadata kinds endpoint")
    payload = json.loads(response.body.decode("utf-8"))
    require(isinstance(payload, dict), "node metadata kinds payload was not object")
    require(payload.get("ok") is True, "node metadata kinds payload was not ok")
    templates = payload.get("templates")
    require(isinstance(templates, dict), "node metadata kind templates missing")
    meta_kinds = read_soemdsp_meta_kinds()
    require(meta_kinds == EXPECTED_META_KINDS, "soemdsp meta kind fixture drifted")
    template_kinds = set(templates)
    missing = meta_kinds - template_kinds
    require(not missing, f"node metadata kind templates missing meta.hpp kinds: {sorted(missing)}")
    amplitude = templates.get("amplitude")
    decibels = templates.get("decibels")
    decimal_bipolar = templates.get("decimal_bipolar")
    frequency = templates.get("frequency")
    phase = templates.get("phase")
    descrete = templates.get("descrete")
    integer_bipolar = templates.get("integer_bipolar")
    waveform = templates.get("waveform")
    bypass = templates.get("bypass")
    plusminus = templates.get("plusminus")
    onoff = templates.get("onoff")
    momentary = templates.get("momentary")
    require(isinstance(amplitude, dict), "amplitude metadata kind missing")
    require(isinstance(decibels, dict), "decibels metadata kind missing")
    require(isinstance(decimal_bipolar, dict), "decimal_bipolar metadata kind missing")
    require(isinstance(frequency, dict), "frequency metadata kind missing")
    require(isinstance(phase, dict), "phase metadata kind missing")
    require(isinstance(descrete, dict), "descrete metadata kind missing")
    require(isinstance(integer_bipolar, dict), "integer_bipolar metadata kind missing")
    require(isinstance(waveform, dict), "waveform metadata kind missing")
    require(isinstance(bypass, dict), "bypass metadata kind missing")
    require(isinstance(plusminus, dict), "plusminus metadata kind missing")
    require(isinstance(onoff, dict), "onoff metadata kind missing")
    require(isinstance(momentary, dict), "momentary metadata kind missing")
    require(amplitude.get("label") == "Amplitude", "amplitude metadata label mismatch")
    require(amplitude.get("unit") == "amp", "amplitude metadata unit mismatch")
    require(amplitude.get("linearSmoothing") is True, "amplitude linearSmoothing mismatch")
    require(amplitude.get("maxDigits") == 3, "amplitude maxDigits mismatch")
    require(decibels.get("label") == "Decibels", "decibels metadata label mismatch")
    require(decibels.get("unit") == "dB", "decibels metadata unit mismatch")
    require(decimal_bipolar.get("unit") == "", "decimal_bipolar metadata unit mismatch")
    require(decimal_bipolar.get("showPlusMinus") is True, "decimal_bipolar showPlusMinus mismatch")
    require("showPlusMinus" not in decibels, "decibels should not default showPlusMinus")
    require(frequency.get("unit") == "Hz", "frequency metadata unit mismatch")
    require(frequency.get("linearSmoothing") is True, "frequency linearSmoothing mismatch")
    require(frequency.get("step") == 0, "frequency metadata step should default to any")
    require(frequency.get("maxDigits") == 5, "frequency maxDigits mismatch")
    require(phase.get("unit") == "cycle", "phase metadata unit mismatch")
    require(phase.get("wraparound") is True, "phase wraparound mismatch")
    require(phase.get("linearSmoothing") is True, "phase linearSmoothing mismatch")
    require("showPlusMinus" not in templates.get("pitch", {}), "pitch should not default showPlusMinus")
    require(descrete.get("unit") == "idx", "descrete metadata unit mismatch")
    require(descrete.get("linearSmoothing") is False, "descrete linearSmoothing mismatch")
    require(integer_bipolar.get("label") == "Integer Bipolar", "integer_bipolar metadata label mismatch")
    require(integer_bipolar.get("unit") == "idx", "integer_bipolar metadata unit mismatch")
    require(integer_bipolar.get("min") == -9, "integer_bipolar metadata min mismatch")
    require(integer_bipolar.get("max") == 9, "integer_bipolar metadata max mismatch")
    require(integer_bipolar.get("showPlusMinus") is True, "integer_bipolar showPlusMinus mismatch")
    require(integer_bipolar.get("linearSmoothing") is False, "integer_bipolar linearSmoothing mismatch")
    require(
        waveform.get("choices") == ["Saw", "Square", "Triangle", "Sine", "Noise"],
        "waveform choices mismatch",
    )
    require(waveform.get("displayChoices") is True, "waveform displayChoices mismatch")
    require(waveform.get("divideChoicesVisibly") is True, "waveform divideChoicesVisibly mismatch")
    require(waveform.get("linearSmoothing") is False, "waveform linearSmoothing mismatch")
    require(waveform.get("min") == 0, "waveform metadata min mismatch")
    require(waveform.get("max") == 4, "waveform metadata max mismatch")
    require(waveform.get("mid") == 2, "waveform metadata mid mismatch")
    require(bypass.get("choices") == ["active", "BYPASSED"], "bypass choices mismatch")
    require(bypass.get("displayChoices") is True, "bypass displayChoices mismatch")
    require(bypass.get("divideChoicesVisibly") is True, "bypass divideChoicesVisibly mismatch")
    require(bypass.get("linearSmoothing") is False, "bypass linearSmoothing mismatch")
    require(plusminus.get("choices") == ["-", "+"], "plusminus choices mismatch")
    require(plusminus.get("displayChoices") is True, "plusminus displayChoices mismatch")
    require(plusminus.get("divideChoicesVisibly") is True, "plusminus divideChoicesVisibly mismatch")
    require(plusminus.get("showPlusMinus") is True, "plusminus showPlusMinus mismatch")
    require(onoff.get("choices") == ["off", "on"], "onoff choices mismatch")
    require(onoff.get("displayChoices") is True, "onoff displayChoices mismatch")
    require(onoff.get("divideChoicesVisibly") is True, "onoff divideChoicesVisibly mismatch")
    require(momentary.get("choices") == ["idle", "on"], "momentary choices mismatch")
    require(momentary.get("displayChoices") is True, "momentary displayChoices mismatch")
    require(momentary.get("divideChoicesVisibly") is True, "momentary divideChoicesVisibly mismatch")


def require_manifest_contracts(payload: dict[str, object]) -> None:
    require_producer_proof(payload)
    require_handoff_contract(payload)
    require_artifact_contract(payload)
    require_phase_contract(payload)
    require_parameter_resync_contract(payload)
    require_caller_processing_order_contract(payload)


def require_artifact_report_and_audio_contracts(
  base_url: str,
  payload: dict[str, object],
) -> None:
    require_artifact_reachability(base_url, payload)
    require_report_documents(base_url, payload)
    require_parameter_summary(base_url, payload)
    require_primary_audio_wav(base_url, payload)

    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")
    handoff = manifest.get("sandboxHandoff", {})
    require(isinstance(handoff, dict), "sandbox handoff missing")
    audio_path = handoff.get("primaryAudioArtifact")
    require(audio_path, "primary audio artifact missing from handoff")
    audio_response = request(
        f"{base_url}/artifact?path={urllib.parse.quote(str(audio_path))}",
        method="HEAD",
    )
    require(audio_response.status == 200, "primary audio artifact did not return 200")
    require_no_store(audio_response, "primary audio artifact")


def require_server_error_contracts(base_url: str) -> None:
    missing_path = request(f"{base_url}/artifact", method="HEAD")
    require(missing_path.status == 400, "missing artifact path did not return 400")
    require_no_store(missing_path, "missing artifact path")

    missing_route = request(f"{base_url}/missing", method="HEAD")
    require(missing_route.status == 404, "missing route did not return 404")
    require_no_store(missing_route, "missing route")

    missing_public = request(f"{base_url}/public/missing.js", method="HEAD")
    require(missing_public.status == 404, "missing public file did not return 404")
    require_no_store(missing_public, "missing public file")

    missing_artifact = request(
        f"{base_url}/artifact?path=missing.wav",
        method="HEAD",
    )
    require(missing_artifact.status == 404, "missing artifact did not return 404")
    require_no_store(missing_artifact, "missing artifact")

    forbidden_artifact = request(
        f"{base_url}/artifact?path=../server.py",
        method="HEAD",
    )
    require(forbidden_artifact.status == 403, "artifact traversal did not return 403")
    require_no_store(forbidden_artifact, "artifact traversal")

    forbidden_encoded_artifact = request(
        f"{base_url}/artifact?path=%2e%2e/server.py",
        method="HEAD",
    )
    require(
        forbidden_encoded_artifact.status == 403,
        "encoded artifact traversal did not return 403",
    )
    require_no_store(forbidden_encoded_artifact, "encoded artifact traversal")

    forbidden_public = request(
        f"{base_url}/public/%2e%2e/server.py",
        method="HEAD",
    )
    require(forbidden_public.status == 403, "public traversal did not return 403")
    require_no_store(forbidden_public, "public traversal")

    manifest_head = request(f"{base_url}/api/manifest", method="HEAD")
    require(manifest_head.status == 405, "manifest HEAD did not return 405")
    require_no_store(manifest_head, "manifest HEAD")

    metadata_head = request(f"{base_url}/api/node-metadata-kinds", method="HEAD")
    require(metadata_head.status == 405, "node metadata kinds HEAD did not return 405")
    require_no_store(metadata_head, "node metadata kinds HEAD")

    require_read_only_method_rejections(base_url)


def wait_for_server(base_url: str, process: subprocess.Popen[bytes]) -> None:
    deadline = time.monotonic() + 5
    last_status = ""
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(
                f"sandbox server exited before becoming ready: {process.returncode}",
            )
        response = request(f"{base_url}/public/index.html", method="HEAD")
        last_status = f"{response.status} {response.reason}"
        if response.status == 200:
            if process.poll() is not None:
                raise RuntimeError(
                    f"sandbox server exited during readiness check: {process.returncode}",
                )
            require_no_store(response, "public index")
            return
        time.sleep(0.1)
    raise RuntimeError(f"sandbox server did not become ready: {last_status}")


def start_server(port: int, manifest: Path) -> subprocess.Popen[bytes]:
    require_port_available(port)
    process = subprocess.Popen(
        [
            sys.executable,
            str(ROOT / "server.py"),
            "--port",
            str(port),
            "--manifest",
            str(manifest),
        ],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(0.05)
    if process.poll() is not None:
        raise RuntimeError(f"sandbox server exited immediately: {process.returncode}")
    return process


def stop_server(process: subprocess.Popen[bytes]) -> None:
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def run_valid_manifest_smoke(port: int, manifest: Path) -> None:
    base_url = f"http://127.0.0.1:{port}"
    process = start_server(port, manifest)

    try:
        wait_for_server(base_url, process)

        run_step("root shell contract", lambda: require_root_shell(base_url))
        run_step("static assets", lambda: require_static_assets(base_url))
        run_step("waveform seek source contract", require_waveform_seek_source_contract)
        run_step("manifest error surface contract", require_manifest_error_surface_contract)
        run_step("follow/free seek contract", require_follow_free_seek_contract)
        run_step("node graph MVP contract", require_node_graph_mvp_contract)
        run_step("README scheduler contract", require_readme_scheduler_contract)
        run_step("soemdsp WireMeta traits", require_soemdsp_wire_meta_traits)
        run_step(
            "node metadata kinds transport",
            lambda: require_node_metadata_kinds_transport(base_url),
        )
        run_step(
            "user UI settings update contract",
            lambda: require_user_ui_settings_update_contract(base_url),
        )

        payload: dict[str, object] = {}

        def fetch_payload() -> None:
            nonlocal payload
            payload = fetch_valid_manifest_payload(base_url)

        run_step("manifest transport", fetch_payload)
        run_step("manifest contracts", lambda: require_manifest_contracts(payload))
        run_step(
            "artifact contract negative cases",
            require_artifact_contract_negative_cases,
        )
        run_step(
            "phase audio contract negative cases",
            require_phase_audio_contract_negative_cases,
        )
        run_step(
            "parameter resync contract negative cases",
            require_parameter_resync_contract_negative_cases,
        )
        run_step(
            "caller processing order negative cases",
            require_caller_processing_order_contract_negative_cases,
        )
        run_step(
            "artifact reports and audio",
            lambda: require_artifact_report_and_audio_contracts(base_url, payload),
        )
        run_step("server error responses", lambda: require_server_error_contracts(base_url))
    finally:
        stop_server(process)


def run_manifest_error_smoke(port: int) -> None:
    with tempfile.TemporaryDirectory() as directory:
        fixture_root = Path(directory)
        missing_manifest = fixture_root / "missing_manifest.json"
        invalid_manifest = fixture_root / "invalid_manifest.json"
        invalid_manifest.write_text('{ "ok": true, ', encoding="utf-8")

        cases = [
            (missing_manifest, 404, "manifest not found", ""),
            (
                invalid_manifest,
                500,
                "manifest JSON parse failed",
                "Expecting property name",
            ),
        ]

        for index, (path, status, error, detail) in enumerate(cases):
            case_port = find_free_port() if port == 0 else port + index
            base_url = f"http://127.0.0.1:{case_port}"
            process = start_server(case_port, path)
            try:
                wait_for_server(base_url, process)
                response = request(f"{base_url}/api/manifest")
                require(response.status == status, f"{error} status mismatch")
                require_json_response_metadata(response, error)
                payload = json.loads(response.body.decode("utf-8"))
                require(payload.get("ok") is False, f"{error} payload was not false")
                require(payload.get("error") == error, f"{error} payload mismatch")
                require(payload.get("path") == str(path.resolve()), f"{error} path missing")
                require(
                    payload.get("artifactRoot") == str(fixture_root.resolve()),
                    f"{error} artifact root mismatch",
                )
                if detail:
                    require(detail in payload.get("message", ""), f"{error} detail missing")
            finally:
                stop_server(process)


def run_readable_malformed_manifest_smoke(port: int) -> None:
    with tempfile.TemporaryDirectory() as directory:
        fixture_root = Path(directory)
        malformed_manifest = fixture_root / "malformed_manifest.json"
        malformed_manifest.write_text(json.dumps({"allOk": True}), encoding="utf-8")

        case_port = find_free_port() if port == 0 else port
        base_url = f"http://127.0.0.1:{case_port}"
        process = start_server(case_port, malformed_manifest)
        try:
            wait_for_server(base_url, process)
            response = request(f"{base_url}/api/manifest")
            require(response.status == 200, "readable malformed manifest status mismatch")
            require_json_response_metadata(response, "readable malformed manifest")
            payload = json.loads(response.body.decode("utf-8"))
            require(payload.get("ok") is True, "readable malformed manifest was not ok")
            require(
                payload.get("manifestPath") == str(malformed_manifest.resolve()),
                "readable malformed manifest path missing",
            )
            require(
                payload.get("artifactRoot") == str(fixture_root.resolve()),
                "readable malformed manifest artifact root mismatch",
            )
            require_manifest_file_info(payload, malformed_manifest, "readable malformed manifest")
            require(
                payload.get("manifest") == {"allOk": True},
                "readable malformed manifest payload mismatch",
            )
            require("error" not in payload, "readable malformed manifest had error field")
        finally:
            stop_server(process)


def run_smoke(port: int, manifest: Path) -> None:
    valid_manifest_port = find_free_port() if port == 0 else port
    error_manifest_port = 0 if port == 0 else port + 1
    malformed_manifest_port = 0 if port == 0 else port + 3
    run_step(
        "valid manifest packet",
        lambda: run_valid_manifest_smoke(valid_manifest_port, manifest),
    )
    run_step(
        "manifest error responses",
        lambda: run_manifest_error_smoke(error_manifest_port),
    )
    run_step(
        "readable malformed manifest source",
        lambda: run_readable_malformed_manifest_smoke(malformed_manifest_port),
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--port",
        default=0,
        type=int,
        help="Port for the first smoke server. Defaults to 0 for automatic ports.",
    )
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    args = parser.parse_args()

    run_smoke(args.port, Path(args.manifest).resolve())
    print("soemdsp-sandbox smoke test passed")


if __name__ == "__main__":
    main()
