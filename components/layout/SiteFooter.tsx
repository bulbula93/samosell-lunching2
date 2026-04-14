import Link from "next/link"
import { SITE_NAME } from "@/lib/site"

export default function SiteFooter() {
  return (
    <footer className="bg-[#2E3134] text-white">
      <div className="mx-auto flex min-h-[196px] w-full max-w-[1441px] items-end px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
        <Link href="/" className="font-logo text-[32px] font-extrabold uppercase leading-10 tracking-[-0.04em] text-[#F88A51] transition hover:opacity-85">
          {SITE_NAME}
        </Link>
      </div>
    </footer>
  )
}
