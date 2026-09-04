export const dynamic = "force-dynamic"
export const revalidate = 0

import Link from "next/link"
import SmartImage from "@/components/shared/SmartImage"
import AdminAdSubmitButton from "@/components/admin/AdminAdSubmitButton"
import { launchAdminAdAction, saveAdminAdAction, stopAdminAdAction } from "@/app/admin/ads/actions"
import {
  ADMIN_AD_PLACEMENTS,
  AD_PLACEMENT_LABELS,
  getAdminAdStatus,
  isAdId,
  type AdminAdStatus,
} from "@/lib/admin-ads"
import { requireAdminUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import type { AdPlacementKey } from "@/lib/ads"

type AdminAdRow = {
  id: string
  placement_key: AdPlacementKey
  title: string | null
  description: string | null
  image_url: string | null
  target_url: string | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  priority: number
  advertiser_name: string | null
  created_at: string
  updated_at: string
}

type AdminAdsSearchParams = { edit?: string | string[]; flash?: string | string[] }

type AdEventCountRow = { ad_id: string; impressions: number | string; clicks: number | string }

const statusLabels: Record<AdminAdStatus, string> = {
  active: "აქტიური",
  scheduled: "დაგეგმილი",
  expired: "ვადა გასულია",
  stopped: "შეჩერებული",
  draft: "მონახაზი",
}

const statusClasses: Record<AdminAdStatus, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-800",
  scheduled: "border-sky-200 bg-sky-50 text-sky-800",
  expired: "border-neutral-200 bg-neutral-100 text-neutral-700",
  stopped: "border-amber-200 bg-amber-50 text-amber-900",
  draft: "border-neutral-200 bg-white text-neutral-700",
}

function flashMessage(value: string) {
  switch (value) {
    case "created": return "რეკლამა მონახაზად შეინახა. საიტზე გამოსაჩენად დააჭირე „გაშვება 7 დღით“"
    case "updated": return "რეკლამის მონაცემები განახლდა"
    case "launched": return "რეკლამა გაეშვა და ზუსტად 7 დღეში ავტომატურად შეწყვეტს ჩვენებას"
    case "stopped": return "რეკლამის ჩვენება შეჩერებულია"
    case "invalid_advertiser": return "შეავსე რეკლამის დამკვეთის სახელი (მაქსიმუმ 120 სიმბოლო)"
    case "invalid_title": return "შეავსე სწორი სათაური (მაქსიმუმ 120 სიმბოლო)"
    case "invalid_description": return "აღწერა არ უნდა აღემატებოდეს 280 სიმბოლოს"
    case "invalid_placement": return "აირჩიე რეკლამის სწორი ადგილი"
    case "invalid_target": return "მიუთითე სრული http/https ბმული ან უსაფრთხო შიდა ბმული"
    case "invalid_priority": return "პრიორიტეტი უნდა იყოს მთელი რიცხვი -1000-დან 1000-მდე"
    case "image_size": return "სურათი უნდა იყოს 3 MB-ზე ნაკლები"
    case "image_type": return "სურათის ფორმატი უნდა იყოს JPEG, PNG ან WEBP"
    case "upload_failed": return "სურათი ვერ აიტვირთა. მონაცემები არ შეცვლილა"
    case "save_failed": return "რეკლამა ვერ შეინახა. სცადე ხელახლა"
    case "not_found": return "რეკლამა ვერ მოიძებნა"
    case "invalid_id": return "რეკლამის იდენტიფიკატორი არასწორია"
    default: return ""
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "—"
  return new Intl.DateTimeFormat("ka-GE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tbilisi",
  }).format(date)
}

