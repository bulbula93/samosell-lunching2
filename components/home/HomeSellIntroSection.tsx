import Link from "next/link"
import SmartImage from "@/components/shared/SmartImage"

const steps = [
  "დარეგისტრირდი ან შექმენი ახალი განცხადება",
  "ატვირთე სასურველი პროდუქტი",
  "ჩართე შეტყობინება რათა არ გამოტოვო მომხმარებლის მოთხოვნა",
] as const

export default function HomeSellIntroSection({ signedIn, showcaseImage }: { signedIn: boolean; showcaseImage: string | null }) {
  return (
    <section className="bg-[#ECECEC] px-4 py-10 sm:px-6 lg:px-10 lg:py-[36px]">
      <div className="mx-auto grid max-w-[1440px] items-center gap-8 lg:grid-cols-[483px_1fr] lg:gap-[54px]">
        <div className="max-w-[470px] pl-0 lg:pl-[18px]">
          <h1 className="max-w-[430px] text-[32px] font-bold uppercase leading-10 text-[#3A3A3A]">
            იყიდე, გაყიდე და აღმოაჩინე უნიკალური სტილის ტანსაცმელი
          </h1>

          <p className="mt-6 max-w-[365px] text-[14px] leading-[22px] text-[#5B5B5B]">
            შექმენი შენი პირადი სივრცე და დაიწყე საკუთარი ბიზნესის განვითარება, ჩვენი პლატფორმა <span className="text-[#F88A51]">Samosell</span> დაგეხმარება ამაში.
          </p>

          <div className="mt-5 space-y-2.5">
            {steps.map((line, index) => (
              <div key={line} className="flex items-start gap-4">
                <span className="min-w-5 text-[18px] font-bold leading-[44px] text-black sm:text-[20px]">{index + 1}</span>
                <span className="pt-2 text-[14px] font-medium leading-6 text-[#1F1F1F]">{line}</span>
              </div>
            ))}
          </div>

          <Link
            href={signedIn ? "/dashboard/listings/new" : "/register"}
            className="mt-5 inline-flex h-[46px] items-center justify-center rounded-[6px] border border-[#9C5D30] bg-[#F88A51] px-5 text-[14px] font-medium leading-6 text-white transition hover:bg-[#ef7b3f]"
          >
            შექმენი განცხადება
          </Link>
        </div>

        <div className="relative mx-auto h-[258px] w-full max-w-[485px] sm:h-[312px] lg:h-[310px] lg:max-w-[590px]">
          <div className="absolute bottom-0 left-0 right-7 top-0 rounded-[16px] bg-[#F29A57]" />
          <div className="absolute bottom-7 left-7 right-0 top-7 overflow-hidden rounded-[16px] border-4 border-white bg-white shadow-[0_18px_38px_rgba(0,0,0,0.08)]">
            <SmartImage
              src={showcaseImage}
              alt="Samosell showcase"
              wrapperClassName="h-full w-full"
              className="h-full w-full object-cover"
              fallbackLabel="აქ გამოჩნდება საუკეთესო განცხადებები"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
