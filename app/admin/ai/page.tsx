import Link from "next/link"
import { requireAdminUser } from "@/lib/auth"
import { AGENT_ROLES, ACTIONS } from "@/lib/ai-ops/policy"

export const dynamic = "force-dynamic"
export const metadata = { title: "AI Operations | SamoSell", robots: { index: false, follow: false } }

const AGENTS: Record<(typeof AGENT_ROLES)[number], { name: string; purpose: string }> = {
  coordinator: { name: "AI Coordinator", purpose: "დავალებების კოორდინაცია და ესკალაცია" },
  support: { name: "Support", purpose: "მომხმარებელთა მხარდაჭერა" },
  moderation: { name: "Moderator", purpose: "რეპორტები, სპამი და რისკები" },
  technical: { name: "Technical Ops", purpose: "ინფრასტრუქტურა და ინციდენტები" },
  marketing: { name: "Marketing", purpose: "კონტენტი და კამპანიები" },
  seo: { name: "SEO", purpose: "ინდექსაცია და საძიებო ხარისხი" },
  finance: { name: "Finance", purpose: "VIP და გადახდების მონიტორინგი" },
  seller_success: { name: "Seller Success", purpose: "გამყიდველების გააქტიურება" },
  qa: { name: "QA", purpose: "რეგრესია და ბაგების ანგარიშები" },
}

export default async function AiOperationsPage() {
  await requireAdminUser("/dashboard")
  const availableActions = Object.entries(ACTIONS)
  return (
    <main className="ui-container ui-section space-y-6">
      <header className="ui-card p-6 sm:p-8">
        <div className="ui-eyebrow">SamoSell AI Operations / Foundation v0.5</div>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-text">AI თანამშრომლების მართვა</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-text-soft">
          ეს არის Foundation Preview: პოლიტიკისა და როლების სამუშაო სია, არა გაშვებული აგენტები.
          ყველა აგენტი ამ ეტაპზე გამორთულია. არც AI მოთხოვნები და არც ფონური დავალებები არ სრულდება.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border px-3 py-1 text-xs font-bold text-text">9 როლი განსაზღვრულია</span>
          <span className="rounded-full border px-3 py-1 text-xs font-bold text-text">0 გაშვებული</span>
          <span className="rounded-full border px-3 py-1 text-xs font-bold text-text">Production write: გამორთულია</span>
        </div>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Agent roles">
        {AGENT_ROLES.map((role) => (
          <article key={role} className="ui-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-soft">{role}</p>
            <h2 className="mt-2 text-lg font-bold text-text">{AGENTS[role].name}</h2>
            <p className="mt-1 text-sm text-text-soft">{AGENTS[role].purpose}</p>
            <p className="mt-4 text-xs font-medium text-text-soft">სტატუსი: არ არის აქტიური</p>
          </article>
        ))}
      </section>
      <section className="ui-card p-6">
        <h2 className="text-xl font-bold text-text">მოქმედებების პოლიტიკა</h2>
        <p className="mt-2 text-sm text-text-soft">დაშვება ნაგულისხმევად აკრძალულია; მაღალი რისკის ოპერაციებს სჭირდება ადამიანის დამტკიცება და შემდგომი სერვერული გადამოწმება.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {availableActions.map(([action, tier]) => (
            <div key={action} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <code className="break-all text-text">{action}</code>
              <span className="shrink-0 rounded-full border px-2 py-1 text-xs text-text-soft">{tier}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="ui-card p-6">
        <h2 className="text-xl font-bold text-text">Shadow Monitor</h2>
        <p className="mt-2 text-sm text-text-soft">QA რიგისა და აქტივობის დაკვირვება. აგენტები ნაგულისხმევად შეჩერებულია. რეალური AI Worker ჯერ არ სრულდება.</p>
        <Link href="/admin/ai/shadow" className="mt-4 inline-flex rounded-full border px-4 py-2 text-sm font-bold text-text hover:underline">დაკვირვების პანელის გახსნა →</Link>
      </section>
      <section className="ui-card p-6">
        <h2 className="text-xl font-bold text-text">Job Queue &amp; Activity Log</h2>
        <p className="mt-2 text-sm text-text-soft">დავალებებისა და აუდიტის რეალური მონაცემები SamoSell-QA-დან. სერვერული წვდომა მხოლოდ წაკითხვაზეა შეზღუდული; Worker ჯერ არ მუშაობს.</p>
        <Link href="/admin/ai/activity" className="mt-4 inline-flex rounded-full border px-4 py-2 text-sm font-bold text-text hover:underline">დავალებებისა და აქტივობის ნახვა →</Link>
      </section>
      <Link href="/admin" className="inline-flex text-sm font-bold underline">← ადმინისტრირების პანელი</Link>
    </main>
  )
}
