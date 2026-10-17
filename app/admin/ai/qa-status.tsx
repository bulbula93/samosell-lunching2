import Link from "next/link";
import type { QaReadResult } from "@/lib/ai-ops/qa-reader";
import { formatQaTime } from "@/lib/ai-ops/presentation";

const errors = {
  environment_blocked:
    "QA კავშირი დაშვებულია მხოლოდ AI Foundation-ის Preview branch-ზე",
  configuration_missing: "QA კავშირის სერვერული კონფიგურაცია აკლია",
  configuration_invalid:
    "QA კავშირის კონფიგურაცია ვერ გადის უსაფრთხოების შემოწმებას",
  schema_unavailable: "QA ცხრილები ან კონტროლის ჩანაწერი მიუწვდომელია",
  access_denied: "QA reader-ს მოთხოვნილი წაკითხვის უფლება არ აქვს",
  connection_failed: "QA ბაზასთან კავშირი ვერ დამყარდა. სცადე მოგვიანებით",
};
export function QaStatus({ result }: { result: QaReadResult }) {
  const stopped =
    !result.ok || result.data.environmentStopped || result.data.control.stopped;
  return (
    <section
      className="ui-card p-5 sm:p-6"
      aria-label="QA connection and safety status"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="ui-eyebrow">SamoSell-QA · მხოლოდ წაკითხვა</p>
          <h2 className="mt-2 text-lg font-bold text-text">
            Kill Switch:{" "}
            {stopped ? "Stopped / შეჩერებულია" : "გაჩერება გამორთულია"}
          </h2>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs font-bold text-text">
          აგენტები: არააქტიური
        </span>
      </div>
      {result.ok ? (
        <p className="mt-3 text-sm text-text-soft">
          ბაზის Kill Switch:{" "}
          {result.data.control.stopped ? "Stopped" : "Stop გამორთულია"} ·
          განახლება: {formatQaTime(result.data.control.updated_at)} · სერვერული
          გაჩერება: {result.data.environmentStopped ? "ჩართულია" : "გამორთულია"}
        </p>
      ) : (
        <div role="status" className="mt-3 rounded-xl border p-4">
          <p className="font-semibold text-text">{errors[result.code]}</p>
          <p className="mt-2 text-sm text-text-soft">
            ბაზის სტატუსი უცნობია. სისტემა უსაფრთხოდ შეჩერებულია; მონაცემები არ
            ჩანაცვლდება გამოგონილი ჩანაწერებით.
          </p>
          <code className="mt-2 block text-xs text-text-soft">
            {result.code}
          </code>
        </div>
      )}
      <p className="mt-3 text-xs leading-6 text-text-soft">
        Worker და Scheduler ჯერ არ არის გაშვებული. ამ პანელიდან გაშვება,
        დამტკიცება და მონაცემების შეცვლა შეუძლებელია.
      </p>
    </section>
  );
}
export function AiNavigation() {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="AI Operations navigation">
      {[
        ["/admin/ai", "მიმოხილვა"],
        ["/admin/ai/shadow", "Shadow Mode"],
        ["/admin/ai/activity", "Queue & Activity"],
      ].map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className="rounded-full border px-4 py-2 text-sm font-bold text-text hover:bg-black/5"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
