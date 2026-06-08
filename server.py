from __future__ import annotations

import argparse
import base64
import binascii
import json
import mimetypes
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from email.utils import formatdate
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
DEFAULT_PRESET = PUBLIC / "presets" / "default.json"
DEFAULT_UI_SETTINGS = PUBLIC / "presets" / "useruisettings.json"
DEFAULT_UI_SETTINGS_SCRIPT = PUBLIC / "presets" / "useruisettings.js"
MAX_PRESET_BYTES = 512 * 1024
MAX_YOUTUBE_UPLOAD_JSON_BYTES = 256 * 1024 * 1024
DEFAULT_SOEMDSP_ROOT = ROOT.parent / "soemdsp"
DEFAULT_MANIFEST = (
    DEFAULT_SOEMDSP_ROOT / "runtime_dsp_object_bound_wav_resync_demo.manifest.json"
)
STATIC_MIME_TYPES = {
    ".css": "text/css",
    ".js": "application/javascript",
}
# Mirrors soemdsp::meta::MetaType defaults from ../soemdsp/include/soemdsp/meta.hpp.
NODE_METADATA_KIND_TEMPLATES = {
    "decimal": {
        "def": 0,
        "label": "Decimal",
        "linearSmoothing": True,
        "max": 1,
        "mid": 0.5,
        "min": 0,
        "step": 0.01,
        "unit": "",
    },
    "decimal_bipolar": {
        "def": 0,
        "label": "Decimal Bipolar",
        "linearSmoothing": True,
        "max": 1,
        "mid": 0,
        "min": -1,
        "showPlusMinus": True,
        "step": 0.01,
        "unit": "",
    },
    "amplitude": {
        "def": 1,
        "label": "Amplitude",
        "linearSmoothing": True,
        "max": 3,
        "mid": 1,
        "min": 0,
        "step": 0.01,
        "unit": "amp",
    },
    "decibels": {
        "def": 0,
        "label": "Decibels",
        "linearSmoothing": True,
        "max": 12,
        "mid": 0,
        "min": -60,
        "step": 0.1,
        "unit": "dB",
    },
    "frequency": {
        "def": 440,
        "label": "Frequency",
        "linearSmoothing": True,
        "max": 20000,
        "mid": 440,
        "min": 0,
        "step": 0,
        "unit": "Hz",
    },
    "phase": {
        "def": 0,
        "label": "Phase",
        "linearSmoothing": True,
        "max": 1,
        "mid": 0.5,
        "min": 0,
        "step": 0.01,
        "unit": "cycle",
        "wraparound": True,
    },
    "pitch": {
        "def": 0,
        "label": "Pitch",
        "linearSmoothing": True,
        "max": 12,
        "mid": 0,
        "min": -12,
        "step": 0.1,
        "unit": "st",
    },
    "seconds": {
        "def": 0,
        "label": "Seconds",
        "linearSmoothing": True,
        "max": 5,
        "mid": 2.5,
        "min": 0,
        "step": 0.01,
        "unit": "s",
    },
    "sustain": {
        "def": 1,
        "label": "Sustain",
        "linearSmoothing": True,
        "max": 1,
        "mid": 0.7,
        "min": 0,
        "step": 0.01,
        "unit": "amp",
    },
    "descrete": {
        "def": 0,
        "label": "Descrete",
        "linearSmoothing": False,
        "max": 9,
        "mid": 4,
        "min": 0,
        "step": 1,
        "unit": "idx",
    },
    "integer_bipolar": {
        "def": 0,
        "label": "Integer Bipolar",
        "linearSmoothing": False,
        "max": 9,
        "mid": 0,
        "min": -9,
        "showPlusMinus": True,
        "step": 1,
        "unit": "idx",
    },
    "waveform": {
        "choices": ["Saw", "Square", "Triangle", "Sine", "Noise"],
        "def": 0,
        "displayChoices": True,
        "divideChoicesVisibly": True,
        "label": "Waveform",
        "linearSmoothing": False,
        "max": 4,
        "mid": 2,
        "min": 0,
        "step": 1,
        "unit": "",
    },
    "bypass": {
        "choices": ["active", "BYPASSED"],
        "def": 0,
        "displayChoices": True,
        "divideChoicesVisibly": True,
        "label": "Bypass",
        "linearSmoothing": False,
        "max": 1,
        "mid": 0.5,
        "min": 0,
        "step": 1,
        "unit": "bypass",
    },
    "plusminus": {
        "choices": ["-", "+"],
        "def": -1,
        "displayChoices": True,
        "divideChoicesVisibly": True,
        "label": "Plus Minus",
        "linearSmoothing": False,
        "max": 1,
        "mid": 0,
        "min": -1,
        "showPlusMinus": True,
        "step": 1,
        "unit": "plusminus",
    },
    "onoff": {
        "choices": ["off", "on"],
        "def": 1,
        "displayChoices": True,
        "divideChoicesVisibly": True,
        "label": "On Off",
        "linearSmoothing": False,
        "max": 1,
        "mid": 0.5,
        "min": 0,
        "step": 1,
        "unit": "onoff",
    },
    "momentary": {
        "choices": ["idle", "on"],
        "def": 0,
        "displayChoices": True,
        "divideChoicesVisibly": True,
        "label": "Momentary",
        "linearSmoothing": False,
        "max": 1,
        "mid": 0.5,
        "min": 0,
        "step": 1,
        "unit": "momentary",
    },
}

