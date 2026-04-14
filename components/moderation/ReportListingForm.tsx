import { submitListingReportAction } from "@/app/moderation/actions"

type ReportListingFormProps = {
  listingId: string
  listingSlug: string
  sellerId: string
  nextPath: string
}

export default function ReportListingForm({
  listingId,
  listingSlug,
  sellerId,
  nextPath,
}: ReportListingFormProps) {
  return (
    <form action={submitListingReportAction} className="rounded-[1.25rem] border border-line bg-surface-alt p-4">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="listingSlug" value={listingSlug} />
      <input type="hidden" name="sellerId" value={sellerId} />
      <input type="hidden" name="nextPath" value={nextPath} />

      <div className="text-sm font-semibold text-text">განცხადების დარეპორტება</div>
      <p className="mt-1 text-xs leading-5 text-text-soft">
        გამოიყენე მხოლოდ მაშინ, თუ განცხადება არღვევს წესებს, შეიცავს ყალბ ან აკრძალულ ინფორმაციას, ან აშკარად პრობლემურია.
      </p>

      <div className="mt-4 grid gap-3">
        <div>
          <label className="mb-2 block text-sm font-medium text-text">მიზეზი</label>
          <select name="reason" defaultValue="other" className="ui-input">
            <option value="spam">სპამი</option>
            <option value="fake">ყალბი განცხადება</option>
            <option value="prohibited">აკრძალული ნივთი</option>
            <option value="abuse">შეურაცხმყოფელი შინაარსი</option>
            <option value="wrong_info">არასწორი ინფორმაცია</option>
            <option value="other">სხვა</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text">დეტალები</label>
          <textarea
            name="details"
            rows={4}
            className="w-full rounded-[1rem] border border-line bg-white px-4 py-3 text-sm text-text outline-none transition placeholder:text-text-soft focus:border-brand focus:ring-4 focus:ring-brand-soft/70"
            placeholder="მოკლედ აღწერე რა პრობლემაა ამ განცხადებაში"
          />
        </div>
      </div>

      <button type="submit" className="mt-4 inline-flex items-center justify-center rounded-full border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50">
        დარეპორტება
      </button>
    </form>
  )
}
