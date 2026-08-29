export const SELLER_PHONE_MAX_LENGTH = 32

const SELLER_PHONE_PATTERN = /^\+?[0-9 ()-]+$/

export function normalizeSellerPhone(value: string | null | undefined) {
  return String(value ?? "").trim().replace(/\s+/g, " ")
}

export function isValidSellerPhone(value: string | null | undefined) {
  const phone = normalizeSellerPhone(value)
  if (phone.length < 7 || phone.length > SELLER_PHONE_MAX_LENGTH) return false
  if (!SELLER_PHONE_PATTERN.test(phone)) return false

  const digits = phone.replace(/\D/g, "")
  return digits.length >= 7 && digits.length <= 15
}

export function getSellerPhoneHref(value: string | null | undefined) {
  if (!isValidSellerPhone(value)) return null
  const phone = normalizeSellerPhone(value)
  const digits = phone.replace(/\D/g, "")
  return `tel:${phone.startsWith("+") ? "+" : ""}${digits}`
}
