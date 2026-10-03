import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"

export default function AuthCard({
  title,
  subtitle,
  altHref,
  altLabel,
  altText,
  children,
}: {
  title: ReactNode
  subtitle: ReactNode
  altHref: string
  altLabel: string
  altText: string
  children: React.ReactNode
}) {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#fffaf6] px-4 py-10 text-neutral-900 sm:px-6 sm:py-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-28 h-56 w-56 rounded-full bg-[#dff5ef] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-16 h-64 w-64 rounded-full bg-[#fff0d7] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 h-64 w-72 -translate-x-1/2 rounded-full bg-[#fff4df] blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-[2rem] border border-[#eadfd7] bg-white/95 p-6 shadow-[0_20px_65px_rgba(7,63,59,0.12)] backdrop-blur sm:p-8">
        <div className="mb-8">
          <Link
            href="/"
            aria-label="მთავარ გვერდზე დაბრუნება"
            className="inline-flex min-h-11 items-center rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
          >
            <Image unoptimized
              src="/brand/samosell-header-logo.svg"
              alt="Samo$ell"
              width={164}
              height={50}
              className="h-[38px] w-auto"
            />
          </Link>

          <h1 className="mt-5 text-3xl font-black leading-tight tracking-[-0.03em] text-brand sm:text-[2rem]">
            {title}
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-neutral-600">{subtitle}</p>
        </div>

        {children}

        <div className="mt-7 text-center text-sm text-neutral-600">
          {altText}{" "}
          <Link
            href={altHref}
            className="font-black text-[#f06f16] underline decoration-[#ffb424] decoration-2 underline-offset-4 transition hover:text-[#d85f0e]"
          >
            {altLabel}
            <span aria-hidden="true" className="ml-1">→</span>
          </Link>
        </div>
      </div>
    </main>
  )
}
