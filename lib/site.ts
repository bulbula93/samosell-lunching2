import { isTbcCheckoutEnabled } from "@/lib/tbc"

export const SITE_NAME = "SamoSell"
export const SITE_TAGLINE = "ტანსაცმლისა და აქსესუარების ონლაინ ბაზარი"
export const SITE_DESCRIPTION_EN = "Fashion-first marketplace for clothing, accessories and vintage finds."
export const SITE_DESCRIPTION_KA = "SamoSell-ზე მოძებნე ახალი, ვინტაჟური და უნიკალური ნივთები მთელ საქართველოში."
export const SITE_STORAGE_NAMESPACE = "samosell"

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
  }
}

export function getBoostPaymentConfig() {
  const support = getSupportConfig()
  const externalPaymentUrl = readOptionalEnv("BOOST_EXTERNAL_PAYMENT_URL", "")

  const tbcCheckoutEnabled = isTbcCheckoutEnabled()

  return {
    bankName: readOptionalEnv("BOOST_BANK_NAME", ""),
    accountHolder: readOptionalEnv("BOOST_ACCOUNT_HOLDER", ""),
    accountNumber: readOptionalEnv("BOOST_BANK_ACCOUNT", ""),
    note: readOptionalEnv(
      "BOOST_PAYMENT_NOTE",
      "VIP განთავსების მოთხოვნის შექმნის შემდეგ გამოიყენე payment reference გადარიცხვის დანიშნულებაში და შემდეგ დაელოდე ადმინის დადასტურებას."
    ),
    proofHint: readOptionalEnv(
      "BOOST_PAYMENT_PROOF_HINT",
      "თუ დამატებითი გადამოწმება დაგვჭირდება, მოგვწერე მხარდაჭერის ელფოსტაზე და მიუთითე შენი payment reference."
    ),
    approvalTime: readOptionalEnv("BOOST_ADMIN_APPROVAL_TIME", support.responseTime),
    paymentContactEmail: readOptionalEnv("BOOST_PAYMENT_CONTACT_EMAIL", support.supportEmail),
    externalPaymentUrl,
    hasExternalPaymentUrl: Boolean(externalPaymentUrl),
    hasBankDetails: Boolean(readOptionalEnv("BOOST_BANK_NAME", "") || readOptionalEnv("BOOST_BANK_ACCOUNT", "") || readOptionalEnv("BOOST_ACCOUNT_HOLDER", "")),
    tbcCheckoutEnabled,
  }
}
