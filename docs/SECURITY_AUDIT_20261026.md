# SamoSell Security Audit — 2026-10-26

> **2026-10-27 continuation checkpoint (Asia/Tbilisi): NOT READY. QA Auth URLs, Google OAuth, QA server key, scoped Admin moderation/audit, User A password login, profile/avatar lifecycle, owner store branding and User A Admin-route rejection: PASS.** Preview `9ed49957d2ad692ec23c3d6c9dc5bdb444d02379` served these browser tests. Registration email was received and the new non-admin account confirmed, but the user's email-link callback did not establish a session; subsequent password login succeeded. Missing pre-existing store-hero schema was restored only in QA using the existing migration, once. User B browser isolation, emailed password recovery, mobile flows and full authenticated exposure review remain pending. Earlier checkpoints retain their original historical scope and are superseded by the latest results where specified.

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

QA Site URL and six redirect entries reference previous review branches. The current security Preview alias is missing, so Google OAuth/password recovery can fall back to the wrong QA branch. The follow-up below supersedes the earlier wildcard proposal with four exact callback URLs, including the reset-password next parameter. The reset-password landing page itself is not the redirectTo sent by the application. No redirect list was saved during this audit.

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


## Follow-up verification — 2026-10-26

**NOT READY remains the release verdict.** This continuation changes audit evidence only. It does not change application code, database schemas, grants, Storage policies, Auth configuration, environment values or Deployment Protection. Production and main remain unchanged. No duplicate migration was created or applied.

### Revision, Preview and migration readback

- Tested application head: `8d518c81c225c92873192df4a41ffc2df89b8b1e`; `main` remains `23fa44a0c11ccdd3cba6b72d318252cd4d93b7fe`.
- PR #136 is open, Draft, unmerged and mergeable at readback. GitHub CI run `40314515460` succeeded for the tested head.
- Preview deployment `dpl_CBxkoZB2buZKBvn3QkyMjGPgQsVx` is READY for that head. Deployment URL: https://samosell-lunching2-g4n8kyqa6-giorgibulbula-6265s-projects.vercel.app.
- Its stable branch alias is https://samosell-lunching2-git-prev-f7eae1-giorgibulbula-6265s-projects.vercel.app. Use this stable alias for the QA Auth configuration and browser flow, rather than a URL that changes on each deployment.
- QA migration history contains exactly one matching entry: `20261026105600 / security_storage_and_rpc_hardening`. The existing repository file and SHA-256 remain the identifiers recorded above. No migration replay was needed.
- Readback confirms six ownership mutation policies, three RESTRICTIVE guards, both UPDATE predicates and public SELECT policies. Advisor remains 21 no-policy INFO / 10 anon SECURITY DEFINER / 56 authenticated SECURITY DEFINER / 1 leaked-password warning. These counts are unchanged and are not a test of Storage ownership.

### Prepared QA configuration — NOT saved

QA project: `ydocqjdjmffysexkzxyc` only. The persisted Site URL is still:

`https://samosell-lunching2-git-prev-3132e4-giorgibulbula-6265s-projects.vercel.app`

Proposed replacement Site URL:

`https://samosell-lunching2-git-prev-f7eae1-giorgibulbula-6265s-projects.vercel.app`

Add these exact redirect URLs for the planned login, dashboard, recovery and default store-registration flows:

```text
https://samosell-lunching2-git-prev-f7eae1-giorgibulbula-6265s-projects.vercel.app/auth/callback?next=%2F
https://samosell-lunching2-git-prev-f7eae1-giorgibulbula-6265s-projects.vercel.app/auth/callback?next=%2Fdashboard
https://samosell-lunching2-git-prev-f7eae1-giorgibulbula-6265s-projects.vercel.app/auth/callback?next=%2Freset-password
https://samosell-lunching2-git-prev-f7eae1-giorgibulbula-6265s-projects.vercel.app/auth/callback?next=%2Fdashboard%2Fstore%2Fsetup
```

