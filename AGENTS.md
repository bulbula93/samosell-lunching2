<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Git identity before committing

For work authorized by the repository owner, verify the authenticated GitHub
account first. The owner is `bulbula93` (GitHub user ID `146710014`).
Use repository-local identity; never inherit `Codex <codex@openai.com>`.
For this owner's authorized commits:

```sh
git config --local user.name "Giorgi bulbulashvili"
git config --local user.email "146710014+bulbula93@users.noreply.github.com"
git config --local user.useConfigOnly true
git var GIT_AUTHOR_IDENT
git var GIT_COMMITTER_IDENT
```

If working as another person, use that person's verified GitHub identity instead.
Do not rewrite published history to repair an old author warning.
Before a deployment, push the exact source commit and verify that GitHub can
resolve its SHA. Vercel metadata must refer to the actual uploaded commit.

## Deployment targets and recovery checks

- Repository: `bulbula93/samosell-lunching2`.
- Vercel team: `team_8xV00BDFp9xfIUl4faO29wy1`.
- Vercel project: `prj_R9brlTc5RoXFHDGuhKdcvdMRZEQz`.
- Production domain: `https://samosell.ge`.
- Production Supabase project: `lxsvjzbiuewgwpajqrwr`, Singapore.
- Keep Vercel functions in `sin1`, as specified by `vercel.json`.
- Verify persisted Production `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` resolve to that project. A successful
  deployment supplied with temporary CLI variables does not prove the next
  Git-triggered deployment has those variables.
- Inspect Preview branch overrides separately. Use the approved test project;
  a preview that uses production public data must stay read-only.
- Preserve the user's approval boundary for production releases, environment
  changes, database writes and compute upgrades. Preparing a branch or draft PR
  does not authorize promotion to production.

A Vercel `READY` deployment and Supabase `ACTIVE_HEALTHY` status are insufficient
to declare recovery. Verify a database `SELECT 1`, Auth health, an anonymous
Data API read, and actual rendered catalog results, with bounded timeouts.
Check recent runtime logs for gateway 5xx and query timeouts. Do not create
unbounded retries or automatically restart the database on a generic failure.
Capture UTC times and request IDs for support. Treat Git author warnings and
Supabase resource/API failures as separate causes until evidence connects them.
