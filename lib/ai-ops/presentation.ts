import { ACTIONS } from "./policy";

export function approvalRisk(action: string): "high" | "medium" | "low" {
  const tier = Object.hasOwn(ACTIONS, action)
    ? ACTIONS[action as keyof typeof ACTIONS]
    : undefined;
  return tier === "read" || tier === "draft"
    ? "low"
    : tier === "guarded"
      ? "medium"
      : "high";
}
export function activityOutcome(event: string): string {
  const outcomes: Record<string, string> = {
    queued: "რიგშია",
    claimed: "მიღებულია",
    completed: "დასრულდა",
    failed: "შეცდომა",
    approval_requested: "ელოდება ადამიანს",
    cancelled: "გაუქმდა",
    kill_switch: "კონტროლი შეიცვალა",
  };
  return Object.hasOwn(outcomes, event) ? outcomes[event] : "შედეგი უცნობია";
}
export function formatQaTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ka-GE", {
    timeZone: "Asia/Tbilisi",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
