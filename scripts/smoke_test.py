from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from wave import Error as WaveError
from wave import open as open_wave


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = (
    ROOT.parent / "soemdsp" / "runtime_dsp_object_bound_wav_resync_demo.manifest.json"
)
EXPECTED_CONTRACT = "soemdsp-demo-local-sandbox-handoff"
EXPECTED_CONTRACT_VERSION = 1
EXPECTED_INSPECTION_MODE = "mouse-and-ears"
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
REPORT_ARTIFACT_KINDS = {
    "manifest",
    "text-summary",
    "wav-report",
    "phase-report",
}


@dataclass
class Response:
    status: int
    reason: str
    headers: dict[str, str]
    body: bytes


def request(url: str, method: str = "GET") -> Response:
    request = urllib.request.Request(url, method=method)
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


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


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


def require_artifact_contract(payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")
    links = manifest.get("artifactLinks")
    require(isinstance(links, list), "artifact links missing")
    require(all(isinstance(link, dict) for link in links), "artifact link not object")
    require(all(link.get("path") for link in links), "artifact link path missing")

    kinds = {str(link.get("kind")) for link in links}
    missing_kinds = REQUIRED_ARTIFACT_KINDS - kinds
    require(not missing_kinds, f"required artifact kinds missing: {sorted(missing_kinds)}")

    phases = manifest.get("phases")
    require(isinstance(phases, list), "phases missing")
    phase_report_count = sum(1 for link in links if link.get("kind") == "phase-report")
    require(
        phase_report_count == len(phases),
        "phase report count did not match phase count",
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
    for index, phase in enumerate(phases):
        require(isinstance(phase, dict), f"phase {index} not object")
        require(phase.get("name"), f"phase {index} name missing")
        require(phase.get("preflightOk") is True, f"phase {index} preflight failed")
        require(phase.get("applyOk") is True, f"phase {index} apply failed")
        require(phase.get("processOk") is True, f"phase {index} process failed")
        samples = int(phase.get("samplesProcessed", 0))
        require(samples > 0, f"phase {index} samples missing")
        total_phase_frames += samples

    require(
        total_phase_frames == wav_frames,
        f"phase frames {total_phase_frames} did not match wav frames {wav_frames}",
    )


def require_artifact_reachability(base_url: str, payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")
    links = manifest.get("artifactLinks")
    require(isinstance(links, list), "artifact links missing")

    for index, link in enumerate(links):
        require(isinstance(link, dict), f"artifact link {index} not object")
        path = link.get("path")
        require(isinstance(path, str) and path, f"artifact link {index} path missing")
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
        require(content_length > 0, f"artifact link {index} content length missing")


def require_report_documents(base_url: str, payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")
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
        response = request(f"{base_url}/artifact?path={urllib.parse.quote(path)}")
        require(response.status == 200, f"report link {index} did not return 200")
        require_no_store(response, f"report link {index}")
        text = response.body.decode("utf-8")
        require(text.strip(), f"report link {index} was empty")
        if kind == "manifest":
            json.loads(text)


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
    expected_file_bytes = int(wav.get("fileBytes", 0))
    require(expected_frames > 0, "wav frame count missing")
    require(expected_sample_rate > 0, "wav sample rate missing")
    require(expected_file_bytes > 0, "wav file byte count missing")

    response = request(f"{base_url}/artifact?path={urllib.parse.quote(audio_path)}")
    require(response.status == 200, "primary audio WAV did not return 200")
    require_no_store(response, "primary audio WAV")
    require(len(response.body) == expected_file_bytes, "WAV file byte count mismatch")

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
                require(wave_file.getnchannels() > 0, "WAV channel count missing")
                require(wave_file.getsampwidth() == 2, "WAV sample width mismatch")
    except WaveError as error:
        raise AssertionError(f"primary audio WAV parse failed: {error}") from error


def wait_for_server(base_url: str) -> None:
    deadline = time.monotonic() + 5
    last_status = ""
    while time.monotonic() < deadline:
        response = request(f"{base_url}/public/index.html", method="HEAD")
        last_status = f"{response.status} {response.reason}"
        if response.status == 200:
            require_no_store(response, "public index")
            return
        time.sleep(0.1)
    raise RuntimeError(f"sandbox server did not become ready: {last_status}")


def start_server(port: int, manifest: Path) -> subprocess.Popen[bytes]:
    return subprocess.Popen(
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
        wait_for_server(base_url)

        root_response = request(f"{base_url}/", method="HEAD")
        require(root_response.status == 200, "root shell did not return 200")
        require_no_store(root_response, "root shell")
        require_content_type(root_response, "text/html", "root shell")

        for path, content_type in [
            ("/public/app.js", ("application/javascript", "text/javascript")),
            ("/public/styles.css", "text/css"),
        ]:
            static_response = request(f"{base_url}{path}", method="HEAD")
            require(static_response.status == 200, f"{path} did not return 200")
            require_no_store(static_response, path)
            require_content_type(static_response, content_type, path)

        manifest_response = request(f"{base_url}/api/manifest")
        require(manifest_response.status == 200, "manifest endpoint did not return 200")
        require_no_store(manifest_response, "manifest endpoint")
        payload = json.loads(manifest_response.body.decode("utf-8"))
        require(payload.get("ok") is True, "manifest payload was not ok")
        require(payload.get("manifestPath"), "manifest path missing")
        require(payload.get("artifactRoot"), "artifact root missing")
        require_handoff_contract(payload)
        require_artifact_contract(payload)
        require_phase_contract(payload)
        require_artifact_reachability(base_url, payload)
        require_report_documents(base_url, payload)
        require_primary_audio_wav(base_url, payload)

        handoff = payload["manifest"].get("sandboxHandoff", {})
        audio_path = handoff.get("primaryAudioArtifact")
        require(audio_path, "primary audio artifact missing from handoff")
        audio_response = request(
            f"{base_url}/artifact?path={urllib.parse.quote(audio_path)}",
            method="HEAD",
        )
        require(audio_response.status == 200, "primary audio artifact did not return 200")
        require_no_store(audio_response, "primary audio artifact")

        missing_path = request(f"{base_url}/artifact", method="HEAD")
        require(missing_path.status == 400, "missing artifact path did not return 400")
        require_no_store(missing_path, "missing artifact path")

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

        forbidden_public = request(
            f"{base_url}/public/%2e%2e/server.py",
            method="HEAD",
        )
        require(forbidden_public.status == 403, "public traversal did not return 403")
        require_no_store(forbidden_public, "public traversal")

        manifest_head = request(f"{base_url}/api/manifest", method="HEAD")
        require(manifest_head.status == 405, "manifest HEAD did not return 405")
        require_no_store(manifest_head, "manifest HEAD")
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
            case_port = port + index
            base_url = f"http://127.0.0.1:{case_port}"
            process = start_server(case_port, path)
            try:
                wait_for_server(base_url)
                response = request(f"{base_url}/api/manifest")
                require(response.status == status, f"{error} status mismatch")
                require_no_store(response, error)
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


def run_smoke(port: int, manifest: Path) -> None:
    run_valid_manifest_smoke(port, manifest)
    run_manifest_error_smoke(port + 1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", default=18765, type=int)
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    args = parser.parse_args()

    run_smoke(args.port, Path(args.manifest).resolve())
    print("soemdsp-sandbox smoke test passed")


if __name__ == "__main__":
    main()
