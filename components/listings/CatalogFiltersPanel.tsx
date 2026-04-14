"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { getCatalogItemLabel, getCatalogItemOptions } from "@/lib/catalog-taxonomy"

type Option = {
  slug?: string | null
  name?: string | null
}

type CatalogFiltersPanelProps = {
  categories: Option[]
  brands: string[]
  sizes: string[]
  cities: string[]
  values: {
    q: string
    category: string
    brand: string
    size: string
    city: string
    condition: string
    gender: string
    vip: string
    sort: string
  }
  totalCount: number
}

type CityGroup = {
  label: string
  options: string[]
}

const FALLBACK_FASHION_BRANDS = [
  "Abercrombie & Fitch", "adidas", "Aldo", "Alexander McQueen", "American Eagle", "Armani", "ASICS", "Balenciaga", "Bershka", "Bogner",
  "Bottega Veneta", "Burberry", "Calvin Klein", "Carhartt", "Celine", "Champion", "Chanel", "Columbia", "Converse", "COS",
  "Crocs", "Desigual", "Diesel", "Dior", "DKNY", "Dolce & Gabbana", "Dr. Martens", "Fendi", "Fila", "Fred Perry",
  "Gap", "Geox", "Giorgio Armani", "Givenchy", "Gucci", "H&M", "Helly Hansen", "Hermès", "Hugo Boss", "Intimissimi",
  "Jordan", "Kappa", "Karl Lagerfeld", "Kenzo", "Lacoste", "Levi's", "Liu Jo", "Louis Vuitton", "Mango", "Marc Jacobs",
  "Massimo Dutti", "Max Mara", "Michael Kors", "Moncler", "Moschino", "Mudo", "Napapijri", "New Balance", "New Yorker", "Next",
  "Nike", "Oysho", "Patagonia", "Polo Ralph Lauren", "Prada", "Pull&Bear", "Puma", "Reebok", "Reserved", "River Island",
  "Russell Athletic", "S.Oliver", "Saint Laurent", "Salomon", "Sandro", "Stradivarius", "Superdry", "The North Face", "Timberland", "Tom Ford",
  "Tommy Hilfiger", "Topshop", "Under Armour", "Uniqlo", "Vans", "Versace", "Victoria's Secret", "Zadig & Voltaire", "Zara", "Zegna",
  "Aritzia", "Bimba y Lola", "Maje", "Skechers", "UGG", "Valentino", "Weekend Max Mara", "Wrangler", "Guess", "Marella",
]

const GEORGIA_MAJOR_CITIES = [
  "თბილისი", "ბათუმი", "ქუთაისი", "რუსთავი", "გორი", "ზუგდიდი", "ფოთი", "თელავი", "ახალციხე", "ოზურგეთი", "მცხეთა", "ამბროლაური",
]

const GEORGIA_REGIONAL_CENTERS = [
  "ახალქალაქი", "ბოლნისი", "ბორჯომი", "გარდაბანი", "გურჯაანი", "დედოფლისწყარო", "დუშეთი", "კასპი", "ლაგოდეხი", "მარნეული", "ონი", "საგარეჯო",
  "სამტრედია", "სენაკი", "სიღნაღი", "სტეფანწმინდა", "ტყიბული", "ტყუარჩალი", "ქარელი", "ქობულეთი", "ყაზბეგი", "ყვარელი",
  "ცაგერი", "წყალტუბო", "ჭიათურა", "ხაშური", "ხელვაჩაური", "ხობი",
]

function fieldClassName() {
  return "ui-input h-11 rounded-[1rem]"
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map(normalizeLabel).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ka"))
}

function buildCatalogHref(nextValues: CatalogFiltersPanelProps["values"]) {
  const params = new URLSearchParams()
  ;(Object.entries(nextValues) as Array<[keyof CatalogFiltersPanelProps["values"], string]>).forEach(([key, value]) => {
    if (!value) return
    if (key === "sort" && value === "latest") return
    params.set(key, value)
  })
  const query = params.toString()
  return query ? `/catalog?${query}` : "/catalog"
}

