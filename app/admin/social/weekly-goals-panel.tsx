import type { WeeklyGoal } from "@/lib/social/weekly-goals"
import Link from "next/link"

export function WeeklyGoalsPanel({ label, goals, completed, planned, simulated }: {
  label: string
  goals: WeeklyGoal[]
  completed: number
  planned: number
  simulated: boolean
}) {
  const goalCount = goals.length
  return (
    <section id="weekly-goals" className="ui-card p-5 sm:p-6" aria-label="Weekly agent goals">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-text-soft">Marketing Autopilot · Weekly goals</p>
          <h2 className="mt-2 text-xl font-black text-text">ამ კვირის გეგმა · {label}</h2>
          <p className="mt-1 text-sm text-text-soft">Meta Weekly Plan-ის ანალოგი · ოფიციალური Meta ჩექლისტის სტატუსი API-ით არ მოწმდება</p>
        </div>
        <span className="rounded-full border px-4 py-2 text-sm font-black text-text">{completed}/{goalCount} დადასტურებული</span>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="კვირის დადასტურებული მიზნები" aria-valuemin={0} aria-valuemax={goalCount} aria-valuenow={completed}>
        <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.round(completed / goalCount * 100)}%` }} />
      </div>
      {simulated && <p className="mt-3 rounded-lg border border-amber-500 p-3 text-sm text-text">სიმულაციის რეჟიმია — ტესტური კონტენტი არ ითვლება რეალურ გამოქვეყნებად.</p>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {goals.map((goal) => {
          const color = goal.state === "complete" ? "text-emerald-700" : goal.state === "blocked" ? "text-red-700" : "text-text-soft"
          return <div key={goal.id} className="rounded-xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-text">{goal.title}</h3>
              <span className={`shrink-0 text-sm font-black ${color}`}>{goal.state === "blocked" ? "დაბლოკილია" : goal.state === "unverified" ? "ვერ მოწმდება" : `${goal.done}/${goal.target}`}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-200"><div className="h-full rounded-full bg-sky-600" style={{width:`${Math.min(100, goal.done / goal.target * 100)}%`}} /></div>
            <p className="mt-2 text-xs leading-5 text-text-soft">{goal.note}</p>
          </div>
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
        <div>
          <p className="text-sm font-bold text-text">ამ კვირაში დაგეგმილი კონტენტი: {planned}</p>
          <p className="mt-1 text-xs text-text-soft">სისტემის მიმდინარე გეგმის გასაშვებად გამოიყენე ქვემოთ არსებული „კვირის გეგმის შექმნა“. ავტომატური scheduler ამ Preview-ში არ აქტიურდება.</p>
        </div>
        <Link href="#content" className="rounded-full border px-4 py-2 text-sm font-bold text-text hover:underline">კონტენტის ნახვა</Link>
      </div>
    </section>
  )
}
