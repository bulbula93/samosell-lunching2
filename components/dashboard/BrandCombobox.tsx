"use client"

import { useMemo } from "react"
import { POPULAR_BRAND_NAMES } from "@/lib/popular-brands"

export type BrandOption = {
  id: string
  name?: string
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ")
}

export default function BrandCombobox({
  id,
  brands,
  brandId,
  customBrand,
  onChange,
  error,
  extraSuggestions = [],
}: {
  id: string
  brands: BrandOption[]
  brandId: string
  customBrand: string
  onChange: (next: { brandId: string; customBrand: string }) => void
  error?: string
  extraSuggestions?: readonly string[]
}) {
  const knownBrands = useMemo(
    () =>
      brands
        .map((brand) => ({ id: brand.id, name: String(brand.name ?? "").trim() }))
        .filter((brand) => brand.name),
    [brands],
  )

  const selectedKnown = knownBrands.find((brand) => brand.id === brandId)
  const value = selectedKnown?.name ?? customBrand

  const suggestions = useMemo(() => {
    const seen = new Set<string>()
    const next: string[] = []

    for (const name of [...extraSuggestions, ...POPULAR_BRAND_NAMES, ...knownBrands.map((brand) => brand.name)]) {
      const key = normalize(name)
      if (!key || seen.has(key)) continue
      seen.add(key)
      next.push(name)
    }

    return next
  }, [extraSuggestions, knownBrands])

  function handleChange(nextValue: string) {
    const normalized = normalize(nextValue)
    const exact = knownBrands.find((brand) => normalize(brand.name) === normalized)

    if (exact) {
      onChange({ brandId: exact.id, customBrand: "" })
      return
    }

    onChange({ brandId: "", customBrand: nextValue })
  }

  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-text-soft">ბრენდი</span>
      <input
        id={id}
        list={`${id}-suggestions`}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        placeholder="აირჩიე ან ჩაწერე ბრენდი"
        autoComplete="off"
        className={`ui-input ${error ? "border-red-400 focus:border-red-500 focus:ring-red-100" : ""}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        maxLength={80}
      />
      <datalist id={`${id}-suggestions`}>
        {suggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <span className="mt-1.5 block text-[11px] leading-5 text-text-soft">
        აირჩიე სიიდან ან ჩაწერე სხვა ბრენდი ხელით.
      </span>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </label>
  )
}
