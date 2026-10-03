import Link from "next/link"
import UiEmptyState from "@/components/shared/UiEmptyState"

export default function NotFound() {
  return (
    <main className="ui-page-shell flex min-h-[70vh] items-center px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <UiEmptyState
          icon="404"
          title="გვერდი ვერ მოიძებნა"
          description="შესაძლოა ბმული შეიცვალა, განცხადება წაიშალა ან URL არასწორია. დაბრუნდი კატალოგში ან მთავარ გვერდზე."
          actions={
            <>
              <Link href="/catalog" className="ui-btn-primary">კატალოგი</Link>
              <Link href="/" className="ui-btn-secondary">მთავარი</Link>
            </>
          }
        />
      </div>
    </main>
  )
}
