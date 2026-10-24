import Link from "next/link"
import SiteHeader from "@/components/layout/SiteHeader"

// Without a segment-level not-found boundary, notFound() from
// generateMetadata rendered this route with a 200 status. The listing segment
// has always shipped one, which is why /listing/<unknown> answers 404.
export default function SellerNotFound() {
  return (
    <>
      <SiteHeader />
      <main className="flex min-h-[70vh] items-center justify-center bg-bg px-4">
        <section className="ui-card w-full max-w-xl p-8 text-center">
          <div className="mx-auto inline-flex rounded-full border border-line bg-surface-alt px-4 py-2 text-sm font-bold text-text-soft">
            404
          </div>
          <h1 className="mt-6 text-3xl font-black text-text">
            გამყიდველი ვერ მოიძებნა
          </h1>
          <p className="mt-3 text-sm leading-7 text-text-soft">
            ეს გამყიდველი აღარ არსებობს, ან მისი ანგარიში შეჩერებულია.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/catalog" className="ui-btn-primary">
              კატალოგი
            </Link>
            <Link href="/" className="ui-btn-secondary">
              მთავარი
            </Link>
          </div>
        </section>
      </main>
    </>
  )
}
