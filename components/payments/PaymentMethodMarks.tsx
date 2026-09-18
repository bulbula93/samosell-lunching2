type PaymentMethodMarksProps = {
  compact?: boolean
}

export default function PaymentMethodMarks({ compact = false }: PaymentMethodMarksProps) {
  const itemClass = compact
    ? "inline-flex h-8 items-center justify-center rounded-lg border border-current/15 bg-white px-2.5"
    : "inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 shadow-sm"

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="გადახდის მხარდაჭერილი მეთოდები">
      <span className={itemClass} aria-label="Visa">
        <span className="text-base font-black italic tracking-[-0.06em] text-[#1434CB]">VISA</span>
      </span>
      <span className={itemClass} aria-label="Mastercard">
        <span className="relative mr-1 inline-flex h-5 w-8 items-center">
          <span className="absolute left-0 h-5 w-5 rounded-full bg-[#EB001B]" />
          <span className="absolute right-0 h-5 w-5 rounded-full bg-[#F79E1B] opacity-95" />
        </span>
        <span className="text-[11px] font-bold text-neutral-800">Mastercard</span>
      </span>
      <span className={itemClass} aria-label="Apple Pay">
        <span className="text-sm font-semibold text-black">Apple Pay</span>
      </span>
      <span className={itemClass} aria-label="Google Pay">
        <span className="text-sm font-semibold text-neutral-900">Google Pay</span>
      </span>
    </div>
  )
}
