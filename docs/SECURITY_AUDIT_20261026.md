# SamoSell Security Audit — 2026-10-26

## აღმასრულებელი შეჯამება

**ვერდიქტი: NOT READY სრული Production release-ისთვის.**

Production-ზე დადასტურდა მაღალი სიმძიმის Storage ხარვეზი: ავტორიზებულ მომხმარებელს შეეძლო სხვისი avatar/store-branding ფაილის შექმნა, ჩანაცვლება და წაშლა. ეს მოქმედებები გავიმეორეთ მხოლოდ QA-ის დროებით ანგარიშებსა და ფაილებზე. გამოსწორების შემდეგ სხვისი INSERT, UPDATE, upsert და DELETE იბლოკება; საკუთარი ფაილების მართვა და საჯარო გამოსახულებები მუშაობს.

დამატებით დაიხურა შიდა მარკეტინგული სტატისტიკის RPC-ის საჯარო წვდომა. Next.js/React და მოწყვლადი ტრანზიტული დამოკიდებულებები განახლდა; dependency audit-ის 73 შეტყობინება შემცირდა ნულამდე. დაემატა CSP Report-Only, ადმინისტრატორის API-ების CSRF/body საზღვრები, telemetry-ის მოცულობის შეზღუდვა და პირადი ტექსტის ლოგებში მოხვედრისგან დაცვა.

QA-ზე პროფილის პრივილეგიების თვითნებური შეცვლა, სხვის ჩატში/შეტყობინებაში/განცხადებაში/შეკვეთაში/notification-ში ჩარევა და გადახდის finalizer-ების უნებართვო გაშვება იბლოკება. ადმინისტრატორის ნებადართული verify/unverify მუშაობს. **Production-ის მონაცემები, პოლიტიკები, სქემა, გადახდები, credentials და deployment არ შეცვლილა.** ამიტომ Production-ზე თავდაპირველი Storage პრობლემა კვლავ მოსაგვარებელია მხოლოდ ცალკე დამტკიცებული release-ით.

READY ვერ გამოცხადდება, სანამ არ დასრულდება ავტორიზებული მომხმარებლისა და ადმინისტრატორის სრული ბრაუზერული E2E და QA OAuth redirect-ის გამართვა. Preview განზრახ იყენებს QA public client-ს და არ იღებს Production service-role/payment/email/AI credentials-ს. QA service-role-ზე დამოკიდებული ადმინისტრაციული UI-ს ყველა სცენარი ამ გარემოში ვერ დადასტურდა. ეს შეზღუდვა არ უნდა ჩაითვალოს გავლილ ტესტად.

## Scope and revision

