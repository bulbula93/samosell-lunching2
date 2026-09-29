import "server-only"

import { absoluteSiteUrl, sendTransactionalEmail } from "@/lib/email"
import { createAdminClient } from "@/lib/supabase/admin"

const DEFAULT_ADMIN_ACTIVITY_EMAIL = "giorgi.bulbula@gmail.com"

function adminActivityEmail() {
  const configured = String(process.env.ADMIN_ACTIVITY_EMAIL ?? "").trim()
  return configured || DEFAULT_ADMIN_ACTIVITY_EMAIL
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function formatMoney(amount: number | string, currency = "GEL") {
  const numeric = Number(amount)
  return Number.isFinite(numeric)
    ? `${numeric.toFixed(2)} ${currency}`
    : `${String(amount)} ${currency}`
}

async function sendAdminActivityEmail(input: {
  subject: string
  heading: string
  lines: Array<[string, string]>
  href?: string
  hrefLabel?: string
  idempotencyKey: string
}) {
  try {
    const url = input.href ? absoluteSiteUrl(input.href) : null
  const text = [
    input.heading,
    "",
    ...input.lines.map(([label, value]) => `${label}: ${value}`),
    ...(url ? ["", `${input.hrefLabel ?? "გახსნა"}: ${url}`] : []),
  ].join("\n")

  const rows = input.lines
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#64748b;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 0;font-weight:600;color:#0f172a">${escapeHtml(value)}</td></tr>`,
    )
    .join("")

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:24px">
      <div style="font-size:12px;font-weight:800;letter-spacing:.12em;color:#0d665d;text-transform:uppercase">SamoSell Admin Alert</div>
      <h1 style="font-size:22px;line-height:1.35;margin:10px 0 18px">${escapeHtml(input.heading)}</h1>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
      ${url ? `<p style="margin:22px 0 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#0d665d;color:#fff;text-decoration:none;font-weight:700;padding:11px 16px;border-radius:10px">${escapeHtml(input.hrefLabel ?? "გახსნა")}</a></p>` : ""}
    </div>
  </body>
</html>`

    const result = await sendTransactionalEmail({
      to: adminActivityEmail(),
      subject: input.subject,
      text,
      html,
      idempotencyKey: input.idempotencyKey,
    })

    if (!result.ok && !result.skipped) {
      console.error("[admin activity email] delivery failed", {
        subject: input.subject,
        status: result.status,
      })
    }
  } catch (error) {
    console.error("[admin activity email] notification failed safely", {
      subject: input.subject,
      message: error instanceof Error ? error.message : "unknown_error",
    })
  }
}

export async function notifyAdminNewListing(input: {
  listingId: string
  slug: string
  title: string
  price: number | string
  currency?: string
  sellerId: string
  sellerEmail?: string | null
}) {
  await sendAdminActivityEmail({
    subject: `[SamoSell] ახალი განცხადება — ${input.title}`,
    heading: "ახალი განცხადება გამოქვეყნდა",
    lines: [
      ["სათაური", input.title],
      ["ფასი", formatMoney(input.price, input.currency ?? "GEL")],
      ["გამყიდველის ID", input.sellerId],
      ["გამყიდველის ელფოსტა", input.sellerEmail || "—"],
      ["განცხადების ID", input.listingId],
    ],
    href: `/listing/${encodeURIComponent(input.slug)}`,
    hrefLabel: "განცხადების ნახვა",
    idempotencyKey: `admin-listing-published-${input.listingId}`,
  })
}

export async function notifyAdminNewAd(input: {
  adId: string
  orderId: string
  title: string
  advertiserName: string
  targetUrl: string
  amount: number
  currency: string
  userId: string
  userEmail?: string | null
}) {
  await sendAdminActivityEmail({
    subject: `[SamoSell] ახალი რეკლამის მოთხოვნა — ${input.title}`,
    heading: "ახალი რეკლამის მოთხოვნა შეიქმნა",
    lines: [
      ["რეკლამის სათაური", input.title],
      ["რეკლამის დამკვეთი", input.advertiserName],
      ["თანხა", formatMoney(input.amount, input.currency)],
      ["სტატუსი", "გადახდას ელოდება"],
      ["მომხმარებლის ელფოსტა", input.userEmail || "—"],
      ["მომხმარებლის ID", input.userId],
      ["Target URL", input.targetUrl],
      ["რეკლამის ID", input.adId],
      ["შეკვეთის ID", input.orderId],
    ],
    href: "/admin/ads",
    hrefLabel: "რეკლამების მართვა",
    idempotencyKey: `admin-ad-created-${input.adId}`,
  })
}

export async function notifyAdminBoostPurchase(
  orderId: string,
  providerLabel: "Flitt" | "TBC",
) {
  const admin = createAdminClient()
  const { data: order, error } = await admin
    .from("listing_boost_orders")
    .select("id, listing_id, seller_id, product_id, amount, currency")
    .eq("id", orderId)
    .maybeSingle()

  if (error || !order) {
    console.error("[admin activity email] boost order lookup failed", {
      orderId,
      code: error?.code,
    })
    return
  }

  const [{ data: listing }, { data: product }, { data: profile }] = await Promise.all([
    admin
      .from("listings")
      .select("title, slug")
      .eq("id", order.listing_id)
      .maybeSingle(),
    admin
      .from("listing_boost_products")
      .select("name")
      .eq("id", order.product_id)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("username, full_name")
      .eq("id", order.seller_id)
      .maybeSingle(),
  ])

  const sellerLabel =
    String(profile?.full_name ?? "").trim() ||
    (profile?.username ? `@${profile.username}` : order.seller_id)

  await sendAdminActivityEmail({
    subject: `[SamoSell] პაკეტი შეძენილია — ${product?.name ?? "VIP/Boost"}`,
    heading: "მომხმარებელმა ფასიანი პაკეტი შეიძინა",
    lines: [
      ["პაკეტი", product?.name ?? String(order.product_id)],
      ["თანხა", formatMoney(order.amount, order.currency)],
      ["გადახდის არხი", providerLabel],
      ["განცხადება", listing?.title ?? String(order.listing_id)],
      ["გამყიდველი", sellerLabel],
      ["შეკვეთის ID", order.id],
    ],
    href: listing?.slug
      ? `/listing/${encodeURIComponent(listing.slug)}`
      : "/admin/payments",
    hrefLabel: listing?.slug ? "განცხადების ნახვა" : "გადახდების ნახვა",
    idempotencyKey: `admin-boost-purchased-${order.id}`,
  })
}
