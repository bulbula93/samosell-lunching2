"""Regression coverage for SEO diffs, API errors and artifact restoration."""
import copy
import io
import json
import os
import tempfile
import unittest
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

import seo_monitor as monitor
import seo_restore_previous as restore


def response(text="", status=200, url=monitor.BASE + "/sitemap.xml", **extra):
    data = {"text": text, "status": status, "initial_status": status, "url": url,
            "error": None, "truncated": False, "redirects": [], "x_robots_tag": []}
    data.update(extra)
    return data


def urlset(urls):
    return '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + "".join(
        "<url><loc>" + url + "</loc></url>" for url in urls) + "</urlset>"


def snapshot(urls=None):
    checks = {}
    for path in ("/robots.txt", "/sitemap.xml") + monitor.PAGE_PATHS + tuple(monitor.LEGACY):
        final = monitor.BASE + monitor.LEGACY.get(path, path)
        initial = 308 if path in monitor.LEGACY else 200
        checks[path] = {"status": 200, "initial_status": initial, "final_url": final,
                        "redirects": [], "error": None, "x_robots_tag": []}
        if path not in ("/robots.txt", "/sitemap.xml"):
            checks[path].update(canonicals=[final], robots_meta=["index, follow"])
    checks["/robots.txt"].update(has_sitemap_directive=True, disallow_rules=["/admin"],
                                 googlebot_allowed={path: True for path in monitor.PAGE_PATHS},
                                 content_sha256="robots-old")
    checks["/sitemap.xml"].update(monitor.sitemap_urls(response(urlset(urls or [monitor.PROPERTY]))))
    return {"generated_at": "2026-10-11T10:00:00+00:00", "property": monitor.PROPERTY,
            "property_access": True, "gsc_properties": {"siteEntry": [{"siteUrl": monitor.PROPERTY}]},
            "checks": checks, "sitemaps": {}, "search_analytics": {},
            "url_inspection_sample": {path: {key: ("PASS" if key == "verdict" else None)
                                             for key in monitor.INSPECT_FIELDS}
                                      for path in monitor.INSPECT_PATHS}}


def archive(snapshot_data):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as zipped:
        zipped.writestr("snapshot.json", json.dumps(snapshot_data))
        zipped.writestr("report.md", "Fixture report")
    return stream.getvalue()


class SitemapTests(unittest.TestCase):
    def test_full_inventory_deduplicates_and_keeps_urls_beyond_sample(self):
        urls = [monitor.BASE + "/listing/" + str(i) for i in range(40)]
        result = monitor.sitemap_urls(response(urlset(urls + [urls[-1]])))
        self.assertTrue(result["sitemap_complete"])
        self.assertEqual(result["loc_count"], 40)
        self.assertEqual(result["loc_urls"], sorted(urls))
        self.assertEqual(len(result["loc_sample"]), 10)

    def test_sitemap_index_expands_all_children(self):
        text = "<sitemapindex><sitemap><loc>https://samosell.ge/one.xml</loc></sitemap>" \
               "<sitemap><loc>https://samosell.ge/two.xml</loc></sitemap></sitemapindex>"
        fetched = []
        def fetch(url, **kwargs):
            fetched.append(url)
            return response(urlset([monitor.BASE + ("/one" if url.endswith("one.xml") else "/two")]))
        result = monitor.sitemap_urls(response(text), fetch=fetch)
        self.assertEqual(len(fetched), 2)
        self.assertEqual(result["loc_urls"], [monitor.BASE + "/one", monitor.BASE + "/two"])
        self.assertTrue(result["sitemap_complete"])
        self.assertTrue(result["is_sitemap_index"])

    def test_child_failure_makes_whole_inventory_incomplete(self):
        text = "<sitemapindex><sitemap><loc>https://samosell.ge/child.xml</loc></sitemap></sitemapindex>"
        result = monitor.sitemap_urls(response(text), fetch=lambda *args, **kwargs: response(status=503, error="HTTP 503"))
        self.assertFalse(result["sitemap_complete"])
        self.assertIn("HTTP 503", result["sitemap_errors"][0])

    def test_invalid_xml_and_truncation_are_not_empty_successful_sitemaps(self):
        for value in (response("<urlset>"), response(urlset([]), truncated=True),
                      response("<html/>"), response("<urlset><url/></urlset>")):
            with self.subTest(value=value):
                self.assertFalse(monitor.sitemap_urls(value)["sitemap_complete"])

    def test_document_limit_is_explicit(self):
        text = "<sitemapindex><sitemap><loc>https://samosell.ge/child.xml</loc></sitemap></sitemapindex>"
        result = monitor.sitemap_urls(response(text), max_documents=1)
        self.assertFalse(result["sitemap_complete"])
        self.assertIn("limit", result["sitemap_errors"][0])

    def test_external_child_is_reported(self):
        text = "<sitemapindex><sitemap><loc>https://other.example/sitemap.xml</loc></sitemap></sitemapindex>"
        self.assertFalse(monitor.sitemap_urls(response(text))["sitemap_complete"])


