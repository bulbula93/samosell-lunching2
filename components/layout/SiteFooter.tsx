import Link from "next/link"
import { ka } from "@/lib/i18n/ka"
import { SITE_NAME } from "@/lib/site"

const footerGroups = [
  {
    title: "აღმოაჩინე",
    links: [
      { href: "/catalog", label: "კატალოგი" },
      { href: "/sell-fast", label: "როგორ გავყიდო" },
      { href: "/dashboard/favorites", label: "რჩეულები" },
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
    ],
  },
] as const

export default function SiteFooter() {
  return (
    <footer className="bg-[#073f3b] text-white">
      <div className="ui-container py-12 sm:py-16">
        <div className="grid gap-12 border-b border-white/15 pb-12 lg:grid-cols-[1.1fr_2fr]">
          <div className="max-w-md">
            <Link href="/" className="font-logo text-3xl font-black tracking-[-0.045em] text-white transition hover:text-[#9EE3DA]">
              {ka.brand}
            </Link>
            <p className="mt-4 text-sm leading-7 text-white/70">
              ქართული marketplace მეორადი, ვინტაჟური და ახალი ტანსაცმლისთვის, ფეხსაცმლისა და აქსესუარებისთვის.
            </p>
            <Link href="/dashboard/listings/new" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-black text-brand transition hover:bg-brand-soft">
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

        <div className="grid gap-6 border-b border-white/15 py-7 sm:grid-cols-3">
          <div>
            <h2 className="text-sm font-black">მიწოდება</h2>
            <p className="mt-2 text-xs leading-6 text-white/60">ცენტრალიზებული მიწოდების სერვისი ჯერ არ არის ჩართული.</p>
          </div>
          <div>
            <h2 className="text-sm font-black">დაბრუნება</h2>
            <p className="mt-2 text-xs leading-6 text-white/60">პირობები გამყიდველსა და მყიდველს შორის წინასწარ თანხმდება.</p>
          </div>
          <div>
            <h2 className="text-sm font-black">სოციალური ქსელები</h2>
            <p className="mt-2 text-xs leading-6 text-white/60">ოფიციალური არხები გამოქვეყნდება მათი დადასტურების შემდეგ.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-6 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {SITE_NAME}. ყველა უფლება დაცულია.</p>
          <p>იყიდე და გაყიდე პასუხისმგებლობით.</p>
        </div>
      </div>
    </footer>
  )
}
