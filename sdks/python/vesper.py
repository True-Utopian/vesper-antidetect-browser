"""Vesper loopback API clients. Original source by true-utopian. MIT licensed.

Python 3.10+, standard library only. No vendor accounts or subscriptions.
"""
import hashlib
import hmac
import base64
import json
import re
from pathlib import Path
from urllib.parse import urlsplit, quote
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError


class VesperError(RuntimeError):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise VesperError(code, "Local API redirects are not accepted")


class Client:
    @classmethod
    def from_directory(cls, directory, timeout=120):
        directory = Path(directory)
        descriptor = json.loads((directory / "service.json").read_text())
        port = descriptor.get("port")
        if descriptor.get("version") != 1 or descriptor.get("apiVersion") != "1.0" or not isinstance(port, int) or not 1 <= port <= 65535:
            raise ValueError("Invalid service discovery record")
        return cls(f"http://127.0.0.1:{port}", directory / "admin-token", timeout)

    def __init__(self, url, token_file, timeout=120):
        parsed = urlsplit(url)
        if parsed.scheme != "http" or parsed.hostname != "127.0.0.1" or not parsed.port or parsed.username or parsed.password or parsed.path not in ("", "/") or parsed.query or parsed.fragment:
            raise ValueError("Use an HTTP 127.0.0.1 origin with a port")
        self.url, self.token_file, self.timeout = url.rstrip("/"), Path(token_file), timeout
        self.opener = build_opener(_NoRedirect())

    def _token(self):
        if self.token_file.stat().st_size > 4096:
            raise ValueError("Invalid token file")
        token = self.token_file.read_text().strip()
        if len(token) < 24:
            raise ValueError("Invalid access token")
        return token

    def _open(self, path, method="GET", body=None, headers=None):
        if not path.startswith("/") or path.startswith("//") or ".." in path:
            raise ValueError("Invalid API path")
        request_headers = {"Authorization": "Bearer " + self._token(), **(headers or {})}
        data = None
        if isinstance(body, bytes):
            data = body
        elif body is not None:
            request_headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode()
        try:
            return self.opener.open(Request(self.url + "/api/v1" + path, data=data, headers=request_headers, method=method), timeout=self.timeout)
        except HTTPError as error:
            try:
                message = json.loads(error.read(65536)).get("error", "API request failed")
            except (ValueError, AttributeError):
                message = "API request failed"
            raise VesperError(error.code, message) from None

    def request(self, path, method="GET", body=None, headers=None):
        with self._open(path, method, body, headers) as response:
            return json.load(response)

    def capabilities(self):
        return self.request("/capabilities")

    def download(self, path, destination, headers=None, limit=2 * 1024**3):
        target = Path(destination)
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("xb") as output:
            try:
                with self._open(path, headers=headers) as response:
                    size = 0
                    while chunk := response.read(1024 * 1024):
                        size += len(chunk)
                        if size > limit:
                            raise ValueError("Download exceeds size limit")
                        output.write(chunk)
            except BaseException:
                output.close()
                target.unlink(missing_ok=True)
                raise
        return target


