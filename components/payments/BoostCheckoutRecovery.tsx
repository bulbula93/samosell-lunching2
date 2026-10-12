import { resumeBoostCheckoutAction } from "@/app/dashboard/boosts/actions"
import ModerationSubmitButton from "@/components/moderation/ModerationSubmitButton"
import { canResumeManualBoostCheckout } from "@/lib/boosts"
import type { BoostOrder } from "@/types/boost"

export default function BoostCheckoutRecovery({ order, nextPath, enabled }: { order: BoostOrder; nextPath: string; enabled: boolean }) {
  if (!enabled || !canResumeManualBoostCheckout(order)) return null

  return (
    <details className="mt-4 rounded-xl border border-line bg-white p-4 text-sm">
      <summary className="cursor-pointer font-semibold text-brand">ბარათით გადახდა</summary>
      <p className="mt-3 text-text-soft">არსებული შეკვეთის გადახდას ბარათით გააგრძელებ. თუ თანხა უკვე გადარიცხე, ხელახლა ნუ გადაიხდი — მიმართე მხარდაჭერას.</p>
      <form action={resumeBoostCheckoutAction} className="mt-3 space-y-3">
        <input type="hidden" name="orderId" value={order.id} />
        <input type="hidden" name="nextPath" value={nextPath} />
        <label className="flex items-start gap-2 text-text">
          <input type="checkbox" name="confirmUnpaid" value="yes" required className="mt-1" />
          <span>ამ შეკვეთაზე თანხა ჯერ არ გადამიხდია</span>
        </label>
        <ModerationSubmitButton className="ui-btn-primary" idleLabel="ბარათით გადახდის გაგრძელება" pendingLabel="გადახდა მზადდება…" />
      </form>
    </details>
  )
}
