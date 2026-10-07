import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import SiteHeader from "@/components/layout/SiteHeader"
export const metadata: Metadata = { title: "გაყიდე ნივთები უფასოდ", description: "გადაუღე ფოტო, მიუთითე ფასი და განათავსე უფასოდ SamoSell-ზე.", alternates: { canonical: "/sell" } }
export default function SellPage() {
  return <><SiteHeader /><main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-12">
    <section className="ui-card grid overflow-hidden md:grid-cols-2">
      <div className="flex flex-col justify-center p-6 sm:p-10"><p className="text-sm font-medium text-brand">ახალი ადგილი შენს გარდერობში</p><h1 className="mt-4 text-3xl font-semibold leading-[1.35] text-brand sm:text-4xl">გაყიდე ნივთები, რომლებსაც აღარ იყენებ</h1><p className="mt-5 text-base leading-7 text-text-soft">გადაუღე ფოტო, მიუთითე ფასი და განათავსე უფასოდ.</p><Link href="/dashboard/listings/new" className="ui-btn-primary mt-7 min-h-12 w-full text-center sm:w-fit">დადე პირველი ნივთი</Link></div>
      <div className="relative h-56 md:h-auto md:min-h-[390px]"><Image src="/brand/samosell-hero-bg.jpg" alt="ტანსაცმელი, რომელსაც ახალი მფლობელი ელოდება" fill loading="eager" sizes="(max-width: 767px) 100vw, 50vw" className="object-cover object-right" /></div>
    </section>
    <section aria-label="როგორ განათავსო ნივთი" className="mt-7 grid gap-3 sm:grid-cols-3">{["გადაუღე ფოტო", "აღწერე და მიუთითე ფასი", "გამოაქვეყნე უფასოდ"].map((text, i) => <div key={text} className="ui-card flex items-center gap-4 p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-lg font-semibold text-brand">{i + 1}</span><h2 className="text-base font-medium leading-6">{text}</h2></div>)}</section>
  </main></>
}
