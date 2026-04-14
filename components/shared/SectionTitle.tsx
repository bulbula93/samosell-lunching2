type SectionTitleProps = {
  title: string
  actionText?: string
}

export default function SectionTitle({
  title,
  actionText,
}: SectionTitleProps) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <h2 className="text-2xl font-black">{title}</h2>
      {actionText ? (
        <button className="text-sm font-semibold text-neutral-500 hover:text-black">
          {actionText}
        </button>
      ) : null}
    </div>
  )
}
