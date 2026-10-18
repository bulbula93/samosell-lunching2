import { readQaOperations } from "@/lib/ai-ops/qa-reader";
import { evaluateAiOpsTriage } from "@/lib/ai-ops/triage";
import {
  activityOutcome,
  approvalRisk,
  formatQaTime,
} from "@/lib/ai-ops/presentation";
import { AiNavigation, QaStatus } from "../qa-status";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "AI Activity | SamoSell",
  robots: { index: false, follow: false },
};

export default async function AiActivityPage() {
  const result = await readQaOperations();
  const findings = result.ok ? evaluateAiOpsTriage({
    jobs: result.data.jobs.map(j => ({ status: j.status, priority: j.priority, createdAt: j.created_at })),
    approvals: result.data.approvals.map(a => ({ status: a.status, expiresAt: a.expires_at })),
    control: {
      stopped: result.data.environmentStopped || result.data.control.stopped,
      workerEnabled: result.data.control.worker_enabled,
      schedulerEnabled: result.data.control.scheduler_enabled,
    },
    nowIso: new Date().toISOString(),
  }) : [];
  return (
    <main className="ui-container ui-section min-w-0 space-y-5">
      <header className="ui-card p-5 sm:p-8">
        <p className="ui-eyebrow">AI Operations · Foundation v0.6</p>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-text sm:text-3xl">
          დავალებები და აქტივობის ჟურნალი
        </h1>
        <p className="mt-3 text-sm leading-7 text-text-soft">
          იზოლირებული QA მონაცემები · მხოლოდ წაკითხვა · დრო: თბილისი
        </p>
      </header>
      <AiNavigation />
      <QaStatus result={result} />
      {result.ok && (
        <>
          <section className="ui-card p-5 sm:p-6" aria-label="Deterministic QA triage">
            <h2 className="text-xl font-bold text-text">ოპერაციული პრიორიტეტები · უფასო ანალიზი</h2>
            <p className="mt-2 text-sm text-text-soft">ეს შეფასება ითვლის მხოლოდ ბოლო 20 დავალებისა და 20 დამტკიცების მოთხოვნის ნიმუშს. მთლიანი სისტემის ინციდენტების რაოდენობა არ არის. არ იყენებს AI API-ს და არაფერს ცვლის.</p>
            {findings.length ? (
              <ul className="mt-4 space-y-3">{findings.map(f => (
                <li key={f.code} className="rounded-xl border p-4">
                  <p className="font-bold text-text">{f.severity === "critical" ? "კრიტიკული" : f.severity === "warning" ? "საყურადღებო" : "ინფორმაცია"} · {f.code} · {f.count}</p>
                  <p className="mt-1 text-sm text-text-soft">{f.explanation}</p>
                  <p className="mt-2 text-sm text-text">შემდეგი შემოწმება: {f.nextStep}</p>
                </li>
              ))}</ul>
            ) : <p className="mt-3 text-sm text-text-soft">წაკითხულ ნიმუშში საყურადღებო სიგნალი არ გამოვლენილა.</p>}
          </section>
          <section className="grid gap-3 sm:grid-cols-3" aria-label="QA totals">
            {[
              ["სულ დავალებები", result.data.totals.jobs],
              ["აქტივობის ჩანაწერები", result.data.totals.activity],
              ["Pending მოთხოვნები", result.data.totals.pending],
            ].map(([label, count]) => (
              <article key={label} className="ui-card p-5">
                <h2 className="text-sm text-text-soft">{label}</h2>
                <p className="mt-2 text-3xl font-black text-text">{count}</p>
              </article>
            ))}
          </section>
          <section className="ui-card min-w-0 p-5 sm:p-6">
            <h2 className="text-xl font-bold text-text">Job Queue</h2>
            <p className="mt-1 text-xs text-text-soft">ბოლო 20 დავალება</p>
            {result.data.jobs.length === 0 ? (
              <p className="mt-4 text-sm text-text-soft">
                QA რიგი ცარიელია. დავალებები ჯერ არ შექმნილა.
              </p>
            ) : (
              <div
                className="mt-4 overflow-x-auto"
                tabIndex={0}
                role="region"
                aria-label="Job Queue table"
              >
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        "Job ID",
                        "Agent",
                        "Task type",
                        "Status",
                        "Priority",
                        "Attempts",
                        "Created At",
                      ].map((h) => (
                        <th
                          scope="col"
                          key={h}
                          className="border-b p-3 text-xs font-semibold text-text-soft"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.jobs.map((j) => (
                      <tr key={j.id} className="border-b last:border-0">
                        <td className="p-3 font-mono text-xs text-text">
                          {j.id}
                        </td>
                        <td className="p-3 text-text">{j.role}</td>
                        <td className="p-3 text-text">{j.kind}</td>
                        <td className="p-3 text-text">{j.status}</td>
                        <td className="p-3 text-text">{j.priority}</td>
                        <td className="p-3 text-text">{j.attempt}</td>
                        <td className="whitespace-nowrap p-3 text-text-soft">
                          {formatQaTime(j.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="ui-card p-5 sm:p-6">
            <h2 className="text-xl font-bold text-text">Activity Log</h2>
            <p className="mt-1 text-xs text-text-soft">
              ბოლო 30 მოვლენა · შედეგი ეფუძნება შენახულ event-ს
            </p>
            {result.data.activity.length === 0 ? (
              <p className="mt-4 text-sm text-text-soft">
                QA აქტივობა ჯერ არ დაფიქსირებულა.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {result.data.activity.map((e) => (
                  <li
                    key={e.id}
                    className="grid gap-2 rounded-xl border p-4 sm:grid-cols-[1fr_1fr_auto]"
                  >
                    <div>
                      <p className="font-bold text-text">{e.role}</p>
                      <p className="mt-1 break-words text-sm text-text-soft">
                        {e.event_type}
                      </p>
                    </div>
                    <p className="text-sm text-text">
                      {activityOutcome(e.event_type)}
                    </p>
                    <time
                      className="text-xs text-text-soft"
                      dateTime={new Date(e.created_at).toISOString()}
                    >
                      {formatQaTime(e.created_at)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="ui-card p-5 sm:p-6">
            <h2 className="text-xl font-bold text-text">Approval Center</h2>
            <p className="mt-2 text-sm text-text-soft">
              {result.data.totals.pending} pending · ბოლო 20 მოთხოვნა, pending
              პირველ რიგში · საჭიროა ადამიანის დამტკიცება
            </p>
            {result.data.approvals.length === 0 ? (
              <p className="mt-4 text-sm text-text-soft">
                დამტკიცების მოთხოვნები არ არსებობს.
              </p>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {result.data.approvals.map((a) => (
                  <li key={a.id} className="rounded-xl border p-4">
                    <p className="break-words font-bold text-text">
                      {a.action}
                    </p>
                    <dl className="mt-3 space-y-2 text-sm text-text-soft">
                      <div className="flex justify-between gap-2">
                        <dt>სტატუსი</dt>
                        <dd>
                          {a.status}
                          {a.status === "pending" && a.expired
                            ? " · ვადა გასულია"
                            : ""}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>პოლიტიკით რისკი</dt>
                        <dd>{approvalRisk(a.action)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>ადამიანის დამტკიცება</dt>
                        <dd>სავალდებულოა</dd>
                      </div>
                      <div>
                        <dt>მოთხოვნის დრო</dt>
                        <dd>{formatQaTime(a.requested_at)}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-text-soft">
              დამტკიცება და შესრულება ამ ეტაპზე გამორთულია. უცნობი მოქმედება
              ფასდება მაღალ რისკად.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
