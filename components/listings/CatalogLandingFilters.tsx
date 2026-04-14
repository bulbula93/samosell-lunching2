"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { getCatalogItemLabel, getCatalogItemOptions } from "@/lib/catalog-taxonomy"

type Option = {
  slug?: string | null
  name?: string | null
}

type CatalogLandingFiltersProps = {
  categories: Option[]
  brands: string[]
  sizes: string[]
  colors: string[]
  cities: string[]
  values: {
    q: string
    category: string
    brand: string
    size: string
    color: string
    city: string
    condition: string
    gender: string
    vip: string
    sort: string
    min_price: string
    max_price: string
  }
}

type CityGroup = {
  label: string
  options: string[]
}

type DropdownKey = "gender" | "category" | "size" | "city" | "price" | "sort" | null

type FilterKey = keyof CatalogLandingFiltersProps["values"]

const GEORGIA_MAJOR_CITIES = [
  "თბილისი", "ბათუმი", "ქუთაისი", "რუსთავი", "გორი", "ზუგდიდი", "ფოთი", "თელავი", "ახალციხე", "ოზურგეთი", "მცხეთა", "ამბროლაური",
]

const GEORGIA_REGIONAL_CENTERS = [
  "ახალქალაქი", "ბოლნისი", "ბორჯომი", "გარდაბანი", "გურჯაანი", "დედოფლისწყარო", "დუშეთი", "კასპი", "ლაგოდეხი", "მარნეული", "ონი", "საგარეჯო",
  "სამტრედია", "სენაკი", "სიღნაღი", "სტეფანწმინდა", "ტყიბული", "ქარელი", "ქობულეთი", "ყვარელი", "ცაგერი", "წყალტუბო", "ჭიათურა", "ხაშური", "ხობი",
]

const conditionLabels: Record<string, string> = {
  new: "ახალი ნივთები",
  like_new: "თითქმის ახალი",
  good: "კარგი მდგომარეობა",
  fair: "საშუალო მდგომარეობა",
}

const genderLabels: Record<string, string> = {
  women: "ქალებისთვის",
  men: "მამაკაცებისთვის",
  kids: "ბავშვებისთვის",
  unisex: "სხვა",
}

const sortOptions = [
  { value: "latest", label: "სორტირება" },
  { value: "price_asc", label: "ფასი ↑" },
  { value: "price_desc", label: "ფასი ↓" },
  { value: "vip", label: "ჯერ VIP" },
] as const

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map(normalizeLabel).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ka"))
}

function buildCityGroups(cities: string[]): CityGroup[] {
  const merged = uniqueSorted([...GEORGIA_MAJOR_CITIES, ...GEORGIA_REGIONAL_CENTERS, ...cities])
  const majorSet = new Set(GEORGIA_MAJOR_CITIES)
  const regionalSet = new Set(GEORGIA_REGIONAL_CENTERS)
  const major = merged.filter((city) => majorSet.has(city))
  const regional = merged.filter((city) => regionalSet.has(city) && !majorSet.has(city))
  const other = merged.filter((city) => !majorSet.has(city) && !regionalSet.has(city))
  return [
    { label: "მთავარი ქალაქები", options: major },
    { label: "რეგიონული ცენტრები", options: regional },
    { label: "სხვა ქალაქები", options: other },
  ].filter((group) => group.options.length > 0)
}

function buildCategoryOptions(categories: Option[]) {
  return categories.filter((item) => item.slug && item.name).map((item) => ({ value: String(item.slug), label: String(item.name) }))
}

function buildCatalogHref(values: CatalogLandingFiltersProps["values"]) {
  const params = new URLSearchParams()
  const entries = Object.entries(values) as Array<[FilterKey, string]>
  for (const [key, value] of entries) {
    if (!value) continue
    if (key === "sort" && value === "latest") continue
    params.set(key, value)
  }
  const query = params.toString()
  return query ? `/catalog?${query}` : "/catalog"
}

