import Link from "next/link"

export default function BuyerSafetyReminder() {
  return (
    <aside
      aria-label="უსაფრთხო ყიდვის შეხსენება"
      className="mt-5 overflow-hidden rounded-2xl border border-brand/15 bg-[linear-gradient(135deg,rgba(232,247,242,0.92),rgba(255,244,223,0.78))] p-4 shadow-[0_8px_24px_rgba(7,63,59,0.05)]"
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

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-black text-brand">უსაფრთხო ყიდვა</h3>
            <Link
              href="/safety"
              className="text-xs font-black text-brand underline decoration-brand/25 decoration-2 underline-offset-4 hover:decoration-brand"
            >
              წესები →
            </Link>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-text-soft sm:text-xs">
            <span className="rounded-full border border-white/80 bg-white/75 px-2.5 py-1">ჩათი SamoSell-ში</span>
            <span className="rounded-full border border-white/80 bg-white/75 px-2.5 py-1">ნივთი გადაამოწმე</span>
            <span className="rounded-full border border-white/80 bg-white/75 px-2.5 py-1">OTP კოდი არ გააზიარო</span>
          </div>

          <p className="mt-2 text-xs leading-5 text-text-soft">
            შეთანხმებამდე გადაამოწმე გამყიდველის პროფილი, შეფასებები და ნივთის მდგომარეობა.
          </p>
        </div>
      </div>
    </aside>
  )
}
