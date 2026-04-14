import { ReactNode } from "react"
import { startChatAction } from "@/app/dashboard/chats/actions"

export default function StartChatButton({
  listingId,
  listingSlug,
  className,
  label = "მიწერე გამყიდველს",
  icon,
}: {
  listingId: string
  listingSlug: string
  className?: string
  label?: string
  icon?: ReactNode
}) {
  return (
    <form action={startChatAction} className="w-full">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="listingSlug" value={listingSlug} />
      <button type="submit" className={className ?? "ui-btn-primary w-full"}>
        {icon}
        <span>{label}</span>
      </button>
    </form>
  )
}
