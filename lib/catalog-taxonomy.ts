export type CatalogItemOption = {
  value: string
  label: string
  genders: Array<"women" | "men" | "unisex" | "kids">
  keywords: string[]
}

export const TOP_LEVEL_CATEGORY_SLUGS = new Set(["women", "men", "accessories", "vintage"])

const CATALOG_ITEM_OPTIONS: CatalogItemOption[] = [
  { value: "tshirts", label: "მაისურები", genders: ["women", "men", "unisex", "kids"], keywords: ["მაისური", "tee", "t-shirt"] },
  { value: "tops", label: "ტოპები", genders: ["women"], keywords: ["ტოპი", "crop top", "body"] },
  { value: "blouses", label: "ბლუზები", genders: ["women"], keywords: ["ბლუზა"] },
  { value: "shirts", label: "პერანგები", genders: ["women", "men", "kids"], keywords: ["პერანგი", "shirt"] },
  { value: "polos", label: "პოლოები", genders: ["men", "kids"], keywords: ["პოლო", "polo"] },
  { value: "dresses", label: "კაბები", genders: ["women", "kids"], keywords: ["კაბა", "dress"] },
  { value: "skirts", label: "ქვედაბოლოები", genders: ["women", "kids"], keywords: ["ქვედაბოლო", "skirt"] },
  { value: "sweaters", label: "სვიტერები", genders: ["women", "men", "unisex", "kids"], keywords: ["სვიტერი", "knit", "knitwear"] },
  { value: "hoodies", label: "ჰუდები", genders: ["women", "men", "unisex", "kids"], keywords: ["ჰუდი", "hoodie"] },
  { value: "blazers", label: "ჟაკეტები და პიჯაკები", genders: ["women", "men"], keywords: ["ჟაკეტი", "პიჯაკი", "blazer"] },
  { value: "jackets", label: "ქურთუკები", genders: ["women", "men", "unisex", "kids"], keywords: ["ქურთუკი", "jacket"] },
  { value: "coats", label: "პალტოები", genders: ["women", "men", "kids"], keywords: ["პალტო", "coat", "ტრენჩი"] },
  { value: "jeans", label: "ჯინსები", genders: ["women", "men", "unisex", "kids"], keywords: ["ჯინსი", "jeans", "დენიმი"] },
  { value: "trousers", label: "შარვლები", genders: ["women", "men", "unisex", "kids"], keywords: ["შარვალი", "pants", "trousers"] },
  { value: "leggings", label: "ლეგინსები", genders: ["women", "kids"], keywords: ["ლეგინსი", "leggings"] },
  { value: "shorts", label: "შორტები", genders: ["women", "men", "unisex", "kids"], keywords: ["შორტი", "shorts"] },
  { value: "sportswear", label: "სპორტული ტანსაცმელი", genders: ["women", "men", "unisex", "kids"], keywords: ["სპორტული", "ტრენინგი", "სპორტული ტანსაცმელი"] },
  { value: "suits", label: "კოსტიუმები", genders: ["men", "women"], keywords: ["კოსტიუმი", "suit"] },
  { value: "underwear", label: "საცვლები და პიჟამო", genders: ["women", "men", "kids"], keywords: ["საცვალი", "თეთრეული", "პიჟამო", "lingerie"] },
  { value: "swimwear", label: "საცურაო ტანსაცმელი", genders: ["women", "men", "kids"], keywords: ["საცურაო", "swimwear", "ბიკინი"] },
  { value: "footwear", label: "ფეხსაცმელი", genders: ["women", "men", "unisex", "kids"], keywords: ["ფეხსაცმელი", "კედი", "ბოტასი", "sneakers", "boots"] },
  { value: "bags", label: "ჩანთები", genders: ["women", "men", "unisex", "kids"], keywords: ["ჩანთა", "bag", "backpack"] },
  { value: "accessories", label: "აქსესუარები", genders: ["women", "men", "unisex", "kids"], keywords: ["აქსესუარი", "ქამარი", "ბეჭედი", "სათვალე", "სამკაული"] },
  { value: "vintage", label: "ვინტაჟი", genders: ["women", "men", "unisex"], keywords: ["ვინტაჟი", "vintage"] },
  { value: "newborn", label: "ახალშობილის ტანსაცმელი", genders: ["kids"], keywords: ["ახალშობილი", "baby", "ბოდე"] },
  { value: "school-uniform", label: "სასკოლო ფორმა", genders: ["kids"], keywords: ["სასკოლო ფორმა", "uniform"] },
]

export function getCatalogItemOptions(gender?: string) {
  const normalized = gender === "women" || gender === "men" || gender === "unisex" || gender === "kids" ? gender : ""
  if (!normalized) return CATALOG_ITEM_OPTIONS
  return CATALOG_ITEM_OPTIONS.filter((item) => item.genders.includes(normalized))
}

export function getCatalogItemLabel(value?: string | null) {
  if (!value) return ""
  return CATALOG_ITEM_OPTIONS.find((item) => item.value === value)?.label ?? value
}

export function getCatalogItemKeywords(value?: string | null) {
  if (!value) return []
  return CATALOG_ITEM_OPTIONS.find((item) => item.value === value)?.keywords ?? [value]
}
