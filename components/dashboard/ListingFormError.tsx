"use client"

import Link from "next/link"

export default function ListingFormError({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-[60vh] bg-bg px-4 py-12 sm:px-6">
      <section className="ui-card mx-auto max-w-xl p-7 text-center sm:p-10" role="alert">
        <span className="ui-pill-soft">დროებითი შეცდომა</span>
        <h1 className="mt-4 text-2xl font-black text-text">ფორმის ჩატვირთვა ვერ მოხერხდა</h1>
        <p className="mt-3 text-sm leading-6 text-text-soft">
          მონაცემები არ შეცვლილა. სცადე ხელახლა ან დაბრუნდი შენს განცხადებებთან.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={reset} className="ui-btn-primary">
            ხელახლა ცდა
          </button>
          <Link href="/dashboard/listings" className="ui-btn-secondary">
            განცხადებებზე დაბრუნება
          </Link>
        </div>
      </section>
    </main>
  )
}
