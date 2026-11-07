import Link from "next/link"
import type { getCategorySeo } from "@/lib/seo"

type Seo = NonNullable<ReturnType<typeof getCategorySeo>>

/**
 * Server-rendered buying guide under a category's listings (canonical first page only).
 * Gives Google real text for the category query and links related categories together.
 * Uses native <details> for the FAQ — no client JavaScript.
 */
export default function CategorySeoContent({ seo }: { seo: Seo }) {
  const { sections, faqs, related } = seo.guide
  return (
    <section aria-labelledby="category-guide" className="mt-12 border-t border-line pt-8 text-text">
      <h2 id="category-guide" className="text-xl font-bold text-brand sm:text-2xl">{seo.h1}: სასარგებლო ინფორმაცია</h2>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {sections.map(section => (
          <div key={section.title}>
            <h3 className="text-base font-bold">{section.title}</h3>
            <p className="mt-2 text-sm leading-7 text-text-soft">{section.text}</p>
          </div>
        ))}
      </div>

      <h3 className="mt-8 text-base font-bold">ხშირად დასმული კითხვები</h3>
      <div className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
        {faqs.map(faq => (
          <details key={faq.question} className="group px-4 py-3">
            <summary className="cursor-pointer list-none text-sm font-semibold marker:hidden">{faq.question}</summary>
            <p className="mt-2 text-sm leading-6 text-text-soft">{faq.answer}</p>
          </details>
        ))}
      </div>

      <nav aria-label="დაკავშირებული კატეგორიები" className="mt-8">
        <h3 className="text-base font-bold">ასევე ნახე</h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          {related.map(link => (
            <li key={link.href}>
              <Link href={link.href} className="inline-flex min-h-10 items-center rounded-full border border-brand/20 bg-white px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft">{link.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  )
}
