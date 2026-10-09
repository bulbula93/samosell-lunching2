import { notFound } from "next/navigation"
import StartChatButton from "@/components/chat/StartChatButton"
import { isReadOnlyPreview } from "@/lib/preview-read-only"

export const dynamic = "force-dynamic"
export const metadata = { title: "ჩათის ვიზუალური პრევიუ", robots: { index: false, follow: false } }

export default function MessagePreviewPage() {
  if (!isReadOnlyPreview()) notFound()

  return (
    <main className="mx-auto max-w-lg px-5 py-10">
      <h1 className="text-xl font-semibold text-text">ჩათის ვიზუალური პრევიუ</h1>
      <p className="mb-6 mt-3 text-sm leading-6 text-text-soft">გახსენი ახალი შეტყობინების ეკრანი. ეს სანახავი მაგალითია — შეტყობინება არ გაიგზავნება.</p>
      <StartChatButton
        listingId="477f3329-6c04-4c40-8f33-873ab3ee4f76"
        listingSlug="visual-preview"
        sellerLabel="გამყიდველი"
        listingTitle="შავი ქურთუკი"
        priceLabel="55 ₾"
        presentation="responsive"
      />
    </main>
  )
}
