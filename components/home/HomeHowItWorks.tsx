import { ka } from "@/lib/i18n/ka"

const steps = [
  { number: "01", title: "ატვირთე", text: "დაამატე რეალური ფოტოები, აღწერა და სასურველი ფასი" },
  { number: "02", title: "გაყიდე", text: "დაინტერესებულ მყიდველს უპასუხე SAMOSELL-ის ჩატში" },
  { number: "03", title: "შეათანხმე გადაცემა", text: "ერთად გადაწყვიტეთ შეხვედრა ან თქვენთვის მისაღები გაგზავნის გზა" },
  { number: "04", title: "მიიღე თანხა", text: "გადახდის გზა მყიდველთან წინასწარ და უსაფრთხოდ შეათანხმე" },
] as const

export default function HomeHowItWorks() {
  return (
    <section className="bg-brand py-14 text-white sm:py-18">
      <div className="ui-container">
        <h2 className="text-2xl font-black tracking-[-0.025em] sm:text-3xl">{ka.home.howItWorks}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <article key={step.number} className="rounded-2xl border border-white/20 bg-white/8 p-5">
              <span className="text-xs font-black tracking-[0.18em] text-[#9EE3DA]">{step.number}</span>
              <h3 className="mt-4 text-lg font-black">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/75">{step.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
