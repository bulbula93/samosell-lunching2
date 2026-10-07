export default function SamoSellSupportAvatar({
  sizeClassName = "h-12 w-12",
}: {
  sizeClassName?: string
}) {
  return (
    <div
      aria-label="SamoSell Help"
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand/15 bg-white px-1.5 shadow-[0_8px_24px_rgba(7,63,59,0.08)] ${sizeClassName}`}
    >
      <img
        src="/brand/samosell-header-logo.svg"
        alt="Samo$ell"
        width={164}
        height={50}
        className="h-auto w-full object-contain"
      />
    </div>
  )
}
