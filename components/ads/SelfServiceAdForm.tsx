"use client"

import { useState } from "react"
import { submitSelfServiceAdAction } from "@/app/advertise/actions"

type DestinationOption = {
  label: string
  url: string
}

export default function SelfServiceAdForm({
  defaultAdvertiserName,
  destinationOptions,
}: {
  defaultAdvertiserName: string
  destinationOptions: DestinationOption[]
}) {
  const [advertiserName, setAdvertiserName] = useState(defaultAdvertiserName)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [targetUrl, setTargetUrl] = useState(destinationOptions[0]?.url ?? "")

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <form action={submitSelfServiceAdAction} encType="multipart/form-data" className="ui-card p-5 sm:p-6">
        <div className="ui-eyebrow">რეკლამის შექმნა</div>
        <h2 className="mt-2 text-2xl font-black text-text">შექმენი შენი რეკლამა</h2>
        <p className="mt-2 text-sm leading-6 text-text-soft">
          შეავსე ტექსტი, აირჩიე გადასასვლელი გვერდი და სურვილის შემთხვევაში დაამატე სურათი.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <label htmlFor="advertiserName" className="mb-2 block text-sm font-semibold text-text">მაღაზია / ბრენდი *</label>
            <input
              id="advertiserName"
              name="advertiserName"
              required
              maxLength={120}
              value={advertiserName}
              onChange={(event) => setAdvertiserName(event.target.value)}
              className="ui-input"
              placeholder="მაგ: Vintage Room"
            />
          </div>

          <div>
            <label htmlFor="adTitle" className="mb-2 block text-sm font-semibold text-text">სათაური *</label>
            <input
              id="adTitle"
              name="title"
              required
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="ui-input"
              placeholder="მაგ: ახალი კოლექცია უკვე ონლაინ"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="adDescription" className="block text-sm font-semibold text-text">მოკლე ტექსტი</label>
              <span className="text-xs text-text-soft">{description.length}/280</span>
            </div>
            <textarea
              id="adDescription"
              name="description"
              maxLength={280}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-28 w-full rounded-[1rem] border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand-soft/70"
              placeholder="მაქსიმუმ 280 სიმბოლო"
            />
          </div>

          <div>
            <label htmlFor="targetUrl" className="mb-2 block text-sm font-semibold text-text">სად გადავიდეს მომხმარებელი? *</label>
            {destinationOptions.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {destinationOptions.map((option) => (
                  <button
                    key={option.url}
                    type="button"
                    onClick={() => setTargetUrl(option.url)}
                    className="rounded-full border border-line bg-white px-3 py-2 text-xs font-semibold text-brand transition hover:border-brand hover:bg-brand-soft"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
            <input
              id="targetUrl"
              name="targetUrl"
              required
              maxLength={2048}
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              className="ui-input"
              placeholder="https://instagram.com/... ან https://yourstore.ge"
            />
            <p className="mt-2 text-xs leading-5 text-text-soft">
              შეგიძლია მიუთითო შენი SamoSell მაღაზია, Instagram, Facebook, TikTok ან ნებისმიერი უსაფრთხო http/https გვერდი.
            </p>
          </div>

          <div>
            <label htmlFor="placementKey" className="mb-2 block text-sm font-semibold text-text">მთავარი გვერდის ადგილი *</label>
            <select id="placementKey" name="placementKey" defaultValue="home_hero_left" className="ui-input">
              <option value="home_hero_left">მარცხენა სარეკლამო ბლოკი</option>
              <option value="home_hero_right">მარჯვენა სარეკლამო ბლოკი</option>
            </select>
            <p className="mt-2 text-xs leading-5 text-text-soft">თუ არჩეული ადგილი დაკავებულია, გაშვებამდე შეგვიძლია თავისუფალ მხარეს გადავანაწილოთ.</p>
          </div>

          <div>
            <label htmlFor="adImage" className="mb-2 block text-sm font-semibold text-text">სურათი</label>
            <input
              id="adImage"
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="block w-full rounded-[1rem] border border-line bg-white px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-brand-soft file:px-4 file:py-2 file:font-semibold file:text-brand"
            />
            <p className="mt-2 text-xs leading-5 text-text-soft">JPEG, PNG ან WEBP · მაქსიმუმ 850 KB. სურათი სურვილისამებრ არის.</p>
          </div>

          <div className="rounded-[1.25rem] border border-brand/15 bg-brand-soft/35 px-4 py-4 text-sm leading-6 text-text">
            <span className="font-black">Home Brand Ad — 49.90 ₾ / 7 დღე.</span>{" "}
            გაგზავნის შემდეგ რეკლამა ინახება დასამტკიცებლად და პირდაპირ ეთერში ავტომატურად არ გამოჩნდება.
          </div>

          <button type="submit" className="ui-btn-primary w-full sm:w-auto">
            რეკლამის გაგზავნა
          </button>
        </div>
      </form>

      <section className="xl:sticky xl:top-24 xl:self-start">
        <div className="mb-3">
          <div className="ui-eyebrow">Live Preview</div>
          <h2 className="mt-2 text-2xl font-black text-text">ასე გამოჩნდება რეკლამა</h2>
        </div>

        <article className="relative grid min-h-[13rem] overflow-hidden rounded-[1.75rem] border border-[#dfd6c2] bg-[#faf5e9] shadow-[0_12px_34px_rgba(31,74,67,0.07)] sm:grid-cols-[minmax(0,1fr)_10rem]">
          <div className="relative z-10 flex min-w-0 flex-col justify-center p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-fit rounded-full border border-brand/15 bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-brand">
                რეკლამა
              </span>
              {advertiserName ? <span className="truncate text-xs font-semibold text-text-soft">{advertiserName}</span> : null}
            </div>
            <h3 className="mt-3 text-xl font-black leading-tight tracking-[-0.025em] text-brand sm:text-2xl">
              {title || "შენი სარეკლამო სათაური"}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-soft">
              {description || "აქ გამოჩნდება შენი მოკლე სარეკლამო ტექსტი."}
            </p>
            <span className="mt-4 inline-flex min-h-11 w-fit items-center justify-center rounded-xl bg-brand px-5 text-sm font-black text-white">
              შეთავაზების ნახვა
            </span>
          </div>

          <div aria-hidden="true" className="relative hidden overflow-hidden border-l border-[#dfd6c2] bg-[radial-gradient(circle_at_30%_30%,rgba(158,227,218,0.9),transparent_36%),linear-gradient(145deg,#e8f4ef,#f4e7c7)] sm:block">
            <div className="absolute -right-8 top-4 h-24 w-24 rounded-full border border-brand/15" />
            <div className="absolute bottom-5 left-5 h-12 w-12 rounded-2xl bg-brand/90" />
          </div>
        </article>

        <div className="mt-4 rounded-[1.25rem] border border-line bg-white p-4 text-sm leading-6 text-text-soft">
          დაკლიკებისას მომხმარებელი გადავა: <span className="break-all font-semibold text-text">{targetUrl || "ჯერ არ არის მითითებული"}</span>
        </div>
      </section>
    </div>
  )
}