No `*` or `**`, team-wide Vercel hostname pattern, direct reset-password redirect, or extra deployment hostname is proposed. Existing entries are preserved pending a separate review of other QA branches. These four entries cover the named flows; arbitrary other dynamic next paths are not claimed covered. Such paths need their own reviewed exact entry or a separately designed fixed-callback continuation flow. Google Cloud's provider callback is the QA Supabase Auth callback, not the Vercel app callback; no Google Cloud configuration was changed or verified through a provider login.

Vercel metadata confirms `SUPABASE_SERVICE_ROLE_KEY` exists as an encrypted variable with target `preview`, gitBranch `preview/security-hardening-20261026`, ID `r3Z3BsMdWwQJwctP`. The authenticated edit UI shows **Empty**. Existence of an encrypted variable is therefore not evidence that a usable credential is installed. The form is prepared to use the non-revealable Secret type and retains its existing environment/branch selectors. No value was copied, revealed, submitted or committed.

Conditional proposal: populate that existing variable with the existing **QA-only** server key and save as Secret, without widening its target or branch scope. A service/secret key bypasses QA RLS for the backend: it does add backend privilege relative to the current empty value, even when the environment scope stays fixed. Consequently this cannot honestly be described as having no privilege impact, and it has not been applied under the instruction not to expand Preview rights. No Production key, new key, database grant, broad Preview target, payment/email/AI credential or protection bypass is proposed. The key is not required for browser password login or direct user-token RLS tests; its absence affects server-side administrative workflows that construct the privileged client.

The Browser action-time confirmation rule, “Creates or materially expands security-sensitive access,” blocks saving the new trusted Auth destinations or transferring the QA server credential until the concrete changes are confirmed. This is an execution-control requirement, not a request to approve Production. The current user instruction to avoid Preview privilege expansion is also preserved.

### Tests completed in this continuation

The full suite was run once before the latest instruction to avoid repeats: **206 files / 1,174 tests PASS**. The selected payment mock/invariant suite was also run once: **14 files / 112 tests PASS**. This 112-test selection differs from the earlier 117-test selection; both counts identify their actual runs. Neither suite was rerun after the user requested no repetition, and no application code changed.

Fresh disposable QA fixtures were used to repeat direct Auth/REST/RPC/Storage checks. The access script was interrupted after the first six completed groups; only its outstanding order/notification group was resumed separately. Completed results:

| Scenario | Evidence / result |
|---|---|
| Three disposable email/password Auth sign-ins | PASS through the QA Auth API; not a browser Login PASS |
| Both Storage buckets: foreign INSERT, UPDATE, upsert create/overwrite, DELETE and owner move into foreign namespace | DENIED |
| Both Storage buckets: owner upload, update, upsert, cleanup and public image delivery | PASS; anonymous INSERT DENIED |
| Privileged profiles INSERT/UPDATE, foreign profile/store edit | Privileged flags preserved/normalized; foreign edit DENIED |
| Own draft listing creation/edit and participant chat send | PASS |
| Foreign draft listing read/edit, private chat/message read/send, direct VIP activation | DENIED |
| Anonymous/non-admin administrative RPC calls | DENIED |
| Disposable admin verifies/unverifies disposable seller | PASS |
| Internal metrics, private admin/payment tables and payment finalizers | Non-admin access DENIED |
| Order/notification outsider reads, read-state mutation and direct paid transition | DENIED; legitimate owner reads PASS |
| Current Preview Login page | Renders email/password, Google and recovery controls |
| Current Preview anonymous /dashboard/profile | Redirects to /login?next=%2Fdashboard%2Fprofile |
| Current Preview anonymous /admin | Redirects to /login?next=%2Fdashboard; login heading visibly confirmed |
| Current Preview /reset-password without a session | Redirects to /forgot-password?error=invalid_or_expired |
| Browser password Login, completed Google OAuth, emailed recovery and password change | BLOCKED / NOT VERIFIED; requires a disposable browser sign-in and the reviewed QA redirect configuration |
| Authenticated browser profile/store uploads, user-to-user UI boundaries and privileged admin UI | NOT VERIFIED; direct API results above do not substitute for these flows |

