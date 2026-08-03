import Link from "next/link"
import { SITE_NAME } from "@/lib/site"

const footerGroups = [
  {
    title: "მარკეტფლეისი",
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
      { href: "/contact", label: "დაგვიკავშირდი" },
    ],
  },
  {
    title: "იურიდიული",
    links: [
      { href: "/terms", label: "წესები და პირობები" },
      { href: "/privacy-policy", label: "კონფიდენციალურობა" },
    ],
  },
] as const

export default function SiteFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-[#2E3134] text-white">
      <div className="mx-auto w-full max-w-[1441px] px-6 py-12 sm:px-8 lg:px-10 lg:py-16">
        <div className="grid gap-12 border-b border-white/15 pb-12 lg:grid-cols-[1.35fr_2fr]">
          <div className="max-w-md">
            <Link href="/" className="font-logo text-[32px] font-extrabold uppercase leading-10 tracking-[-0.04em] text-[#F88A51] transition hover:opacity-85">
              {SITE_NAME}
            </Link>
            <p className="mt-4 text-sm leading-6 text-white/70">
              ქართული მოდის მარკეტფლეისი, სადაც შეგიძლია მარტივად იყიდო, გაყიდო და აღმოაჩინო გამორჩეული ნივთები.
            </p>
            <Link
              href="/dashboard/listings/new"
              className="mt-7 inline-flex h-12 items-center justify-center rounded-lg bg-[#F88A51] px-6 text-sm font-bold text-[#2E3134] transition hover:bg-[#ff9d69]"
            >
              განათავსე განცხადება
            </Link>
          </div>

          <nav aria-label="ქვედა ნავიგაცია" className="grid gap-8 sm:grid-cols-3">
            {footerGroups.map((group) => (
              <div key={group.title}>
                <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-white">{group.title}</h2>
                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm text-white/70 transition hover:text-[#F88A51]">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-3 pt-6 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© {currentYear} {SITE_NAME}. ყველა უფლება დაცულია.</p>
          <p>იყიდე და გაყიდე პასუხისმგებლობით.</p>
        </div>
      </div>
    </footer>
  )
}
