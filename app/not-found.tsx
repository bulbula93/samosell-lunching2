import Link from "next/link"

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
      <div className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-600">404</div>
      <h1 className="mt-6 text-4xl font-black text-neutral-900">გვერდი ვერ მოიძებნა</h1>
      <p className="mt-4 max-w-xl leading-7 text-neutral-600">
        შესაძლოა ბმული შეიცვალა, განცხადება წაიშალა ან URL არასწორია. დაბრუნდი კატალოგში ან მთავარ გვერდზე.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/catalog" className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">კატალოგი</Link>
        <Link href="/" className="rounded-full border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-700">მთავარი</Link>
      </div>
    </main>
  )
}
