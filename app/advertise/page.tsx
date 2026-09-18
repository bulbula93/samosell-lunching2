import type { Metadata } from "next"
import Link from "next/link"
import SiteHeader from "@/components/layout/SiteHeader"
import SelfServiceAdForm from "@/components/ads/SelfServiceAdForm"
import { requireAuthenticatedUser } from "@/lib/auth"

export const metadata: Metadata = {
  title: "რეკლამის განთავსება",
  description: "შექმენი ბრენდული რეკლამა SamoSell-ის მთავარ გვერდზე.",
  alternates: { canonical: "/advertise" },
}

function flashMessage(code: string) {
  switch (code) {
    case "submitted": return "რეკლამა მიღებულია. ის შენახულია დასამტკიცებლად და შეგიძლია გააგრძელო SamoSell-ის გამოყენება."
    case "invalid_advertiser": return "მიუთითე მაღაზიის ან ბრენდის სწორი სახელი."
    case "invalid_title": return "მიუთითე რეკლამის სწორი სათაური."
    case "invalid_description": return "რეკლამის ტექსტი არ უნდა აღემატებოდეს 280 სიმბოლოს."
    case "invalid_target": return "მიუთითე უსაფრთხო SamoSell ან http/https ბმული."
    case "invalid_placement": return "აირჩიე მთავარი გვერდის სწორი სარეკლამო ადგილი."
    case "image_size": return "სურათი უნდა იყოს 850 KB-ზე ნაკლები."
    case "image_type": return "სურათი უნდა იყოს JPEG, PNG ან WEBP ფორმატში."
    case "upload_failed": return "სურათი ვერ აიტვირთა. სცადე ხელახლა."
    case "save_failed": return "რეკლამა ვერ შეინახა. სცადე ხელახლა."
    default: return ""
  }
}

export default async function AdvertisePage({
  searchParams,
}: {
  searchParams?: Promise<{ flash?: string | string[] }>
}) {
  const params = (await searchParams) ?? {}
  const flashCode = typeof params.flash === "string" ? params.flash : ""
  const flash = flashMessage(flashCode)

  const { supabase, user } = await requireAuthenticatedUser("/advertise")
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, full_name, seller_type, store_instagram, store_facebook, store_website")
    .eq("id", user.id)
    .maybeSingle()

  const advertiserName = String(profile?.full_name || profile?.username || "").trim()
  const destinationOptions = [
    profile?.username
      ? { label: "ჩემი SamoSell გვერდი", url: `/seller/${encodeURIComponent(profile.username)}` }
      : null,
    profile?.store_instagram ? { label: "Instagram", url: profile.store_instagram } : null,
    profile?.store_facebook ? { label: "Facebook", url: profile.store_facebook } : null,
    profile?.store_website ? { label: "ვებგვერდი", url: profile.store_website } : null,
  ].filter((item): item is { label: string; url: string } => Boolean(item?.url))

  return (
    <main className="min-h-screen bg-bg text-text">
      <SiteHeader />
      <section className="ui-container py-10 sm:py-14">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">SamoSell Brand Ads</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">განათავსე შენი მაღაზიის რეკლამა</h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              შექმენი რეკლამის ტექსტი თვითონ და მიაბი შენი SamoSell მაღაზიის გვერდი, სოციალური ქსელი ან საკუთარი ვებგვერდი.
              რეკლამა გამოჩნდება მთავარი გვერდის ერთ-ერთ ორ ბრენდულ სარეკლამო ბლოკში.
            </p>
          </div>
          <Link href="/" className="ui-btn-secondary">მთავარ გვერდზე დაბრუნება</Link>
        </div>

        {flash ? (
          <div
            role="status"
            className={`mb-6 rounded-[1.2rem] border px-4 py-3 text-sm ${
              flashCode === "submitted"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {flash}
          </div>
        ) : null}

        <SelfServiceAdForm
          defaultAdvertiserName={advertiserName}
          destinationOptions={destinationOptions}
        />
      </section>
    </main>
  )
}
