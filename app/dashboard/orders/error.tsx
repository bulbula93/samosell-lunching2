"use client"

export default function OrdersError({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-screen bg-bg py-10 text-text">
      <div className="ui-container max-w-3xl">
        <section role="alert" className="ui-card border-red-200 p-6 sm:p-8">
          <p className="ui-eyebrow text-red-700">შეცდომა</p>
          <h1 className="mt-3 text-3xl font-black">შეკვეთები ვერ ჩაიტვირთა</h1>
          <p className="mt-3 text-sm leading-7 text-text-soft">დროებითი შეფერხებაა. მონაცემები არ შეცვლილა.</p>
          <button type="button" onClick={reset} className="ui-btn-primary mt-6">ხელახლა ცდა</button>
        </section>
      </div>
    </main>
  )
}
