#!/usr/bin/env python3
"""Read-only SamoSell SEO snapshot and diff; Python standard library only."""
import datetime as dt
import hashlib
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path

BASE = "https://samosell.ge"
PROPERTY = BASE + "/"
OUT = Path("seo-monitor-output")
UA = "SamoSellSEOHealthMonitor/2.0 (+https://samosell.ge)"
LEGACY = {"/catalog?category=" + category: "/catalog/" + category
          for category in ("women", "men", "kids", "accessories")}
PAGE_PATHS = ("/", "/catalog/women", "/catalog/men", "/catalog/kids",
              "/catalog/accessories", "/catalog/perfume")
INSPECT_PATHS = ("/", "/catalog/women", "/catalog/perfume")
INSPECT_FIELDS = ("verdict", "coverageState", "indexingState", "lastCrawlTime",
                  "googleCanonical", "userCanonical", "robotsTxtState", "pageFetchState")


class Redirects(urllib.request.HTTPRedirectHandler):
    def __init__(self):
        super().__init__()
        self.chain = []

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        self.chain.append({"status": code, "url": req.full_url, "location": newurl})
        return redirected


def request(url, limit=2_000_000):
    redirects = Redirects()
    opener = urllib.request.build_opener(redirects)
    result = {"status": None, "url": url, "text": "", "error": None,
              "redirects": redirects.chain, "x_robots_tag": [], "truncated": False}
    try:
        with opener.open(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=20) as response:
            body = response.read(limit + 1)
            result.update(status=response.status, url=response.geturl(),
                          text=body[:limit].decode("utf-8", "replace"),
                          truncated=len(body) > limit,
                          x_robots_tag=response.headers.get_all("X-Robots-Tag", []))
    except urllib.error.HTTPError as exc:
        result.update(status=exc.code, url=exc.geturl(), error="HTTP " + str(exc.code))
    except Exception as exc:
        result["error"] = type(exc).__name__ + ": " + str(exc)[:200]
    result["initial_status"] = redirects.chain[0]["status"] if redirects.chain else result["status"]
    return result


def google_request(url, data=None):
    token = os.environ.get("ACCESS_TOKEN", "")
    if not token:
        return {"error": "Missing ACCESS_TOKEN (Google WIF authentication did not supply a token)"}
    payload = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=payload, headers={
        "Authorization": "Bearer " + token, "Content-Type": "application/json"},
        method="POST" if data is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            result = json.load(response)
        if not isinstance(result, dict):
            return {"error": "Invalid Google API response: expected a JSON object"}
        return result
    except urllib.error.HTTPError as exc:
        details = exc.read(4000).decode("utf-8", "replace")
        try:
            details = json.loads(details).get("error", {}).get("message", details)
        except (ValueError, AttributeError):
            pass
        return {"error": "HTTP " + str(exc.code), "details": str(details)[:1000]}
    except Exception as exc:
        return {"error": type(exc).__name__ + ": " + str(exc)[:200]}


def gsc(path, data=None):
    return google_request("https://www.googleapis.com/webmasters/v3/" + path, data)


def gsc_inspect(site, url):
    data = google_request("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
                          {"inspectionUrl": url, "siteUrl": site, "languageCode": "en-US"})
    if data.get("error"):
        return data
    inspected = data.get("inspectionResult")
    result = inspected.get("indexStatusResult") if isinstance(inspected, dict) else None
    if not isinstance(result, dict) or not result.get("verdict"):
        return {"error": "Invalid URL Inspection response: indexStatusResult/verdict missing"}
    return {key: result.get(key) for key in INSPECT_FIELDS}


