import Link from "next/link"

export default function ProfilePhoneRequiredCard() {
  return (
    <section className="ui-card mx-auto w-full max-w-5xl p-6 sm:p-8" role="alert">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <p className="ui-eyebrow">საკონტაქტო ინფორმაცია</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-text sm:text-3xl">
            ტელეფონის ნომერი სავალდებულოა
          </h1>
          <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
            განცხადების განთავსებამდე პროფილის რედაქტირებაში მიუთითე მოქმედი ტელეფონის ნომერი. განცხადების გვერდზე ავტომატურად სწორედ პროფილში შენახული ნომერი გამოჩნდება.
          </p>
        </div>
        <Link href="/dashboard/profile" className="ui-btn-primary shrink-0 text-center">
          პროფილის რედაქტირება
        </Link>
      </div>
    </section>
  )
}
