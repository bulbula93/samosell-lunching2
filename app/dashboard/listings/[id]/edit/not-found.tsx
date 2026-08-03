import Link from "next/link"

export default function EditListingNotFound() {
  return (
    <main className="min-h-[60vh] bg-bg px-4 py-12 sm:px-6">
      <section className="ui-card mx-auto max-w-xl p-7 text-center sm:p-10">
        <span className="ui-pill-soft">404</span>
        <h1 className="mt-4 text-2xl font-black text-text">განცხადება ვერ მოიძებნა</h1>
        <p className="mt-3 text-sm leading-6 text-text-soft">
          ჩანაწერი არ არსებობს ან მისი რედაქტირების უფლება არ გაქვს.
        </p>
        <Link href="/dashboard/listings" className="ui-btn-primary mt-6">
          ჩემს განცხადებებზე დაბრუნება
        </Link>
      </section>
    </main>
  )
}