class Browser(Client):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.owners = {}

    def _lease(self, profile_id):
        run_id = self.owners.get(profile_id)
        if not run_id:
            return {}
        key = hmac.new(self._token().encode(), f"vesper-lease-v1:{profile_id}:{run_id}".encode(), hashlib.sha256).digest()
        return {"X-Vesper-Lease": base64.urlsafe_b64encode(key).decode().rstrip("=")}

    @staticmethod
    def _path(profile_id, action=""):
        # IDs are encoded so an invalid ID cannot change the endpoint.
        return "/profiles/" + quote(profile_id, safe="") + ("/" + action if action else "")

    def profiles(self):
        return self.request("/profiles")

    def fingerprint_capabilities(self):
        return self.request("/fingerprint/capabilities")

    def fingerprint(self, profile_id):
        return self.request(self._path(profile_id, "fingerprint"))

    def engine_versions(self):
        return self.request("/engine/versions")

    def extensions(self):
        return self.request("/extensions")

    def remove_extension(self, package_id):
        if not isinstance(package_id, str) or not re.fullmatch(r"[a-f0-9]{64}", package_id):
            raise ValueError("Invalid extension package ID")
        return self.request("/extensions/" + package_id, "DELETE")

    def profile_extensions(self, profile_id):
        return self.request(self._path(profile_id, "extensions"), headers=self._lease(profile_id))

    def import_extension(self, archive):
        archive = Path(archive)
        limit = 40 * 1024**2
        if archive.stat().st_size > limit:
            raise ValueError("Extension ZIP exceeds 40 MiB")
        with archive.open("rb") as source:
            data = source.read(limit + 1)
        if len(data) > limit:
            raise ValueError("Extension ZIP exceeds 40 MiB")
        return self.request("/extensions/import", "POST", data, {"Content-Type": "application/zip"})

    def stage_native_kernel(self, executable_path):
        return self.request("/engine/native/stage", "POST", {"executablePath": executable_path})

    def engine_action(self, action, build_id, family="chromium"):
        if action not in ("stage", "qualify", "activate") or family not in ("chromium", "brave", "vesper"):
            raise ValueError("Unsupported engine action or family")
        return self.request("/engine/" + action, "POST", {"buildId": build_id, "family": family})

    def create(self, settings, run_id=None, idempotency_key=None):
        headers = {}
        if run_id:
            headers["X-Vesper-Run-Id"] = run_id
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        result = self.request("/profiles", "POST", settings, headers)
        if run_id:
            self.owners[result["id"]] = run_id
        return result

    def claim(self, profile_id, run_id):
        self.request(self._path(profile_id, "lease"), "POST", {"runId": run_id})
        self.owners[profile_id] = run_id

    def control(self, profile_id, action):
        if action not in ("start", "stop", "install", "duplicate", "trash", "restore"):
            raise ValueError("Unsupported profile action")
        return self.request(self._path(profile_id, action), "POST", headers=self._lease(profile_id))

    def connection(self, profile_id):
        return self.request(self._path(profile_id, "connection"), headers=self._lease(profile_id))["endpoint"]

    def edit(self, profile_id, settings, revision=None):
        headers = self._lease(profile_id)
        if revision is not None:
            headers["If-Match"] = f'"{revision}"'
        return self.request(self._path(profile_id), "PATCH", settings, headers)

    def export(self, profile_id, destination):
        return self.download(self._path(profile_id, "archive"), destination, self._lease(profile_id))

    def release(self, profile_id):
        result = self.request(self._path(profile_id, "lease"), "DELETE", headers=self._lease(profile_id))
        self.owners.pop(profile_id, None)
        return result


class Workbench(Client):
    def schedules(self):
        return self.request("/schedules")

    def create_schedule(self, name, automation_id, inputs, next_at=None, interval_ms=None, cron=None, timezone=None):
        body = {"name": name, "automationId": automation_id, "inputs": inputs}
        if next_at is not None:
            body["nextAt"] = next_at
        if interval_ms is not None:
            body["intervalMs"] = interval_ms
        if cron is not None:
            body["cron"] = cron
        if timezone is not None:
            body["timezone"] = timezone
        return self.request("/schedules", "POST", body)

    def calendar_preview(self, cron, timezone="UTC", after=None):
        body = {"cron": cron, "timezone": timezone}
        if after is not None:
            body["after"] = after
        return self.request("/schedules/preview", "POST", body)

    def schedule_control(self, schedule_id, action):
        if action not in ("pause", "resume", "remove"):
            raise ValueError("Unsupported schedule control")
        return self.request("/schedules/" + quote(schedule_id, safe="") + "/" + action, "POST")

    def flow_library(self):
        return self.request("/flow-library")

    def save_flow(self, pack, manifest, revision=0, layout=None):
        body = {"pack": pack, "manifest": manifest, "revision": revision}
        if layout is not None:
            body["layout"] = layout
        return self.request("/flow-library", "POST", body)

    def publish_flow(self, flow_id, revision):
        return self.request("/flow-library/" + quote(flow_id, safe="") + "/publish", "POST", {"revision": revision})

    def automations(self):
        return self.request("/automations")

    def runs(self):
        return self.request("/runs")

    def run(self, run_id):
        return self.request("/runs/" + quote(run_id, safe=""))

    def submit(self, automation_id, inputs, idempotency_key=None, preset="fast", identity_id=None):
        body = {"automationId": automation_id, "inputs": inputs, "preset": preset}
        if identity_id:
            body["identityId"] = identity_id
        return self.request("/runs", "POST", body, {"Idempotency-Key": idempotency_key} if idempotency_key else {})

    def control(self, run_id, action):
        if action not in ("pause", "resume", "cancel", "finish", "retry-export"):
            raise ValueError("Unsupported run control")
        return self.request("/runs/" + quote(run_id, safe="") + "/" + action, "POST")

    def provide_input(self, run_id, challenge_id, values):
        return self.request("/runs/" + quote(run_id, safe="") + "/input", "POST", {"challengeId": challenge_id, "values": values})

    def artifact(self, run_id, destination):
        return self.download("/runs/" + quote(run_id, safe="") + "/artifact", destination)