function filterChipClass(light = false) {
  return light
    ? "inline-flex h-9 items-center gap-2 rounded-[8px] bg-[#EAEAEA] px-3 text-[14px] font-normal leading-5 text-[#2C2C2C]"
    : "inline-flex h-9 items-center gap-2 rounded-[8px] bg-[#2C2C2C] px-3 text-[14px] font-normal leading-5 text-white"
}

function FilterButton({
  label,
  active,
  open,
  onClick,
  widthClass,
}: {
  label: string
  active?: boolean
  open?: boolean
  onClick: () => void
  widthClass: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex h-12 items-center justify-between gap-4 rounded-[24px] border px-6 text-left text-[16px] font-medium leading-6 text-[#3C4043] transition",
        widthClass,
        active || open
          ? "border-[#F88A51] bg-[rgba(248,138,81,0.16)] shadow-[0_2px_0_rgba(248,138,81,0.04)]"
          : "border-[rgba(46,49,52,0.29)] bg-white hover:border-[#9FA2A5]",
      ].join(" ")}
      aria-expanded={open}
    >
      <span className="truncate">{label}</span>
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${active || open ? "bg-white/70" : "bg-white"}`}>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`h-5 w-5 text-[#555] transition ${open ? "rotate-180" : ""}`}>
          <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  )
}

function MenuOptionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-[12px] px-4 py-3 text-left text-[16px] font-medium leading-6 text-[#3C4043] transition hover:bg-white"
    >
      <span>{label}</span>
    </button>
  )
}

