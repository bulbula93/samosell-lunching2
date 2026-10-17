/** Pure read-only triage: no model calls, writes or side effects. */
export type ShadowSignal = {
  id: "moderation_backlog" | "support_backlog" | "payments_pending"
  role: "moderation" | "support" | "technical"
  priority: "normal" | "high"
  count: number
  summary: string
}
export type ShadowCounts = {
  moderationOpen: number | null
  supportOpen: number | null
  paymentsPending: number | null
}
export function triageShadowCounts(counts: ShadowCounts): ShadowSignal[] {
  const signals: ShadowSignal[] = []
  if (counts.moderationOpen !== null && counts.moderationOpen > 0)
    signals.push({ id: "moderation_backlog", role: "moderation", priority: counts.moderationOpen >= 10 ? "high" : "normal", count: counts.moderationOpen, summary: "ღია განცხადებების რეპორტები" })
  if (counts.supportOpen !== null && counts.supportOpen > 0)
    signals.push({ id: "support_backlog", role: "support", priority: counts.supportOpen >= 10 ? "high" : "normal", count: counts.supportOpen, summary: "ღია მხარდაჭერის მოთხოვნები" })
  if (counts.paymentsPending !== null && counts.paymentsPending > 0)
    signals.push({ id: "payments_pending", role: "technical", priority: "normal", count: counts.paymentsPending, summary: "გადაუმუშავებელი გადახდების სტატუსები (მხოლოდ რიცხვი)" })
  return signals
}
export function isShadowEnabled(env: { VERCEL_ENV?: string; AI_OPS_SHADOW_ENABLED?: string; AI_OPS_KILL_SWITCH?: string }): boolean {
  return env.VERCEL_ENV === "preview" && env.AI_OPS_SHADOW_ENABLED === "true" && env.AI_OPS_KILL_SWITCH !== "true"
}
