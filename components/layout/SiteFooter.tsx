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
      { href: "/stores", label: "მაღაზიები" },
      { href: "/for-stores", label: "გახსენი მაღაზია" },
      { href: "/sell-fast", label: "როგორ გავყიდო" },
      { href: "/vintage-georgia", label: "ვინტაჟის გზამკვლევი" },
      { href: "/sustainable-fashion", label: "მდგრადი მოდა" },
    ],
  },
  {
    title: "დახმარება",
    links: [
      { href: "/faq", label: "ხშირი კითხვები" },
      { href: "/safety", label: "უსაფრთხოება" },
      { href: "/contact", label: "კონტაქტი" },
      { href: "/advertise", label: "რეკლამა SamoSell-ზე" },
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
      <div className="ui-container py-6 sm:py-9">
        <div className="grid gap-6 border-b border-white/15 pb-5 sm:gap-8 sm:pb-7 lg:grid-cols-[1fr_2.3fr]">
          <div className="max-w-md">
            <Link
              href="/"
              prefetch={false}
              aria-label="SAMOSELL-ის მთავარ გვერდზე დაბრუნება"
              className="inline-flex min-h-11 items-center rounded-xl bg-white px-3 py-2 transition hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <Image
                src="/brand/samosell-header-logo.svg"
                alt="Samo$ell"
                width={164}
                height={50}
                className="h-[30px] w-auto sm:h-[34px]"
              />
            </Link>
            <p className="mt-3 max-w-sm text-xs leading-5 text-white/70">
              ახალი და მეორადი ტანსაცმლის პლატფორმა საქართველოში. განათავსე განცხადება უფასოდ, გაყიდე საკომისიოს გარეშე.
            </p>
            <Link prefetch={false} href="/sell-fast" className="mt-4 hidden min-h-10 sm:inline-flex items-center justify-center rounded-xl bg-white px-6 text-sm font-black text-brand transition hover:bg-brand-soft">
              {ka.nav.sell}
            </Link>
          </div>

          <nav aria-label="ქვედა ნავიგაცია" className="grid sm:grid-cols-3 sm:gap-8">
            {footerGroups.map((group) => (
              <details key={`${group.title}-mobile`} className="group border-b border-white/10 sm:hidden" data-footer-accordion>
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm font-black text-white [&::-webkit-details-marker]:hidden">
                  {group.title}
                  <span aria-hidden="true" className="text-lg leading-none text-white/60 transition group-open:rotate-45">+</span>
                </summary>
                <ul className="pb-2">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link prefetch={false} href={link.href} className="flex min-h-11 items-center text-sm text-white/75 hover:text-white">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            {footerGroups.map((group) => (
              <div key={group.title} className="hidden sm:block">
                <h2 className="text-sm font-black text-white">{group.title}</h2>
                <ul className="mt-3 space-y-2">
                  {group.links.slice(0, group.title === "აღმოაჩინე" ? 5 : undefined).map((link) => (
                    <li key={link.href}>
                      <Link prefetch={false} href={link.href} className="text-sm text-white/70 transition hover:text-white hover:underline">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                {group.title === "აღმოაჩინე" ? (
                  <details className="group mt-2 text-sm">
                    <summary className="cursor-pointer list-none font-semibold text-white/80 hover:text-white [&::-webkit-details-marker]:hidden">მეტი ბმული <span aria-hidden="true" className="inline-block transition group-open:rotate-90">›</span></summary>
                    <ul className="mt-2 space-y-2">
                      {group.links.slice(5).map((link) => (
                        <li key={link.href}><Link prefetch={false} href={link.href} className="text-sm text-white/70 hover:text-white hover:underline">{link.label}</Link></li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            ))}
          </nav>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b border-white/15 py-5 sm:grid-cols-4 sm:gap-5 sm:py-5">
          <div className="col-span-2 sm:col-span-1">
            <h2 className="text-sm font-black">მიწოდება</h2>
            <p className="mt-1.5 text-xs leading-5 text-white/60">მიწოდებას მყიდველი და გამყიდველი ათანხმებენ.</p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <h2 className="text-sm font-black">დაბრუნება</h2>
            <p className="mt-2 text-xs leading-6 text-white/60">დაბრუნების პირობები წინასწარ შეათანხმე გამყიდველთან.</p>
          </div>
          <div>
            <h2 className="text-sm font-black">გადახდის მეთოდები</h2>
            <p className="mt-2 text-xs leading-6 text-white/60">SamoSell-ის ფასიანი ციფრული მომსახურებებისთვის</p>
            <div className="mt-2 text-neutral-900"><PaymentMethodMarks compact /></div>
            <Link prefetch={false} href="/payment-terms" className="mt-2 inline-block text-xs font-semibold text-white/80 underline underline-offset-4 hover:text-white">
              დეტალური პირობები
            </Link>
          </div>
          <div>
            <h2 className="text-sm font-black">სოციალური ქსელები</h2>
            <nav aria-label="SamoSell-ის სოციალური ქსელები" className="mt-2 flex flex-wrap items-start gap-1">
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

        <div className="flex flex-col gap-2 pt-4 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
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
