import type { Metadata } from "next"
import Link from "next/link"
import SiteHeader from "@/components/layout/SiteHeader"
import { SITE_NAME } from "@/lib/site"

export const metadata: Metadata = {
  title: "ხშირად დასმული კითხვები",
  description: `${SITE_NAME}-ის ხშირად დასმული კითხვები, გაყიდვისა და ყიდვის მოკლე გზამკვლევი.`,
  alternates: {
    canonical: "/faq",
  },
}

const faqs = [
  {
    question: "როგორ დავამატო განცხადება?",
    answer:
      "გადადით კაბინეტში, გახსენით „ჩემი განცხადებები“ ან „განცხადების დამატება“, ატვირთეთ ფოტოები, შეავსეთ სათაური, აღწერა, ფასი და კატეგორია, შემდეგ შეინახეთ დრაფტად ან გამოაქვეყნეთ.",
  },
  {
    question: "როგორ მივწერო გამყიდველს?",
    answer:
      "ნებისმიერი აქტიური განცხადების გვერდზე გამოიყენეთ ჩათის ღილაკი. სისტემა გახსნის პირდაპირ დიალოგს, სადაც შეძლებთ დეტალების დაზუსტებას, ფასზე შეთანხმებას და მიწოდების პირობების განხილვას.",
  },
  {
    question: "როგორ გავხადო ჩემი განცხადება უფრო ხილვადი?",
    answer:
      "საუკეთესო შედეგს ჩვეულებრივ იძლევა ხარისხიანი მთავარი ფოტო, ზუსტი სათაური, რეალისტური ფასი და დეტალური აღწერა. მოგვიანებით შეგიძლია გამოიყენო VIP, promoted ან featured პაკეტებიც.",
  },
  {
    question: "რას ნიშნავს დადასტურებული პროფილი?",
    answer:
      "ეს არის ნდობის დამატებითი სიგნალი პროფილზე. ის მომხმარებლებს ეხმარება უფრო თავდაჯერებულად შეაფასონ გამყიდველი, თუმცა გარიგების ყველა დეტალის გადაამოწმება მაინც რეკომენდებულია პირადადაც.",
  },
  {
    question: "რა ვქნა საეჭვო განცხადების შემთხვევაში?",
    answer:
      "გამოიყენე რეპორტის ფორმა განცხადების გვერდზე ან მოგვწერე უსაფრთხოების მისამართზე. თუ ეჭვი გაქვს თაღლითობაზე, ნუ გააგრძელებ კომუნიკაციას მანამ, სანამ ინფორმაცია არ გადაამოწმებ.",
  },
  {
    question: "შემიძლია განცხადება ჯერ დრაფტად შევინახო?",
    answer:
      "კი. განცხადების დამატების ფორმაში შეგიძლია გამოქვეყნების ნაცვლად დრაფტი შეინახო და მოგვიანებით დაასრულო ტექსტი, ფოტოები ან ფასი.",
  },
]

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">დახმარების ცენტრი</div>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">ხშირად დასმული კითხვები</h1>
          <p className="mt-4 max-w-3xl leading-7 text-neutral-700">
            აქ ნახავ მოკლე პასუხებს ყველაზე ხშირ კითხვებზე: როგორ დაამატო განცხადება, როგორ ესაუბრო გამყიდველს, რა ზრდის ნდობას და როგორ დაიცვა თავი საეჭვო აქტივობისგან.
          </p>

          <div className="mt-8 space-y-4">
            {faqs.map((item, index) => (
              <details key={item.question} className="group rounded-[1.5rem] border border-neutral-200 bg-neutral-50 px-5 py-4">
                <summary className="cursor-pointer list-none pr-8 text-lg font-bold text-neutral-900 marker:hidden">
                  <span className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white text-sm font-black text-neutral-700">
                    {index + 1}
                  </span>
                  {item.question}
                </summary>
                <p className="mt-4 pl-11 text-sm leading-7 text-neutral-600">{item.answer}</p>
              </details>
            ))}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Link href="/safety" className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5 transition hover:border-neutral-300 hover:bg-white">
              <div className="text-base font-black text-neutral-900">უსაფრთხო გარიგების რჩევები</div>
              <p className="mt-2 text-sm leading-6 text-neutral-600">გაიგე როგორ გადაამოწმო პროფილი, შეთავაზება და კომუნიკაცია უსაფრთხო გარიგებამდე.</p>
            </Link>
            <Link href="/sell-fast" className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5 transition hover:border-neutral-300 hover:bg-white">
              <div className="text-base font-black text-neutral-900">როგორ გაყიდო სწრაფად</div>
              <p className="mt-2 text-sm leading-6 text-neutral-600">ფოტოების, ფასის, აღწერისა და კომუნიკაციის მოკლე ჩეკლისტი უფრო სწრაფი შედეგისთვის.</p>
            </Link>
            <Link href="/contact" className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5 transition hover:border-neutral-300 hover:bg-white">
              <div className="text-base font-black text-neutral-900">დაგვიკავშირდი</div>
              <p className="mt-2 text-sm leading-6 text-neutral-600">თუ კონკრეტული პრობლემა გაქვს, მხარდაჭერის გვერდიდან სწორ საკონტაქტო არხს სწრაფად იპოვი.</p>
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