Cleanup readback found zero fixture users, profiles, sessions, refresh tokens, Storage objects, listings, chats, messages, notifications, orders, admin audit rows and growth events. Disposable credential and password-hash setup files were removed. No real user files, identities, messages or financial records were used for destructive tests. No payment or external email was sent by the test scripts.

### Remaining release risks and exact approval boundary

The implemented fixes and root causes remain SEC-01 through SEC-06 above; the Storage flaw is fixed and verified in QA, and the candidate code contains the dependency/API/header changes. These fixes have **not** been deployed to Production. Remaining blockers are the pending QA Auth configuration, the privileged-backend credential decision, completed authorized browser user/admin E2E, and final release approval. Administrator MFA enrollment/challenge/recovery remains a separate unresolved Medium item; no factor was registered or AAL2 rule enforced. CAPTCHA integration, Free-plan leaked-password protection limitations, redacted password-policy values and residual abuse surfaces remain as documented.

Production execution is **not approved**. The exact release sequence remains:

1. Save only explicitly confirmed QA configuration; keep the stable alias, branch scope and existing protection. If a QA server key is approved, prove it is QA-only before saving it, never exposing the value, and rebuild Preview so the server receives it.
2. Complete browser Login, Google OAuth, recovery, own image replacement, regular/admin authorization and two-user UI boundary checks using disposable QA data. Do not mark direct API checks as browser passes. Resolve any regression before changing the verdict.
3. Freeze the exact final PR commit and its successful relevant checks. The last tested application code is `8d518c81c225c92873192df4a41ffc2df89b8b1e`; subsequent audit-document-only commits do not change the application. Re-read main before approval; rebase and retest if application changes require it.
4. Request explicit Production approval for target `lxsvjzbiuewgwpajqrwr`, migration name `security_storage_and_rpc_hardening`, repository file `supabase/migrations/20261026092938_security_storage_and_rpc_hardening.sql`, SHA-256 `1a9488d243c297beaf67f6e32877b3f9ec1f496c2b7c530a42dfa315e823c84e`, and the frozen final release commit. Capture ACL/policy definitions and bucket metadata without exporting user data.
5. Apply only those exact reviewed SQL bytes through the migration runner to the approved Production project. Record the actual runner-assigned migration version and reconcile history explicitly. Preserve the existing QA version; do not bulk-push historical migrations or create a duplicate migration to disguise timestamp drift.
6. Read back the six owner mutation policies, three restrictive guards, UPDATE USING/WITH CHECK, public SELECT and service-only marketing RPC grants; run Security Advisor. A mismatch halts release.
7. After explicit merge/deployment approval, merge PR #136 through the normal protected main workflow and release the frozen patched code. Verify the deployment's Supabase target is Production and that QA branch overrides/test data do not carry over. Do not change Production payment configuration or credentials.
8. Run low-impact public and legitimate owner/admin smoke checks; monitor upload/auth/payment errors and report-only CSP. Keep destructive boundary testing on QA. On regression, halt rollout; retain the ownership guards and choose a patched application rollback build. Never restore the bucket-only permissive mutation policies. MFA enrollment/enforcement needs its own reviewed deployment and secure authenticator handoff.

## QA Auth / privileged Preview continuation checkpoint — 2026-10-27

This is an intermediate checkpoint, not a completed final browser E2E report. Application code and migration bytes have not changed. No application or payment suite was repeated. No SQL mutation, Production change, credential transfer, deployment, merge or PR-state change was performed in this continuation.

### Fresh infrastructure evidence