function SortMenuButton({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-[12px] px-4 py-3 text-left text-[16px] font-medium leading-6 transition ${active ? "bg-[rgba(248,138,81,0.16)] text-[#2E3134]" : "text-[#3C4043] hover:bg-white"}`}
    >
      <span>{label}</span>
      {active ? (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4 text-[#F88A51]">
          <path d="M5 12.5L9.2 16.7L19 6.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </button>
  )
}

export default function CatalogLandingFilters({ categories, sizes, cities, values }: CatalogLandingFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const rootRef = useRef<HTMLDivElement | null>(null)

  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null)
  const [minPriceDraft, setMinPriceDraft] = useState(values.min_price)
  const [maxPriceDraft, setMaxPriceDraft] = useState(values.max_price)

  const toggleDropdown = useCallback(
    (key: Exclude<DropdownKey, null>) => {
      setOpenDropdown((current) => {
        const nextValue = current === key ? null : key
        if (nextValue === "price") {
          setMinPriceDraft(values.min_price)
          setMaxPriceDraft(values.max_price)
        }
        return nextValue
      })
    },
    [values.max_price, values.min_price]
  )

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) return
      if (event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setOpenDropdown(null)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenDropdown(null)
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [])

  const cityGroups = useMemo(() => buildCityGroups(cities), [cities])
  const fallbackCategoryOptions = useMemo(() => buildCategoryOptions(categories), [categories])
  const categoryOptions = useMemo(() => {
    const byGender = getCatalogItemOptions(values.gender)
    return byGender.length > 0 ? byGender.map((item) => ({ value: item.value, label: item.label })) : fallbackCategoryOptions
  }, [fallbackCategoryOptions, values.gender])

  const activeChips = useMemo(() => {
    const items: Array<{ key: FilterKey | "price"; label: string; light?: boolean }> = []
    if (values.gender) items.push({ key: "gender", label: genderLabels[values.gender] ?? values.gender })
    if (values.category) items.push({ key: "category", label: getCatalogItemLabel(values.category) })
    if (values.brand) items.push({ key: "brand", label: values.brand })
    if (values.size) items.push({ key: "size", label: values.size })
    if (values.city) items.push({ key: "city", label: values.city })
    if (values.condition) items.push({ key: "condition", label: conditionLabels[values.condition] ?? values.condition })
    if (values.vip === "1") items.push({ key: "vip", label: "VIP" })
    if (values.min_price || values.max_price) {
      const min = values.min_price || "0"
      const max = values.max_price || "∞"
      items.push({ key: "price", label: `${min}-${max} ₾` })
    }
    if (values.q) items.push({ key: "q", label: `ძებნა: ${values.q}`, light: true })
    return items
  }, [values])

  const clearHref = values.q ? `/catalog?q=${encodeURIComponent(values.q)}` : "/catalog"

  const pushValues = useCallback(
    (updates: Partial<CatalogLandingFiltersProps["values"]>) => {
      const params = new URLSearchParams(searchParams.toString())
      const merged = { ...values, ...updates }
      const keys = Object.keys(merged) as FilterKey[]
      for (const key of keys) {
        const value = merged[key]
        if (!value || (key === "sort" && value === "latest")) params.delete(key)
        else params.set(key, value)
      }
      params.delete("page")
      const query = params.toString()
      router.push(query ? `${pathname}?${query}` : pathname)
    },
    [pathname, router, searchParams, values]
  )

  const selectValue = useCallback(
    (key: FilterKey, value: string) => {
      const updates: Partial<CatalogLandingFiltersProps["values"]> = { [key]: value } as Partial<CatalogLandingFiltersProps["values"]>
      if (key === "gender" && value !== values.gender) {
        updates.category = ""
      }
      if (key === "condition" && value === "new") {
        // no-op, kept for parity if needed later
      }
      pushValues(updates)
      setOpenDropdown(null)
    },
    [pushValues, values.gender]
  )

  const toggleCheckbox = useCallback(
    (key: FilterKey, checked: boolean) => {
      if (key === "vip") {
        pushValues({ vip: checked ? "1" : "" })
        return
      }
      if (key === "condition") {
        pushValues({ condition: checked ? "new" : "" })
      }
    },
    [pushValues]
  )

  const applyPrice = useCallback(() => {
    const min = minPriceDraft.replace(/[^\d]/g, "")
    const max = maxPriceDraft.replace(/[^\d]/g, "")
    pushValues({ min_price: min, max_price: max })
    setOpenDropdown(null)
  }, [maxPriceDraft, minPriceDraft, pushValues])

  const clearPrice = useCallback(() => {
    setMinPriceDraft("")
    setMaxPriceDraft("")
    pushValues({ min_price: "", max_price: "" })
    setOpenDropdown(null)
  }, [pushValues])

  const categoryButtonLabel = values.gender ? genderLabels[values.gender] ?? "კატეგორია" : "კატეგორია"
  const subcategoryButtonLabel = values.category ? getCatalogItemLabel(values.category) : "ქვეკატეგორია"
  const sizeButtonLabel = values.size || "ზომა"
  const cityButtonLabel = values.city || "ქალაქი"
  const priceButtonLabel = values.min_price || values.max_price ? `ფასი ${values.min_price || "0"}-${values.max_price || "∞"} ₾` : "ფასი"
  const sortButtonLabel = sortOptions.find((item) => item.value === values.sort)?.label ?? "სორტირება"

  return (
    <div ref={rootRef} className="relative">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <FilterButton label={categoryButtonLabel} active={Boolean(values.gender)} open={openDropdown === "gender"} onClick={() => toggleDropdown("gender")} widthClass="min-w-[180px]" />
            {openDropdown === "gender" ? (
              <div className="absolute left-0 top-[calc(100%+12px)] z-30 w-[290px] rounded-[24px] border border-[#2E3134] bg-[#F5F5F5] p-4 shadow-[0_12px_28px_rgba(33,40,49,0.08)]">
                <div className="space-y-1">
                  <MenuOptionButton label="ქალებისთვის" onClick={() => selectValue("gender", "women")} />
                  <MenuOptionButton label="მამაკაცებისთვის" onClick={() => selectValue("gender", "men")} />
                  <MenuOptionButton label="ბავშვებისთვის" onClick={() => selectValue("gender", "kids")} />
                  <MenuOptionButton label="სხვა" onClick={() => selectValue("gender", "unisex")} />
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <FilterButton label={subcategoryButtonLabel} active={Boolean(values.category)} open={openDropdown === "category"} onClick={() => toggleDropdown("category")} widthClass="min-w-[180px]" />
            {openDropdown === "category" ? (
              <div className="absolute left-0 top-[calc(100%+12px)] z-30 max-h-[420px] w-[290px] overflow-y-auto rounded-[24px] border border-[#2E3134] bg-[#F5F5F5] p-4 shadow-[0_12px_28px_rgba(33,40,49,0.08)]">
                <div className="space-y-1">
                  {categoryOptions.map((item) => (
                    <MenuOptionButton key={item.value} label={item.label} onClick={() => selectValue("category", item.value)} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <FilterButton label={sizeButtonLabel} active={Boolean(values.size)} open={openDropdown === "size"} onClick={() => toggleDropdown("size")} widthClass="min-w-[140px]" />
            {openDropdown === "size" ? (
              <div className="absolute left-0 top-[calc(100%+12px)] z-30 max-h-[360px] w-[220px] overflow-y-auto rounded-[24px] border border-[#2E3134] bg-[#F5F5F5] p-4 shadow-[0_12px_28px_rgba(33,40,49,0.08)]">
                <div className="space-y-1">
                  {sizes.map((item) => (
                    <MenuOptionButton key={item} label={item} onClick={() => selectValue("size", item)} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <FilterButton label={cityButtonLabel} active={Boolean(values.city)} open={openDropdown === "city"} onClick={() => toggleDropdown("city")} widthClass="min-w-[180px]" />
            {openDropdown === "city" ? (
              <div className="absolute left-0 top-[calc(100%+12px)] z-30 max-h-[420px] w-[290px] overflow-y-auto rounded-[24px] border border-[#2E3134] bg-[#F5F5F5] p-4 shadow-[0_12px_28px_rgba(33,40,49,0.08)]">
                <div className="space-y-3">
                  {cityGroups.map((group) => (
                    <div key={group.label}>
                      <div className="px-4 pb-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-[#8A8A8A]">{group.label}</div>
                      <div className="space-y-1">
                        {group.options.map((item) => (
                          <MenuOptionButton key={item} label={item} onClick={() => selectValue("city", item)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <FilterButton label={priceButtonLabel} active={Boolean(values.min_price || values.max_price)} open={openDropdown === "price"} onClick={() => toggleDropdown("price")} widthClass="min-w-[180px] sm:min-w-[220px]" />
            {openDropdown === "price" ? (
              <div className="absolute left-0 top-[calc(100%+12px)] z-30 w-[388px] max-w-[calc(100vw-2rem)] rounded-[24px] border border-[#2E3134] bg-[#F5F5F5] p-5 shadow-[0_12px_28px_rgba(33,40,49,0.08)]">
                <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4">
                  <label className="block">
                    <span className="mb-2 block text-[14px] font-semibold leading-5 text-[#3C4043]">მინ ფასი</span>
                    <input
                      inputMode="numeric"
                      value={minPriceDraft}
                      onChange={(event) => setMinPriceDraft(event.target.value.replace(/[^\d]/g, ""))}
                      placeholder="0 ₾"
                      className="h-[70px] w-full rounded-[8px] border border-[rgba(46,49,52,0.45)] bg-white px-4 text-center text-[18px] font-medium text-[#81878C] outline-none placeholder:text-[#9AA0A6]"
                    />
                  </label>
                  <div className="pb-6 text-[32px] leading-none text-[#7A7A7A]">-</div>
                  <label className="block">
                    <span className="mb-2 block text-[14px] font-semibold leading-5 text-[#3C4043]">მაქს. ფასი</span>
                    <input
                      inputMode="numeric"
                      value={maxPriceDraft}
                      onChange={(event) => setMaxPriceDraft(event.target.value.replace(/[^\d]/g, ""))}
                      placeholder="5000 ₾"
                      className="h-[70px] w-full rounded-[8px] border border-[rgba(46,49,52,0.45)] bg-white px-4 text-center text-[18px] font-medium text-[#81878C] outline-none placeholder:text-[#9AA0A6]"
                    />
                  </label>
                </div>
                <div className="mt-6 flex items-center justify-end gap-4">
                  <button type="button" onClick={clearPrice} className="inline-flex h-[60px] items-center justify-center rounded-[16px] px-5 text-[16px] font-semibold text-[#3C4043] transition hover:bg-white">
                    განულება
                  </button>
                  <button type="button" onClick={applyPrice} className="inline-flex h-[60px] items-center justify-center rounded-[16px] border border-[#2E3134] bg-[#F88A51] px-7 text-[16px] font-semibold text-white transition hover:bg-[#ef7d46]">
                    დამატება
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3 self-start">
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleDropdown("sort")}
              className="inline-flex h-12 min-w-[170px] items-center justify-between gap-4 rounded-[24px] border border-[rgba(46,49,52,0.29)] bg-white px-6 text-left text-[16px] font-medium leading-6 text-[#2E3134] transition hover:border-[#9FA2A5]"
            >
              <span>{sortButtonLabel}</span>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`h-5 w-5 text-[#555] transition ${openDropdown === "sort" ? "rotate-180" : ""}`}>
                <path d="M12 4V20M12 20L6 14M12 20L18 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {openDropdown === "sort" ? (
              <div className="absolute right-0 top-[calc(100%+12px)] z-30 w-[220px] rounded-[24px] border border-[#2E3134] bg-[#F5F5F5] p-4 shadow-[0_12px_28px_rgba(33,40,49,0.08)]">
                {sortOptions.map((item) => (
                  <SortMenuButton key={item.value} label={item.label} active={(values.sort || "latest") === item.value} onClick={() => selectValue("sort", item.value)} />
                ))}
              </div>
            ) : null}
          </div>

          <Link href={clearHref} className="inline-flex h-12 items-center justify-center rounded-[24px] border border-[rgba(46,49,52,0.18)] bg-white px-6 text-[16px] font-medium leading-6 text-[#6D7278] transition hover:bg-[#F3F3F3]">
            გასუფთავება
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-6">
        <label className="inline-flex items-center gap-2 text-[16px] font-medium leading-6 text-[#2D2D2D]">
          <input
            type="checkbox"
            checked={values.vip === "1"}
            onChange={(event) => toggleCheckbox("vip", event.target.checked)}
            className="h-[18px] w-[18px] rounded-[4px] border border-[#9C9C9C] accent-[#F88A51]"
          />
          მხოლოდ <span className="font-bold text-[#E0A01E]">VIP</span>
        </label>

        <label className="inline-flex items-center gap-2 text-[16px] font-medium leading-6 text-[#2D2D2D]">
          <input
            type="checkbox"
            checked={values.condition === "new"}
            onChange={(event) => toggleCheckbox("condition", event.target.checked)}
            className="h-[18px] w-[18px] rounded-[4px] border border-[#9C9C9C] accent-[#F88A51]"
          />
          ახალი ნივთები
        </label>
      </div>

      {activeChips.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-3">
          {activeChips.map((chip) => {
            const nextValues = { ...values }
            if (chip.key === "price") {
              nextValues.min_price = ""
              nextValues.max_price = ""
            } else {
              nextValues[chip.key] = chip.key === "sort" ? "latest" : ""
            }
            return (
              <Link key={`${chip.key}-${chip.label}`} href={buildCatalogHref(nextValues)} className={filterChipClass(chip.light)}>
                <span>{chip.label}</span>
                <span className="text-base leading-none">×</span>
              </Link>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
