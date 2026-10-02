import { ka } from "@/lib/i18n/ka"

const steps = [
  { title: "ატვირთე", text: "დაამატე რეალური ფოტოები, აღწერა და სასურველი ფასი", tone: "orange" },
  { title: "გაყიდე", text: "დაინტერესებულ მყიდველს უპასუხე SAMOSELL-ის ჩატში", tone: "green" },
  { title: "შეათანხმე გადაცემა", text: "ერთად გადაწყვიტეთ შეხვედრა ან თქვენთვის მისაღები გაგზავნის გზა", tone: "orange" },
  { title: "მიიღე თანხა", text: "გადახდის გზა მყიდველთან წინასწარ და უსაფრთხოდ შეათანხმე", tone: "green" },
] as const

function StepIcon({ index }: { index: number }) {
  const common = "h-5 w-5"

  if (index === 0) {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 16V4M7.5 8.5 12 4l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 13.5v4A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-4" strokeLinecap="round" />
      </svg>
    )
  }

  if (index === 1) {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M5 7.5h14l-1 11H6l-1-11Z" strokeLinejoin="round" />
        <path d="M8.5 9V6a3.5 3.5 0 0 1 7 0v3" strokeLinecap="round" />
      </svg>
    )
  }

  if (index === 2) {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M7 7h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-5l-4 2v-2H7a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3Z" strokeLinejoin="round" />
        <path d="M8 12h.01M12 12h.01M16 12h.01" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="6" width="16" height="12" rx="2.5" />
      <path d="M4 10h16M8 15h3" strokeLinecap="round" />
    </svg>
  )
}

export default function HomeHowItWorks() {
  return (
    <section className="relative overflow-hidden bg-[#eef6f3] py-12 sm:py-16">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-56 w-[38rem] -translate-x-1/2 rounded-full bg-white/80 blur-3xl" />

      <div className="ui-container relative">
        <div className="overflow-hidden rounded-[34px] border border-[#dfe9e5] bg-white/85 p-5 shadow-[0_18px_50px_rgba(7,63,59,0.07)] backdrop-blur sm:p-8 lg:p-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#e7f5f0] px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-brand">
                <span aria-hidden="true">✦</span>
                მარტივი პროცესი
              </div>
              <h2
                aria-label={ka.home.howItWorks}
                className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-3xl font-black tracking-[-0.045em] text-brand sm:text-4xl"
              >
                <span>როგორ მუშაობს</span>
                <img
                  src="/brand/samosell-header-logo.svg"
                  alt="Samo$ell"
                  width={164}
                  height={50}
                  className="h-[34px] w-auto sm:h-[42px]"
                />
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-text-soft sm:text-base">
                ოთხი მარტივი ნაბიჯი — განცხადების ატვირთვიდან შეთანხმებამდე.
              </p>
            </div>

            <div className="hidden items-center gap-2 text-xs font-bold text-text-soft lg:flex">
              <span className="h-2 w-2 rounded-full bg-brand" />
              სწრაფი
              <span className="h-2 w-2 rounded-full bg-accent" />
              მარტივი
              <span className="h-2 w-2 rounded-full bg-[#f0c779]" />
              პირდაპირი
            </div>
          </div>

          <div className="relative mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div
              aria-hidden="true"
              className="absolute left-[12.5%] right-[12.5%] top-7 hidden border-t-2 border-dashed border-brand/15 lg:block"
            />

            {steps.map((step, index) => {
              const orange = step.tone === "orange"

              return (
                <article
                  key={step.title}
                  className="group relative rounded-[26px] border border-[#e7ece9] bg-white p-5 shadow-[0_8px_26px_rgba(7,63,59,0.045)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(7,63,59,0.09)]"
                >
                  <div className="relative z-10 flex items-center">
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                        orange ? "bg-[#fff0df] text-accent" : "bg-[#e5f4ef] text-brand"
                      }`}
                    >
                      <StepIcon index={index} />
                    </div>
                  </div>

                  <h3 className="mt-5 text-lg font-black tracking-[-0.02em] text-brand">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-text-soft">{step.text}</p>

                  <div
                    aria-hidden="true"
                    className={`mt-5 h-1.5 w-12 rounded-full transition-all duration-300 group-hover:w-20 ${
                      orange ? "bg-accent/70" : "bg-brand/55"
                    }`}
                  />
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