class DiffTests(unittest.TestCase):
    def test_same_count_replacement_beyond_sample_records_both_urls(self):
        old_urls = [monitor.BASE + "/listing/" + str(i) for i in range(20)]
        old = snapshot(old_urls)
        new = snapshot(old_urls[:-1] + [monitor.BASE + "/new"])
        changes = monitor.compare_snapshots(new, old)
        self.assertIn("Sitemap added: " + monitor.BASE + "/new", changes)
        self.assertIn("Sitemap removed: " + old_urls[-1], changes)

    def test_reordered_and_duplicate_urls_are_not_changes(self):
        old = snapshot([monitor.BASE + "/a", monitor.BASE + "/b"])
        new = snapshot([monitor.BASE + "/b", monitor.BASE + "/a", monitor.BASE + "/a"])
        self.assertEqual(monitor.compare_snapshots(new, old), ["No changes detected in monitored fields."])

    def test_failed_current_sitemap_never_infers_removals(self):
        old, new = snapshot(), snapshot()
        new["checks"]["/sitemap.xml"].update(loc_urls=[], sitemap_complete=False)
        changes = monitor.compare_snapshots(new, old)
        self.assertFalse(any(value.startswith("Sitemap removed:") for value in changes))
        self.assertTrue(any("current inventory is incomplete" in value for value in changes))

    def test_incomplete_old_inventory_never_infers_additions(self):
        old, new = snapshot(), snapshot([monitor.BASE + "/new"])
        old["checks"]["/sitemap.xml"]["sitemap_complete"] = False
        self.assertIn("Sitemap URL diff skipped: previous inventory is incomplete.", monitor.compare_snapshots(new, old))

    def test_old_snapshot_without_full_urls_establishes_new_inventory(self):
        old = snapshot()
        del old["checks"]["/sitemap.xml"]["loc_urls"]
        changes = monitor.compare_snapshots(snapshot(), old)
        self.assertTrue(any("lacks full sitemap URLs" in value for value in changes))
        self.assertFalse(any(value.startswith("Sitemap added:") for value in changes))

    def test_first_run_explains_absent_baseline(self):
        self.assertIn("First baseline", monitor.compare_snapshots(snapshot(), None)[0])

    def test_restore_failure_is_not_a_first_run(self):
        changes = monitor.compare_snapshots(snapshot(), None, {"status": "error"})
        self.assertIn("restoration failed", changes[0])
        self.assertNotIn("First baseline", changes[0])

    def test_redirect_canonical_robots_and_http_diffs(self):
        old, new = snapshot(), snapshot()
        info = new["checks"]["/catalog?category=women"]
        info.update(initial_status=302, final_url=monitor.BASE + "/catalog/men",
                    canonicals=[monitor.BASE + "/catalog/men"], robots_meta=["noindex"],
                    x_robots_tag=["noindex"], redirects=[{"status": 302}])
        new["checks"]["/robots.txt"].update(disallow_rules=["/"], content_sha256="new")
        changes = "\n".join(monitor.compare_snapshots(new, old))
        for field in ("initial_status", "final_url", "canonicals", "robots_meta",
                      "x_robots_tag", "redirects", "disallow_rules", "content_sha256"):
            self.assertIn(field + ":", changes)

    def test_all_inspection_status_fields_are_compared(self):
        old, new = snapshot(), snapshot()
        for key in monitor.INSPECT_FIELDS:
            new["url_inspection_sample"]["/catalog/women"][key] = "CHANGED"
        changes = "\n".join(monitor.compare_snapshots(new, old))
        for key in monitor.INSPECT_FIELDS:
            self.assertIn("URL Inspection /catalog/women: " + key, changes)

    def test_api_failure_is_not_an_indexation_status_change(self):
        old, new = snapshot(), snapshot()
        new["url_inspection_sample"]["/catalog/women"] = {"error": "HTTP 403", "details": "Permission denied"}
        changes = "\n".join(monitor.compare_snapshots(new, old))
        self.assertIn("API availability", changes)
        self.assertNotIn("verdict:", changes)
        self.assertNotIn("lastCrawlTime:", changes)

    def test_api_recovery_is_reported(self):
        old = snapshot()
        old["url_inspection_sample"]["/catalog/women"] = {"error": "HTTP 429"}
        self.assertIn("HTTP 429 -> available", "\n".join(monitor.compare_snapshots(snapshot(), old)))

    def test_failed_fetch_does_not_report_canonical_disappearance(self):
        old, new = snapshot(), snapshot()
        new["checks"]["/catalog/women"] = {"status": 503, "final_url": monitor.BASE + "/catalog/women"}
        changes = "\n".join(monitor.compare_snapshots(new, old))
        self.assertIn("status:", changes)
        self.assertNotIn("canonicals:", changes)


