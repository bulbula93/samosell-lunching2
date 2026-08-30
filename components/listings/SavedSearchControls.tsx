import Link from "next/link"
import { saveCatalogSearchAction } from "@/app/catalog/saved-search-actions"
import type { CatalogFilterValues } from "@/components/listings/CatalogFilterFields"

const SAVED_FILTER_KEYS: Array<keyof CatalogFilterValues> = [
  "q",
  "category",
  "item_type",
  "brand",
  "size",
  "color",
  "city",
  "condition",
  "gender",
  "vip",
  "min_price",
  "max_price",
]

function statusMessage(status?: string) {
  switch (status) {
    case "saved":
      return "ძებნა შენახულია — ახალ შესაბამის განცხადებაზე შეტყობინებას მიიღებ."
    case "limit":
      return "მაქსიმუმ 20 შენახული ძებნა შეგიძლია გქონდეს. წაშალე ან გამორთე ძველი ძებნა."
    case "invalid":
      return "ფილტრებში მონაცემები არასწორია. გადაამოწმე ფასის დიაპაზონი."
    case "error":
      return "ძებნა ვერ შეინახა. სცადე ხელახლა."
    case "empty":
      return "ჯერ აირჩიე მინიმუმ ერთი ფილტრი."
    default:
      return ""
  }
}

export default function SavedSearchControls({
  values,
  signedIn,
  canSave,
  savedExists,
  savedActive,
  status,
}: {
  values: CatalogFilterValues
  signedIn: boolean
  canSave: boolean
  savedExists: boolean
  savedActive: boolean
  status?: string
}) {
  const message = statusMessage(status)

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-black text-text">ძებნის შეტყობინება</p>
        <p className="mt-1 text-xs leading-5 text-text-soft">
          შეინახე მიმდინარე ფილტრები და ახალი შესაბამისი განცხადების დამატებისას SAMOSELL შეგატყობინებს.
        </p>
        {message ? (
          <p className={`mt-2 text-xs font-bold ${status === "saved" ? "text-brand" : "text-red-700"}`}>
            {message}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {!canSave ? (
          <span className="rounded-xl bg-surface-alt px-4 py-2.5 text-xs font-bold text-text-soft">
            აირჩიე მინიმუმ ერთი ფილტრი
          </span>
        ) : !signedIn ? (
          <Link href="/login" className="ui-btn-secondary min-h-10 px-4 py-2 text-sm">
            შედი და შეინახე
          </Link>
        ) : savedActive ? (
          <>
            <span className="rounded-xl bg-brand-soft px-4 py-2.5 text-xs font-black text-brand">
              ✓ შეტყობინება ჩართულია
            </span>
            <Link href="/dashboard/saved-searches" className="ui-btn-ghost min-h-10 px-3 py-2 text-sm">
              მართვა
            </Link>
          </>
        ) : (
          <>
            <form action={saveCatalogSearchAction}>
              {SAVED_FILTER_KEYS.map((key) => (
                <input key={key} type="hidden" name={key} value={values[key]} />
              ))}
              <button type="submit" className="ui-btn-primary min-h-10 px-4 py-2 text-sm">
                {savedExists ? "შეტყობინების ჩართვა" : "☆ ძებნის შენახვა"}
              </button>
            </form>
            {savedExists ? (
              <Link href="/dashboard/saved-searches" className="ui-btn-ghost min-h-10 px-3 py-2 text-sm">
                მართვა
              </Link>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
