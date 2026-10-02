"use client"

import { useMemo, useState, type ReactNode } from "react"
import { getCatalogItemOptionsForSection } from "@/lib/catalog-taxonomy"
import { getCatalogSizeLabels } from "@/lib/marketplace-options"
import { PERFUME_BRAND_NAMES } from "@/lib/perfume-brands"

export type CatalogFilterValues = {
  q: string
  category: string
  item_type: string
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

export type CatalogFilterOptions = {
  categories: Array<{ slug: string; name: string }>
  sizes: Array<{ label?: string | null; group_name?: string | null }>
  colors: string[]
  cities: string[]
}

type PlayfulOption = { value: string; label: string }
type SelectIconKind = "brand" | "city" | "sort" | "item" | "size" | "color"

const conditionOptions: PlayfulOption[] = [
  { value: "", label: "ყველა" },
  { value: "new", label: "ახალი" },
  { value: "like_new", label: "თითქმის ახალი" },
  { value: "good", label: "კარგი" },
  { value: "fair", label: "დამაკმაყოფილებელი" },
]

const perfumeConditionOptions: PlayfulOption[] = [
  { value: "", label: "ყველა" },
  { value: "new", label: "ახალი / გაუხსნელი" },
  { value: "like_new", label: "გახსნილი, თითქმის სავსე" },
  { value: "good", label: "გამოყენებული" },
  { value: "fair", label: "ნაწილობრივ დარჩენილი" },
]

const sortOptions: PlayfulOption[] = [
  { value: "latest", label: "ახლახან დამატებული" },
  { value: "popular", label: "პოპულარული" },
  { value: "price_asc", label: "ფასი: დაბლიდან მაღლა" },
  { value: "price_desc", label: "ფასი: მაღლიდან დაბლა" },
  { value: "vip", label: "VIP და გამორჩეული" },
]

const relevanceSortOption: PlayfulOption = {
  value: "relevance",
  label: "ყველაზე შესაბამისი",
}

const SPECIAL_SIZE_CATEGORIES = new Set(["footwear", "bags", "accessories"])
const FIXED_TYPE_CATEGORIES = new Set(["footwear", "bags", "vintage", "accessories"])

const PERFUME_VOLUMES = [
  "15 ml",
  "30 ml",
  "50 ml",
  "75 ml",
  "100 ml",
  "125 ml",
  "150 ml",
  "200 ml",
] as const

function FilterLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-2 block text-xs font-black uppercase tracking-[0.08em] text-brand/80">
      {children}
    </span>
  )
}