- GitHub PR #136: OPEN, DRAFT, unmerged; head `7107d99f1a2e2a7eba2927de6d287da418232b48`, base main `23fa44a0c11ccdd3cba6b72d318252cd4d93b7fe`. Both remote refs matched local readback.
- Stable QA alias resolves to deployment `dpl_C1eg4f9xrKZrXjSv9zrGSYuTwTe9`, URL `https://samosell-lunching2-aleim19fu-giorgibulbula-6265s-projects.vercel.app`, state READY, target Preview (`target: null`), git ref `preview/security-hardening-20261026`, SHA `7107d99f1a2e2a7eba2927de6d287da418232b48`.
- GitHub Vercel status for that head: SUCCESS. Application-head CI run `40314515460` for `8d518c81c225c92873192df4a41ffc2df89b8b1e`: COMPLETED / SUCCESS. The intervening head changes only the audit Markdown and evidence JSON, so the 1,174 application and 112 selected payment test results were retained without rerunning.
- QA migration listing contains one `20261026105600 / security_storage_and_rpc_hardening`. Local migration SHA-256 remains `1a9488d243c297beaf67f6e32877b3f9ec1f496c2b7c530a42dfa315e823c84e`. Storage policy readback still contains six owner mutation policies, three restrictive namespace guards and both public SELECT policies.
- Vercel branch overrides are target `preview`, gitBranch `preview/security-hardening-20261026`; Supabase URL is `https://ydocqjdjmffysexkzxyc.supabase.co`; public Site URL is the stable security alias. Flitt payments and TBC checkout flags remain false. No wider environment was selected.
- `SUPABASE_SERVICE_ROLE_KEY`, ID `r3Z3BsMdWwQJwctP`, is still EMPTY, encrypted/Config and confined to this Preview branch. It has not been populated or converted. The current editor requires email verification before revealing/editing the existing value; that verification was not completed. No key was revealed, copied or submitted. The installed Supabase tool surface exposes publishable keys but no secure server-key transfer or Auth-config update operation.
- Vercel Deployment Protection UI: Require Log In checked, Standard Protection selected, no domain exceptions shown. Existing Trusted Sources permits this project's development tokens to access Preview. No protection setting, source or bypass was changed.

### Prepared QA Auth form — unsaved

The authenticated dashboard positively identifies **Samosell-QA / `ydocqjdjmffysexkzxyc`**. Persisted Site URL still has the old `3132e4` alias and six existing redirects. The Site URL form contains the requested replacement; the Add URL dialog contains exactly the four callback URLs in the prior proposal. Neither Save URLs nor Save changes has been submitted. Existing entries, including earlier QA branch patterns, are retained. No wildcard was added.

Saving these new trusted Auth destinations falls under the Cloud Browser's action-time confirmation rule, **“Creates or materially expands security-sensitive access.”** The rule requires confirmation at the save step even when initial task authorization exists. This is a browser execution requirement, not a new request to approve Production. The exact prepared QA change is ready for user review.

QA Google provider is enabled; its displayed callback is `https://ydocqjdjmffysexkzxyc.supabase.co/auth/v1/callback`; nonce checks remain enabled. This proves the Supabase callback identity only. Google Cloud's registered redirect list and successful Google login are not yet verified.

### Fresh browser evidence and current result matrix

| Requirement | Status | Actual evidence and limit |
|---|---|---|
| QA Redirect URLs | BLOCKED | Four exact additions and Site URL prepared; action-time save confirmation pending. Persisted old configuration still applies. |
| Google OAuth | BLOCKED | QA provider enabled and callback targets QA; no successful disposable Google sign-in. |
| Password Reset | BLOCKED | Sessionless `/reset-password` redirects to QA `/forgot-password?error=invalid_or_expired`, with the Georgian invalid/expired message. Email delivery, valid recovery exchange and password change not run. |
| QA Server Credential | BLOCKED | Existing branch-only variable is empty; secure credential input and Vercel email verification required. |
| Browser Login | BLOCKED | Login controls render; completed disposable user sign-in, wrong-password, logout and persistence not run. |
| Profile Upload | BLOCKED | Anonymous `/dashboard/profile` redirects to `/login?next=%2Fdashboard%2Fprofile`; authenticated upload/replacement/deletion not run. Historical Storage API PASS is retained separately. |
| Store Branding | BLOCKED | Historical owner and foreign-namespace Storage API tests PASS; creation and image lifecycle through authenticated UI not run. |
| Cross-user Authorization | PASS at prior API scope; browser BLOCKED | Existing redacted REST/RPC/Storage evidence retained without repetition. No two-user browser session test yet. |
| Admin Authorization | PASS at prior RPC scope; browser BLOCKED | Anonymous `/admin` redirects to QA `/login?next=%2Fdashboard`; authorized admin UI, moderation and audit-log UI not run. |
| Payment Security | PASS at prior mocked/invariant scope | Existing 14-file / 112-test log verified, not rerun. No real payment, VIP activation or live provider callback performed. |
| Preview Deployment | READY build; NOT READY for full privileged E2E | Exact branch/commit and Vercel success confirmed; missing QA server credential blocks privileged backend acceptance. |
| Production Readiness | NOT READY | Auth save, secure credential installation and full disposable user/admin browser flows remain outstanding; previously documented MFA risk remains. |

