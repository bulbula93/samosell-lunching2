import BrandLogo from "@/components/shared/BrandLogo"

export default function SamoSellSupportAvatar({
  sizeClassName = "h-12 w-12",
  iconSize = 42,
}: {
  sizeClassName?: string
  iconSize?: number
}) {
  return (
    <div
      aria-label="SamoSell Help"
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand/15 bg-white shadow-[0_8px_24px_rgba(7,63,59,0.08)] ${sizeClassName}`}
    >
      <BrandLogo iconOnly iconSize={iconSize} />
    </div>
  )
}
