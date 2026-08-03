"use client"

import ListingFormError from "@/components/dashboard/ListingFormError"

export default function EditListingError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ListingFormError reset={reset} />
}