Sampled browser warnings/errors during login and anonymous redirect checks contain only extension-origin metadata errors. No app-origin CSP/auth/CORS error appeared in that sample. This does not cover authenticated network responses, all bundles, uploads, session isolation or mobile rendering. Privileged-key exposure cannot be certified for a credential that has not been installed.

No fixture accounts were created during this checkpoint, so no new test records require cleanup. New registration and password changes require user browser handoff under the current secure authentication rules; no passwords or tokens may be pasted into chat or filled through model-visible tools.

### Continuation and conditional Production release

1. Obtain action-time confirmation for the exact Site URL and four callback additions. Save both QA forms and freshly read back all ten redirects plus the Site URL; preserve the six existing entries.
2. Have the user securely supply the existing **QA** server key into the existing Vercel variable. Verify QA project identity, Secret type, Preview target and exact security branch; retain Deployment Protection. Do not use Production or another branch's key. No key contents should be returned to the model.
3. Redeploy only the security Preview after the credential is saved. Verify new deployment SHA, branch, QA backend, protection and public bundle/network secret absence. Carry out the requested disposable A/B/admin browser cases; only changed application areas need regression tests. Google and emailed recovery remain BLOCKED until actually completed.
4. Update the final matrix and freeze the final commit/checks. Keep PR Draft until real acceptance criteria are met. The conditional Production procedure and exact migration bytes/hash in the preceding release section remain the proposal; **none of its Production actions is approved or executed**. Main drift requires review and relevant retesting. Administrator MFA remains unresolved and must be assessed explicitly before a READY verdict.

This checkpoint is intentionally an uncommitted working-tree update while external QA approval/input is pending, avoiding an unnecessary documentation-triggered Preview rebuild. It must be incorporated into the final branch report once the continuation is complete.

### User-saved redirects — fresh readback, 2026-10-27

After the user reported saving the new addresses, the QA URL Configuration page was reloaded. Readback confirms exactly ten redirect entries: the original six plus all four exact requested callbacks, with encoded `next` values `%2F`, `%2Fdashboard`, `%2Freset-password` and `%2Fdashboard%2Fstore%2Fsetup`. No existing entry was removed and no wildcard was added. **Redirect allowlist subcheck: PASS.**

The initial fresh persisted page still showed the previous Site URL. Following the user's response to the concrete QA configuration approval request, the separate **Save changes** action was completed for the already specified stable security Preview. A second page reload confirms persisted Site URL `https://samosell-lunching2-git-prev-f7eae1-giorgibulbula-6265s-projects.vercel.app`, disabled Save changes button, and all ten redirect entries. **Complete QA Auth URL configuration: PASS.** No duplicate redirects were added. This supersedes the unsaved Site URL observations above.

Vercel alias readback remains on `dpl_C1eg4f9xrKZrXjSv9zrGSYuTwTe9`. Branch-only `SUPABASE_SERVICE_ROLE_KEY` readback still reports an empty value, type encrypted, target Preview and gitBranch `preview/security-hardening-20261026`; no secret was printed. No redeployment is necessary for the redirect-only change. Credential-dependent and authenticated browser cases remain unrun.

