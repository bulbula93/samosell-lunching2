# AI Operations — zero-cost deterministic triage

Adds a pure, no-network triage engine at `lib/ai-ops/triage.ts`. This is a preparatory foundation for read-only health reporting.

- No AI API, key, external subscription, cron or billing.
- No database queries, mutations, or worker activation.
- Does not alter current QA branch isolation or Production.
- Identifies dead-letter jobs, stale nonterminal jobs, expired approvals, unknown statuses and inconsistent control flags.
- Never treats a pending approval as consent to execute.
- Consuming UI/reader integration must be separately reviewed: the existing QA reader is restricted to `preview/ai-agents-foundation-20261017`, and must not be silently repointed to this branch.

## Verification
Run `npx vitest run tests/AiOpsTriage.test.ts`, TypeScript, lint, and Next.js build. Confirm CI and Preview readiness prior to any promotion.

## Next stage
Within the existing authorized QA Preview, wire a read-only projection to this pure engine **only after** reviewing branch isolation, column grants, and reader inputs. Keep the stop switch on and production untouched.