- Repository: `bulbula93/samosell-lunching2`
- Base main: `23fa44a0c11ccdd3cba6b72d318252cd4d93b7fe`
- Branch: [preview/security-hardening-20261026](https://github.com/bulbula93/samosell-lunching2/tree/preview/security-hardening-20261026)
- Draft PR: [#136](https://github.com/bulbula93/samosell-lunching2/pull/136)
- Initial tested Preview code commit: `f1b801a9bd02d800860055c50775c32cf74fdb70`
- Initial READY Preview: https://samosell-lunching2-425f9h42u-giorgibulbula-6265s-projects.vercel.app
- Stable branch alias: https://samosell-lunching2-git-prev-f7eae1-giorgibulbula-6265s-projects.vercel.app
- Production Supabase: `lxsvjzbiuewgwpajqrwr`, read-only inspection only.
- QA Supabase: `ydocqjdjmffysexkzxyc`, disposable test data only.

No load flood, brute force, exploit payload for framework RCE/DoS, real payment, or financial mutation against Production was performed. A clean package audit does not prove absence of unknown vulnerabilities.

## Confirmed findings and remediations

| ID | Severity | Component | Evidence / root cause | Candidate fix / status |
|---|---|---|---|---|
| SEC-01 | High | avatars, store-branding | Three Production PERMISSIVE policies checked bucket only. PostgreSQL permissive policies combine with OR, so adding an owner policy alone cannot remove broad access. | Remove named broad INSERT/UPDATE/DELETE grants, restore owner namespace policies, add three RESTRICTIVE guards. QA REST attacks rejected; legitimate lifecycle passes. Production unchanged. |
| SEC-02 | Medium | marketing_growth_snapshot() | anon and authenticated had EXECUTE; SECURITY DEFINER queried internal profile/chat/sales aggregates without authorization. No private message bodies were returned. | Revoke PUBLIC/anon/authenticated; retain service_role. No repository caller found. Same definition installed in QA to exercise revoked access. |
| SEC-03 | Critical/High package advisories; application exploitability varies | Next.js 16.2.3 and dependency tree | Current official advisories and package audit include image/OG/cache RCE ranges and Server Action DoS. Server Actions are used; exploit payloads were not run. | Next.js/eslint-config-next 16.4.3, React/react-dom 19.3.1, Vitest 4.1.12, patched transitive resolutions. Audit: zero known findings. |
| SEC-04 | Medium, defense in depth | Admin agent and admin test checkout POST | Cookie-authenticated routes lacked their own explicit same-origin check. Browser cookie defaults reduce some CSRF paths; no cross-site financial action was executed. | Reject missing/foreign Origin and cross-site Fetch Metadata. Admin agent streaming body limit 32 KiB and malformed-body handling. |
| SEC-05 | Medium | Client error telemetry | Unbounded arbitrary JSON could be retained as log metadata; server monitoring could retain raw client text/URLs. | Same-origin, 8 KiB body bound, fixed categorical metadata and message fingerprint; no raw client fields/URLs/messages retained. |
| SEC-06 | Low | Headers / supply chain | CSP absent; workflow action tags mutable; privileged client lacked explicit server-only import barrier. | CSP Report-Only, preserve two-year HSTS, pin actions to verified official tag SHAs, add server-only barrier. |
| SEC-07 | Medium | Authentication hardening | One active Production admin has no verified MFA factor; CAPTCHA and password-change reauthentication are off. No session theft was demonstrated. | Documented; TOTP enrollment/recovery and challenge integration must be tested before enforcement. Production Auth unchanged. |

The namespace owner is the first path segment matching auth.uid(), consistent with existing profile/store clients. Existing legacy/service-created objects are not moved or deleted; owner_id is not used as an incompatible second ownership requirement.

## Storage validation

Production policies were read from pg_policies, including roles, command and PERMISSIVE/RESTRICTIVE mode. QA originally had strict per-bucket policies; Production had the bucket-only variants. Additional unrelated listing/story policies were inventoried and preserved.

For reproduction, temporary QA grants were limited to a generated account's `security-audit-20261026/` prefix. They reproduced the Production predicates only for disposable objects. They were removed afterward. No real-user files were used.

| Scenario | Before, isolated QA reproduction | After |
|---|---|---|
| B inserts into A namespace | Succeeds | Denied |
| B updates A object | Succeeds | Denied |
| B upserts existing or new A path | Succeeds | Denied |
| B deletes A object | Succeeds | Denied; API may return an empty deleted-object list |
| Owner upload/update/upsert/delete | Works | Works |
| Anonymous upload | Denied | Denied |
| Anonymous public image delivery | Works | Works |
| Owner UPDATE moves file to B namespace | Not required for reproduction | PostgreSQL regression rejects it via WITH CHECK |
| Later accidental permissive policy | Would reopen access | Restrictive guards still deny foreign namespace |

The exact complete migration is applied twice in PGlite PostgreSQL tests. Live QA migration application and repeat execution were also verified. Public bucket flags and existing files are unchanged.

## Access-control results

Live checks use direct Supabase Auth, REST/RPC and Storage APIs with two disposable users plus one disposable admin. These do not replace browser E2E coverage.

| Test | Result |
|---|---|
| Anonymous/non-admin admin_manage_user/listing/category and review moderation/story calls | Denied |
| profiles privileged INSERT | Values normalized to false by trigger |
| profiles privileged UPDATE | Original flags preserved |
| Cross-user profile/store edit | No row modified |
| Own store profile edit | Pass |
| Foreign draft listing read/update | No row returned/modified |
| Own draft creation/edit | Pass with valid cover/description fixture |
| Direct is_vip activation | Denied |
| Private chat/message read and send by outsider | Denied |
| Participant send_chat_message | Pass |
| Outsider mark_chat_read | false; no mutation |
| Admin verifies/unverifies disposable seller | Pass |
| Internal growth metrics by anon/regular users | Denied |
| Private admin/payment table access | Denied or no accessible rows |
| Payment finalizer invocation by ordinary user | Denied |
| Order/notification outsider reads or read-state mutation | Denied |
| Owner order/notification reads | Pass |
| Direct paid order transition | Denied |

The existing protect_profile_privileged_fields_trigger remains enabled for INSERT and UPDATE and preserves is_admin, is_suspended and is_seller_verified. It was not replaced unnecessarily.

## SECURITY DEFINER review

See [function-by-function matrix](SECURITY_DEFINER_REVIEW_20261026.md), including every Production callable warning, effective roles, review disposition, definition fingerprint and QA drift.

All 108 public SECURITY DEFINER definitions were inventoried. Intentional public catalog/search functions are not automatically vulnerabilities. Admin RPCs check administrator status internally; participant RPCs bind mutations to auth.uid(); payment finalizers and refund/reversal/reconciliation functions are not executable by anon/authenticated. Trigger-only and service-only functions retain their restricted grants.

get_public_seller_listing_counts(uuid) already schema-qualifies its tables; its path was reduced from public,pg_temp to empty. Other legacy trigger functions with public search_path remain a low-priority hardening item; no untrusted schema CREATE privilege/exploit was demonstrated. A SECURITY DEFINER count alone is not an exploit.

Residual Medium abuse surfaces: anonymous search telemetry accepts bounded but client-supplied events; support ticket/social RPCs lack equivalent durable per-user limits in every path. These are not treated as proof of cross-user data access or payment bypass. No flood tests were run.

## Payment review

No real transactions or real financial records were changed. Existing mocked provider and PostgreSQL invariant tests were run: **14 files, 117 tests pass**.

- Flitt callback validates signature with constant-time comparison and binds merchant/order/provider-payment ID, amount and currency.
- An independent server-to-server status response is required before activation; browser return/status parameters are not trusted to grant entitlements.
- Flitt finalizers/reversals are service-only; locking/idempotent activation prevents duplicate entitlement extension. Duplicate paid attempts remain an operational refund/reconciliation matter, not permission for an unverified browser status.
- TBC callback treats a bounded payment ID as a synchronization hint, then verifies authoritative server state and database identity/amount/currency. It does not rely on a browser-supplied paid status or pretend the incoming ID has a cryptographic signature.
- Existing tests cover spoofing, mismatch, oversized body, provider failure, retries, reversal/refund and replay/idempotent database behavior. Live merchant configuration and live provider behavior were not exercised or changed.

## Next.js / OWASP review

See [API and Server Action inventory](SECURITY_API_REVIEW_20261026.md) for every API handler and action file.

Review covered broken access control, request/schema bounds, Supabase parameterized queries, JSON-LD escaping, redirect validation, server-only privilege separation, CSRF, dependency integrity and logging. Existing tests exercise listing publish idempotency, private media, public cache privacy and administrative authorization. No confirmed SQL injection or stored XSS exploit was reproduced. This is a scoped review, not a guarantee that every possible IDOR or OWASP issue is absent.

Existing /test-db and /test-marketplace pages require administrator access outside development and are noindex. No public debug endpoint was made available by this change.

Final code candidate e5f8daed674c34688ef00f2f68bbd09cbfd5433b Preview is also READY: https://samosell-lunching2-jipuojfrt-giorgibulbula-6265s-projects.vercel.app.

## Headers and browser coverage

CSP is **Report-Only**, without enforcement or per-request nonces that would disable existing public ISR. Inline hydration/styles are explicitly accommodated. Supabase HTTPS/WebSockets, Google, analytics, payment form destinations and media are included. There is no new public CSP report collector; initial violations are reviewed in browser developer logs.

Baseline X-Content-Type-Options, X-Frame-Options SAMEORIGIN, Referrer-Policy and Permissions-Policy are retained. Production already sends HSTS max-age=63072000; candidate uses the same value and adds neither includeSubDomains nor preload.

Initial Preview is READY, returns HTTP 200, serves QA images and emits CSP-Report-Only. Browser checks passed for homepage hydration, cookie choice, catalog navigation/rendering and login page rendering. No app CSP/hydration error was observed in the sampled browser console; extension-origin errors are unrelated.

Authenticated profile/store upload UI, admin UI, Google OAuth completion and payment redirect E2E are **not marked passed**. Payments and outbound email/AI are disabled in this isolated Preview, and no Production service credential was copied.

## Authentication configuration

Public Auth settings on both projects confirm email and Google are enabled and mailer_autoconfirm=false, so email confirmation is required. Signups are enabled.

Leaked-password protection remains disabled in both advisor snapshots. Official Supabase documentation states this feature requires Pro or above; no upgrade or paid service was introduced. A disabled advisor warning is not evidence of compromised passwords.

Dashboard access subsequently became available and the following settings were inspected read-only in both QA and Production: anonymous sign-ins OFF; manual identity linking OFF; secure email change ON; secure password change/current-password requirement OFF; email OTP 3600 seconds / 8 digits; sign-in/signup rate 30 per 5 minutes per IP; token verification 30 per 5 minutes; refresh 150 per 5 minutes; access tokens expire after 3600 seconds; refresh-token reuse detection ON with 10-second reuse interval; TOTP enabled (maximum 10 factors); AAL1 factor verification limit ON; CAPTCHA OFF. Session time-box/inactivity/single-session controls are Pro-only and not configured. Minimum password length is redacted by the browser and the requirements selector did not expose a value, so these values remain unverified. Existing sessions were not invalidated. No Production Auth setting was changed.

Production Site URL is https://samosell.ge. Its redirect allowlist includes the two SamoSell domains, localhost development callbacks and a wildcard limited to the owner’s Vercel team hostname suffix. Narrowing Production redirects to intended trusted deployments is a Medium hardening recommendation; no open wildcard across all vercel.app hosts was observed.

QA Site URL and six redirect entries reference previous review branches. The current security Preview alias is missing, so Google OAuth/password recovery can fall back to the wrong QA branch. Completing the browser OAuth flow requires approving narrowly scoped QA redirect entries for https://samosell-lunching2-git-prev-f7eae1-giorgibulbula-6265s-projects.vercel.app/auth/callback and /reset-password (including the application’s next query parameters). No redirect list was changed during this audit.

Read-only aggregate query found **1 active Production administrator and 0 with a verified MFA factor**. Administrator TOTP enrollment/enforcement needs its own tested recovery/enrollment flow before any lockout-capable policy is enabled. CAPTCHA requires a client challenge integration before it can safely be enabled; turning it on alone would break sign-in.

## Vercel / abuse protection

Actual project inspection confirms SSO protection is enabled for all_except_custom_domains. Password protection and trusted-IP restrictions are not configured. The custom firewall configuration endpoint returned 404 (no stored custom configuration); this does **not** mean built-in DDoS mitigation is disabled.

Official Vercel documentation describes automatic L3/L4/L7 DDoS mitigation on all plans and Hobby allowances of up to three custom WAF rules and ten project IP blocks. No Production firewall setting was changed. Prefer narrowly scoped free rules and existing durable API counters; do not challenge payment callbacks or legitimate OAuth traffic.

A small runtime-log sample cannot prove absence of attacks or establish traffic baselines. No unsupported claim of “no suspicious traffic” is made. Authenticated Preview sharing used an expiring link; Deployment Protection was not disabled.

## Dependency, secret and CI checks

| Check | Result |
|---|---|
| Full application suite | 206 files / 1,174 tests pass |
| New migration/header/route regressions | 15 tests pass, included above |
| Payment-focused suite | 14 files / 117 tests pass |
| TypeScript | Pass |
| ESLint | 0 errors, 9 warnings (images/internal navigation) |
| Production build against local public fixtures | Pass |
| pnpm 10.17.1 frozen lockfile validation | Pass |
| pnpm audit all dependencies | 5 critical/31 high/30 moderate/7 low before; zero after |
| Secretlint 13.0.7 | 933 files; one finding is explicit test-password fixture in lib/ai-ops/qa-reader.test.ts |
| Reachable Git history signature scan | 1,662 commits; no matching credential signatures |

Secret scan scope: Secretlint recommended rules plus offline signatures for private keys, known provider secret formats and decoded service_role JWTs. The supplementary script reports fingerprints, never secret values. This is not an exhaustive entropy scan and is not proof that no secret ever existed.

No confirmed live credential exposure or compromise was found; no Production credential rotation was performed. Supabase public/publishable keys are not service credentials. Authentication fixture passwords/tokens were never committed. CI actions are pinned to SHA values read from official repositories; least-privilege workflow permissions remain.

## Security Advisor comparison

| Advisor category | Production before (unchanged) | QA before | QA after |
|---|---:|---:|---:|
| RLS enabled, no policy (INFO; default deny tables) | 26 | 21 | 21 |
| anon-executable SECURITY DEFINER | 11 | 10 | 10 |
| authenticated-executable SECURITY DEFINER | 58 | 56 | 56 |
| Leaked password protection warning | 1 | 1 | 1 |

QA originally lacked marketing_growth_snapshot; installing it service-only does not reduce QA's original warning counts. Production is expected to lose that one function from each callable-warning category only after an approved migration. Storage-policy bugs are not fully represented by these advisor counts. Never use an unchanged count to conclude the hardening failed or that the system is safe.

## Migration identifiers and rollback

- Repository file: supabase/migrations/20261026092938_security_storage_and_rpc_hardening.sql (generated with Supabase CLI).
- Recorded QA version: 20261026105600, name security_storage_and_rpc_hardening (assigned by apply_migration).
- SQL file SHA-256: 1a9488d243c297beaf67f6e32877b3f9ec1f496c2b7c530a42dfa315e823c84e.
- The SQL is idempotent and transaction-wrapped. QA apply used the migration runner's transaction wrapper; repeat SQL execution succeeded. Local PostgreSQL regressions apply the exact file twice.
- Repo and remote timestamp differences must be reconciled explicitly; do not run an unreviewed bulk db push that applies unrelated historical migrations.

**Rollback compatibility:** previous frontend code writes auth.uid()/timestamp-suffix paths and uses upsert; that workflow passes with the hardened policies. A code rollback should retain database hardening. No table/column/data transformation requires restoration.

If a legitimate upload regression appears, first inspect its exact bucket/path and restore a narrowly scoped owner policy. Keep the restrictive namespace guards. Do not restore the three bucket-only mutation grants. If urgent containment is needed, temporarily deny affected writes rather than allow cross-user changes. Existing public image delivery remains available.

CSP is report-only and can be removed independently if it causes excessive diagnostic noise. Reverting framework security patches reintroduces known advisory ranges; choose a patched rollback build.

## Production sequence — proposed, NOT authorized or executed

1. Finish the unchecked acceptance items below and re-review the exact final PR commit. Confirm main has not moved; rerun relevant checks if it has.
2. Obtain explicit approval for the exact SQL file/hash, target lxsvjzbiuewgwpajqrwr and code commit. Approval for QA is not approval for Production.
3. Capture only policy/function ACL definitions and bucket metadata in an access-controlled rollback record. Confirm normal backup availability; do not export user files or secrets.
4. Apply only the reviewed security SQL transaction to Production using the migration runner/SQL editor. Record its actual migration version and reconcile history. Do not bulk-apply unrelated QA migrations.
5. Read back the six ownership policies, both UPDATE predicates, all three restrictive guards, public SELECT delivery and service-only growth RPC privileges. Rerun Security Advisor.
6. Release the reviewed patched code through the normal protected main workflow after explicit deployment approval. Confirm the deployment uses Production configuration; no QA fixture credentials/configuration may carry over.
7. Perform low-impact public checks and legitimate owner/admin smoke flows; inspect authorization/payment errors and CSP reports. Destructive cross-user tests stay on QA.
8. Retain security database policies if a frontend rollback is required. Halt release and investigate if any boundary or owner workflow regresses.

## Release acceptance checklist

- [x] High-risk Storage flaw reproduced without real-user destructive tests.
- [x] Cross-user Storage modifications rejected after hardening.
- [x] Legitimate Storage upload/replacement/public delivery pass.
- [x] Profile privilege escalation and admin/non-admin RPC tests pass.
- [x] Targeted chat/listing/order/notification access boundaries pass.
- [x] Payment mock/database regressions pass; no real payment.
- [x] Migration validated on QA, repeatable and compatible with previous owner upload paths.
- [x] Dependencies patched; supported scans completed without confirmed live secret findings.
- [x] Tests, TypeScript, lint (warnings only), local production build and initial Preview pass.
- [ ] Complete authenticated user/admin browser E2E, including real profile/store upload UI on QA.
- [ ] Configure a legitimate QA-only privileged backend credential where admin UI requires it, without retrieving/copying Production secrets.
- [x] Read Auth signup/rate/session/MFA/CAPTCHA and redirect settings from the signed-in dashboard.
- [ ] Confirm redacted password-policy values and test narrowly scoped QA OAuth/recovery redirects.
- [x] Code candidate e5f8daed674c34688ef00f2f68bbd09cbfd5433b: Preview READY and GitHub CI run 40313631173 successful; subsequent changes are audit documentation only.
- [ ] Explicitly approve and execute Production migration/deployment sequence.

## Evidence and primary references

- SECURITY_EVIDENCE_20261026.json and SECURITY_QA_*_20261026.json contain redacted counts, policies and test outcomes.
- scripts/security-qa-storage.mjs and scripts/security-qa-access.mjs require an external disposable QA credential file and never accept Production as a target.
- https://nextjs.org/blog/nextjs-security-update-october-14-2026
- https://github.com/vercel/next.js/security/advisories
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/auth/password-security
- https://vercel.com/docs/security/ddos-mitigation
- https://vercel.com/docs/vercel-firewall/vercel-waf