The QA API Keys page (`/dashboard/project/ydocqjdjmffysexkzxyc/settings/api-keys`) was opened for the user. It shows an existing default Secret key, masked, with a Copy API key control; no key was created or revealed. The user must copy that existing QA-only server key directly into the existing branch-scoped Vercel variable, choose Secret storage, and preserve Preview + exact security branch. Vercel's email verification prompt is left for secure user completion. No new key or rotation is required. This is a user-input handoff, not completed credential configuration.

### User-saved credential and refreshed security Preview — 2026-10-27

The user reported saving the credential. Fresh Vercel metadata confirms the existing ID `r3Z3BsMdWwQJwctP` is now type `sensitive` (Secret), target only `preview`, gitBranch exactly `preview/security-hardening-20261026`, updatedAt `1793082730424`. The single-variable readback returns no value. No key was printed, read into a local environment file, revealed in the browser, committed, or copied to another branch. The public Supabase URL override remains the QA project. Configuration installation is confirmed; key/project compatibility remains a functional admin test requirement, not an inferred PASS.

The user's screenshot showed a separate Preview build from `main` at `23fa44a`; this was not a Production deployment and could not consume the security-branch-only key. It was not treated as the security QA build. The agent redeployed only the known security-branch deployment, preserving commit `7107d99f1a2e2a7eba2927de6d287da418232b48` and using the refreshed branch environment. A request using API target `preview` was rejected before creating anything; the API's accepted non-Production target `staging` was used for the redeploy.

New deployment `dpl_8edyAfgr9BQhyJvTwaz4dTrSjiNu` is READY, source redeploy, security branch and exact SHA above. URL: `https://samosell-lunching2-pplu7xq23-giorgibulbula-6265s-projects.vercel.app`. Stable security alias readback points to this deployment. Build start `1793082886789`, ready `1793083011383`. Project protection readback after the credential update still reports SSO enabled for `all_except_custom_domains`; no protection setting was changed. The privileged backend's functional behavior still requires the pending authenticated admin checks.

Public response verification after redeploy: `/register` HTTP 200, 41,288-character HTML with CSP Report-Only, private/no-store caching, nosniff and SAMEORIGIN headers. All 15 script URLs advertised by that HTML returned HTTP 200. Scanning those scripts found no `sb_secret_` credential or JWT with `service_role` role; the registration bundle contains the QA Supabase URL. No secret-key pattern was found in the HTML. This is a scoped format/role scan, not a guarantee about every bundle, authenticated response, log or equality with the unretrieved installed key. Redacted scan details are in `SECURITY_QA_BROWSER_20261027.json`.

Authenticated HTTP retrieval used the Vercel connector's temporary share-link mechanism; its documented access link expires after 23 hours. SSO was not disabled and no long-lived automation bypass was added. Share tokens are excluded from the committed evidence.

The rebuilt registration page renders, and only synthetic non-secret name/username fields were prepared for User A. Email and password are left for the user. No registration submission or confirmation email was initiated by the agent. Cloud Browser authentication guidance requires manual handoff for new account creation and prevents model-visible credential entry; the user must complete registration/confirmation and sign in before profile/storage/browser authorization checks can proceed. Disposable PNG fixtures for avatar/replacement/logo/cover are prepared locally. Sampled warnings/errors still contain only extension-origin metadata errors. Application/payment suites and migrations were not rerun. Production and main remain unchanged by the agent, and PR #136 remains Draft and unmerged.

### Signup confusion diagnosis and narrowly scoped copy fix — 2026-10-27

The user supplied a registration-success screenshot but reported no confirmation email. Read-only QA Auth checks show the supplied address already belonged to a confirmed Google-only account created on 2026-10-03, with no password configured. No account with the prepared temporary username was created. The attempted signup did not set a password on the existing identity. This does not establish an SMTP outage or successful delivery. Sampled Auth logs returned no matching signup/email error in the selected window, which is insufficient evidence to certify an email send.

