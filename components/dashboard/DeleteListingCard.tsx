"use client"

import { useFormStatus } from "react-dom"

type DeleteListingCardProps = {
  listingId: string
  listingTitle: string
  action: (formData: FormData) => void | Promise<void>
}

function DeleteSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center justify-center rounded-2xl border border-red-300 bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "იშლება..." : "განცხადების სრულად წაშლა"}
    </button>
  )
}

export default function DeleteListingCard({ listingId, listingTitle, action }: DeleteListingCardProps) {
  return (
    <section className="mt-8 rounded-[1.75rem] border border-red-200 bg-red-50/70 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-red-700">Danger zone</div>
          <h2 className="mt-2 text-2xl font-black text-neutral-950">წაშალე განცხადება მთლიანად</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-700">
            ეს მოქმედება განცხადებას მთლიანად წაშლის საიტიდან. წაიშლება თავად განცხადება და მისი ფოტოებიც. მოქმედება შეუქცევადია.
          </p>
        </div>

        <form
          action={action}
          onSubmit={(event) => {
            const accepted = window.confirm(`ნამდვილად გინდა განცხადების სრულად წაშლა?\n\n${listingTitle}\n\nეს მოქმედება შეუქცევადია.`)
            if (!accepted) event.preventDefault()
          }}
          className="flex flex-col items-start gap-3"
        >
          <input type="hidden" name="listingId" value={listingId} />
          <DeleteSubmitButton />
          <p className="text-xs leading-5 text-red-700/90">თუ უბრალოდ დამალვა გინდა, გამოიყენე არქივში გადატანა. ეს ღილაკი სრულ წაშლას აკეთებს.</p>
        </form>
      </div>
    </section>
  )
}
