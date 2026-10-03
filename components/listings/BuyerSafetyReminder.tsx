import Link from "next/link"

export default function BuyerSafetyReminder() {
  return (
    <aside
      aria-label="უსაფრთხო ყიდვის შეხსენება"
      className="mt-6 overflow-hidden rounded-2xl border border-brand/15 bg-[linear-gradient(135deg,rgba(232,247,242,0.9),rgba(255,244,223,0.72))] p-4"
    >
      <div className="flex gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand shadow-sm"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 19 6v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3Z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </span>

        <div className="min-w-0">
          <h3 className="text-sm font-black text-brand">უსაფრთხო ყიდვა</h3>
          <p className="mt-1 text-xs leading-5 text-text-soft sm:text-sm sm:leading-6">
            შეინარჩუნე შეთანხმების დეტალები SamoSell-ის ჩათში, გადაამოწმე ნივთი და გამყიდველის პროფილი და არასოდეს გააზიარო SMS/ბანკის ერთჯერადი კოდები.
          </p>
          <Link
            href="/safety"
            className="mt-2 inline-flex min-h-9 items-center text-xs font-black text-brand underline decoration-brand/25 decoration-2 underline-offset-4 hover:decoration-brand"
          >
            უსაფრთხოების სრული წესები →
          </Link>
        </div>
      </div>
    </aside>
  )
}