QA SMTP settings were inspected read-only: custom SMTP is enabled, host `smtp.resend.com`, port 465, sender name SamoSell. Password and sender address were not revealed. Default-SMTP recipient restrictions are therefore not a demonstrated cause here. No email configuration, auth identity, administrator flag or password was modified.

`components/auth/RegisterForm.tsx` unconditionally promised a confirmation email for every error-free, sessionless signup response. Its success copy now conditionally describes new-account confirmation and tells existing users to sign in or use Google. The same neutral message is shown for every such response; no email-existence endpoint, identity check, sign-in attempt, confirmation bypass or new account-enumeration signal was added. Auth calls, redirect construction and store continuation paths are unchanged. This fixes the observed misleading UI, not the provider's anti-enumeration behavior.

Validation for the text-only application change: targeted ESLint PASS and `git diff --check` PASS. No mirrored copy test was added and no full application/payment suite or migration was repeated. Earlier application test results remain evidence for the earlier head, not a new test run. A new Preview build is required to deliver this text change. Existing QA Google login is the next read-only authentication step; all destructive authorization tests must still use disposable target records.

### Completed Google OAuth / privileged Admin browser verification — 2026-10-27

- The signup-message-only fix and checkpoint evidence were committed through GitHub to the existing security branch: `9ed49957d2ad692ec23c3d6c9dc5bdb444d02379`. PR #136 remains Draft and unmerged. New Preview `dpl_2DxSyYkjCZBpgg7KgUeGCP8bCsju` / `https://samosell-lunching2-8lvotxrrt-giorgibulbula-6265s-projects.vercel.app` is READY, source git, target Preview (`null`), alias stable security hostname. No other application behavior changed.
- Secure browserAuth choice selected Google and completed OAuth. Fresh QA-origin homepage visibly showed the signed-in profile and account navigation. This is a real successful login, not merely provider settings or a consent screen: **Google OAuth PASS**.
- Following the user's accepted use of the existing email, the actor was the existing **QA-only administrator**, not a newly created temporary Admin QA identity. Its profile, password, existing listings and administrator privileges were not modified. Only fresh disposable records were used for moderation targets. This actor distinction must not be obscured in the final acceptance report.
- `/admin` rendered the Admin dashboard. `/admin/search` rendered Search Quality Lab with 105 alias rules and analytics after its three service-only RPCs completed. That page throws on any of those RPC errors. Given the checked QA URL override and successful service-only calls, the installed backend key is functionally valid for QA: **QA server credential PASS**. No key value was returned to the model or browser UI.
- A no-password, non-admin disposable QA Auth/profile fixture `99587cad-58b5-4078-b670-2924349cfb97` and listing `7bce4a6c-1f53-40df-9f78-1a189b0b1638` were seeded only in QA. The Auth fixture was unconfirmed with an `.invalid` email and was never signed in; it is not a registration/login PASS. An initial setup statement referenced a nonexistent `phone` column and failed without changes; corrected fixture setup used `store_phone`, a synthetic all-zero phone and a repository image asset.
- Through the real Admin browser UI: seller verify and unverify, user suspend and restore, listing restore and hide all succeeded. Suspend archived the listing; restoring the user intentionally left it archived until explicit listing restoration. The authenticated admin's own moderation controls remained disabled.
- SQL readback and `/admin/audit` UI both showed exactly seven fixture entries: `seller.verify`, `seller.unverify`, the suspension-generated `listing.hide`, `user.suspend`, `user.restore`, `listing.restore`, final `listing.hide`. Expected previous/next flags and listing statuses were present in metadata. **Scoped Admin mutation + audit acceptance PASS**. Ordinary-user rejection through the browser still requires A/B sign-ins; historical API rejection evidence remains separate.
- Cleanup removed only the new fixture audit entries, listing and Auth user. Fresh readback: zero fixture users, profiles, listings and audit rows. No existing QA account or data was deleted. No real payment, VIP or paid campaign was activated.
- Session persisted across authenticated route navigation, deployment rollover and a full Admin page reload. A boolean count sampled before streaming finished initially read false; the protected Admin controls then rendered and Logout executed, so that early count is not a failed session test. Logout was verified by absence of the logout control and a new `/admin/search` request redirecting to QA Login. **Session persistence / Logout PASS** for the Google session.

