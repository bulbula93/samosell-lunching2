import { ka } from "@/lib/i18n/ka"

const steps = [
  { title: "ატვირთე", text: "დაამატე რეალური ფოტოები, აღწერა და სასურველი ფასი" },
  { title: "გაყიდე", text: "დაინტერესებულ მყიდველს უპასუხე SAMOSELL-ის ჩატში" },
  { title: "შეათანხმე გადაცემა", text: "ერთად გადაწყვიტეთ შეხვედრა ან თქვენთვის მისაღები გაგზავნის გზა" },
  { title: "მიიღე თანხა", text: "გადახდის გზა მყიდველთან წინასწარ და უსაფრთხოდ შეათანხმე" },
] as const

export default function HomeHowItWorks() {
  return (
    <section className="bg-[#f2f6f4] py-12 sm:py-16">
      <div className="ui-container">
        <h2 className="text-2xl font-black tracking-[-0.035em] text-brand sm:text-3xl">{ka.home.howItWorks}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <article key={step.title} className="rounded-[24px] border border-[#e3e9e6] bg-white p-5 shadow-[0_10px_28px_rgba(7,63,59,0.045)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-sm font-black text-accent">{index + 1}</div>
              <h3 className="mt-4 text-lg font-black text-brand">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-soft">{step.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
