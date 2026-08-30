import BlockUserForm from "@/components/moderation/BlockUserForm"
import ReportListingForm from "@/components/moderation/ReportListingForm"
import ReportUserForm from "@/components/moderation/ReportUserForm"

type ListingSafetyActionsProps = {
  listingId: string
  listingSlug: string
  sellerId: string
  nextPath: string
  isBlocked: boolean
}

export default function ListingSafetyActions({
  listingId,
  listingSlug,
  sellerId,
  nextPath,
  isBlocked,
}: ListingSafetyActionsProps) {
  return (
    <details className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface-alt">
      <summary className="cursor-pointer list-none px-4 py-4 text-sm font-bold text-text marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
        რეპორტი ან დაბლოკვა
      </summary>

      <div className="border-t border-line bg-white p-4">
        <div className="rounded-xl border border-line bg-surface-alt px-4 py-3">
          <div className="text-sm font-bold text-text">რა განსხვავებაა?</div>
          <p className="mt-1 text-xs leading-5 text-text-soft">
            რეპორტი იგზავნება SamoSell-ის მოდერაციაში შესამოწმებლად. დაბლოკვა კი მხოლოდ შენსა და ამ მომხმარებელს შორის კომუნიკაციას ზღუდავს და ავტომატურად ანგარიშის შეზღუდვას არ ნიშნავს.
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          <ReportListingForm
            listingId={listingId}
            listingSlug={listingSlug}
            nextPath={nextPath}
          />
          <ReportUserForm
            reportedUserId={sellerId}
            contextListingId={listingId}
            nextPath={nextPath}
          />
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <div className="mb-3">
            <div className="text-sm font-bold text-text">პირადი ბლოკი</div>
            <p className="mt-1 text-xs leading-5 text-text-soft">
              {isBlocked
                ? "ეს მომხმარებელი დაბლოკილი გაქვს. სურვილის შემთხვევაში შეგიძლია ბლოკი მოხსნა."
                : "დაბლოკვის შემდეგ ამ მომხმარებელთან შეტყობინებების გაცვლა შეიზღუდება."}
            </p>
          </div>
          <BlockUserForm
            blockedId={sellerId}
            nextPath={nextPath}
            isBlocked={isBlocked}
          />
        </div>
      </div>
    </details>
  )
}
