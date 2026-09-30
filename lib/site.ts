export const SITE_NAME = "SamoSell"
export const LEGAL_OPERATOR_NAME = "ინდივიდუალური მეწარმე „დაგდაგანი“"
export const SITE_TAGLINE = "ტანსაცმლისა და აქსესუარების ონლაინ ბაზარი"
export const SITE_DESCRIPTION_EN = "Fashion-first marketplace for clothing, accessories and vintage finds."
export const SITE_DESCRIPTION_KA = "SamoSell-ზე მოძებნე ახალი, ვინტაჟური და უნიკალური ნივთები მთელ საქართველოში."
export const SITE_STORAGE_NAMESPACE = "samosell"

export const SOCIAL_LINKS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/samo.sell/",
    ariaLabel: "Instagram — SamoSell-ის ოფიციალური პროფილი",
    icon: "instagram",
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/samosell.ge/",
    ariaLabel: "Facebook — SamoSell-ის ოფიციალური გვერდი",
    icon: "facebook",
  },
] as const

function readOptionalEnv(name: string, fallback: string) {
  const safe = String(process.env[name] ?? "").trim()
  return safe || fallback
}

export function getSupportConfig() {
  return {
    supportEmail: readOptionalEnv("SUPPORT_EMAIL", "support@samosell.ge"),
    trustEmail: readOptionalEnv("TRUST_EMAIL", "trust@samosell.ge"),
    responseTime: readOptionalEnv("SUPPORT_RESPONSE_TIME", "24–48 საათი"),
    businessHours: readOptionalEnv("SUPPORT_BUSINESS_HOURS", "ორშ–პარ, 11:00–19:00"),
    phone: readOptionalEnv("SUPPORT_PHONE", "577 00 33 06"),
    address: readOptionalEnv("SUPPORT_ADDRESS", "თბილისი, ნუცუბიძის 77ბ"),
  }
}
