export default function DashboardChatsPage() {
  return (
    <div className="hidden h-full min-h-0 flex-1 items-center justify-center p-8 lg:flex">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8 fill-none stroke-current" strokeWidth="1.8">
            <path d="M5 5.75h14a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H10l-5.5 3v-3H5a2 2 0 0 1-2-2v-7.5a2 2 0 0 1 2-2Z" />
            <path d="M7.5 10h9M7.5 13h6" />
          </svg>
        </div>
        <h2 className="mt-5 text-2xl font-black text-text">აირჩიე მიმოწერა</h2>
        <p className="mt-2 text-sm leading-6 text-text-soft">
          მარცხენა სიიდან გახსენი მომხმარებელი და საუბარი აქ გამოჩნდება.
        </p>
      </div>
    </div>
  )
}