function getActiveLabel(key: keyof CatalogFiltersPanelProps["values"], value: string) {
  if (!value) return ""
  const genderLabels: Record<string, string> = { women: "ქალები", men: "კაცები", unisex: "უნისექსი", kids: "ბავშვები" }
  const conditionLabels: Record<string, string> = { new: "ახალი", like_new: "თითქმის ახალი", good: "კარგი", fair: "საშუალო" }
  const sortLabels: Record<string, string> = {
    latest: "რეკომენდებული",
    price_asc: "ფასი: იაფიდან",
    price_desc: "ფასი: ძვირიდან",
    vip: "ჯერ VIP",
  }

  switch (key) {
    case "q":
      return `ძებნა: ${value}`
    case "category":
      return `კატეგორია: ${getCatalogItemLabel(value)}`
    case "brand":
      return `ბრენდი: ${value}`
    case "size":
      return `ზომა: ${value}`
    case "city":
      return `ქალაქი: ${value}`
    case "condition":
      return `მდგომარეობა: ${conditionLabels[value] ?? value}`
    case "gender":
      return `სექცია: ${genderLabels[value] ?? value}`
    case "vip":
      return "მხოლოდ VIP"
    case "sort":
      return `სორტირება: ${sortLabels[value] ?? value}`
    default:
      return value
  }
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

function buildBrandOptions(brands: string[]) {
  return uniqueSorted([...FALLBACK_FASHION_BRANDS, ...brands]).slice(0, 100)
}

function FiltersFormFields({
  brands,
  sizes,
  cities,
  values,
}: Pick<CatalogFiltersPanelProps, "brands" | "sizes" | "cities" | "values">) {
  const brandOptions = useMemo(() => buildBrandOptions(brands), [brands])
  const cityGroups = useMemo(() => buildCityGroups(cities), [cities])
  const [selectedGender, setSelectedGender] = useState(values.gender)
  const [selectedCategory, setSelectedCategory] = useState(values.category)
  const itemOptions = useMemo(() => getCatalogItemOptions(selectedGender), [selectedGender])
  const categoryValue = useMemo(() => {
    if (!selectedCategory) return ""
    return itemOptions.some((item) => item.value === selectedCategory) ? selectedCategory : ""
  }, [itemOptions, selectedCategory])

  function handleGenderChange(nextGender: string) {
    setSelectedGender(nextGender)
    const nextOptions = getCatalogItemOptions(nextGender)
    setSelectedCategory((current) => (nextOptions.some((item) => item.value === current) ? current : ""))
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_1.15fr_1fr_1fr]">
        <input type="search" name="q" defaultValue={values.q} placeholder="ძებნა სათაურში, ბრენდში ან აღწერაში" className={fieldClassName()} />
        <select name="gender" value={selectedGender} onChange={(event) => handleGenderChange(event.target.value)} className={fieldClassName()}>
          <option value="">ყველა სექცია</option>
          <option value="women">ქალები</option>
          <option value="men">კაცები</option>
          <option value="unisex">უნისექსი</option>
          <option value="kids">ბავშვები</option>
        </select>
        <select name="category" value={categoryValue} onChange={(event) => setSelectedCategory(event.target.value)} className={fieldClassName()}>
          <option value="">ტანსაცმლის კატეგორია</option>
          {selectedGender === "women" ? <optgroup label="ქალების პოპულარული კატეგორიები">{itemOptions.map((item) => (<option key={item.value} value={item.value}>{item.label}</option>))}</optgroup> : null}
          {selectedGender === "men" ? <optgroup label="კაცების პოპულარული კატეგორიები">{itemOptions.map((item) => (<option key={item.value} value={item.value}>{item.label}</option>))}</optgroup> : null}
          {selectedGender === "unisex" ? <optgroup label="უნისექსი კატეგორიები">{itemOptions.map((item) => (<option key={item.value} value={item.value}>{item.label}</option>))}</optgroup> : null}
          {selectedGender === "kids" ? <optgroup label="ბავშვის კატეგორიები">{itemOptions.map((item) => (<option key={item.value} value={item.value}>{item.label}</option>))}</optgroup> : null}
          {!selectedGender ? <optgroup label="პოპულარული კატეგორიები">{itemOptions.map((item) => (<option key={item.value} value={item.value}>{item.label}</option>))}</optgroup> : null}
        </select>
        <select name="size" defaultValue={values.size} className={fieldClassName()}>
          <option value="">ყველა ზომა</option>
          {sizes.map((item, index) => (
            <option key={`${item}-${index}`} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select name="condition" defaultValue={values.condition} className={fieldClassName()}>
          <option value="">ყველა მდგომარეობა</option>
          <option value="new">ახალი</option>
          <option value="like_new">თითქმის ახალი</option>
          <option value="good">კარგი მდგომარეობა</option>
          <option value="fair">საშუალო მდგომარეობა</option>
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1.1fr_1fr_auto_auto]">
        <select name="brand" defaultValue={values.brand} className={fieldClassName()}>
          <option value="">ყველა ბრენდი</option>
          <optgroup label="100 პოპულარული fashion ბრენდი">
            {brandOptions.map((item, index) => (
              <option key={`${item}-${index}`} value={item}>
                {item}
              </option>
            ))}
          </optgroup>
        </select>
        <select name="city" defaultValue={values.city} className={fieldClassName()}>
          <option value="">ყველა ქალაქი</option>
          {cityGroups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((item, index) => (
                <option key={`${item}-${index}`} value={item}>
                  {item}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <select name="sort" defaultValue={values.sort} className={fieldClassName()}>
          <option value="latest">რეკომენდებული</option>
          <option value="price_asc">ფასი: იაფიდან ძვირისკენ</option>
          <option value="price_desc">ფასი: ძვირიდან იაფისკენ</option>
          <option value="vip">ჯერ VIP</option>
        </select>
        <label className="flex h-11 items-center gap-3 rounded-[1rem] border border-line bg-white px-4 text-sm text-text-soft">
          <input type="checkbox" name="vip" value="1" defaultChecked={values.vip === "1"} />
          მხოლოდ VIP
        </label>
        <div className="flex gap-3">
          <button className="ui-btn-primary !rounded-[1rem] !px-6 !py-0 !h-11">ფილტრაცია</button>
          <Link href="/catalog" className="ui-btn-secondary !rounded-[1rem] !px-6 !py-0 !h-11">
            გასუფთავება
          </Link>
        </div>
      </div>
    </>
  )
}

export default function CatalogFiltersPanel(props: CatalogFiltersPanelProps) {
  const { totalCount, values, categories, cities } = props
  const [open, setOpen] = useState(false)

  const activeEntries = useMemo(
    () =>
      (Object.entries(values) as Array<[keyof CatalogFiltersPanelProps["values"], string]>).filter(([key, value]) => {
        if (!value) return false
        if (key === "sort" && value === "latest") return false
        return true
      }),
    [values]
  )

  const activeCount = activeEntries.length

  const quickPresetLinks = useMemo(() => {
    const firstCategory = categories.find((item) => item.slug && item.name)
    const firstCity = buildCityGroups(cities)[0]?.options[0]
    return [
      { label: "ყველა", href: "/catalog", active: activeCount === 0 },
      { label: "მხოლოდ VIP", href: buildCatalogHref({ ...values, vip: values.vip === "1" ? "" : "1" }), active: values.vip === "1" },
      { label: "ქალები", href: buildCatalogHref({ ...values, gender: values.gender === "women" ? "" : "women" }), active: values.gender === "women" },
      { label: "კაცები", href: buildCatalogHref({ ...values, gender: values.gender === "men" ? "" : "men" }), active: values.gender === "men" },
      { label: "ახალი ნივთები", href: buildCatalogHref({ ...values, condition: values.condition === "new" ? "" : "new" }), active: values.condition === "new" },
      firstCategory?.slug && firstCategory.name
        ? { label: firstCategory.name, href: buildCatalogHref({ ...values, category: values.category === firstCategory.slug ? "" : firstCategory.slug }), active: values.category === firstCategory.slug }
        : null,
      firstCity
        ? { label: `${firstCity}`, href: buildCatalogHref({ ...values, city: values.city === firstCity ? "" : firstCity }), active: values.city === firstCity }
        : null,
    ].filter(Boolean) as Array<{ label: string; href: string; active: boolean }>
  }, [activeCount, categories, cities, values])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <>
      <div className="hidden lg:block">
        <div className="ui-card rounded-[1.8rem] p-6">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {quickPresetLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${link.active ? "border border-brand bg-brand text-white" : "border border-line bg-surface-alt text-text-soft hover:border-brand/20 hover:bg-white hover:text-text"}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {activeCount > 0 ? (
            <div className="mb-5 flex flex-wrap items-center gap-2 rounded-[1.3rem] border border-line bg-surface-alt p-3">
              <div className="mr-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-soft">არჩეული</div>
              {activeEntries.map(([key, value]) => {
                const nextValues = { ...values, [key]: key === "sort" ? "latest" : "" }
                return (
                  <Link key={`${key}-${value}`} href={buildCatalogHref(nextValues)} className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-text-soft transition hover:text-text">
                    {getActiveLabel(key, value)} ×
                  </Link>
                )
              })}
            </div>
          ) : null}

          <div className="mb-4 rounded-[1.2rem] border border-line bg-surface-alt px-4 py-3 text-sm text-text-soft">
            კატეგორიები ახლა მიბმულია <span className="font-semibold text-text">სექციაზე</span>: თუ აირჩევ „კაცები“-ს, კაბა და ქალის სპეციფიკური კატეგორიები აღარ გამოჩნდება. ქალაქები ისევ დაყოფილია <span className="font-semibold text-text">მთავარ ქალაქებად</span> და <span className="font-semibold text-text">რეგიონულ ცენტრებად</span>.
          </div>

          <form className="space-y-4">
            <FiltersFormFields {...props} />
          </form>
        </div>
      </div>

      <div className="lg:hidden">
        <div className="ui-card rounded-[1.6rem] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-text">{totalCount} შედეგი</div>
              <div className="mt-1 text-xs text-text-soft">{activeCount > 0 ? `${activeCount} აქტიური ფილტრი` : "ფილტრების გარეშე"}</div>
            </div>
            <button type="button" onClick={() => setOpen(true)} className="ui-btn-secondary !px-4 !py-2">
              ფილტრები
            </button>
          </div>

          <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {quickPresetLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${link.active ? "border border-brand bg-brand text-white" : "border border-line bg-surface-alt text-text-soft"}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {activeCount > 0 ? (
            <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {activeEntries.map(([key, value]) => {
                const nextValues = { ...values, [key]: key === "sort" ? "latest" : "" }
                return (
                  <Link key={`${key}-${value}`} href={buildCatalogHref(nextValues)} className="shrink-0 rounded-full border border-line bg-white px-3 py-2 text-sm font-semibold text-text-soft">
                    {getActiveLabel(key, value)} ×
                  </Link>
                )
              })}
            </div>
          ) : null}
        </div>

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-4">
          <div className="pointer-events-auto mx-auto flex max-w-7xl items-center gap-3 rounded-full border border-line bg-white/95 p-2 shadow-[0_16px_36px_rgba(16,24,40,0.14)] backdrop-blur">
            <button type="button" onClick={() => setOpen(true)} className="ui-btn-primary flex-1 !px-4 !py-3">
              ფილტრები{activeCount > 0 ? ` · ${activeCount}` : ""}
            </button>
            <Link href="/catalog" className="ui-btn-secondary !px-4 !py-3">
              გასუფთავება
            </Link>
          </div>
        </div>

        {open ? (
          <div className="fixed inset-0 z-40 bg-black/45">
            <button type="button" aria-label="Close" className="absolute inset-0 h-full w-full" onClick={() => setOpen(false)} />
            <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[2rem] bg-bg p-4 shadow-2xl">
              <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-neutral-300" />
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-black text-text">ფილტრები</div>
                  <div className="text-sm text-text-soft">ლოგიკა ახლა ასეთია: ჯერ სექცია, მერე შესაბამისი ტანსაცმლის კატეგორია, შემდეგ ზომა, მდგომარეობა, ბრენდი და ქალაქი.</div>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="ui-btn-secondary !px-4 !py-2">
                  დახურვა
                </button>
              </div>

              <div className="mb-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {quickPresetLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${link.active ? "border border-brand bg-brand text-white" : "border border-line bg-white text-text-soft"}`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <form className="space-y-4 pb-4">
                <FiltersFormFields {...props} />
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
