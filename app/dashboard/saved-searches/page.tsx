import Link from "next/link"
import {
  deleteSavedSearchAction,
  toggleSavedSearchAction,
} from "@/app/dashboard/saved-searches/actions"
import { requireAuthenticatedUser } from "@/lib/auth"

type SavedSearchRow = {
  id: string
  label: string
  catalog_path: string
  is_active: boolean
  last_matched_at: string | null
  created_at: string
}

function formatDate(value?: string | null) {
  if (!value) return "ჯერ არა"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("ka-GE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export default async function SavedSearchesPage() {
  const { supabase } = await requireAuthenticatedUser("/dashboard/saved-searches")
  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, label, catalog_path, is_active, last_matched_at, created_at")
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) throw new Error("Saved searches could not be loaded.")
  const searches = (data ?? []) as SavedSearchRow[]

  return (
    <main className="min-h-screen bg-bg px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="ui-eyebrow">ძიების ალერტები</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-text">შენახული ძებნები</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-soft">
              შეინახე კატალოგის ფილტრები და ახალი შესაბამისი განცხადების გამოქვეყნებისას შეტყობინებას მიიღებ.
            </p>
          </div>
          <Link href="/catalog" className="ui-btn-primary whitespace-nowrap">
            ახალი ძებნის შექმნა
          </Link>
        </header>

        {searches.length === 0 ? (
          <section className="ui-card p-8 text-center sm:p-12">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-xl text-brand">⌕</div>
            <h2 className="mt-4 text-xl font-black text-text">ჯერ შენახული ძებნა არ გაქვს</h2>
            <p className="mt-2 text-sm leading-6 text-text-soft">
              კატალოგში აირჩიე ფილტრები და გამოიყენე „ძებნის შენახვა“.
            </p>
            <Link href="/catalog" className="ui-btn-primary mt-5">
              კატალოგის გახსნა
            </Link>
          </section>
        ) : (
          <section className="space-y-3" aria-label="შენახული ძებნების სია">
            {searches.map((search) => (
              <article key={search.id} className="ui-card p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-black text-text">{search.label}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${search.is_active ? "bg-brand-soft text-brand" : "bg-surface-alt text-text-soft"}`}>
                        {search.is_active ? "ჩართულია" : "გამორთულია"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold text-text-soft">
                      <span>შენახულია: {formatDate(search.created_at)}</span>
                      <span>ბოლო შესაბამისობა: {formatDate(search.last_matched_at)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link href={search.catalog_path} className="ui-btn-secondary min-h-10 px-4 py-2 text-sm">
                      შედეგების ნახვა
                    </Link>
                    <form action={toggleSavedSearchAction}>
                      <input type="hidden" name="savedSearchId" value={search.id} />
                      <input type="hidden" name="active" value={search.is_active ? "0" : "1"} />
                      <button type="submit" className="ui-btn-ghost min-h-10 px-3 py-2 text-sm">
                        {search.is_active ? "გამორთვა" : "ჩართვა"}
                      </button>
                    </form>
                    <form action={deleteSavedSearchAction}>
                      <input type="hidden" name="savedSearchId" value={search.id} />
                      <button type="submit" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50">
                        წაშლა
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        <p className="mt-4 text-xs leading-5 text-text-soft">
          მაქსიმუმ 20 შენახული ძებნა შეგიძლია გქონდეს. გამორთული ძებნა აღარ აგზავნის ახალ შეტყობინებებს.
        </p>
      </div>
    </main>
  )
}
