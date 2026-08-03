import Link from "next/link"

export default function ChatThreadNotFound() {
  return (
    <main className="ui-container py-12">
      <section
        aria-labelledby="thread-not-found-title"
        className="ui-card mx-auto max-w-2xl p-6 text-center sm:p-8"
      >
        <h1 id="thread-not-found-title" className="text-2xl font-black text-text">
          მიმოწერა ვერ მოიძებნა
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-soft">
          დიალოგი არ არსებობს ან მის მონაწილედ არ ხარ მითითებული.
        </p>
        <Link href="/dashboard/chats" className="ui-btn-primary mt-6">
          ჩემს შეტყობინებებში დაბრუნება
        </Link>
      </section>
    </main>
  )
}