class Meta(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonicals = []
        self.robots = []

    def handle_starttag(self, tag, attrs):
        attrs = {key: value or "" for key, value in attrs}
        if tag == "link" and "canonical" in attrs.get("rel", "").lower().split():
            self.canonicals.append(attrs.get("href", ""))
        if tag == "meta" and attrs.get("name", "").lower() in ("robots", "googlebot"):
            self.robots.append(attrs.get("content", ""))

    handle_startendtag = handle_starttag


def sitemap_urls(response, fetch=None, max_documents=50):
    """Expand sitemap indexes; incomplete inventories must never imply removals."""
    fetch = fetch or request
    urls, seen, errors = set(), set(), []
    queue = [(BASE + "/sitemap.xml", response)]
    is_index = False
    while queue:
        url, response = queue.pop(0)
        if url in seen:
            continue
        if len(seen) >= max_documents:
            errors.append("Sitemap document limit exceeded; URL inventory is incomplete")
            break
        seen.add(url)
        if response is None:
            response = fetch(url, limit=52_428_800)
        if response.get("status") != 200 or response.get("error") or response.get("truncated"):
            errors.append(f"{url}: {response.get('error') or 'HTTP ' + str(response.get('status'))}" +
                          ("; response truncated" if response.get("truncated") else ""))
            continue
        try:
            root = ET.fromstring(response["text"])
            kind = root.tag.rsplit("}", 1)[-1]
            if kind not in ("urlset", "sitemapindex"):
                raise ValueError("Expected urlset or sitemapindex, got " + kind)
            if len(seen) == 1:
                is_index = kind == "sitemapindex"
            for entry in root:
                if entry.tag.rsplit("}", 1)[-1] != ("sitemap" if kind == "sitemapindex" else "url"):
                    continue
                loc = next((child for child in entry if child.tag.rsplit("}", 1)[-1] == "loc"), None)
                value = (loc.text or "").strip() if loc is not None else ""
                parsed = urllib.parse.urlparse(value)
                if parsed.scheme not in ("http", "https") or not parsed.netloc:
                    raise ValueError("Missing or invalid sitemap loc")
                if kind == "sitemapindex":
                    if parsed.scheme != "https" or parsed.netloc != "samosell.ge":
                        raise ValueError("Child sitemap is outside https://samosell.ge")
                    queue.append((value, None))
                else:
                    urls.add(value)
        except (ET.ParseError, ValueError) as exc:
            errors.append(f"{url}: {type(exc).__name__}: {exc}")
    inventory = sorted(urls)
    return {"loc_urls": inventory, "loc_count": len(inventory), "loc_sample": inventory[:10],
            "is_sitemap_index": is_index, "sitemap_complete": not errors,
            "sitemap_documents": sorted(seen), "sitemap_errors": errors}


def validate_snapshot(snapshot):
    if not isinstance(snapshot, dict) or not isinstance(snapshot.get("checks"), dict):
        raise ValueError("Snapshot must contain a checks object")
    if not snapshot.get("generated_at"):
        raise ValueError("Snapshot generated_at missing")
    dt.datetime.fromisoformat(snapshot["generated_at"].replace("Z", "+00:00"))
    if snapshot.get("property") not in (PROPERTY, "sc-domain:samosell.ge"):
        raise ValueError("Snapshot belongs to another or inaccessible GSC property")
    if any(not isinstance(value, dict) for value in snapshot["checks"].values()):
        raise ValueError("Invalid snapshot checks")
    sitemap = snapshot["checks"].get("/sitemap.xml", {})
    if "loc_urls" in sitemap and (not isinstance(sitemap["loc_urls"], list) or
                                  any(not isinstance(url, str) for url in sitemap["loc_urls"])):
        raise ValueError("Invalid full sitemap URL inventory")
    if not isinstance(snapshot.get("url_inspection_sample", {}), dict):
        raise ValueError("Invalid URL Inspection sample")
    return snapshot


def load_previous(directory=Path("seo-monitor-previous")):
    directory = Path(directory)
    metadata = {"status": "missing", "reason": "No previous snapshot available"}
    try:
        if (directory / "baseline-meta.json").exists():
            metadata = json.loads((directory / "baseline-meta.json").read_text(encoding="utf-8"))
            if not isinstance(metadata, dict) or metadata.get("status") not in ("restored", "missing", "error"):
                raise ValueError("Invalid baseline metadata")
            if metadata["status"] == "error":
                return None, metadata
        path = directory / "snapshot.json"
        if not path.exists():
            if metadata.get("status") == "restored":
                raise ValueError("Restore reported success but snapshot.json is missing")
            return None, metadata
        snapshot = validate_snapshot(json.loads(path.read_text(encoding="utf-8")))
        metadata["status"] = "restored"
        return snapshot, metadata
    except (OSError, ValueError, TypeError, AttributeError) as exc:
        return None, {"status": "error", "error": "Invalid baseline: " + str(exc)[:300]}


def compare_snapshots(current, previous, baseline=None):
    changes = []
    if previous is None:
        if (baseline or {}).get("status") == "error":
            return ["Baseline restoration failed; changes cannot be calculated (see collection errors)."]
        return ["First baseline: no previous snapshot available; changes cannot yet be calculated."]
    for path, info in current["checks"].items():
        old = previous["checks"].get(path)
        if old is None:
            changes.append("Newly monitored endpoint: " + path)
            continue
        for key in ("status", "initial_status", "final_url", "redirects", "canonicals",
                    "robots_meta", "x_robots_tag", "disallow_rules", "has_sitemap_directive",
                    "content_sha256", "googlebot_allowed"):
            if key in old and key in info and old[key] != info[key]:
                changes.append(f"{path}: {key}: {old[key]} -> {info[key]}")
    new_sitemap = current["checks"].get("/sitemap.xml", {})
    old_sitemap = previous["checks"].get("/sitemap.xml", {})
    if not new_sitemap.get("sitemap_complete", False):
        changes.append("Sitemap URL diff skipped: current inventory is incomplete; no removals inferred.")
    elif "loc_urls" not in old_sitemap:
        changes.append("Previous snapshot lacks full sitemap URLs; URL-level diff begins with this run.")
    elif not old_sitemap.get("sitemap_complete", old_sitemap.get("status") == 200 and
                             not old_sitemap.get("is_sitemap_index", False)):
        changes.append("Sitemap URL diff skipped: previous inventory is incomplete.")
    else:
        new_urls, old_urls = set(new_sitemap["loc_urls"]), set(old_sitemap["loc_urls"])
        changes.extend("Sitemap added: " + url for url in sorted(new_urls - old_urls))
        changes.extend("Sitemap removed: " + url for url in sorted(old_urls - new_urls))
    for path, info in current.get("url_inspection_sample", {}).items():
        old = previous.get("url_inspection_sample", {}).get(path, {})
        if info.get("error") or old.get("error"):
            if old.get("error") != info.get("error"):
                changes.append(f"URL Inspection {path}: API availability: {old.get('error') or 'available'} -> "
                               f"{info.get('error') or 'available'}")
            continue
        for key in INSPECT_FIELDS:
            if key in old and key in info and old[key] != info[key]:
                changes.append(f"URL Inspection {path}: {key}: {old[key]} -> {info[key]}")
    return changes or ["No changes detected in monitored fields."]


def error_description(result):
    return str(result.get("error", "")) + (": " + str(result["details"]) if result.get("details") else "")


def collect_snapshot():
    checks = {}
    for path in ("/robots.txt", "/sitemap.xml") + PAGE_PATHS + tuple(LEGACY):
        response = request(BASE + path, limit=52_428_800 if path == "/sitemap.xml" else 2_000_000)
        item = {"status": response["status"], "initial_status": response["initial_status"],
                "final_url": response["url"], "redirects": response["redirects"],
                "x_robots_tag": response["x_robots_tag"], "error": response["error"]}
        if response["truncated"]:
            item["error"] = "Response exceeded size limit; checks incomplete"
        if path == "/sitemap.xml":
            item.update(sitemap_urls(response))
        elif path == "/robots.txt" and response["status"] == 200:
            item["has_sitemap_directive"] = bool(re.search(r"(?im)^\s*sitemap\s*:", response["text"]))
            item["disallow_rules"] = re.findall(r"(?im)^[ \t]*disallow[ \t]*:[ \t]*([^\r\n]*)", response["text"])
            item["content_sha256"] = hashlib.sha256(response["text"].encode()).hexdigest()
            robots = urllib.robotparser.RobotFileParser()
            robots.parse(response["text"].splitlines())
            item["googlebot_allowed"] = {page: robots.can_fetch("Googlebot", BASE + page) for page in PAGE_PATHS}
        elif response["status"] == 200:
            meta = Meta()
            meta.feed(response["text"])
            item["canonicals"], item["robots_meta"] = meta.canonicals, meta.robots
        checks[path] = item
    properties = gsc("sites")
    entries = properties.get("siteEntry", [])
    if not isinstance(entries, list) or any(not isinstance(entry, dict) for entry in entries):
        properties = {"error": "Invalid Google properties response: siteEntry must be an array of objects"}
        entries = []
    selected = next((candidate for candidate in (PROPERTY, "sc-domain:samosell.ge")
                     if any(entry.get("siteUrl") == candidate for entry in entries)), None)
    sitemaps, search, inspection = {}, {}, {}
    if selected:
        site_id = urllib.parse.quote(selected, safe="")
        sitemaps = gsc("sites/" + site_id + "/sitemaps")
        end = dt.datetime.now(dt.timezone.utc).date() - dt.timedelta(days=3)
        start = end - dt.timedelta(days=6)
        search = gsc("sites/" + site_id + "/searchAnalytics/query", {
            "startDate": start.isoformat(), "endDate": end.isoformat(), "dimensions": ["date"], "rowLimit": 20})
        search["date_window"] = [start.isoformat(), end.isoformat()]
        inspection = {path: gsc_inspect(selected, BASE + path) for path in INSPECT_PATHS}
    return {"schema_version": 2, "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "property": selected, "property_access": bool(selected), "gsc_properties": properties,
            "checks": checks, "sitemaps": sitemaps, "search_analytics": search,
            "url_inspection_sample": inspection}


def findings(snapshot, baseline):
    errors, warnings = [], []
    if baseline.get("status") == "error":
        errors.append("Baseline restore: " + error_description(baseline))
    warnings.extend(baseline.get("warnings", []))
    if not snapshot["property_access"]:
        errors.append("Search Console property not accessible: " +
                      (error_description(snapshot["gsc_properties"]) or PROPERTY + " not in accessible properties"))
    for name in ("sitemaps", "search_analytics"):
        if snapshot[name].get("error"):
            errors.append("Google API " + name + ": " + error_description(snapshot[name]))
    for path, info in snapshot["checks"].items():
        if info.get("error") or info["status"] != 200:
            errors.append(f"{path}: HTTP {info['status']}; {info.get('error') or 'unexpected final response'}")
        if path in LEGACY and (info["initial_status"] not in (301, 308) or
                               info["final_url"] != BASE + LEGACY[path] or info["status"] != 200):
            warnings.append(f"{path}: expected permanent redirect to {BASE + LEGACY[path]}; "
                            f"got initial HTTP {info['initial_status']} -> {info['final_url']} (HTTP {info['status']})")
        if "canonicals" in info:
            expected = BASE + LEGACY.get(path, path)
            canonical_urls = [urllib.parse.urljoin(info["final_url"], url).rstrip("/") for url in info["canonicals"]]
            if canonical_urls != [expected.rstrip("/")]:
                warnings.append(f"{path}: missing, multiple or unexpected canonical: {info['canonicals']}")
            if any(re.search(r"\b(noindex|none)\b", value, re.I)
                   for value in info.get("robots_meta", []) + info.get("x_robots_tag", [])):
                warnings.append(path + ": robots meta / X-Robots-Tag blocks indexing")
    robots = snapshot["checks"]["/robots.txt"]
    if robots["status"] == 200 and not robots.get("has_sitemap_directive"):
        warnings.append("robots.txt is missing a Sitemap directive")
    for path, allowed in robots.get("googlebot_allowed", {}).items():
        if not allowed:
            warnings.append(path + ": robots.txt blocks Googlebot")
    errors.extend(snapshot["checks"]["/sitemap.xml"].get("sitemap_errors", []))
    for path, info in snapshot["url_inspection_sample"].items():
        if info.get("error"):
            errors.append("Google URL Inspection " + path + ": " + error_description(info))
        elif info.get("verdict") != "PASS":
            warnings.append(f"{path}: Google does not confirm indexation: {info.get('coverageState')}")
    return errors, warnings


def render_report(snapshot):
    baseline = snapshot["baseline"]
    lines = ["# SamoSell SEO health report", "", "UTC: " + snapshot["generated_at"],
             "Search Console property: " + (snapshot["property"] or "NOT ACCESSIBLE"),
             "Collection status: " + ("COMPLETE" if snapshot["collection_complete"] else "INCOMPLETE"),
             "", "## Previous snapshot", "", "- Status: " + baseline["status"]]
    if baseline.get("run_url"):
        lines.append(f"- Source: {baseline['run_url']} (artifact {baseline['artifact_id']})")
    if baseline.get("reason"):
        lines.append("- " + baseline["reason"])
    lines += ["", "## HTTP / redirects / canonical / robots", ""]
    for path, info in snapshot["checks"].items():
        lines.append(f"- {path}: HTTP {info['initial_status']} -> {info['status']}; "
                     f"final {info['final_url']}; canonical {info.get('canonicals', 'n/a')}; "
                     f"robots {info.get('robots_meta', [])}; X-Robots-Tag {info.get('x_robots_tag', [])}")
    sitemap = snapshot["checks"]["/sitemap.xml"]
    lines += ["", "## Sitemap inventory", "", f"- Unique page URLs: {sitemap['loc_count']}; "
              f"complete: {sitemap['sitemap_complete']}; documents: {len(sitemap['sitemap_documents'])}",
              "- Full URL inventory is stored in snapshot.json; comparison uses URL sets, not counts.",
              "", "## Google URL Inspection (indexed version)", ""]
    for path in INSPECT_PATHS:
        info = snapshot["url_inspection_sample"].get(path)
        if info is None:
            lines.append(f"- {path}: NOT RUN (property authentication/access failed)")
        elif info.get("error"):
            lines.append(f"- {path}: API ERROR: {error_description(info)}")
        else:
            lines.append(f"- {path}: verdict={info.get('verdict')}; coverage={info.get('coverageState')}; "
                         f"indexing={info.get('indexingState')}; last crawl={info.get('lastCrawlTime')}; "
                         f"Google canonical={info.get('googleCanonical')}; user canonical={info.get('userCanonical')}; "
                         f"robots.txt={info.get('robotsTxtState')}; fetch={info.get('pageFetchState')}")
    lines += ["", "## Changes since previous snapshot", ""] + ["- " + value for value in snapshot["changes"]]
    lines += ["", "## Collection / Google API errors", ""] + (
        ["- " + value for value in snapshot["collection_errors"]] or ["- None"])
    lines += ["", "## SEO warnings", ""] + (
        ["- " + value for value in snapshot["warnings"]] or ["- No monitored SEO warnings detected"])
    lines += ["", "## Caveats", "", "- Search Analytics is delayed and does not prove indexation.",
              "- URL Inspection reports Google's indexed version for a fixed sample; it is not a Live Test.",
              "- A 200 response, sitemap inclusion or indexing request does not prove indexation.",
              "- Live Test and Request Indexing require the Search Console interface; this monitor does neither.",
              "- Sitemap URL removals are calculated only from two complete inventories."]
    return "\n".join(lines) + "\n"


def main():
    OUT.mkdir(exist_ok=True)
    snapshot = collect_snapshot()
    previous, baseline = load_previous()
    snapshot["baseline"] = baseline
    snapshot["changes"] = compare_snapshots(snapshot, previous, baseline)
    snapshot["collection_errors"], snapshot["warnings"] = findings(snapshot, baseline)
    snapshot["collection_complete"] = not snapshot["collection_errors"]
    (OUT / "snapshot.json").write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = render_report(snapshot)
    (OUT / "report.md").write_text(report, encoding="utf-8")
    print(report)
    return 0 if snapshot["collection_complete"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
