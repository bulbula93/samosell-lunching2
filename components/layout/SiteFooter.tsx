import Image from "next/image"
import Link from "next/link"
import { BrowserSettingsButton } from "@/components/privacy/BrowserConsentPanel"
import { ka } from "@/lib/i18n/ka"
import PaymentMethodMarks from "@/components/payments/PaymentMethodMarks"
import { LEGAL_OPERATOR_NAME, SITE_NAME, SOCIAL_LINKS } from "@/lib/site"

const footerGroups = [
  {
    title: "აღმოაჩინე",
    links: [
      { href: "/catalog", label: "კატალოგი" },
      { href: "/catalog/women", label: "ქალებისთვის" },
      { href: "/catalog/accessories", label: "აქსესუარები" },
      { href: "/catalog/vintage", label: "ვინტაჟი" },
      { href: "/sell-fast", label: "როგორ გავყიდო" },\n      { href: "/vintage-georgia", label: "ვინტაჟის გზამკვლევი" },\n      { href: "/sustainable-fashion", label: "მდგრადი მოდა" },
    ],
  },
  {
    title: "დახმარება",
    links: [
      { href: "/faq", label: "ხშირი კითხვები" },
      { href: "/safety", label: "უსაფრთხოება" },
      { href: "/contact", label: "კონტაქტი" },
    ],
  },
  {
    title: "წესები",
    links: [
      { href: "/terms", label: "წესები და პირობები" },
      { href: "/privacy-policy", label: "კონფიდენციალურობა" },
      { href: "/payment-terms", label: "გადახდის პირობები" },
      { href: "/refund-policy", label: "დაბრუნების პოლიტიკა" },
    ],
  },
] as const

export default function SiteFooter() {
  return (
    <footer className="bg-[#073f3b] text-white">
      <div className="ui-container py-12 sm:py-16">
        <div className="grid gap-12 border-b border-white/15 pb-12 lg:grid-cols-[1.1fr_2fr]">
          <div className="max-w-md">
            <Link
              href="/"
              aria-label="SAMOSELL-ის მთავარ გვერდზე დაბრუნება"
              className="inline-flex min-h-11 items-center rounded-xl bg-white px-3 py-2 transition hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <Image
                src="/brand/samosell-header-logo.svg"
                alt="Samo$ell"
                width={164}
                height={50}
                className="h-[34px] w-auto sm:h-[42px]"
              />
            </Link>
            <p className="mt-4 text-sm leading-7 text-white/70">
              ქართული მეორადი ტანსაცმლის ონლაინ პლატფორმა, სადაც მყიდველი და გამყიდველი ერთმანეთს პირადად ეკონტაქტებიან და ათანხმებენ შეძენის პირობებს ყოველგვარი საკომისიოს გარეშე
            </p>
            <Link href="/sell-fast" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-black text-brand transition hover:bg-brand-soft">
              {ka.nav.sell}
            </Link>
          </div>

          <nav aria-label="ქვედა ნავიგაცია" className="grid gap-8 sm:grid-cols-3">
            {footerGroups.map((group) => (
              <div key={group.title}>
                <h2 className="text-sm font-black text-white">{group.title}</h2>
                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm text-white/70 transition hover:text-white hover:underline">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="grid gap-6 border-b border-white/15 py-7 sm:grid-cols-4">
          <div>
            <h2 className="text-sm font-black">მიწოდება</h2>
            <p className="mt-2 text-xs leading-6 text-white/60">ცენტრალიზებული მიწოდების სერვისი ჯერ არ არის ჩართული</p>
          </div>
          <div>
            <h2 className="text-sm font-black">დაბრუნება</h2>
            <p className="mt-2 text-xs leading-6 text-white/60">პირობები გამყიდველსა და მყიდველს შორის წინასწარ თანხმდება და samosell.ge პასუხისმგებლობას იხსნის ნივთებთან დაკავშირებული პრობლემებისგან</p>
          </div>
          <div>
            <h2 className="text-sm font-black">გადახდის მეთოდები</h2>
            <p className="mt-2 text-xs leading-6 text-white/60">SamoSell-ის ფასიანი ციფრული მომსახურებებისთვის</p>
            <div className="mt-3 text-neutral-900"><PaymentMethodMarks compact /></div>
            <Link href="/payment-terms" className="mt-3 inline-block text-xs font-semibold text-white/80 underline underline-offset-4 hover:text-white">
              დეტალური პირობები
            </Link>
          </div>
          <div>
            <h2 className="text-sm font-black">სოციალური ქსელები</h2>
            <nav aria-label="SamoSell-ის სოციალური ქსელები" className="mt-3 flex flex-col items-start gap-1">
              {SOCIAL_LINKS.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.ariaLabel}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9EE3DA]"
                >
                  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-current">
                    {link.icon === "instagram" ? (
                      <>
                        <path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9Z" />
                        <path d="M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.25-3.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z" />
                      </>
                    ) : (
                      <path d="M13.4 22v-8.9h3l.45-3.48H13.4V7.4c0-1.01.28-1.7 1.73-1.7H17V2.59A23.4 23.4 0 0 0 14.28 2c-2.7 0-4.55 1.65-4.55 4.68v2.94H6.67v3.48h3.06V22h3.67Z" />
                    )}
                  </svg>
                  <span>{link.name}</span>
                </a>
              ))}
            </nav>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-6 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p>© {new Date().getFullYear()} {SITE_NAME} ყველა უფლება დაცულია</p>
            <p className="mt-1">პლატფორმის ოპერატორი: {LEGAL_OPERATOR_NAME}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <BrowserSettingsButton />
            <div id="top-ge-counter-container" data-site-id="118968" />
            <p>იყიდე და გაყიდე პასუხისმგებლობით</p>
          </div>
        </div>
      </div>

    </footer>
  )
}
