export const GEORGIA_CITIES = [
  "თბილისი",
  "ბათუმი",
  "ქუთაისი",
  "რუსთავი",
  "გორი",
  "ზუგდიდი",
  "ფოთი",
  "თელავი",
  "ახალციხე",
  "ოზურგეთი",
  "მარნეული",
  "მცხეთა",
  "ქობულეთი",
  "ბორჯომი",
  "ხაშური",
  "სამტრედია",
  "სენაკი",
  "ზესტაფონი",
  "გარდაბანი",
  "ბოლნისი",
  "ჭიათურა",
  "წყალტუბო",
  "ამბროლაური",
  "ყვარელი",
  "ლაგოდეხი",
  "დუშეთი",
  "კასპი",
  "ახალქალაქი",
  "ნინოწმინდა",
] as const

export type ListingSizeType =
  | "clothing"
  | "bottoms"
  | "shoes"
  | "kids"
  | "kids_shoes"
  | "universal"

export type SizeLookupOption = {
  label?: string | null
  group_name?: string | null
}

export const ADULT_SIZE_TYPE_OPTIONS: Array<{ value: ListingSizeType; label: string }> = [
  { value: "clothing", label: "ტანსაცმელი" },
  { value: "bottoms", label: "შარვალი / ჯინსი" },
  { value: "shoes", label: "ფეხსაცმელი" },
  { value: "universal", label: "უნივერსალური / One Size" },
]

export const KIDS_SIZE_TYPE_OPTIONS: Array<{ value: ListingSizeType; label: string }> = [
  { value: "kids", label: "საბავშვო ტანსაცმელი" },
  { value: "kids_shoes", label: "საბავშვო ფეხსაცმელი" },
  { value: "universal", label: "უნივერსალური / One Size" },
]

const BOTTOM_ITEM_TYPES = new Set(["jeans", "trousers", "leggings", "shorts", "skirts"])
const UNIVERSAL_ITEM_TYPES = new Set(["bags", "accessories"])
const KIDS_ITEM_TYPES = new Set(["newborn", "school-uniform"])

export function normalizeListingSizeType(groupName?: string | null): ListingSizeType | null {
  if (!groupName) return null
  if (groupName === "women" || groupName === "men" || groupName === "clothing") return "clothing"
  if (
    groupName === "bottoms" ||
    groupName === "shoes" ||
    groupName === "kids" ||
    groupName === "kids_shoes" ||
    groupName === "universal"
  ) {
    return groupName
  }
  return null
}

export function recommendedListingSizeType(categorySlug?: string | null, gender?: string | null): ListingSizeType {
  const category = String(categorySlug ?? "")
  const normalizedGender = String(gender ?? "")

  if (category === "footwear") return normalizedGender === "kids" ? "kids_shoes" : "shoes"
  if (BOTTOM_ITEM_TYPES.has(category)) return normalizedGender === "kids" ? "kids" : "bottoms"
  if (KIDS_ITEM_TYPES.has(category) || normalizedGender === "kids") return "kids"
  if (UNIVERSAL_ITEM_TYPES.has(category) || category === "accessories") return "universal"
  return "clothing"
}

export function listingSizeTypeOptions(gender?: string | null) {
  return gender === "kids" ? KIDS_SIZE_TYPE_OPTIONS : ADULT_SIZE_TYPE_OPTIONS
}

export function sizeGroupMatchesType(groupName: string | null | undefined, sizeType: ListingSizeType) {
  const group = String(groupName ?? "")
  if (sizeType === "clothing") return group === "clothing" || group === "women" || group === "men"
  return group === sizeType
}

export function getCatalogSizeLabels(
  sizes: SizeLookupOption[],
  categorySlug?: string | null,
  gender?: string | null,
  currentSize?: string | null,
) {
  const type = recommendedListingSizeType(categorySlug, gender)
  const labels: string[] = []

  for (const size of sizes) {
    const label = String(size.label ?? "").trim()
    if (!label) continue
    if (sizeGroupMatchesType(size.group_name, type)) labels.push(label)
    if (type === "clothing" && size.group_name === "universal") labels.push(label)
  }

  const current = String(currentSize ?? "").trim()
  if (current) labels.push(current)
  return Array.from(new Set(labels))
}
