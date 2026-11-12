# SamoSell Clarity UX implementation — 2026-11-09

**Status: corrections implemented; automated checks passed; live QA/release gate NOT READY.**

## მოკლე შედეგი

ცალკე განშტოებაში გასწორდა პაროლის აღდგენისას საწყისი მისამართის დაკარგვა და ავტორიზაციის შეტყობინებების ხელმისაწვდომობა. ცვლილებები შემოწმდა ტესტებითა და build-ით. Production არ შეცვლილა. მფლობელის ყველა მოწყობილობის ვიზიტები ჯერ საიმედოდ გამოყოფილი არ არის; ქცევითი დასკვნები ამ შეზღუდვით უნდა წავიკითხოთ.

## Changes and before/after

| Problem | Before | After |
| --- | --- | --- |
| Recovery detour from listing creation | Login → recovery → login/registration could lose `/dashboard/listings/new` and default to `/` | The validated destination is carried through links, email callback destination, reset completion and expired-code recovery |
| Screen-reader feedback | Registration errors/confirmation instructions and Google errors were ordinary divs | Errors have alert semantics; confirmation instructions have status semantics |

No redesign, new dependency, migration, environment-variable change, paid resource, schema/RLS change or publication rule change was introduced.

## Files

| File | Purpose |
| --- | --- |
| `lib/auth-redirect.ts` | Build auth-page URLs with the existing internal-path safety validator |
| `components/auth/LoginForm.tsx` | Preserve the destination on the forgot-password link |
| `app/forgot-password/page.tsx` | Parse/sanitize `next`; pass it to the form and return link |
| `components/auth/ForgotPasswordForm.tsx` | Embed the destination in the reset callback path |
| `app/reset-password/page.tsx` | Preserve it when canceling or requesting a fresh recovery link |
| `components/auth/ResetPasswordForm.tsx` | Preserve it when returning to login after a successful password change |
| `app/auth/callback/route.ts` | Recognize recovery paths with query parameters and retain the destination on failure |
| `components/auth/RegisterForm.tsx` | Announce errors and confirmation instructions |
| `components/auth/SocialAuthButtons.tsx` | Announce OAuth errors |
| `tests/ClarityAuthContinuation.test.tsx` | Behavioral continuation, unsafe URL, feedback and keyboard regressions |
| `tests/AuthPasswordRecovery.test.ts` | Replace source-string checks with real callback/page/component behavior tests |
| `docs/CLARITY_UX_AUDIT_20261109.md` | Behavioral evidence, cohort limitations and recommendations |

## Reproduction and regression evidence

The initial new component-test run failed **5 of 8 tests** on the original code: lost destination on opening recovery, lost destination on returning to login, and three missing feedback roles. Three unsafe-return-path cases already passed. After correction these passed.

The existing password-recovery tests asserted exact source strings, so they were replaced with behavioral coverage: actual callback responses, authenticated reset-page access, expired recovery, OAuth callback errors, default recovery paths, external-return rejection, update/sign-out calls and the final login destination. Auth and navigation use test doubles; no messages or passwords were sent to a real service.

Keyboard coverage checks that Tab reaches recovery after the email field and then reaches the password field. This is a jsdom keyboard test, not a real browser or screen-reader session.

## Verification

All commands ran in the isolated `clarity-ux-audit` worktree with no copied `.env.local` or Production credentials. Test services used loopback/placeholder configuration and existing mocks/PGlite fixtures. The build used the repository's loopback public-data fixture.

| Check | Result | Scope/limitations |
| --- | --- | --- |
| Targeted auth regressions, initial | 27 passed | Node 24.14.1; original targeted tests after correction |
| Full automated suite | 223 files / 1,390 tests passed | Node 24.14.1; includes listing wizard, uploads, validation, retries, draft restoration, auth, navigation and existing regression suites |
| Additional keyboard regression | Included in final targeted run | Added after the full suite; no application code changed afterward |
| Final targeted auth run | 3 files / 28 tests passed | Node 22.23.4; auth continuation/recovery/redirect and keyboard tests |
| ESLint | 0 errors, 8 warnings | Existing `no-img-element` warnings outside changed components |
| Production build | Passed; 54 static pages generated | Next.js 16.2.3 / Node 22.23.4, `node scripts/build-with-public-fixture.mjs`; no deployment |
| TypeScript | Build type-check passed; standalone `tsc --noEmit` exited 0 | Node 22.23.4 |
| Diff whitespace | `git diff --check` passed | Focused code/test/docs changes |
| Live local desktop/mobile browser QA | Blocked | Automatic approval review rejected launching `next start` on loopback port 3210; no further reason was supplied. The block was not bypassed. |
| Real Google OAuth, recovery delivery, QA Supabase persistence/storage/publication | Not run | No disposable QA backend/accounts were exercised; simulated tests do not establish live behavior |
| Physical iPhone and assistive technology | Not run | No claim of real-device or spoken-feedback validation |

The test runner emits existing React/jsdom warnings in some unrelated suites; these do not constitute live-browser verification.

## Safety and review

- Branch: `ux/clarity-audit-20261109`, based on `3acc5680c2d9a47a547ddcba0c0362dfffe00e6e`.
- Original checkout's `next-env.d.ts`, `.claude/`, and `.mcp.json` changes were preserved; no environment files or private recordings were copied into the worktree.
- Existing internal-path validation remains in use at every new return-path boundary. Tests cover unsafe external returns and query-string preservation.
- Existing user lookup/code exchange, password update/sign-out behavior and consent requirements remain in place.
- No listing form, upload, profile, catalog or navigation redesign was made based on ambiguous replay signals.
- React review: no new effects, client data queries, rendering waterfalls, component dependencies or layout classes. Links remain native accessible anchors; dynamic errors/status use explicit semantics.
- `vercel.json` enables automatic Git deployments only for `main` and `preview/**`; the requested `ux/**` branch is outside these configured deployment patterns. No deployment was requested.

## Remaining risks and next steps

1. Identify/exclude every owner/test browser before declaring a genuine-customer Clarity baseline. The temporary admin-browser exclusion does not stop tracking or cover the owner's iPhone/logged-out activity.
2. Review this as a **draft PR**. Unblock local browser execution or provide an isolated writable QA environment, then verify the actual recovery detour at desktop/mobile widths and with keyboard/screen reader.
3. In QA, verify allowed callback URL configuration, recovery email delivery, old links without `next`, expired links, Google OAuth continuation, listing phone gate, photo upload and publication. Browser checks must include loading, empty, error and success states; no real notifications or Production users.
4. Recheck performance and PWA overlay leads with a clean cohort/current build. No measured conversion or latency improvement is claimed.
5. Merge/deployment require separate explicit approval after these gates pass. No Production action is part of this work.

Rollback before merge: keep the draft unmerged. If later released, revert the implementation commit through the normal reviewed release workflow and restore the previous deployment. There are no database migrations or environment changes to undo. Existing recovery links without a destination continue using the prior homepage default.
