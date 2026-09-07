import "server-only"

import { getSupportConfig } from "@/lib/site"
import { isTbcCheckoutEnabled } from "@/lib/tbc"

function readOptionalEnv(name: string, fallback: string) {
  const safe = String(process.env[name] ?? "").trim()
  return safe || fallback
}

export function getBoostPaymentConfig() {
  const support = getSupportConfig()
  const externalPaymentUrl = readOptionalEnv("BOOST_EXTERNAL_PAYMENT_URL", "")
  const bankName = readOptionalEnv("BOOST_BANK_NAME", "")
  const accountHolder = readOptionalEnv("BOOST_ACCOUNT_HOLDER", "")
  const accountNumber = readOptionalEnv("BOOST_BANK_ACCOUNT", "")

  return {
    bankName,
    accountHolder,
    accountNumber,
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
    hasBankDetails: Boolean(bankName || accountNumber || accountHolder),
    tbcCheckoutEnabled: isTbcCheckoutEnabled(),
  }
}