for kind, template in NODE_METADATA_KIND_TEMPLATES.items():
    template.setdefault("maxDigits", 5 if kind == "frequency" else 3)


def ui_settings_script_text(payload: dict) -> str:
    payload_text = json.dumps(payload, indent=2, sort_keys=False)
    return (
        "(function (settings) {\n"
        "  window.nodeUiDevBundledDefaultSettings = settings;\n"
        "  document.documentElement.dataset.nodeUiDevBundledDefaultSettings = JSON.stringify(settings);\n"
        f"}})({payload_text});\n"
    )


class SandboxServer(BaseHTTPRequestHandler):
    manifest_path: Path = DEFAULT_MANIFEST
    artifact_root: Path = DEFAULT_SOEMDSP_ROOT
    sending_error: bool = False

    def log_message(self, format: str, *args: object) -> None:
        return

    def send_error(
        self,
        code: int,
        message: str | None = None,
        explain: str | None = None,
    ) -> None:
        self.sending_error = True
        try:
            super().send_error(code, message, explain)
        finally:
            self.sending_error = False

    def end_headers(self) -> None:
        if self.sending_error:
            self.send_no_store_headers()
        super().end_headers()

    def do_GET(self) -> None:
        self.serve_request(send_body=True)

    def do_HEAD(self) -> None:
        self.serve_request(send_body=False)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/presets/default":
            self.save_default_preset()
            return
        if parsed.path == "/api/presets/useruisettings":
            self.save_default_ui_settings()
            return
        if parsed.path == "/api/shader-script/to-desktop":
            self.save_shader_script_to_desktop()
            return
        if parsed.path == "/api/metadata-script/to-desktop":
            self.save_metadata_script_to_desktop()
            return
        if parsed.path == "/api/open-path":
            self.open_local_path()
            return
        if parsed.path == "/api/youtube/upload":
            self.upload_youtube_video()
            return
        self.reject_mutation_method()

    def do_PUT(self) -> None:
        self.reject_mutation_method()

    def do_PATCH(self) -> None:
        self.reject_mutation_method()

    def do_DELETE(self) -> None:
        self.reject_mutation_method()

    def do_OPTIONS(self) -> None:
        self.reject_mutation_method()

    def reject_mutation_method(self) -> None:
        self.send_error(405, "Method not allowed")

    def serve_request(self, send_body: bool) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self.serve_file(PUBLIC / "index.html", send_body=send_body)
            return

        if parsed.path.startswith("/public/"):
            relative = parsed.path.removeprefix("/public/")
            self.serve_public(relative, send_body=send_body)
            return

        if parsed.path == "/api/manifest":
            if not send_body:
                self.send_error(405, "Method not allowed")
                return
            self.serve_manifest()
            return

        if parsed.path == "/api/node-metadata-kinds":
            if not send_body:
                self.send_error(405, "Method not allowed")
                return
            self.serve_node_metadata_kinds()
            return

        if parsed.path == "/artifact":
            self.serve_artifact(parsed.query, send_body=send_body)
            return

        self.send_error(404, "Not found")

    def serve_public(self, relative: str, send_body: bool) -> None:
        path = (PUBLIC / unquote(relative)).resolve()
        if not path.is_relative_to(PUBLIC):
            self.send_error(403, "Forbidden")
            return
        self.serve_file(path, send_body=send_body)

    def serve_manifest(self) -> None:
        manifest_path = self.manifest_path.resolve()
        if not manifest_path.exists():
            self.send_json(
                {
                    "ok": False,
                    "error": "manifest not found",
                    "artifactRoot": str(self.artifact_root.resolve()),
                    "path": str(manifest_path),
                },
                status=404,
            )
            return

        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            self.send_json(
                {
                    "ok": False,
                    "error": "manifest JSON parse failed",
                    "artifactRoot": str(self.artifact_root.resolve()),
                    "message": str(exc),
                    "path": str(manifest_path),
                },
                status=500,
            )
            return

        manifest_stat = manifest_path.stat()
        self.send_json(
            {
                "ok": True,
                "manifestPath": str(manifest_path),
                "artifactRoot": str(self.artifact_root.resolve()),
                "manifestInfo": {
                    "bytes": manifest_stat.st_size,
                    "modifiedUtc": datetime.fromtimestamp(
                        manifest_stat.st_mtime,
                        timezone.utc,
                    )
                    .replace(microsecond=0)
                    .isoformat()
                    .replace("+00:00", "Z"),
                },
                "manifest": manifest,
            }
        )

    def serve_node_metadata_kinds(self) -> None:
        self.send_json(
            {
                "ok": True,
                "templates": NODE_METADATA_KIND_TEMPLATES,
            },
        )

    def save_default_preset(self) -> None:
        payload = self.read_json_preset_payload("preset")
        if payload is None:
            return

        patch_format = payload.get("format")
        if not isinstance(patch_format, dict):
            self.send_json(
                {"ok": False, "error": "preset missing format object"},
                status=400,
            )
            return
        if patch_format.get("kind") != "soemdsp-sandbox-node-patch":
            self.send_json(
                {"ok": False, "error": "preset format kind mismatch"},
                status=400,
            )
            return
        if patch_format.get("version") != 1:
            self.send_json(
                {"ok": False, "error": "preset format version mismatch"},
                status=400,
            )
            return
        if not isinstance(payload.get("nodes"), list):
            self.send_json(
                {"ok": False, "error": "preset missing nodes array"},
                status=400,
            )
            return

        DEFAULT_PRESET.parent.mkdir(parents=True, exist_ok=True)
        DEFAULT_PRESET.write_text(
            f"{json.dumps(payload, indent=2, sort_keys=False)}\n",
            encoding="utf-8",
        )
        self.send_json(
            {
                "ok": True,
                "path": str(DEFAULT_PRESET),
                "bytes": DEFAULT_PRESET.stat().st_size,
            },
        )

    def save_default_ui_settings(self) -> None:
        payload = self.read_json_preset_payload("ui settings")
        if payload is None:
            return

        settings_format = payload.get("format")
        if not isinstance(settings_format, dict):
            self.send_json(
                {"ok": False, "error": "ui settings missing format object"},
                status=400,
            )
            return
        if settings_format.get("kind") != "soemdsp-sandbox-user-ui-settings":
            self.send_json(
                {"ok": False, "error": "ui settings format kind mismatch"},
                status=400,
            )
            return
        if settings_format.get("version") not in (1, 2, 3):
            self.send_json(
                {"ok": False, "error": "ui settings format version mismatch"},
                status=400,
            )
            return
        if not isinstance(payload.get("controls"), dict):
            self.send_json(
                {"ok": False, "error": "ui settings missing controls object"},
                status=400,
            )
            return
        if not isinstance(payload.get("nodeColors"), dict):
            self.send_json(
                {"ok": False, "error": "ui settings missing nodeColors object"},
                status=400,
            )
            return
        if "view" in payload and not isinstance(payload.get("view"), dict):
            self.send_json(
                {"ok": False, "error": "ui settings view must be an object"},
                status=400,
            )
            return

        DEFAULT_UI_SETTINGS.parent.mkdir(parents=True, exist_ok=True)
        DEFAULT_UI_SETTINGS.write_text(
            f"{json.dumps(payload, indent=2, sort_keys=False)}\n",
            encoding="utf-8",
        )
        DEFAULT_UI_SETTINGS_SCRIPT.write_text(
            ui_settings_script_text(payload),
            encoding="utf-8",
        )
        self.send_json(
            {
                "ok": True,
                "path": str(DEFAULT_UI_SETTINGS),
                "bytes": DEFAULT_UI_SETTINGS.stat().st_size,
            },
        )

    def save_shader_script_to_desktop(self) -> None:
        payload = self.read_json_preset_payload("shader script")
        if payload is None:
            return

        source = payload.get("source")
        if not isinstance(source, str):
            self.send_json(
                {"ok": False, "error": "shader script source must be a string"},
                status=400,
            )
            return
        title = str(payload.get("title") or "scope-shader")
        safe_title = "".join(
            character if character.isalnum() or character in ("-", "_", ".") else "-"
            for character in title.strip()
        ).strip(".-") or "scope-shader"
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        filename = f"{safe_title}-{timestamp}.scope-shader.txt"
        desktop = Path.home() / "Desktop"
        try:
            desktop.mkdir(parents=True, exist_ok=True)
            path = desktop / filename
            path.write_text(source, encoding="utf-8")
        except OSError as exc:
            self.send_json(
                {"ok": False, "error": f"desktop export failed: {exc}"},
                status=500,
            )
            return
        self.send_json(
            {
                "ok": True,
                "filename": filename,
                "path": str(path),
                "bytes": path.stat().st_size,
            },
        )

    def save_metadata_script_to_desktop(self) -> None:
        payload = self.read_json_preset_payload("metadata script")
        if payload is None:
            return

        source = payload.get("source")
        if not isinstance(source, str):
            self.send_json(
                {"ok": False, "error": "metadata script source must be a string"},
                status=400,
            )
            return
        title = str(payload.get("title") or "metadata-script")
        safe_title = "".join(
            character if character.isalnum() or character in ("-", "_", ".") else "-"
            for character in title.strip()
        ).strip(".-") or "metadata-script"
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        filename = f"{safe_title}-{timestamp}.metadata-script.txt"
        desktop = Path.home() / "Desktop"
        try:
            desktop.mkdir(parents=True, exist_ok=True)
            path = desktop / filename
            path.write_text(source, encoding="utf-8")
        except OSError as exc:
            self.send_json(
                {"ok": False, "error": f"desktop export failed: {exc}"},
                status=500,
            )
            return
        self.send_json(
            {
                "ok": True,
                "filename": filename,
                "path": str(path),
                "bytes": path.stat().st_size,
            },
        )

    def open_local_path(self) -> None:
        payload = self.read_json_preset_payload("open path")
        if payload is None:
            return

        requested = payload.get("path")
        if not isinstance(requested, str) or not requested.strip():
            self.send_json({"ok": False, "error": "path must be a string"}, status=400)
            return

        downloads = (Path.home() / "Downloads").resolve()
        path = Path(requested.strip()).expanduser()
        if not path.is_absolute():
            path = downloads / path
        try:
            target = path.resolve()
        except OSError as exc:
            self.send_json({"ok": False, "error": f"path resolve failed: {exc}"}, status=400)
            return

        if target != downloads and not target.is_relative_to(downloads):
            self.send_json({"ok": False, "error": "path must be inside Downloads"}, status=403)
            return
        if not target.exists():
            self.send_json({"ok": False, "error": "path does not exist", "path": str(target)}, status=404)
            return
        if not hasattr(os, "startfile"):
            self.send_json({"ok": False, "error": "open path is only supported on Windows"}, status=501)
            return

        try:
            os.startfile(str(target))  # type: ignore[attr-defined]
        except OSError as exc:
            self.send_json({"ok": False, "error": f"open path failed: {exc}", "path": str(target)}, status=500)
            return

        self.send_json({"ok": True, "path": str(target)})

    def upload_youtube_video(self) -> None:
        payload = self.read_json_payload(
            "youtube upload",
            max_bytes=MAX_YOUTUBE_UPLOAD_JSON_BYTES,
        )
        if payload is None:
            return

        access_token = os.environ.get("SOEMDSP_YOUTUBE_ACCESS_TOKEN", "").strip()
        if not access_token:
            self.send_json(
                {
                    "ok": False,
                    "error": "youtube access token missing",
                    "setup": "Set SOEMDSP_YOUTUBE_ACCESS_TOKEN to a valid YouTube Data API OAuth access token, then restart the sandbox server.",
                },
                status=501,
            )
            return

        title = str(payload.get("title") or "").strip()
        description = str(payload.get("description") or "").strip()
        mime_type = str(payload.get("mimeType") or "video/mp4").strip() or "video/mp4"
        video_base64 = payload.get("videoBase64")
        if not title:
            self.send_json({"ok": False, "error": "title is required"}, status=400)
            return
        if not isinstance(video_base64, str) or not video_base64.strip():
            self.send_json({"ok": False, "error": "videoBase64 is required"}, status=400)
            return

        try:
            video_bytes = base64.b64decode(video_base64, validate=True)
        except (ValueError, binascii.Error) as exc:
            self.send_json({"ok": False, "error": f"videoBase64 decode failed: {exc}"}, status=400)
            return
        if not video_bytes:
            self.send_json({"ok": False, "error": "video is empty"}, status=400)
            return

        metadata = {
            "snippet": {
                "title": title,
                "description": description,
                "categoryId": "10",
            },
            "status": {
                "privacyStatus": "private",
                "selfDeclaredMadeForKids": False,
            },
        }
        metadata_body = json.dumps(metadata).encode("utf-8")
        start_request = urllib.request.Request(
            "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
            data=metadata_body,
            method="POST",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=UTF-8",
                "Content-Length": str(len(metadata_body)),
                "X-Upload-Content-Type": mime_type,
                "X-Upload-Content-Length": str(len(video_bytes)),
            },
        )
        try:
            with urllib.request.urlopen(start_request, timeout=30) as response:
                upload_url = response.headers.get("Location")
        except urllib.error.HTTPError as exc:
            self.send_json(self.youtube_error_payload(exc, "youtube upload session failed"), status=502)
            return
        except OSError as exc:
            self.send_json({"ok": False, "error": f"youtube upload session failed: {exc}"}, status=502)
            return

        if not upload_url:
            self.send_json({"ok": False, "error": "youtube upload session did not return a Location header"}, status=502)
            return

        upload_request = urllib.request.Request(
            upload_url,
            data=video_bytes,
            method="PUT",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": mime_type,
                "Content-Length": str(len(video_bytes)),
            },
        )
        try:
            with urllib.request.urlopen(upload_request, timeout=300) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            self.send_json(self.youtube_error_payload(exc, "youtube video upload failed"), status=502)
            return
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            self.send_json({"ok": False, "error": f"youtube video upload failed: {exc}"}, status=502)
            return

        video_id = str(response_payload.get("id") or "")
        self.send_json(
            {
                "ok": True,
                "videoId": video_id,
                "url": f"https://youtu.be/{video_id}" if video_id else "",
                "privacyStatus": "private",
            },
        )

    def youtube_error_payload(self, error: urllib.error.HTTPError, label: str) -> dict:
        try:
            body = error.read().decode("utf-8")
        except OSError:
            body = ""
        try:
            details = json.loads(body) if body else {}
        except json.JSONDecodeError:
            details = body
        return {
            "ok": False,
            "error": f"{label}: HTTP {error.code}",
            "details": details,
        }

    def read_json_preset_payload(self, label: str) -> dict | None:
        return self.read_json_payload(label, max_bytes=MAX_PRESET_BYTES)

    def read_json_payload(self, label: str, max_bytes: int) -> dict | None:
        length_text = self.headers.get("Content-Length", "0")
        try:
            length = int(length_text)
        except ValueError:
            self.send_json(
                {"ok": False, "error": "invalid Content-Length"},
                status=400,
            )
            return
        if length <= 0:
            self.send_json({"ok": False, "error": f"empty {label} body"}, status=400)
            return None
        if length > max_bytes:
            self.send_json(
                {"ok": False, "error": f"{label} body too large"},
                status=413,
            )
            return None

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            self.send_json(
                {"ok": False, "error": f"{label} JSON parse failed: {exc}"},
                status=400,
            )
            return None

        if not isinstance(payload, dict):
            self.send_json(
                {"ok": False, "error": f"{label} must be a JSON object"},
                status=400,
            )
            return None
        return payload

    def serve_artifact(self, query: str, send_body: bool) -> None:
        params = parse_qs(query)
        requested = params.get("path", [""])[0]
        if not requested:
            self.send_error(400, "Missing artifact path")
            return

        root = self.artifact_root.resolve()
        path = (root / requested).resolve()
        if not path.is_relative_to(root):
            self.send_error(403, "Forbidden")
            return

        self.serve_file(path, send_body=send_body)

    def serve_file(self, path: Path, send_body: bool = True) -> None:
        if not path.exists() or not path.is_file():
            self.send_error(404, "Not found")
            return

        mime_type = STATIC_MIME_TYPES.get(path.suffix.lower())
        if mime_type is None:
            mime_type, _ = mimetypes.guess_type(path)
        stat = path.stat()
        try:
            byte_range = self.parse_byte_range(
                self.headers.get("Range"),
                stat.st_size,
            )
        except ValueError:
            self.send_range_error(stat.st_size)
            return

        start = 0
        end = stat.st_size - 1
        if byte_range is not None:
            start, end = byte_range
        content_length = end - start + 1

        self.send_response(206 if byte_range is not None else 200)
        self.send_header("Content-Type", mime_type or "application/octet-stream")
        self.send_header("Content-Length", str(content_length))
        self.send_header("Last-Modified", formatdate(stat.st_mtime, usegmt=True))
        self.send_header("Accept-Ranges", "bytes")
        if byte_range is not None:
            self.send_header("Content-Range", f"bytes {start}-{end}/{stat.st_size}")
        self.send_no_store_headers()
        self.end_headers()
        if send_body:
            with path.open("rb") as handle:
                handle.seek(start)
                self.wfile.write(handle.read(content_length))

    def parse_byte_range(
        self,
        header: str | None,
        file_size: int,
    ) -> tuple[int, int] | None:
        if not header:
            return None

        if not header.startswith("bytes="):
            raise ValueError("unsupported range unit")

        spec = header.removeprefix("bytes=").strip()
        if "," in spec or "-" not in spec:
            raise ValueError("unsupported byte range")

        start_text, end_text = spec.split("-", 1)
        try:
            if start_text == "":
                suffix_length = int(end_text)
                if suffix_length <= 0:
                    raise ValueError("invalid suffix range")
                start = max(0, file_size - suffix_length)
                end = file_size - 1
            else:
                start = int(start_text)
                end = int(end_text) if end_text else file_size - 1
        except ValueError as error:
            raise ValueError("invalid byte range") from error

        if start < 0 or end < start or start >= file_size:
            raise ValueError("unsatisfiable byte range")

        return start, min(end, file_size - 1)

    def send_range_error(self, file_size: int) -> None:
        self.send_response(416)
        self.send_header("Content-Range", f"bytes */{file_size}")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", "0")
        self.send_no_store_headers()
        self.end_headers()

    def send_no_store_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")

    def send_json(self, payload: object, status: int = 200) -> None:
        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_no_store_headers()
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8765, type=int)
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    args = parser.parse_args()

    SandboxServer.manifest_path = Path(args.manifest).resolve()
    SandboxServer.artifact_root = SandboxServer.manifest_path.parent.resolve()

    server = ThreadingHTTPServer((args.host, args.port), SandboxServer)
    print(f"soemdsp-sandbox serving http://{args.host}:{args.port}")
    print(f"manifest: {SandboxServer.manifest_path}")
    server.serve_forever()


if __name__ == "__main__":
    main()
