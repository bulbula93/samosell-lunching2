import { ka } from "@/lib/i18n/ka"

const steps = [
  { title: "ატვირთე", text: "დაამატე რეალური ფოტოები, აღწერა და სასურველი ფასი" },
  { title: "გაყიდე", text: "დაინტერესებულ მყიდველს უპასუხე SAMOSELL-ის ჩატში" },
  { title: "შეათანხმე გადაცემა", text: "ერთად გადაწყვიტეთ შეხვედრა ან თქვენთვის მისაღები გაგზავნის გზა" },
  { title: "მიიღე თანხა", text: "გადახდის გზა მყიდველთან წინასწარ და უსაფრთხოდ შეათანხმე" },
] as const

export default function HomeHowItWorks() {
  return (
    <section className="bg-brand py-14 text-white sm:py-18">
      <div className="ui-container">
        <h2 className="text-2xl font-black tracking-[-0.025em] sm:text-3xl">{ka.home.howItWorks}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <article key={step.title} className="rounded-2xl border border-white/20 bg-white/8 p-5">
              <h3 className="text-lg font-black">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/75">{step.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