class ApiAndReportTests(unittest.TestCase):
    def test_meta_handles_self_closing_and_valueless_attributes(self):
        parser = monitor.Meta()
        parser.feed('<LINK REL="canonical" href="/catalog/women"/><meta name="robots" content="noindex"/><meta name/>')
        self.assertEqual(parser.canonicals, ["/catalog/women"])
        self.assertEqual(parser.robots, ["noindex"])

    def test_google_http_error_retains_reason(self):
        error = urllib.error.HTTPError("https://www.googleapis.com", 403, "Forbidden", {}, io.BytesIO(
            b'{"error":{"message":"Permission denied for property"}}'))
        with patch.dict(os.environ, {"ACCESS_TOKEN": "fixture-token"}), patch("urllib.request.urlopen", side_effect=error):
            result = monitor.gsc("sites")
        self.assertEqual(result["error"], "HTTP 403")
        self.assertIn("Permission denied", result["details"])

    def test_missing_token_is_explicit(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertIn("Missing ACCESS_TOKEN", monitor.gsc("sites")["error"])

    def test_inspection_error_includes_details(self):
        with patch.object(monitor, "google_request", return_value={"error": "HTTP 429", "details": "Quota exceeded"}):
            self.assertEqual(monitor.gsc_inspect(monitor.PROPERTY, monitor.BASE + "/"), {
                "error": "HTTP 429", "details": "Quota exceeded"})

    def test_invalid_inspection_is_an_api_error(self):
        for data in ({}, {"inspectionResult": None}, {"inspectionResult": {"indexStatusResult": {}}}):
            with patch.object(monitor, "google_request", return_value=data):
                self.assertIn("error", monitor.gsc_inspect(monitor.PROPERTY, monitor.PROPERTY))

    def test_redirect_warning_requires_permanent_status_and_correct_target(self):
        current = snapshot()
        current["checks"]["/catalog?category=women"]["initial_status"] = 302
        errors, warnings = monitor.findings(current, {"status": "missing"})
        self.assertFalse(errors)
        self.assertTrue(any("expected permanent redirect" in value for value in warnings))

    def test_robots_noindex_and_googlebot_block_are_warnings(self):
        current = snapshot()
        current["checks"]["/catalog/women"]["x_robots_tag"] = ["noindex"]
        current["checks"]["/robots.txt"]["googlebot_allowed"]["/catalog/women"] = False
        warnings = monitor.findings(current, {"status": "missing"})[1]
        self.assertTrue(any("blocks indexing" in value for value in warnings))
        self.assertTrue(any("blocks Googlebot" in value for value in warnings))

    def test_all_google_errors_render_and_fail_collection(self):
        current = snapshot()
        current["sitemaps"] = {"error": "HTTP 403", "details": "Sitemaps permission denied"}
        current["search_analytics"] = {"error": "HTTP 429", "details": "Quota exceeded"}
        current["url_inspection_sample"]["/catalog/women"] = {"error": "HTTP 500", "details": "Backend failure"}
        current["baseline"] = {"status": "missing"}
        current["changes"] = ["No changes detected in monitored fields."]
        current["collection_errors"], current["warnings"] = monitor.findings(current, current["baseline"])
        current["collection_complete"] = not current["collection_errors"]
        report = monitor.render_report(current)
        self.assertFalse(current["collection_complete"])
        for text in ("HTTP 403", "HTTP 429", "HTTP 500", "Backend failure", "INCOMPLETE"):
            self.assertIn(text, report)

    def test_unindexed_url_is_an_seo_finding_and_not_api_failure(self):
        current = snapshot()
        current["url_inspection_sample"]["/catalog/women"].update(
            verdict="NEUTRAL", coverageState="URL is unknown to Google")
        errors, warnings = monitor.findings(current, {"status": "missing"})
        self.assertFalse(errors)
        self.assertTrue(any("URL is unknown to Google" in value for value in warnings))

    def test_main_saves_report_snapshot_and_correct_exit_code(self):
        for fail in (False, True):
            with self.subTest(fail=fail), tempfile.TemporaryDirectory() as temp:
                current = snapshot()
                if fail:
                    current["search_analytics"] = {"error": "HTTP 429", "details": "Quota exceeded"}
                with patch.object(monitor, "OUT", Path(temp)), patch.object(monitor, "collect_snapshot", return_value=current), \
                     patch.object(monitor, "load_previous", return_value=(None, {"status": "missing"})), redirect_stdout(io.StringIO()):
                    result = monitor.main()
                self.assertEqual(result, 1 if fail else 0)
                saved = json.loads((Path(temp) / "snapshot.json").read_text())
                self.assertEqual(saved["collection_complete"], not fail)
                report = (Path(temp) / "report.md").read_text()
                self.assertIn("First baseline", report)
                self.assertIn("HTTP 429" if fail else "Collection status: COMPLETE", report)

    def test_no_changes_text_is_written_to_report(self):
        current = snapshot()
        current["baseline"] = {"status": "restored"}
        current["changes"] = monitor.compare_snapshots(current, copy.deepcopy(current))
        current["collection_errors"], current["warnings"] = [], []
        current["collection_complete"] = True
        self.assertIn("No changes detected in monitored fields.", monitor.render_report(current))

    def test_load_corrupt_baseline_is_an_error(self):
        with tempfile.TemporaryDirectory() as temp:
            (Path(temp) / "snapshot.json").write_text("{bad json")
            previous, info = monitor.load_previous(temp)
        self.assertIsNone(previous)
        self.assertEqual(info["status"], "error")

    def test_load_absent_baseline_is_missing(self):
        with tempfile.TemporaryDirectory() as temp:
            previous, info = monitor.load_previous(temp)
        self.assertIsNone(previous)
        self.assertEqual(info["status"], "missing")


class RestoreTests(unittest.TestCase):
    def run_restore(self, runs, artifacts=None, archives=None, extra_get=None):
        artifacts, archives = artifacts or {}, archives or {}
        calls = []
        def get(path, binary=False):
            calls.append(path)
            if extra_get:
                value = extra_get(path, binary)
                if value is not None:
                    return value
            if "/workflows/" in path:
                return {"workflow_runs": runs}
            if "/runs/" in path:
                run_id = int(path.split("/runs/")[1].split("/")[0])
                return {"artifacts": artifacts.get(run_id, [])}
            artifact_id = int(path.split("/artifacts/")[1].split("/")[0])
            value = archives.get(artifact_id)
            if isinstance(value, Exception):
                raise value
            return value
        with tempfile.TemporaryDirectory() as temp:
            info = restore.restore("bulbula93/samosell-lunching2", "fixture", current_run="99", directory=temp, get=get)
            persisted = json.loads((Path(temp) / "baseline-meta.json").read_text())
            restored = json.loads((Path(temp) / "snapshot.json").read_text()) if (Path(temp) / "snapshot.json").exists() else None
        self.assertEqual(info, persisted)
        return info, restored, calls

    @staticmethod
    def workflow_run(run_id, **extra):
        result = {"id": run_id, "head_branch": "main", "status": "completed", "conclusion": "success",
                  "path": ".github/workflows/seo-monitor-daily.yml", "created_at": f"2026-10-{run_id:02}T10:00:00Z"}
        result.update(extra)
        return result

    @staticmethod
    def artifact(artifact_id, **extra):
        result = {"id": artifact_id, "name": "seo-snapshot", "expired": False}
        result.update(extra)
        return result

    def test_restores_only_successful_main_workflow_and_excludes_current_run(self):
        runs = [self.workflow_run(99), self.workflow_run(5, head_branch="preview"),
                self.workflow_run(4, conclusion="failure"), self.workflow_run(3, path=".github/workflows/other.yml"), self.workflow_run(2)]
        info, saved, calls = self.run_restore(runs, {2: [self.artifact(20)]}, {20: archive(snapshot())})
        self.assertEqual(info["run_id"], 2)
        self.assertEqual(info["artifact_id"], 20)
        self.assertEqual(saved["property"], monitor.PROPERTY)
        self.assertIn("branch=main", calls[0])
        self.assertIn("status=success", calls[0])
        self.assertEqual(len(calls), 3)

    def test_expired_artifact_falls_back_to_older_successful_run(self):
        info, saved, _ = self.run_restore([self.workflow_run(2), self.workflow_run(1)],
            {2: [self.artifact(20, expired=True)], 1: [self.artifact(10)]}, {10: archive(snapshot())})
        self.assertEqual(info["run_id"], 1)
        self.assertIsNotNone(saved)

    def test_invalid_zip_falls_back_and_reports_warning(self):
        info, saved, _ = self.run_restore([self.workflow_run(2), self.workflow_run(1)],
            {2: [self.artifact(20)], 1: [self.artifact(10)]}, {20: b"not a zip", 10: archive(snapshot())})
        self.assertEqual(info["status"], "restored")
        self.assertEqual(info["run_id"], 1)
        self.assertTrue(info["warnings"])
        self.assertIsNotNone(saved)

    def test_missing_artifact_is_true_baseline_case(self):
        info, saved, _ = self.run_restore([])
        self.assertEqual(info["status"], "missing")
        self.assertIsNone(saved)

    def test_api_permission_failure_is_not_silently_a_first_run(self):
        def forbidden(path, binary):
            raise urllib.error.HTTPError("https://api.github.com", 403, "Forbidden", {}, None)
        info, saved, _ = self.run_restore([], extra_get=forbidden)
        self.assertEqual(info["status"], "error")
        self.assertEqual(info["error"], "HTTP 403")
        self.assertIsNone(saved)

    def test_runs_pagination_finds_older_artifact(self):
        filler = [self.workflow_run(i + 100, head_branch="preview") for i in range(100)]
        def pages(path, binary):
            if "/workflows/" in path:
                page = urllib.parse.parse_qs(urllib.parse.urlparse(path).query)["page"][0]
                return {"workflow_runs": filler if page == "1" else [self.workflow_run(1)]}
            return None
        info, saved, calls = self.run_restore([], {1: [self.artifact(10)]}, {10: archive(snapshot())}, extra_get=pages)
        self.assertEqual(info["run_id"], 1)
        self.assertTrue(any("page=2" in path for path in calls))

    def test_unavailable_zip_falls_back(self):
        gone = urllib.error.HTTPError("https://api.github.com", 410, "Gone", {}, None)
        info, _, _ = self.run_restore([self.workflow_run(2), self.workflow_run(1)],
            {2: [self.artifact(20)], 1: [self.artifact(10)]}, {20: gone, 10: archive(snapshot())})
        self.assertEqual(info["run_id"], 1)
        self.assertIn("HTTP 410", info["warnings"][0])

    def test_incomplete_snapshot_is_not_restored(self):
        bad = snapshot()
        bad["collection_complete"] = False
        info, saved, _ = self.run_restore([self.workflow_run(1)], {1: [self.artifact(10)]}, {10: archive(bad)})
        self.assertEqual(info["status"], "error")
        self.assertIsNone(saved)
        self.assertTrue(info["warnings"])

    def test_wrong_property_snapshot_is_rejected(self):
        wrong = snapshot()
        wrong["property"] = "https://other.example/"
        with self.assertRaises(ValueError):
            restore.read_snapshot(archive(wrong))

    def test_auth_header_is_removed_on_external_archive_redirect(self):
        req = urllib.request.Request("https://api.github.com/repos/example/actions/artifacts/1/zip",
                                     headers={"Authorization": "Bearer fixture"})
        redirected = restore.SafeRedirects().redirect_request(
            req, None, 302, "Found", {}, "https://storage.example/signed-archive.zip")
        self.assertIsNone(redirected.get_header("Authorization"))


if __name__ == "__main__":
    unittest.main()
