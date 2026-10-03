"use client"

import { useFormStatus } from "react-dom"

type DeleteListingInlineButtonProps = {
  listingId: string
  listingTitle: string
  filter?: string
  action: (formData: FormData) => void | Promise<void>
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "იშლება..." : "წაშლა"}
    </button>
  )
}

export default function DeleteListingInlineButton({ listingId, listingTitle, filter, action }: DeleteListingInlineButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const accepted = window.confirm(`ნამდვილად გინდა განცხადების სრულად წაშლა?\n\n${listingTitle}\n\nეს მოქმედება შეუქცევადია.`)
        if (!accepted) event.preventDefault()
      }}
    >
      <input type="hidden" name="listingId" value={listingId} />
      {filter ? <input type="hidden" name="filter" value={filter} /> : null}
      <SubmitButton />
    </form>
  )
}
