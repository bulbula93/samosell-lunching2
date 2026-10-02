export type ListingCategoryOption = {
  id: number
  name: string
  slug?: string | null
  isVirtual?: boolean
}

const SECTION_DEFINITIONS = [
  { slug: "women", name: "ქალებისთვის", virtualId: 910001 },
  { slug: "men", name: "მამაკაცებისთვის", virtualId: 910002 },
  { slug: "kids", name: "ბავშვებისთვის", virtualId: 910003 },
  { slug: "footwear", name: "ფეხსაცმელი", virtualId: 910004 },
  { slug: "bags", name: "ჩანთები", virtualId: 910005 },
  { slug: "vintage", name: "ვინტაჟი", virtualId: 910006 },
  { slug: "accessories", name: "აქსესუარები", virtualId: 910007 },
  { slug: "perfume", name: "პარფიუმერია", virtualId: 910008 },
] as const

export function buildListingCategoryOptions(
  categories: Array<{ id: number; name: string; slug?: string | null }>,
): ListingCategoryOption[] {
  return SECTION_DEFINITIONS.map((definition) => {
    const existing = categories.find((category) => category.slug === definition.slug)
    return existing
      ? { ...existing, name: definition.name, isVirtual: false }
      : {
          id: definition.virtualId,
          name: definition.name,
          slug: definition.slug,
          isVirtual: true,
        }
  })
}

export function isVirtualListingCategory(
  category?: ListingCategoryOption | null,
): boolean {
  return Boolean(category?.isVirtual)
}
