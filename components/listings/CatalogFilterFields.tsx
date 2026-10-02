"use client"

import { useMemo, useState } from "react"
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

const conditionOptions = [
  { value: "", label: "ყველა მდგომარეობა" },
  { value: "new", label: "ახალი" },
  { value: "like_new", label: "თითქმის ახალი" },
  { value: "good", label: "კარგი" },
  { value: "fair", label: "დამაკმაყოფილებელი" },
] as const

const perfumeConditionOptions = [
  { value: "", label: "ყველა მდგომარეობა" },
  { value: "new", label: "ახალი / გაუხსნელი" },
  { value: "like_new", label: "გახსნილი, თითქმის სავსე" },
  { value: "good", label: "გამოყენებული" },
  { value: "fair", label: "ნაწილობრივ დარჩენილი" },
] as const

const sortOptions = [
  { value: "latest", label: "ახლახან დამატებული" },
  { value: "popular", label: "პოპულარული" },
  { value: "price_asc", label: "ფასი: დაბლიდან მაღლა" },
  { value: "price_desc", label: "ფასი: მაღლიდან დაბლა" },
  { value: "vip", label: "VIP და გამორჩეული" },
] as const

const relevanceSortOption = {
  value: "relevance",
  label: "ყველაზე შესაბამისი",
} as const

const SPECIAL_SIZE_CATEGORIES = new Set(["footwear", "bags", "accessories"])


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

