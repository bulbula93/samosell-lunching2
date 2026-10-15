# Duplicate listing image cleanup — 2026-10-16

Production incident: a successful listing creation was followed by a duplicate POST returning HTTP 409. A subsequent upload-abort deleted the original listing's images. The duplicate record was moved to draft; the valid record remains active.

Fix requirements: preserve committed image objects on retried publishes; reuse a stable attempt ID; check committed listing state before any cleanup; add regression tests for duplicate retries and missing images. Do not deploy without passing tests.

## Fix on the review branch

- Upload preparation accepts the client's UUID. Both create interfaces keep this UUID across failed preparation, upload and publication retries. The ID is independent of analytics consent.
- Once a create request has been sent, both interfaces retain its exact payload. A lost response or retryable server error replays that request without re-uploading files. A definitive validation error permits correcting the form while retaining the attempt ID. A fresh form is a new attempt.
- `saveListingAction` checks the authenticated seller's existing row before rate limiting or inserting. A committed replay returns its saved ID, slug and status without overwriting later edits. It checks image records and actual stored file content before declaring success.
- The existing listing primary key arbitrates simultaneous creates across server processes. Image IDs are deterministic UUIDv5 values scoped to listing and upload path, and image writes use `ON CONFLICT DO NOTHING`. This also allows the same attempt to finish an interrupted parent/image write or recover a lost database response.
- Create failures retain the parent and uploads for recovery. Failures in email, cache revalidation or analytics after a successful database save do not roll back the listing.
- `abortListingUploadsAction` authenticates, validates owned paths and checks the listing. Any existing listing protects the whole upload folder. A missing row or failed lookup defers cleanup: neither proves that a concurrent create has stopped. Failure paths do not delete uploaded files. Successful edits still remove intentionally detached old files.

## Deliberate retention tradeoff

Abandoned upload candidates are retained. Safe automatic reclamation would need a durable cancellation/commit protocol shared with publishers; a read-then-delete check cannot provide that guarantee. This fix does not add a garbage collector or delete historical files or listings. Parent/image writes remain separate database requests; if image persistence is unavailable, the retained parent may temporarily have no image rows until the same attempt resumes. Its validated cover object is retained.

No database migration, Production data repair, Production environment update or main-branch merge is part of this change.

## Verification scope

`tests/ListingPublishIdempotency.test.ts` runs the actual server actions against an isolated in-memory PostgreSQL database (PGlite) with real primary/foreign keys and conflict handling. It covers committed replay, simultaneous requests, interleaving before and after parent commit, lost write responses, interrupted image persistence, missing/corrupt/empty objects, unowned uploads, lookup failure, later edits, notification failure and stable upload preparation IDs. The two component suites cover publication retries and lost preparation responses.

The Vercel review branch is explicitly read-only and reads public data. Live Preview checks must be limited to nonmutating requests; publication and abort failure scenarios are exercised against the isolated test database. Production listings, image objects, payment state and user accounts must remain untouched. Main awaits the owner's final approval.

### Local results

Runtime: Node.js 22.23.3, matching the repository's `22.x` engine and CI.

| Check | Result |
| --- | --- |
| TypeScript (`tsc --noEmit`) | Passed |
| ESLint, complete repository | 0 errors; 8 existing image-element warnings in unchanged files |
| ESLint, changed TypeScript files | 0 errors; 0 warnings |
| Vitest, complete suite | 169 files; 971 passed; 0 failed |
| Final focused regression rerun | 4 files; 42 passed; 0 failed |
| Next.js webpack build | Passed |

Vercel's exact commit, deployment state, CI status and read-only smoke results are recorded in the pull request.
