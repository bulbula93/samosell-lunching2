#!/usr/bin/env python3
"""Restore the latest valid snapshot from a successful main SEO workflow run."""
import io
import json
import os
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

from seo_monitor import validate_snapshot

WORKFLOW = "seo-monitor-daily.yml"
MAX_BYTES = 60_000_000
MAX_PAGES = 10


class SafeRedirects(urllib.request.HTTPRedirectHandler):
    """Never forward GitHub auth to the artifact's signed storage URL."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected is not None and urllib.parse.urlparse(req.full_url).netloc != urllib.parse.urlparse(newurl).netloc:
            redirected.remove_header("Authorization")
        return redirected


def github_get(path, token, binary=False):
    req = urllib.request.Request("https://api.github.com/" + path, headers={
        "Authorization": "Bearer " + token, "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "SamoSellSEOHealthMonitor/2.0"})
    with urllib.request.build_opener(SafeRedirects()).open(req, timeout=30) as response:
        body = response.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ValueError("GitHub response exceeds baseline size limit")
    return body if binary else json.loads(body)


def read_snapshot(archive):
    with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
        matches = [entry for entry in zipped.infolist() if entry.filename == "snapshot.json"]
        if len(matches) != 1:
            raise ValueError("Artifact must contain exactly one root snapshot.json")
        if matches[0].file_size > MAX_BYTES:
            raise ValueError("Expanded snapshot exceeds size limit")
        return validate_snapshot(json.loads(zipped.read(matches[0])))


def restore(repository, token, current_run="", directory=Path("seo-monitor-previous"), get=None):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "snapshot.json").unlink(missing_ok=True)
    metadata = {"status": "missing", "reason": "No valid unexpired snapshot from a successful main SEO workflow run"}
    warnings = []
    get = get or (lambda path, binary=False: github_get(path, token, binary))
    try:
        if not repository or not token:
            raise ValueError("GITHUB_REPOSITORY / GH_TOKEN missing; baseline retrieval cannot run")
        prefix = "repos/" + repository + "/actions/"
        for page in range(1, MAX_PAGES + 1):
            query = urllib.parse.urlencode({"branch": "main", "status": "success", "per_page": 100, "page": page})
            runs = get(prefix + "workflows/" + WORKFLOW + "/runs?" + query)["workflow_runs"]
            for run in sorted(runs, key=lambda item: (item.get("created_at", ""), item["id"]), reverse=True):
                if (run.get("head_branch") != "main" or run.get("conclusion") != "success" or
                        run.get("status") != "completed" or str(run["id"]) == str(current_run) or
                        run.get("path", "").split("@")[0] != ".github/workflows/" + WORKFLOW):
                    continue
                for artifact_page in range(1, MAX_PAGES + 1):
                    artifacts = get(prefix + f"runs/{run['id']}/artifacts?per_page=100&page={artifact_page}")["artifacts"]
                    for artifact in sorted(artifacts, key=lambda item: (item.get("created_at", ""), item["id"]), reverse=True):
                        if artifact.get("name") != "seo-snapshot" or artifact.get("expired"):
                            continue
                        if str(artifact.get("workflow_run", {}).get("id", run["id"])) != str(run["id"]):
                            continue
                        try:
                            snapshot = read_snapshot(get(prefix + f"artifacts/{artifact['id']}/zip", binary=True))
                            if snapshot.get("collection_complete") is False:
                                raise ValueError("Artifact reports incomplete collection")
                        except urllib.error.HTTPError as exc:
                            if exc.code not in (404, 410):
                                raise
                            warnings.append(f"Skipped unavailable artifact {artifact['id']}: HTTP {exc.code}")
                            continue
                        except (ValueError, KeyError, TypeError, AttributeError, zipfile.BadZipFile, OSError) as exc:
                            warnings.append(f"Skipped invalid artifact {artifact['id']}: {str(exc)[:200]}")
                            continue
                        metadata = {"status": "restored", "run_id": run["id"],
                                    "run_url": run.get("html_url", f"https://github.com/{repository}/actions/runs/{run['id']}"),
                                    "artifact_id": artifact["id"], "generated_at": snapshot["generated_at"],
                                    "warnings": warnings}
                        (directory / "snapshot.json").write_text(
                            json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                        return metadata
                    if len(artifacts) < 100:
                        break
                else:
                    raise ValueError("Artifact pagination limit reached; cannot establish an accurate baseline")
            if len(runs) < 100:
                break
        else:
            raise ValueError("Workflow pagination limit reached; cannot establish an accurate baseline")
        metadata["warnings"] = warnings
        if warnings:
            metadata.update(status="error", error="Previous artifacts existed but no valid baseline could be restored")
        return metadata
    except Exception as exc:
        error = "HTTP " + str(exc.code) if isinstance(exc, urllib.error.HTTPError) else type(exc).__name__ + ": " + str(exc)[:300]
        metadata = {"status": "error", "error": error, "warnings": warnings}
        return metadata
    finally:
        (directory / "baseline-meta.json").write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    result = restore(os.environ.get("GITHUB_REPOSITORY", ""), os.environ.get("GH_TOKEN", ""),
                     os.environ.get("GITHUB_RUN_ID", ""))
    print(json.dumps(result, indent=2))
    # The monitor publishes restore errors with all other diagnostics, then fails.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
