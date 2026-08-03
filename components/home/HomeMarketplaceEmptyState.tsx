import Link from "next/link"
import { ka } from "@/lib/i18n/ka"

export default function HomeMarketplaceEmptyState() {
  return (
    <section className="border-b border-line bg-bg py-12 sm:py-16">
      <div className="ui-container">
        <div role="status" className="ui-card border-dashed px-6 py-14 text-center">
          <div
            aria-hidden="true"
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-2xl text-brand"
          >
            +
          </div>
          <h2 className="mt-5 text-2xl font-black text-text">{ka.home.emptyTitle}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-text-soft">
            {ka.home.emptyDescription}
          </p>
          <Link href="/dashboard/listings/new" className="ui-btn-primary mt-7">
            {ka.home.startSelling}
          </Link>
        </div>
      </div>
    </section>
  )
}
