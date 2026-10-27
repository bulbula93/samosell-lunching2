"""Offline signature scan of reachable Git history. Never prints matched values.

This supplements Secretlint; it is not an exhaustive credential/entropy scanner.
"""
import base64
import hashlib
import json
import re
import subprocess

patterns = {
    "private-key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "github-token": re.compile(r"(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})"),
    "supabase-secret": re.compile(r"sb_secret_[A-Za-z0-9_-]{20,}"),
    "aws-access-key": re.compile(r"(?:AKIA|ASIA)[A-Z0-9]{16}"),
    "stripe-live-secret": re.compile(r"(?:sk|rk)_live_[A-Za-z0-9]{20,}"),
    "openai-key": re.compile(r"sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,}"),
}
jwt = re.compile(r"eyJ[A-Za-z0-9_-]{8,}\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]{20,}")
process = subprocess.Popen(
    ["git", "log", "--all", "--format=COMMIT:%H", "-p", "--no-ext-diff", "--no-textconv"],
    stdout=subprocess.PIPE, text=True, errors="replace",
)
commit, path = None, None
findings, seen, commits = [], set(), set()
for line in process.stdout:
    if line.startswith("COMMIT:"):
        commit = line.strip().split(":", 1)[1]
        commits.add(commit)
    elif line.startswith("+++ b/"):
        path = line.strip()[6:]
    elif line.startswith("+") and not line.startswith("+++"):
        matches = [(kind, match.group()) for kind, regex in patterns.items() for match in regex.finditer(line)]
        for match in jwt.finditer(line):
            try:
                payload = json.loads(base64.urlsafe_b64decode(match.group(1) + "=" * (-len(match.group(1)) % 4)))
                if payload.get("role") == "service_role":
                    matches.append(("service-role-jwt", match.group()))
            except (ValueError, TypeError):
                pass
        for kind, value in matches:
            fingerprint = hashlib.sha256(value.encode()).hexdigest()[:16]
            if (kind, fingerprint) not in seen:
                seen.add((kind, fingerprint))
                findings.append({"kind": kind, "commit": commit, "path": path, "fingerprint": fingerprint})
code = process.wait()
if code:
    raise SystemExit(code)
print(json.dumps({"commits": len(commits), "findings": findings}, indent=2))