function SelectField({
  label,
  name,
  value,
  children,
}: {
  label: string
  name: string
  value: string
  children: React.ReactNode
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-text-soft">{label}</span>
      <select name={name} defaultValue={value} className="ui-input">
        {children}
      </select>
    </label>
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
  const [selectedCategory, setSelectedCategory] = useState(values.category)
  const [selectedItemType, setSelectedItemType] = useState(values.item_type)
  const [selectedSize, setSelectedSize] = useState(values.size)

  const categoryOptions = useMemo(() => {
    if (options.categories.some((item) => item.slug === "perfume")) return options.categories
    const next = [...options.categories]
    const accessoriesIndex = next.findIndex((item) => item.slug === "accessories")
    const perfumeOption = { slug: "perfume", name: "პარფიუმერია" }
    if (accessoriesIndex >= 0) next.splice(accessoriesIndex + 1, 0, perfumeOption)
    else next.push(perfumeOption)
    return next
  }, [options.categories])

  const availableItemTypes = useMemo(
    () => getCatalogItemOptionsForSection(selectedCategory),
    [selectedCategory],
  )

  const selectedGender = categoryGender(selectedCategory) || values.gender
  const selectedSizeCategory = sizeCategory(selectedCategory, selectedItemType)
  const availableSortOptions = values.q
    ? [relevanceSortOption, ...sortOptions]
    : sortOptions

  const availableSizes = useMemo(() => {
    if (selectedCategory === "perfume") {
      const valuesToShow = [...PERFUME_VOLUMES]
      if (selectedSize && !valuesToShow.includes(selectedSize as typeof PERFUME_VOLUMES[number])) {
        valuesToShow.push(selectedSize as typeof PERFUME_VOLUMES[number])
      }
      return valuesToShow
    }

    return getCatalogSizeLabels(
      options.sizes,
      selectedSizeCategory,
      selectedGender,
      selectedCategory === values.category && selectedItemType === values.item_type ? values.size : "",
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

  function handleCategoryChange(nextCategory: string) {
    const nextItemTypes = getCatalogItemOptionsForSection(nextCategory)
    const nextItemType = selectedItemType && nextItemTypes.some((item) => item.value === selectedItemType)
      ? selectedItemType
      : ""
    const nextGender = categoryGender(nextCategory)
    const nextSizes: string[] = nextCategory === "perfume"
      ? [...PERFUME_VOLUMES]
      : getCatalogSizeLabels(
          options.sizes,
          sizeCategory(nextCategory, nextItemType),
          nextGender,
          "",
        )

    setSelectedCategory(nextCategory)
    setSelectedItemType(nextItemType)
    if (selectedSize && !nextSizes.includes(selectedSize)) setSelectedSize("")
  }

  function handleItemTypeChange(nextItemType: string) {
    const nextSizes: string[] = selectedCategory === "perfume"
      ? [...PERFUME_VOLUMES]
      : getCatalogSizeLabels(
          options.sizes,
          sizeCategory(selectedCategory, nextItemType),
          categoryGender(selectedCategory),
          "",
        )

    setSelectedItemType(nextItemType)
    if (selectedSize && !nextSizes.includes(selectedSize)) setSelectedSize("")
  }

  const categoryField = (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-text-soft">კატეგორია</span>
      <select
        name="category"
        value={selectedCategory}
        onChange={(event) => handleCategoryChange(event.target.value)}
        className="ui-input"
      >
        <option value="">ყველა კატეგორია</option>
        {categoryOptions.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
      </select>
    </label>
  )

  if (selectedCategory === "perfume") {
    const perfumeBrands = values.brand && !PERFUME_BRAND_NAMES.includes(values.brand as (typeof PERFUME_BRAND_NAMES)[number])
      ? [values.brand, ...PERFUME_BRAND_NAMES]
      : PERFUME_BRAND_NAMES

    return (
      <div className={mobile ? "space-y-4" : "grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6"}>
        <input type="hidden" name="category" value="perfume" />

        <SelectField label="ვისთვისაა" name="gender" value={values.gender}>
          <option value="">ყველა</option>
          <option value="women">ქალებისთვის</option>
          <option value="men">მამაკაცებისთვის</option>
          <option value="unisex">უნისექსი</option>
        </SelectField>

        <label className="block min-w-0">
          <span className="mb-1.5 block text-xs font-bold text-text-soft">კონცენტრაცია</span>
          <select
            name="item_type"
            value={selectedItemType}
            onChange={(event) => handleItemTypeChange(event.target.value)}
            className="ui-input"
          >
            <option value="">ყველა ტიპი</option>
            {availableItemTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>

        <SelectField label="ბრენდი" name="brand" value={values.brand}>
          <option value="">ყველა ბრენდი</option>
          {perfumeBrands.map((item) => <option key={item} value={item}>{item}</option>)}
        </SelectField>

        <label className="block min-w-0">
          <span className="mb-1.5 block text-xs font-bold text-text-soft">მოცულობა</span>
          <select
            name="size"
            value={selectedSize}
            onChange={(event) => setSelectedSize(event.target.value)}
            className="ui-input"
          >
            <option value="">ყველა მოცულობა</option>
            {availableSizes.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>

        <SelectField label="მდგომარეობა" name="condition" value={values.condition}>
          {perfumeConditionOptions.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
        </SelectField>

        <SelectField label="მდებარეობა" name="city" value={values.city}>
          <option value="">ყველა ქალაქი</option>
          {options.cities.map((item) => <option key={item} value={item}>{item}</option>)}
        </SelectField>

        <SelectField
          label="დალაგება"
          name="sort"
          value={values.sort || (values.q ? "relevance" : "latest")}
        >
          {availableSortOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </SelectField>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-text-soft">მინ. ფასი</span>
          <input name="min_price" type="number" min="0" step="1" defaultValue={values.min_price} placeholder="0 ₾" className="ui-input" />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-text-soft">მაქს. ფასი</span>
          <input name="max_price" type="number" min="0" step="1" defaultValue={values.max_price} placeholder="5000 ₾" className="ui-input" />
        </label>

        <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-line bg-white px-4 text-sm font-semibold text-text">
          <input type="checkbox" name="vip" value="1" defaultChecked={values.vip === "1"} className="h-5 w-5 accent-brand" />
          მხოლოდ VIP
        </label>

      </div>
    )
  }

  return (
    <div className={mobile ? "space-y-4" : "grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7"}>
      {categoryField}

      <label className="block min-w-0">
        <span className="mb-1.5 block text-xs font-bold text-text-soft">ნივთის ტიპი</span>
        <select
          name="item_type"
          value={selectedItemType}
          onChange={(event) => handleItemTypeChange(event.target.value)}
          className="ui-input"
        >
          <option value="">ყველა ტიპი</option>
          {availableItemTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>

      <label className="block min-w-0">
        <span className="mb-1.5 block text-xs font-bold text-text-soft">ზომა</span>
        <select
          name="size"
          value={selectedSize}
          onChange={(event) => setSelectedSize(event.target.value)}
          className="ui-input"
        >
          <option value="">ყველა ზომა</option>
          {availableSizes.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>

      <SelectField label="მდგომარეობა" name="condition" value={values.condition}>
        {conditionOptions.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
      </SelectField>
      <SelectField label="მდებარეობა" name="city" value={values.city}>
        <option value="">ყველა ქალაქი</option>
        {options.cities.map((item) => <option key={item} value={item}>{item}</option>)}
      </SelectField>
      <SelectField label="ფერი" name="color" value={values.color}>
        <option value="">ყველა ფერი</option>
        {options.colors.map((item) => <option key={item} value={item}>{item}</option>)}
      </SelectField>
      <SelectField
        label="დალაგება"
        name="sort"
        value={values.sort || (values.q ? "relevance" : "latest")}
      >
        {availableSortOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </SelectField>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-text-soft">მინ. ფასი</span>
        <input name="min_price" type="number" min="0" step="1" defaultValue={values.min_price} placeholder="0 ₾" className="ui-input" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-text-soft">მაქს. ფასი</span>
        <input name="max_price" type="number" min="0" step="1" defaultValue={values.max_price} placeholder="5000 ₾" className="ui-input" />
      </label>
      <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-line bg-white px-4 text-sm font-semibold text-text">
        <input type="checkbox" name="vip" value="1" defaultChecked={values.vip === "1"} className="h-5 w-5 accent-brand" />
        მხოლოდ VIP
      </label>
    </div>
  )
}
