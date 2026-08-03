import Link from "next/link"
import CatalogFilterFields, {
  type CatalogFilterOptions,
  type CatalogFilterValues,
} from "@/components/listings/CatalogFilterFields"
import MobileFiltersDrawer from "@/components/listings/MobileFiltersDrawer"
import { getCatalogItemLabel } from "@/lib/catalog-taxonomy"
import { ka } from "@/lib/i18n/ka"

type FilterKey = keyof CatalogFilterValues

function buildCatalogHref(values: CatalogFilterValues) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value && !(key === "sort" && value === "latest")) params.set(key, value)
  }
  const query = params.toString()
  return query ? `/catalog?${query}` : "/catalog"
}

export default function CatalogLandingFilters({
  categories,
  brands,
  sizes,
  colors,
  cities,
  values,
}: CatalogFilterOptions & { values: CatalogFilterValues }) {
  const options = { categories, brands, sizes, colors, cities }
  const chips: Array<{ key: FilterKey | "price"; label: string }> = []
  if (values.category) chips.push({ key: "category", label: getCatalogItemLabel(values.category) })
  if (values.brand) chips.push({ key: "brand", label: values.brand })
  if (values.size) chips.push({ key: "size", label: `ზომა ${values.size}` })
  if (values.condition) chips.push({ key: "condition", label: values.condition })
  if (values.city) chips.push({ key: "city", label: values.city })
  if (values.color) chips.push({ key: "color", label: values.color })
  if (values.vip === "1") chips.push({ key: "vip", label: "VIP" })
  if (values.min_price || values.max_price) chips.push({ key: "price", label: `${values.min_price || "0"}–${values.max_price || "∞"} ₾` })
  const activeCount = chips.length

  return (
    <section aria-label="კატალოგის ფილტრები" className="mt-6">
      <MobileFiltersDrawer options={options} values={values} activeCount={activeCount} />

      <form action="/catalog" className="ui-card hidden p-4 lg:block">
        <div className="mb-4 flex items-end gap-3">
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block text-xs font-bold text-text-soft">ძებნა</span>
            <input
              type="search"
              name="q"
              defaultValue={values.q}
              placeholder={ka.nav.searchPlaceholder}
              className="ui-input"
            />
          </label>
          <button type="submit" className="ui-btn-primary shrink-0">{ka.catalog.apply}</button>
          <Link href="/catalog" className="ui-btn-secondary shrink-0">{ka.catalog.clear}</Link>
        </div>
        <CatalogFilterFields options={options} values={values} />
      </form>

      {chips.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2" aria-label="აქტიური ფილტრები">
          {chips.map((chip) => {
            const nextValues = { ...values }
            if (chip.key === "price") {
              nextValues.min_price = ""
              nextValues.max_price = ""
            } else {
              nextValues[chip.key] = chip.key === "sort" ? "latest" : ""
            }
            return (
              <Link
                key={`${chip.key}-${chip.label}`}
                href={buildCatalogHref(nextValues)}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-brand/20 bg-brand-soft/55 px-4 text-xs font-bold text-brand transition hover:bg-brand-soft"
                aria-label={`${chip.label} ფილტრის მოხსნა`}
              >
                {chip.label}<span aria-hidden="true">×</span>
              </Link>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