function PillGroup({
  name,
  value,
  onChange,
  options,
  tone = "green",
  compact = false,
}: {
  name: string
  value: string
  onChange: (value: string) => void
  options: readonly PlayfulOption[]
  tone?: "green" | "orange"
  compact?: boolean
}) {
  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value || "all"}
              type="button"
              onClick={() => onChange(option.value)}
              className={`${compact ? "min-h-9 px-3 py-1.5 text-xs" : "min-h-10 px-4 py-2 text-sm"} rounded-full border font-black transition ${
                active
                  ? tone === "orange"
                    ? "border-[#f2a36a] bg-[#fff0e4] text-[#b75217] shadow-[0_5px_14px_rgba(232,109,19,0.12)]"
                    : "border-brand/25 bg-[#e7f5f0] text-brand shadow-[0_5px_14px_rgba(7,90,83,0.10)]"
                  : "border-[#e2e9e6] bg-white text-text-soft hover:-translate-y-0.5 hover:border-brand/20 hover:text-brand"
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SelectIcon({ kind }: { kind: SelectIconKind }) {
  if (kind === "brand") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 8.5 8.5 4H19a1 1 0 0 1 1 1v10.5L15.5 20H5a1 1 0 0 1-1-1V8.5Z" strokeLinejoin="round" />
        <circle cx="16" cy="8" r="1.3" />
      </svg>
    )
  }

  if (kind === "city") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" />
        <circle cx="12" cy="10" r="2" />
      </svg>
    )
  }

  if (kind === "item") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 5 5 7.5 7.5 11 10 9.5V20h4V9.5l2.5 1.5L19 7.5 16 5l-2 1h-4L8 5Z" strokeLinejoin="round" />
      </svg>
    )
  }

  if (kind === "size") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 17 17 4l3 3L7 20l-3-3Z" strokeLinejoin="round" />
        <path d="m11 10 3 3m-6 0 3 3m3-9 3 3" />
      </svg>
    )
  }

  if (kind === "color") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3a9 9 0 1 0 0 18h1.2a1.8 1.8 0 0 0 1.1-3.2 1.8 1.8 0 0 1 1.1-3.2H18A3 3 0 0 0 21 12a9 9 0 0 0-9-9Z" />
        <circle cx="7.5" cy="10" r="1" fill="currentColor" />
        <circle cx="10" cy="6.8" r="1" fill="currentColor" />
        <circle cx="14" cy="7" r="1" fill="currentColor" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 4v16M8 4 5 7M8 4l3 3M16 20V4m0 16-3-3m3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlayfulSelect({
  label,
  name,
  value,
  onChange,
  options,
  icon,
}: {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  options: readonly PlayfulOption[]
  icon: SelectIconKind
}) {
  const selected = options.find((option) => option.value === value) ?? options[0]

  return (
    <div className="min-w-0">
      <FilterLabel>{label}</FilterLabel>
      <input type="hidden" name={name} value={value} />

      <details className="group relative">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-2xl border border-[#dfe8e4] bg-white px-4 text-sm font-black text-brand shadow-[0_5px_16px_rgba(7,63,59,0.05)] transition hover:-translate-y-0.5 hover:border-brand/25 [&::-webkit-details-marker]:hidden">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#edf8f4] text-brand">
            <SelectIcon kind={icon} />
          </span>
          <span className="min-w-0 flex-1 truncate">{selected?.label ?? "აირჩიე"}</span>
          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="m5 7 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>

        <div className="absolute left-0 right-0 z-50 mt-2 max-h-64 overflow-y-auto rounded-[20px] border border-[#dfe8e4] bg-white p-2 shadow-[0_18px_45px_rgba(7,63,59,0.16)]">
          {options.map((option) => {
            const active = option.value === value
            return (
              <button
                key={option.value || "all"}
                type="button"
                onClick={(event) => {
                  onChange(option.value)
                  event.currentTarget.closest("details")?.removeAttribute("open")
                }}
                className={`flex min-h-10 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-bold transition ${
                  active
                    ? "bg-[#e9f6f2] text-brand"
                    : "text-text-soft hover:bg-[#fff7ef] hover:text-[#b75217]"
                }`}
              >
                <span className="truncate">{option.label}</span>
                {active ? <span className="ml-3 text-brand">✓</span> : null}
              </button>
            )
          })}
        </div>
      </details>
    </div>
  )
}

function categoryGender(category: string) {
  return category === "women" || category === "men" || category === "kids" ? category : ""
}

function sizeCategory(category: string, itemType: string) {
  if (itemType) return itemType
  return SPECIAL_SIZE_CATEGORIES.has(category) ? category : ""
}

export default function CatalogFilterFields({
  options,
  values,
  mobile = false,
}: {
  options: CatalogFilterOptions
  values: CatalogFilterValues
  mobile?: boolean
}) {
  const selectedCategory = values.category
  const [selectedItemType, setSelectedItemType] = useState(values.item_type)
  const [selectedSize, setSelectedSize] = useState(values.size)
  const [selectedGenderFilter, setSelectedGenderFilter] = useState(values.gender)
  const [selectedBrandFilter, setSelectedBrandFilter] = useState(values.brand)
  const [selectedConditionFilter, setSelectedConditionFilter] = useState(values.condition)
  const [selectedCityFilter, setSelectedCityFilter] = useState(values.city)
  const [selectedColorFilter, setSelectedColorFilter] = useState(values.color)
  const [selectedSortFilter, setSelectedSortFilter] = useState(
    values.sort || (values.q ? "relevance" : "latest"),
  )

  const availableItemTypes = useMemo(
    () => getCatalogItemOptionsForSection(selectedCategory),
    [selectedCategory],
  )

  const selectedGender = categoryGender(selectedCategory) || selectedGenderFilter
  const selectedSizeCategory = sizeCategory(selectedCategory, selectedItemType)
  const availableSortOptions = values.q
    ? [relevanceSortOption, ...sortOptions]
    : sortOptions

  const availableSizes = useMemo(() => {
    if (selectedCategory === "perfume") {
      const valuesToShow = [...PERFUME_VOLUMES]
      if (
        selectedSize &&
        !valuesToShow.includes(selectedSize as (typeof PERFUME_VOLUMES)[number])
      ) {
        valuesToShow.push(selectedSize as (typeof PERFUME_VOLUMES)[number])
      }
      return valuesToShow
    }

    return getCatalogSizeLabels(
      options.sizes,
      selectedSizeCategory,
      selectedGender,
      selectedCategory === values.category &&
        selectedItemType === values.item_type
        ? values.size
        : "",
    )
  }, [
    options.sizes,
    selectedCategory,
    selectedGender,
    selectedItemType,
    selectedSize,
    selectedSizeCategory,
    values.category,
    values.item_type,
    values.size,
  ])


  function handleItemTypeChange(nextItemType: string) {
    const nextSizes: string[] =
      selectedCategory === "perfume"
        ? [...PERFUME_VOLUMES]
        : getCatalogSizeLabels(
            options.sizes,
            sizeCategory(selectedCategory, nextItemType),
            categoryGender(selectedCategory) || selectedGenderFilter,
            "",
          )

    setSelectedItemType(nextItemType)

    if (selectedSize && !nextSizes.includes(selectedSize)) {
      setSelectedSize("")
    }
  }

  function handleGenderChange(nextGender: string) {
    setSelectedGenderFilter(nextGender)

    if (selectedCategory !== "footwear") return

    const nextSizes = getCatalogSizeLabels(
      options.sizes,
      sizeCategory(selectedCategory, selectedItemType),
      nextGender,
      "",
    )

    if (selectedSize && !nextSizes.includes(selectedSize)) {
      setSelectedSize("")
    }
  }

  const cityOptions: PlayfulOption[] = [
    { value: "", label: "ყველა ქალაქი" },
    ...options.cities.map((item) => ({ value: item, label: item })),
  ]

  const colorOptions: PlayfulOption[] = [
    { value: "", label: "ყველა ფერი" },
    ...options.colors.map((item) => ({ value: item, label: item })),
  ]

  const sortSelectOptions: PlayfulOption[] = availableSortOptions.map((item) => ({
    value: item.value,
    label: item.label,
  }))

  const sizeOptions: PlayfulOption[] = [
    { value: "", label: selectedCategory === "footwear" ? "ყველა ზომა" : "ყველა" },
    ...availableSizes.map((item) => ({ value: item, label: item })),
  ]

  const itemTypeOptions: PlayfulOption[] = [
    { value: "", label: "ყველა ტიპი" },
    ...availableItemTypes.map((item) => ({
      value: item.value,
      label: item.label,
    })),
  ]

  if (selectedCategory === "perfume") {
    const perfumeBrands =
      values.brand &&
      !PERFUME_BRAND_NAMES.includes(
        values.brand as (typeof PERFUME_BRAND_NAMES)[number],
      )
        ? [values.brand, ...PERFUME_BRAND_NAMES]
        : PERFUME_BRAND_NAMES

    const audienceOptions: PlayfulOption[] = [
      { value: "", label: "ყველა" },
      { value: "women", label: "ქალებისთვის" },
      { value: "men", label: "მამაკაცებისთვის" },
      { value: "unisex", label: "უნისექსი" },
    ]

    const concentrationOptions: PlayfulOption[] = [
      { value: "", label: "ყველა ტიპი" },
      ...availableItemTypes.map((item) => ({
        value: item.value,
        label: item.label,
      })),
    ]

    const brandOptions: PlayfulOption[] = [
      { value: "", label: "ყველა ბრენდი" },
      ...perfumeBrands.map((item) => ({ value: item, label: item })),
    ]

    return (
      <div className="space-y-5">
        <input type="hidden" name="category" value="perfume" />

        <div className="grid gap-5 rounded-[26px] border border-[#e3ece8] bg-[#fbfdfc] p-4 sm:p-5 xl:grid-cols-2">
          <div>
            <FilterLabel>ვისთვისაა</FilterLabel>
            <PillGroup
              name="gender"
              value={selectedGenderFilter}
              onChange={handleGenderChange}
              options={audienceOptions}
            />
          </div>

          <div>
            <FilterLabel>კონცენტრაცია</FilterLabel>
            <PillGroup
              name="item_type"
              value={selectedItemType}
              onChange={handleItemTypeChange}
              options={concentrationOptions}
              tone="orange"
            />
          </div>
        </div>

        <div className="rounded-[26px] border border-[#f1dfcf] bg-[#fffaf5] p-4 sm:p-5">
          <FilterLabel>მოცულობა</FilterLabel>
          <PillGroup
            name="size"
            value={selectedSize}
            onChange={setSelectedSize}
            options={sizeOptions}
            tone="orange"
          />
        </div>

        <div className={mobile ? "grid gap-4" : "grid gap-4 md:grid-cols-3"}>
          <PlayfulSelect
            label="ბრენდი"
            name="brand"
            value={selectedBrandFilter}
            onChange={setSelectedBrandFilter}
            options={brandOptions}
            icon="brand"
          />
          <PlayfulSelect
            label="მდებარეობა"
            name="city"
            value={selectedCityFilter}
            onChange={setSelectedCityFilter}
            options={cityOptions}
            icon="city"
          />
          <PlayfulSelect
            label="დალაგება"
            name="sort"
            value={selectedSortFilter}
            onChange={setSelectedSortFilter}
            options={sortSelectOptions}
            icon="sort"
          />
        </div>

        <div>
          <FilterLabel>მდგომარეობა</FilterLabel>
          <PillGroup
            name="condition"
            value={selectedConditionFilter}
            onChange={setSelectedConditionFilter}
            options={perfumeConditionOptions}
          />
        </div>

        <PriceAndVip
          values={values}
          mobile={mobile}
        />
      </div>
    )
  }

  const showItemType = !FIXED_TYPE_CATEGORIES.has(selectedCategory)
  const useSizePills = availableSizes.length > 0 && availableSizes.length <= 10
  const footwearAudienceOptions: PlayfulOption[] = [
    { value: "", label: "ყველა" },
    { value: "women", label: "ქალის" },
    { value: "men", label: "კაცის" },
    { value: "unisex", label: "უნისექსი" },
  ]

  return (
    <div className="space-y-5">
      <input type="hidden" name="category" value={selectedCategory} />

      {selectedCategory === "footwear" ? (
        <div className="rounded-[26px] border border-[#e3ece8] bg-[#fbfdfc] p-4 sm:p-5">
          <FilterLabel>ვისთვისაა</FilterLabel>
          <PillGroup
            name="gender"
            value={selectedGenderFilter}
            onChange={handleGenderChange}
            options={footwearAudienceOptions}
            compact={mobile}
          />
        </div>
      ) : null}

      <div className={mobile ? "grid gap-4" : "grid gap-4 md:grid-cols-2 xl:grid-cols-4"}>
        {showItemType ? (
          <PlayfulSelect
            label="ნივთის ტიპი"
            name="item_type"
            value={selectedItemType}
            onChange={handleItemTypeChange}
            options={itemTypeOptions}
            icon="item"
          />
        ) : (
          <input type="hidden" name="item_type" value="" />
        )}

        {!useSizePills ? (
          <PlayfulSelect
            label={selectedCategory === "footwear" ? "ფეხსაცმლის ზომა" : "ზომა"}
            name="size"
            value={selectedSize}
            onChange={setSelectedSize}
            options={sizeOptions}
            icon="size"
          />
        ) : null}

        <PlayfulSelect
          label="მდებარეობა"
          name="city"
          value={selectedCityFilter}
          onChange={setSelectedCityFilter}
          options={cityOptions}
          icon="city"
        />

        <PlayfulSelect
          label="ფერი"
          name="color"
          value={selectedColorFilter}
          onChange={setSelectedColorFilter}
          options={colorOptions}
          icon="color"
        />

        <PlayfulSelect
          label="დალაგება"
          name="sort"
          value={selectedSortFilter}
          onChange={setSelectedSortFilter}
          options={sortSelectOptions}
          icon="sort"
        />
      </div>

      {useSizePills ? (
        <div className="rounded-[26px] border border-[#f1dfcf] bg-[#fffaf5] p-4 sm:p-5">
          <FilterLabel>
            {selectedCategory === "footwear" ? "ფეხსაცმლის ზომა" : "ზომა"}
          </FilterLabel>
          <PillGroup
            name="size"
            value={selectedSize}
            onChange={setSelectedSize}
            options={sizeOptions}
            tone="orange"
            compact={mobile}
          />
        </div>
      ) : null}

      <div>
        <FilterLabel>მდგომარეობა</FilterLabel>
        <PillGroup
          name="condition"
          value={selectedConditionFilter}
          onChange={setSelectedConditionFilter}
          options={conditionOptions}
          compact={mobile}
        />
      </div>

      <PriceAndVip
        values={values}
        mobile={mobile}
      />
    </div>
  )
}

function PriceAndVip({
  values,
  mobile,
}: {
  values: CatalogFilterValues
  mobile: boolean
}) {
  return (
    <div
      className={
        mobile
          ? "grid gap-3"
          : "grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]"
      }
    >
      <label className="block">
        <FilterLabel>მინ. ფასი</FilterLabel>
        <input
          name="min_price"
          type="number"
          min="0"
          step="1"
          defaultValue={values.min_price}
          placeholder="0 ₾"
          className="ui-input rounded-2xl border-[#dfe8e4] bg-white"
        />
      </label>

      <label className="block">
        <FilterLabel>მაქს. ფასი</FilterLabel>
        <input
          name="max_price"
          type="number"
          min="0"
          step="1"
          defaultValue={values.max_price}
          placeholder="5000 ₾"
          className="ui-input rounded-2xl border-[#dfe8e4] bg-white"
        />
      </label>

      <label className="flex min-h-12 items-center gap-3 self-end rounded-2xl border border-[#e3ece8] bg-white px-4 text-sm font-black text-brand shadow-[0_5px_16px_rgba(7,63,59,0.05)]">
        <input
          type="checkbox"
          name="vip"
          value="1"
          defaultChecked={values.vip === "1"}
          className="h-5 w-5 accent-brand"
        />
        მხოლოდ VIP
      </label>
    </div>
  )
}
