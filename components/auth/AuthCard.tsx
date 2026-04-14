import Link from "next/link"
import { SITE_NAME } from "@/lib/site"

export default function AuthCard({
  title,
  subtitle,
  altHref,
  altLabel,
  altText,
  children,
}: {
  title: string
  subtitle: string
  altHref: string
  altLabel: string
  altText: string
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-16 text-neutral-900">
      <div className="mx-auto w-full max-w-md rounded-[2rem] border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <Link
            href="/"
            aria-label="მთავარ გვერდზე დაბრუნება"
            className="inline-block rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-300"
          >
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500 transition group-hover:opacity-90">
              {SITE_NAME}
            </div>
          </Link>
          <h1 className="mt-3 text-3xl font-black">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-600">{subtitle}</p>
        </div>

        {children}

        <div className="mt-6 text-sm text-neutral-600">
          {altText}{" "}
          <Link href={altHref} className="font-semibold text-black underline-offset-2 hover:underline">
            {altLabel}
          </Link>
        </div>
      </div>
    </main>
  )
}
