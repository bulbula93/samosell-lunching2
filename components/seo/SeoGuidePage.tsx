import Link from "next/link"
import SiteHeader from "@/components/layout/SiteHeader"
import { serializeJsonLd } from "@/lib/seo"
import {
  buildSeoGuideStructuredData,
  type SeoGuideDefinition,
} from "@/lib/seo-guides"

export default function SeoGuidePage({ guide }: { guide: SeoGuideDefinition }) {
  const structuredData = buildSeoGuideStructuredData(guide)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <SiteHeader />
      <main className="min-h-screen bg-neutral-50 text-neutral-900">
        <section className="mx-auto max-w-5xl px-4 py-9 sm:px-6 sm:py-14">
          <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
            <Link href="/" className="hover:text-neutral-900 hover:underline">მთავარი</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{guide.eyebrow}</span>
          </nav>

          <article className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
              {guide.eyebrow}
            </div>
            <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              {guide.h1}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-neutral-700 sm:text-lg">
              {guide.lede}
            </p>

            <div className="mt-10 space-y-5">
              {guide.sections.map((section) => (
                <section key={section.title} className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
                  <h2 className="text-xl font-black text-neutral-900">{section.title}</h2>
                  <p className="mt-3 leading-7 text-neutral-700">{section.text}</p>
                  {section.bullets?.length ? (
                    <ul className="mt-4 space-y-2 text-sm leading-7 text-neutral-700">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-3">
                          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>

            <section aria-labelledby="guide-faq-title" className="mt-10">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
                FAQ
              </div>
              <h2 id="guide-faq-title" className="mt-2 text-2xl font-black">
                ხშირი კითხვები
              </h2>
              <div className="mt-5 space-y-3">
                {guide.faqs.map((faq) => (
                  <details key={faq.question} className="group rounded-2xl border border-neutral-200 bg-white p-5">
                    <summary className="cursor-pointer list-none pr-8 font-bold text-neutral-900 marker:hidden">
                      {faq.question}
                    </summary>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-neutral-600">
                      {faq.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>

            <section aria-labelledby="related-guides-title" className="mt-10 border-t border-neutral-200 pt-8">
              <h2 id="related-guides-title" className="text-2xl font-black">
                დაკავშირებული გვერდები
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {guide.relatedLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-[1.4rem] border border-neutral-200 bg-neutral-50 p-5 transition hover:border-neutral-300 hover:bg-white"
                  >
                    <div className="font-black text-neutral-900">{link.label}</div>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">{link.text}</p>
                  </Link>
                ))}
              </div>
            </section>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href={guide.primaryCta.href}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-black px-6 text-sm font-semibold text-white"
              >
                {guide.primaryCta.label}
              </Link>
              <Link
                href={guide.secondaryCta.href}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-neutral-300 bg-white px-6 text-sm font-semibold text-neutral-700"
              >
                {guide.secondaryCta.label}
              </Link>
            </div>
          </article>
        </section>
      </main>
    </>
  )
}
