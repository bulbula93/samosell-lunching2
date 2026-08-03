export const LISTING_TEXT_LIMITS = {
  titleMin: 3,
  titleMax: 120,
  descriptionMin: 10,
  descriptionMax: 3_000,
  colorMax: 60,
  materialMax: 100,
  cityMax: 80,
} as const

export const LISTING_PRICE_LIMITS = {
  min: "0.01",
  max: "99999999.99",
} as const

export const LISTING_CONDITIONS = ["new", "like_new", "good", "fair"] as const
export const LISTING_SALE_TYPES = ["sell", "exchange"] as const
export const LISTING_GENDERS = ["women", "men", "unisex", "kids"] as const
export const EDITABLE_LISTING_STATUSES = ["draft", "active"] as const

export const LISTING_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export const LISTING_IMAGE_ACCEPT = LISTING_IMAGE_MIME_TYPES.join(",")

export type ListingCondition = (typeof LISTING_CONDITIONS)[number]
export type ListingSaleType = (typeof LISTING_SALE_TYPES)[number]
export type ListingGender = (typeof LISTING_GENDERS)[number]
export type EditableListingStatus = (typeof EDITABLE_LISTING_STATUSES)[number]
export type ListingImageMimeType = (typeof LISTING_IMAGE_MIME_TYPES)[number]

export type ListingFormInput = {
  title: string
  description: string
  price: string
  categoryId: string | number
  brandId: string
  sizeId: string
  condition: string
  saleType: string
  gender: string
  color: string
  material: string
  city: string
  publishNow: boolean
}

export type ListingFieldName = keyof ListingFormInput | "images"
export type ListingFieldErrors = Partial<Record<ListingFieldName, string>>

export type ValidatedListingInput = {
  title: string
  description: string
  price: string
  categoryId: number
  brandId: string | null
  sizeId: string | null
  condition: ListingCondition
  saleType: ListingSaleType
  gender: ListingGender
  color: string | null
  material: string | null
  city: string | null
  publishNow: boolean
}

export type ListingValidationResult =
  | { ok: true; data: ValidatedListingInput }
  | { ok: false; fieldErrors: ListingFieldErrors }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PRICE_PATTERN = /^\d{1,8}(?:[.,]\d{1,2})?$/

function textLength(value: string) {
  return Array.from(value).length
}

function normalizeOptionalText(value: string) {
  const normalized = value.trim()
  return normalized || null
}

function isOneOf<T extends readonly string[]>(value: string, allowed: T): value is T[number] {
  return allowed.includes(value)
}

function normalizePrice(value: string) {
  const normalized = value.trim().replace(",", ".")
  if (!PRICE_PATTERN.test(normalized)) return null

  const [whole, fraction = ""] = normalized.split(".")
  const canonical = `${String(Number(whole))}${fraction ? `.${fraction.padEnd(2, "0")}` : ".00"}`
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0") || "0")
  const maxCents = 9_999_999_999

  if (!Number.isSafeInteger(cents) || cents < 1 || cents > maxCents) return null
  return canonical
}

export function validateListingInput(input: ListingFormInput): ListingValidationResult {
  const fieldErrors: ListingFieldErrors = {}
  const title = input.title.trim()
  const description = input.description.trim()
  const titleLength = textLength(title)
  const descriptionLength = textLength(description)
  const price = normalizePrice(input.price)
  const categoryId = typeof input.categoryId === "number" ? input.categoryId : Number(input.categoryId)

  if (titleLength < LISTING_TEXT_LIMITS.titleMin || titleLength > LISTING_TEXT_LIMITS.titleMax) {
    fieldErrors.title = `სათაური უნდა შეიცავდეს ${LISTING_TEXT_LIMITS.titleMin}–${LISTING_TEXT_LIMITS.titleMax} სიმბოლოს.`
  }

  if (
    descriptionLength < LISTING_TEXT_LIMITS.descriptionMin ||
    descriptionLength > LISTING_TEXT_LIMITS.descriptionMax
  ) {
    fieldErrors.description = `აღწერა უნდა შეიცავდეს ${LISTING_TEXT_LIMITS.descriptionMin}–${LISTING_TEXT_LIMITS.descriptionMax} სიმბოლოს.`
  }

  if (!price) {
    fieldErrors.price = "შეიყვანე ფასი 0.01 ₾-დან 99 999 999.99 ₾-მდე, მაქსიმუმ ორი ათწილადი ნიშნით."
  }

  if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
    fieldErrors.categoryId = "აირჩიე მოქმედი კატეგორია."
  }

  if (input.brandId && !UUID_PATTERN.test(input.brandId)) {
    fieldErrors.brandId = "არჩეული ბრენდი არასწორია."
  }

  if (input.sizeId && !UUID_PATTERN.test(input.sizeId)) {
    fieldErrors.sizeId = "არჩეული ზომა არასწორია."
  }

  if (!isOneOf(input.condition, LISTING_CONDITIONS)) {
    fieldErrors.condition = "აირჩიე ნივთის მოქმედი მდგომარეობა."
  }

  if (!isOneOf(input.saleType, LISTING_SALE_TYPES)) {
    fieldErrors.saleType = "აირჩიე გაყიდვის მოქმედი ტიპი."
  }

  if (!isOneOf(input.gender, LISTING_GENDERS)) {
    fieldErrors.gender = "აირჩიე ვისთვისაა განკუთვნილი ნივთი."
  }

  const color = normalizeOptionalText(input.color)
  const material = normalizeOptionalText(input.material)
  const city = normalizeOptionalText(input.city)

  if (color && textLength(color) > LISTING_TEXT_LIMITS.colorMax) {
    fieldErrors.color = `ფერი არ უნდა აღემატებოდეს ${LISTING_TEXT_LIMITS.colorMax} სიმბოლოს.`
  }

  if (material && textLength(material) > LISTING_TEXT_LIMITS.materialMax) {
    fieldErrors.material = `მასალა არ უნდა აღემატებოდეს ${LISTING_TEXT_LIMITS.materialMax} სიმბოლოს.`
  }

  if (city && textLength(city) > LISTING_TEXT_LIMITS.cityMax) {
    fieldErrors.city = `ქალაქი არ უნდა აღემატებოდეს ${LISTING_TEXT_LIMITS.cityMax} სიმბოლოს.`
  }

  if (Object.keys(fieldErrors).length > 0 || !price) {
    return { ok: false, fieldErrors }
  }

  return {
    ok: true,
    data: {
      title,
      description,
      price,
      categoryId,
      brandId: input.brandId || null,
      sizeId: input.sizeId || null,
      condition: input.condition as ListingCondition,
      saleType: input.saleType as ListingSaleType,
      gender: input.gender as ListingGender,
      color,
      material,
      city,
      publishNow: input.publishNow,
    },
  }
}

export function isUuid(value: string) {
  return UUID_PATTERN.test(value)
}

export function isListingImageMimeType(value: string): value is ListingImageMimeType {
  return isOneOf(value, LISTING_IMAGE_MIME_TYPES)
}

export function imageExtensionForMimeType(value: ListingImageMimeType) {
  if (value === "image/png") return "png"
  if (value === "image/webp") return "webp"
  return "jpg"
}

export function detectListingImageMimeType(bytes: Uint8Array): ListingImageMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg"
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png"
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp"
  }

  return null
}