Remaining human input is a genuinely separate temporary A account for password/profile/store UI tests. The supplied main Gmail address is already registered as Google-only. A plus-tag alias was checked as not yet registered in QA and can receive mail in the user's existing inbox; no mailbox creation, SMTP change, confirmation bypass or password reset on the existing admin is needed. New-account credentials and email confirmation must be completed by the user in the QA Cloud Browser. This is still NOT READY for Production, pending the remaining A/B browser, upload, recovery and mobile checks and the previously recorded release risks.

### Temporary User A, email callback and owner upload acceptance — 2026-10-27

- The user registered a genuinely separate Gmail plus-tag QA identity. Read-only QA Auth evidence: user `deef129e-5cbc-461a-86e7-f2b913f6b14e`, email provider, created 07:29:28 UTC, confirmed 07:29:46 UTC (11:29:46 Asia/Tbilisi), is_admin false. The user received the email. No confirmation bypass or identity/password write was performed by the agent.
- The user's confirmation-link screenshot showed Login with the generic `oauth_callback_failed` message. The Cloud Browser remained on Registration; last_sign_in_at was initially null despite email confirmation. A different-browser PKCE verifier mismatch is likely, not established by this evidence. Supabase documents that code exchange needs the browser/device where the flow began. Registration/confirmation are verified, while automatic email-link session completion is not PASS. No token/link was requested in chat or logged.
- Secure browserAuth subsequently selected email/password. Fresh QA-origin homepage showed Security QA A. Full protected reload retained the session. **User A browser password login and session persistence PASS.**
- The callback route handles both email signup and social login, but Login previously called every callback failure a social-auth failure. Only that error copy is generalized to explain that link login did not finish and offer password login or a fresh auth attempt. Callback logic, allowlists, PKCE checks, cookie handling and Auth configuration are unchanged. Targeted ESLint and whitespace validation pass; no full test suite rerun is justified by a text-only edit. This copy is pending the next security-branch Preview deployment.
- Actual Profile UI: saved Security QA A Updated and uploaded a synthetic PNG avatar. Reload retained the name and three rendered avatar images. Replaced the avatar; SQL showed only the new correctly owned object and the previous path removed. Deleted the avatar through UI and saved; SQL confirmed avatar_url null and zero avatar objects. **Profile name/avatar upload-replace-delete-persistence PASS.** A locator wait initially used an incomplete success string and timed out; fresh UI showed the actual successful message. This was not an application failure.
- Store creation initially failed before upload with the schema-preflight message. QA information_schema confirmed store_logo_url and store_banner_url existed but store_hero did not. The migration ledger had no store_hero_customization entry. The repository already contained `20261015125726_store_hero_customization.sql`; its original comment records prior Production application. Reused that exact SQL only on QA through apply_migration; registered as `20261027074002 / store_hero_customization`. No SQL file was created, no security migration was rerun, and no Production call was made. Column and shape constraint readback passed; security migration ledger count remains one. Security advisor category counts were unchanged (21/10/56/1).
- Retried the same Store Setup UI after the schema repair. It created Security QA A Store, routed to Dashboard and saved two correctly owned store-branding objects. Reopened Profile and replaced both logo and cover with different synthetic PNGs. UI confirmed save; SQL showed two new owner-prefixed paths, with both old paths removed. Store-only data persisted between Setup, Dashboard and Profile. **Owner Store creation / logo and cover upload-replacement PASS.** Cross-user UI rejection remains a separate pending test.
- User A direct requests to /admin, /admin/users and /admin/search all resolved to its ordinary /dashboard; no Admin controls or service-only Search data rendered. **User A Admin-route authorization PASS.** No privilege was granted to this account.
- User A and its two branding objects are retained for the authorized next cross-user tests. Earlier moderation fixture cleanup remains complete. Password recovery, User B browser isolation and mobile checks remain pending. Production remains NOT READY.
