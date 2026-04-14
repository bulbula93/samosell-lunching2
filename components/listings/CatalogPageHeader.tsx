import { formatCount } from "@/lib/catalog-page"

export default function CatalogPageHeader({ totalCount }: { totalCount: number }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-7">
      <div>
        <h1 className="text-[28px] font-bold uppercase leading-8 tracking-[-0.02em] text-[#2D2D2D]">პოპულარული სამოსები</h1>
        <p className="mt-1 text-[16px] font-medium leading-6 text-[#2D2D2D]">({formatCount(totalCount)} განცხადება)</p>
      </div>
    </div>
  )
}
