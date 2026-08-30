"use client"

import { useEffect, useMemo, useState } from "react"
import { getCatalogSizeLabels } from "@/lib/marketplace-options"

export type CatalogFilterValues = {
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

export type CatalogFilterOptions = {
  categories: Array<{ slug: string; name: string }>
  brands: string[]
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

const sortOptions = [
  { value: "latest", label: "ახლახან დამატებული" },
  { value: "popular", label: "პოპულარული" },
  { value: "price_asc", label: "ფასი: დაბლიდან მაღლა" },
  { value: "price_desc", label: "ფასი: მაღლიდან დაბლა" },
  { value: "vip", label: "VIP და გამორჩეული" },
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
  const [selectedSize, setSelectedSize] = useState(values.size)

  useEffect(() => {
    setSelectedCategory(values.category)
    setSelectedSize(values.size)
  }, [values.category, values.size])

  const availableSizes = useMemo(
    () => getCatalogSizeLabels(
      options.sizes,
      selectedCategory,
      values.gender,
      selectedCategory === values.category ? values.size : "",
    ),
    [options.sizes, selectedCategory, values.category, values.gender, values.size],
  )

  function handleCategoryChange(nextCategory: string) {
    const nextSizes = getCatalogSizeLabels(options.sizes, nextCategory, values.gender, "")
    setSelectedCategory(nextCategory)
    if (selectedSize && !nextSizes.includes(selectedSize)) setSelectedSize("")
  }

  return (
    <div className={mobile ? "space-y-4" : "grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7"}>
      <label className="block min-w-0">
        <span className="mb-1.5 block text-xs font-bold text-text-soft">კატეგორია</span>
        <select
          name="category"
          value={selectedCategory}
          onChange={(event) => handleCategoryChange(event.target.value)}
          className="ui-input"
        >
          <option value="">ყველა კატეგორია</option>
          {options.categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
        </select>
      </label>

      <SelectField label="ბრენდი" name="brand" value={values.brand}>
        <option value="">ყველა ბრენდი</option>
        {options.brands.map((item) => <option key={item} value={item}>{item}</option>)}
      </SelectField>

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
      <SelectField label="დალაგება" name="sort" value={values.sort || "latest"}>
        {sortOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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

      {values.gender ? <input type="hidden" name="gender" value={values.gender} /> : null}
    </div>
  )
}
