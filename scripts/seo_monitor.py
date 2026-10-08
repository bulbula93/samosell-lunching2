#!/usr/bin/env python3
"""Read-only SamoSell SEO health snapshot; Python standard library only."""
import datetime as dt
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path

BASE = "https://samosell.ge"
OUT = Path("seo-monitor-output")
OUT.mkdir(exist_ok=True)
UA = "SamoSellSEOHealthMonitor/1.0 (+https://samosell.ge)"
TOKEN = os.environ.get("ACCESS_TOKEN", "")

def request(url, token=None, limit=1000000):
    headers = {"User-Agent": UA}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            return {"status": response.status, "url": response.url, "text": response.read(limit).decode("utf-8", "replace"), "error": None}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "url": url, "text": "", "error": "HTTP " + str(e.code)}
    except Exception as e:
        return {"status": None, "url": url, "text": "", "error": type(e).__name__ + ": " + str(e)[:160]}

def gsc(path, data=None):
    if not TOKEN:
        return {"error": "Missing ACCESS_TOKEN"}
    url = "https://www.googleapis.com/webmasters/v3/" + path
    headers = {"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"}
    payload = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST" if data is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return {"error": "HTTP " + str(e.code), "details": e.read(500).decode("utf-8", "replace")}
    except Exception as e:
        return {"error": str(e)[:200]}

class Meta(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonicals = []
        self.robots = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "link" and "canonical" in a.get("rel", "").lower().split():
            self.canonicals.append(a.get("href", ""))
        if tag == "meta" and a.get("name", "").lower() in ("robots", "googlebot"):
            self.robots.append(a.get("content", ""))

def main():
    today = dt.datetime.now(dt.timezone.utc).date()
    site = urllib.parse.quote(BASE + "/", safe="")
    properties = gsc("sites")
    entries = properties.get("siteEntry", [])
    selected = next((s["siteUrl"] for s in entries if s.get("siteUrl") in (BASE + "/", "sc-domain:samosell.ge")), None)
    checks = {}
    for path in ("/robots.txt", "/sitemap.xml", "/", "/catalog/women", "/catalog/accessories", "/catalog/perfume", "/catalog?category=women"):
        r = request(BASE + path)
        item = {"status": r["status"], "final_url": r["url"], "error": r["error"]}
        if path == "/robots.txt":
            item["has_sitemap_directive"] = bool(re.search(r"(?im)^\s*sitemap\s*:", r["text"]))
            item["disallow_rules"] = re.findall(r"(?im)^\s*disallow\s*:\s*(.*)$", r["text"])[:30]
        if path == "/sitemap.xml" and r["status"] == 200:
            try:
                root = ET.fromstring(r["text"])
                locs = [x.text for x in root.iter() if x.tag.endswith("}loc") or x.tag == "loc"]
                item["loc_count"] = len(locs)
                item["loc_sample"] = locs[:10]
                item["is_sitemap_index"] = root.tag.endswith("sitemapindex")
            except ET.ParseError:
                item["xml_parse_error"] = True
        if r["status"] == 200 and path not in ("/robots.txt", "/sitemap.xml"):
            m = Meta()
            m.feed(r["text"])
            item["canonicals"] = m.canonicals
            item["robots_meta"] = m.robots
        checks[path] = item
    search = {"note": "GSC Search Analytics data is delayed and is not a full indexation inventory"}
    sitemaps = {}
    inspection = {}
    if selected:
        site_id = urllib.parse.quote(selected, safe="")
        sitemaps = gsc("sites/" + site_id + "/sitemaps")
        end = today - dt.timedelta(days=3)
        start = end - dt.timedelta(days=6)
        search = gsc("sites/" + site_id + "/searchAnalytics/query", {"startDate": start.isoformat(), "endDate": end.isoformat(), "dimensions": ["date"], "rowLimit": 20})
        search["date_window"] = [start.isoformat(), end.isoformat()]
        # Small, fixed sample only: inspection quotas are limited.
        for path in ("/", "/catalog/women", "/catalog/perfume"):
            inspection[path] = gsc_inspect(selected, BASE + path)
    snapshot = {"generated_at": dt.datetime.now(dt.timezone.utc).isoformat(), "property": selected, "property_access": bool(selected), "checks": checks, "sitemaps": sitemaps, "search_analytics": search, "url_inspection_sample": inspection}
    (OUT / "snapshot.json").write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
    previous = load_previous()
    changes = []
    if previous:
        for path, current in checks.items():
            old = previous.get("checks", {}).get(path, {})
            for key in ("status", "final_url", "canonicals", "robots_meta"):
                if key in old and old[key] != current.get(key):
                    changes.append(f"{path}: {key}: {old[key]} -> {current.get(key)}")
    else:
        changes.append("First baseline: no previous snapshot available; changes cannot yet be calculated.")
    warnings = []
    if not selected:
        warnings.append("Search Console property not accessible")
    for path, info in checks.items():
        if info["status"] is None or info["status"] >= 400:
            warnings.append(f"{path}: HTTP {info['status']} ({info['error']})")
    if checks["/sitemap.xml"].get("xml_parse_error"):
        warnings.append("Sitemap XML parse error")
    lines = ["# SamoSell SEO health report", "", f"UTC: {snapshot['generated_at']}", f"Search Console property: {selected or 'NOT ACCESSIBLE'}", "", "## HTTP / canonical checks", ""]
    for path, info in checks.items():
        lines.append(f"- \`{path}\`: HTTP {info['status']}, final \`{info['final_url']}\`" + (f", canonical {info['canonicals']}" if "canonicals" in info else ""))
    lines += ["", "## Changes since previous snapshot", ""] + ["- " + x for x in changes]
    lines += ["", "## Warnings", ""] + (["- " + x for x in warnings] if warnings else ["- No basic HTTP failures detected"])
    lines += ["", "## Caveats", "", "- Search Analytics is delayed and does not prove indexation.", "- URL Inspection is a small sample, not a complete indexed URL count.", "- A 200 response does not by itself mean that a page is indexable.", "- Sitemap and canonical checks are diagnostic signals, not full crawling."]
    (OUT / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    if not selected:
        raise SystemExit("GSC property not accessible")

def gsc_inspect(site, url):
    # URL Inspection is a separate API endpoint from the legacy webmasters API.
    if not TOKEN:
        return {"error": "Missing ACCESS_TOKEN"}
    payload = json.dumps({"inspectionUrl": url, "siteUrl": site}).encode()
    req = urllib.request.Request("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", data=payload, headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            data = json.load(response)
        result = data.get("inspectionResult", {}).get("indexStatusResult", {})
        return {k: result.get(k) for k in ("verdict", "coverageState", "indexingState", "lastCrawlTime", "googleCanonical", "userCanonical")}
    except urllib.error.HTTPError as e:
        return {"error": "HTTP " + str(e.code)}
    except Exception as e:
        return {"error": str(e)[:160]}

def load_previous():
    path = Path("seo-monitor-previous/snapshot.json")
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return None
    return None

if __name__ == "__main__":
    main()