export default async function AdminAdsPage({ searchParams }: { searchParams?: Promise<AdminAdsSearchParams> }) {
  const params = (await searchParams) ?? {}
  const editId = typeof params.edit === "string" && isAdId(params.edit) ? params.edit : null
  const flashCode = typeof params.flash === "string" ? params.flash : ""
  const flash = flashMessage(flashCode)

  const { user } = await requireAdminUser("/dashboard")
  const admin = createAdminClient()
  const [{ data, error }, { data: eventCounts, error: eventCountsError }] = await Promise.all([
    admin
      .from("ads")
      .select("id, placement_key, title, description, image_url, target_url, is_active, starts_at, ends_at, priority, advertiser_name, created_at, updated_at")
      .order("created_at", { ascending: false }),
    admin.rpc("get_admin_ad_event_counts_service", { p_actor_id: user.id }),
  ])

  const ads = (data ?? []) as AdminAdRow[]
  const eventCountMap = new Map(
    ((eventCounts ?? []) as AdEventCountRow[]).map((row) => [
      row.ad_id,
      { impressions: Number(row.impressions) || 0, clicks: Number(row.clicks) || 0 },
    ]),
  )
  const editingAd = editId ? ads.find((ad) => ad.id === editId) ?? null : null

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">ადმინისტრირება</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">რეკლამების მართვა</h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              შეინახე რეკლამა მონახაზად, გადაამოწმე მონაცემები და შემდეგ გაუშვი. ყოველი გაშვება ზუსტად 7 დღეა და ვადის გასვლის შემდეგ რეკლამა ავტომატურად ქრება საჯარო გვერდებიდან.
            </p>
          </div>
          <Link href="/admin" className="ui-btn-secondary">ადმინისტრირების მთავარი</Link>
        </div>
      </section>

      {flash ? (
        <div role="status" aria-live="polite" className={`mt-6 rounded-[1.2rem] border px-4 py-3 text-sm ${flashCode.startsWith("invalid_") || flashCode.endsWith("failed") || flashCode === "not_found" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {flash}
        </div>
      ) : null}

      {error || eventCountsError ? (
        <div role="alert" className="mt-6 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error ? "რეკლამების სია ვერ ჩაიტვირთა" : "ნახვებისა და დაჭერების სტატისტიკა დროებით ვერ ჩაიტვირთა"}. სცადე გვერდის განახლება
        </div>
      ) : null}

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="ui-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="ui-eyebrow">{editingAd ? "რედაქტირება" : "ახალი რეკლამა"}</div>
              <h2 className="mt-2 text-2xl font-black text-text">{editingAd ? editingAd.title : "რეკლამის მონაცემები"}</h2>
            </div>
            {editingAd ? <Link href="/admin/ads" className="ui-btn-secondary">ახლის დამატება</Link> : null}
          </div>

          <form action={saveAdminAdAction} encType="multipart/form-data" className="mt-6 space-y-5">
            <input type="hidden" name="adId" value={editingAd?.id ?? ""} />

            <div>
              <label htmlFor="advertiserName" className="mb-2 block text-sm font-semibold text-text">დამკვეთი / ბრენდი *</label>
              <input id="advertiserName" name="advertiserName" required maxLength={120} defaultValue={editingAd?.advertiser_name ?? ""} className="ui-input" placeholder="მაგ: ბრენდი XYZ" />
            </div>
            <div>
              <label htmlFor="adTitle" className="mb-2 block text-sm font-semibold text-text">სათაური *</label>
              <input id="adTitle" name="title" required maxLength={120} defaultValue={editingAd?.title ?? ""} className="ui-input" placeholder="მოკლე სარეკლამო სათაური" />
            </div>
            <div>
              <label htmlFor="adDescription" className="mb-2 block text-sm font-semibold text-text">აღწერა</label>
              <textarea id="adDescription" name="description" maxLength={280} defaultValue={editingAd?.description ?? ""} className="min-h-28 w-full rounded-[1rem] border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand-soft/70" placeholder="მაქსიმუმ 280 სიმბოლო" />
            </div>
            <div>
              <label htmlFor="placementKey" className="mb-2 block text-sm font-semibold text-text">საიტზე განთავსების ადგილი *</label>
              <select id="placementKey" name="placementKey" required defaultValue={editingAd?.placement_key ?? "home_hero_left"} className="ui-input">
                {ADMIN_AD_PLACEMENTS.map((placement) => <option key={placement.key} value={placement.key}>{placement.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="targetUrl" className="mb-2 block text-sm font-semibold text-text">რეკლამის ბმული *</label>
              <input id="targetUrl" name="targetUrl" required maxLength={2048} defaultValue={editingAd?.target_url ?? ""} className="ui-input" placeholder="https://example.ge/offer" />
              <p className="mt-2 text-xs leading-5 text-text-soft">გარე ბმული აუცილებლად დაიწყე https://-ით. დაჭერები ჩაითვლება არსებული პირველი მხარის tracking-ით</p>
            </div>
            <div>
              <label htmlFor="priority" className="mb-2 block text-sm font-semibold text-text">პრიორიტეტი</label>
              <input id="priority" name="priority" type="number" min={-1000} max={1000} step={1} defaultValue={editingAd?.priority ?? 0} className="ui-input" />
              <p className="mt-2 text-xs leading-5 text-text-soft">ერთსა და იმავე ადგილზე რამდენიმე აქტიური რეკლამისას უფრო დიდი რიცხვი იმარჯვებს</p>
            </div>
            <div>
              <label htmlFor="adImage" className="mb-2 block text-sm font-semibold text-text">სურათი {editingAd?.image_url ? "(ახალი ფაილი ძველს ჩაანაცვლებს)" : ""}</label>
              <input id="adImage" name="image" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full rounded-[1rem] border border-line bg-white px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-brand-soft file:px-4 file:py-2 file:font-semibold file:text-brand" />
              <p className="mt-2 text-xs leading-5 text-text-soft">JPEG, PNG ან WEBP · მაქსიმუმ 850 KB. რეკომენდებულია ჰორიზონტალური სურათი</p>
            </div>

            {editingAd?.image_url ? (
              <SmartImage src={editingAd.image_url} alt={editingAd.title || "რეკლამის სურათი"} wrapperClassName="aspect-[16/7] w-full overflow-hidden rounded-[1.25rem] border border-line bg-surface-alt" className="object-cover" fallbackLabel="სურათი ვერ ჩაიტვირთა" />
            ) : null}

            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <AdminAdSubmitButton>{editingAd ? "ცვლილებების შენახვა" : "მონახაზად შენახვა"}</AdminAdSubmitButton>
              <span className="text-xs leading-5 text-text-soft">შენახვა რეკლამას ავტომატურად არ გაუშვებს</span>
            </div>
          </form>
        </div>

        <div>
          <div className="mb-4">
            <div className="ui-eyebrow">სარეკლამო სია</div>
            <h2 className="mt-2 text-2xl font-black text-text">ყველა რეკლამა ({ads.length})</h2>
          </div>

          <div className="space-y-4">
            {ads.length > 0 ? ads.map((ad) => {
              const status = getAdminAdStatus(ad)
              const eventCount = eventCountMap.get(ad.id) ?? { impressions: 0, clicks: 0 }
              return (
                <article key={ad.id} className="ui-card overflow-hidden p-5 sm:p-6">
                  <div className="grid gap-5 sm:grid-cols-[9rem_minmax(0,1fr)]">
                    <SmartImage src={ad.image_url} alt={ad.title || "რეკლამა"} wrapperClassName="aspect-[4/3] w-full overflow-hidden rounded-[1.2rem] border border-line bg-surface-alt sm:aspect-square" className="object-cover" fallbackLabel="სურათი არ არის" loading="lazy" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClasses[status]}`}>{statusLabels[status]}</span>
                        <span className="text-xs font-semibold text-text-soft">პრიორიტეტი {ad.priority}</span>
                      </div>
                      <h3 className="mt-3 truncate text-xl font-black text-text">{ad.title || "უსათაურო რეკლამა"}</h3>
                      <p className="mt-1 truncate text-sm font-semibold text-brand">{ad.advertiser_name || "—"}</p>
                      <p className="mt-2 text-xs leading-5 text-text-soft">{AD_PLACEMENT_LABELS[ad.placement_key] ?? ad.placement_key}</p>
                      <dl className="mt-4 grid gap-2 text-xs text-text-soft sm:grid-cols-2">
                        <div className="rounded-xl bg-surface-alt px-3 py-2"><dt className="font-semibold text-text">დაწყება</dt><dd className="mt-1">{formatDateTime(ad.starts_at)}</dd></div>
                        <div className="rounded-xl bg-surface-alt px-3 py-2"><dt className="font-semibold text-text">დასრულება</dt><dd className="mt-1">{formatDateTime(ad.ends_at)}</dd></div>
                        <div className="rounded-xl bg-surface-alt px-3 py-2"><dt className="font-semibold text-text">ჩვენება</dt><dd className="mt-1 text-base font-black text-brand">{eventCount.impressions}</dd></div>
                        <div className="rounded-xl bg-surface-alt px-3 py-2"><dt className="font-semibold text-text">დაჭერა</dt><dd className="mt-1 text-base font-black text-brand">{eventCount.clicks}</dd></div>
                      </dl>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link href={`/admin/ads?edit=${encodeURIComponent(ad.id)}`} className="ui-btn-secondary">რედაქტირება</Link>
                        {status === "active" || status === "scheduled" ? (
                          <form action={stopAdminAdAction}>
                            <input type="hidden" name="adId" value={ad.id} />
                            <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-amber-300 bg-amber-50 px-5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100">შეჩერება</button>
                          </form>
                        ) : (
                          <form action={launchAdminAdAction}>
                            <input type="hidden" name="adId" value={ad.id} />
                            <button className="ui-btn-primary">{status === "draft" ? "გაშვება 7 დღით" : "ხელახლა 7 დღით"}</button>
                          </form>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              )
            }) : (
              <div className="ui-card border-dashed px-6 py-10 text-sm leading-7 text-text-soft">
                რეკლამა ჯერ არ არის. შეავსე ფორმა, შეინახე მონახაზად და შემდეგ გაუშვი 7 დღით
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
