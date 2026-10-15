"use client"

import { useEffect, useState, type ChangeEvent } from "react"
import StoreHeroMockup from "@/components/stores/StoreHeroMockup"
import type { StoreContacts } from "@/components/stores/StoreContactStrip"
import { normalizeStoreHero, STORE_HERO_LIMITS, type StoreHeroContent } from "@/lib/store-hero"

const exampleHero: StoreHeroContent = {
  eyebrow: "ვინტაჟური სამოსი · თბილისი",
  headline: "სტილი, რომელსაც თავისი ისტორია აქვს",
  description: "შერჩეული სამოსი და აქსესუარები ახალი აღმოჩენებისთვის.",
  coverTitle: "შენი შემდეგი რჩეული",
  coverSubtitle: "შერჩეული ნივთები",
}

export default function StoreHeroEditorDemo() {
  const [storeName, setStoreName] = useState("ჩემი მაღაზია")
  const [city, setCity] = useState("თბილისი")
  const [hero, setHero] = useState<StoreHeroContent>(exampleHero)
  const [contacts, setContacts] = useState<StoreContacts>({
    instagram: "@samosell.ge", facebook: "", tiktok: "", whatsapp: "", telegram: "",
    website: "", address: "", mapUrl: "", hours: "",
  })
  const [hasPhysicalStore, setHasPhysicalStore] = useState(false)
  function updateContact(key: keyof StoreContacts, value: string) {
    setContacts((prev) => ({...prev, [key]: value.slice(0, key === "hours" ? 500 : 250)}))
  }
  const [coverPreview, setCoverPreview] = useState("")
  const [logoPreview, setLogoPreview] = useState("")
  const [error, setError] = useState("")

  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview)
    if (logoPreview) URL.revokeObjectURL(logoPreview)
  }, [coverPreview, logoPreview])

  function onFileSelect(event: ChangeEvent<HTMLInputElement>, kind: "cover" | "logo") {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      setError("აირჩიე სურათი, რომლის ზომა მაქსიმუმ 8 მბ-ია.")
      event.target.value = ""
      return
    }
    setError("")
    const objectUrl = URL.createObjectURL(file)
    if (kind === "cover") setCoverPreview(objectUrl)
    else setLogoPreview(objectUrl)
  }
  const update = (key: keyof StoreHeroContent, text: string) =>
    setHero((current) => normalizeStoreHero({ ...current, [key]: text }))

  return (
    <div className="ui-container pb-16 pt-9">
      <div className="mb-7 max-w-3xl">
        <p className="text-xs font-black text-[#b47b5d]">მაღაზიის ვიტრინის კონსტრუქტორი · დემო</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-brand sm:text-4xl">შექმენი შენი მაღაზიის მთავარი ბლოკი</h1>
        <p className="mt-4 text-sm leading-7 text-text-soft">შეიყვანე ნებისმიერი სათაური, აღწერა და წარწერა, ან აირჩიე საკუთარი სურათები. ქვემოთ ცვლილებებს მაშინვე დაინახავ. ეს არის მხოლოდ ვიზუალური დემო: მონაცემები არ ინახება და არ იტვირთება სერვერზე.</p>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="ui-card space-y-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="ui-field-label">მაღაზიის სახელი</span><input className="ui-input h-12 rounded-2xl" maxLength={80} value={storeName} onChange={(e)=>setStoreName(e.target.value)} /></label>
            <label className="block"><span className="ui-field-label">ქალაქი</span><input className="ui-input h-12 rounded-2xl" maxLength={80} value={city} onChange={(e)=>setCity(e.target.value)} /></label>
          </div>

          {([
            { key: "eyebrow", label: "ზედა წარწერა", placeholder: "მაგ: ვინტაჟური მაღაზია"},
            { key: "headline", label: "მთავარი სათაური", placeholder: "შენი მაღაზიის სათაური"},
            { key: "coverTitle", label: "ქავერის ბარათის სათაური", placeholder: "მოკლე სლოგანი"},
            { key: "coverSubtitle", label: "ქავერის ბარათის მცირე ტექსტი", placeholder: "მცირე აღწერა"},
          ] as const).map((item)=>(
            <label key={item.key} className="block">
              <span className="ui-field-label">{item.label}</span>
              <input className="ui-input h-12 rounded-2xl" maxLength={STORE_HERO_LIMITS[item.key]} value={hero[item.key]} onChange={(e)=>update(item.key,e.target.value)} placeholder={item.placeholder} />
            </label>
          ))}
          <label className="block"><span className="ui-field-label">მთავარი აღწერა</span><textarea className="ui-textarea min-h-28" rows={3} maxLength={STORE_HERO_LIMITS.description} value={hero.description} onChange={(e)=>update("description",e.target.value)} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block rounded-xl border border-line bg-surface-alt p-3 text-sm font-semibold text-brand">ატვირთე ქავერი
              <input aria-label="დემო ქავერის ფოტო" type="file" accept="image/*" onChange={(e)=>onFileSelect(e,"cover")} className="mt-2 w-full min-w-0 text-xs text-text-soft"/>
            </label>
            <label className="block rounded-xl border border-line bg-surface-alt p-3 text-sm font-semibold text-brand">ატვირთე ლოგო
              <input aria-label="დემო მაღაზიის ლოგო" type="file" accept="image/*" onChange={(e)=>onFileSelect(e,"logo")} className="mt-2 w-full min-w-0 text-xs text-text-soft"/>
            </label>
          </div>
          <section aria-label="სოციალური ქსელები" className="space-y-4 border-t border-line pt-5">
            <div>
              <h2 className="text-lg font-bold text-brand">სოციალური ქსელები და საკონტაქტო ბმულები</h2>
              <p className="mt-1 text-xs leading-5 text-text-soft">შეავსე მხოლოდ არსებული არხები. მათთან ერთად ლოგოები და ბმულები გამოჩნდება მაღაზიის მთავარ ბლოკში.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                {key:"instagram", label:"Instagram",placeholder:"@myshop"},
                {key:"facebook", label:"Facebook",placeholder:"facebook.com/myshop"},
                {key:"tiktok", label:"TikTok",placeholder:"@myshop"},
                {key:"whatsapp", label:"WhatsApp",placeholder:"+995 555 12 34 56"},
                {key:"telegram", label:"Telegram",placeholder:"@myshop"},
                {key:"website", label:"ვებსაიტი",placeholder:"myshop.ge"},
              ] as const).map(({key,label,placeholder})=>(
                <label key={key} className="block"><span className="ui-field-label">{label}</span>
                  <input className="ui-input h-12 rounded-2xl" value={contacts[key] || ""} maxLength={250} placeholder={placeholder} onChange={e=>updateContact(key,e.target.value)}/>
                </label>
              ))}
            </div>
          </section>

          <section aria-label="ფიზიკური მაღაზია" className="space-y-4 rounded-2xl border border-line bg-[#fff8f0] p-4">
            <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-brand">
              <input type="checkbox" checked={hasPhysicalStore} onChange={e=>setHasPhysicalStore(e.target.checked)} className="h-5 w-5 accent-brand" />
              მაქვს ფიზიკური მაღაზია
            </label>
            {hasPhysicalStore ? <>
              <label className="block"><span className="ui-field-label">ფიზიკური მაღაზიის მისამართი</span>
                <textarea className="ui-textarea min-h-20" value={contacts.address || ""} maxLength={250} placeholder="მაგ: თბილისი, აბაშიძის ქუჩა 10" onChange={e=>updateContact("address",e.target.value)}/></label>
              <label className="block"><span className="ui-field-label">რუკის ბმული (არასავალდებულო)</span>
                <input className="ui-input h-12 rounded-2xl" value={contacts.mapUrl || ""} maxLength={250} placeholder="https://maps.google.com/..." onChange={e=>updateContact("mapUrl",e.target.value)}/></label>
              <label className="block"><span className="ui-field-label">სამუშაო საათები</span>
                <textarea className="ui-textarea min-h-20" value={contacts.hours || ""} maxLength={500} placeholder="ორშაბათი–შაბათი: 10:00–19:00" onChange={e=>updateContact("hours",e.target.value)}/></label>
            </> : <p className="text-xs leading-5 text-text-soft">თუ მხოლოდ ონლაინ ყიდი, ფიზიკური მისამართი საჯარო გვერდზე არ გამოჩნდება.</p>}
          </section>
          {error ? <p role="alert" className="text-sm font-semibold text-red-700">{error}</p> : null}
          <button type="button" className="rounded-xl border border-line px-5 py-3 text-sm font-bold text-brand" onClick={()=>{setHero(normalizeStoreHero({}));setStoreName("");setCity("");setContacts({});setHasPhysicalStore(false);setCoverPreview("");setLogoPreview("");setError("")}}>ყველაფრის გასუფთავება</button>
          <p className="text-xs leading-6 text-text-soft">საბოლოო ვერსიაში ეს ყველაფერი პროფილში შეინახება. ღილაკები „მიწერა“, „გამოწერა“ და „კოლექციის ნახვა“ ფუნქციური ელემენტებია და მათი წაშლა არ არის შესაძლებელი.</p>
        </div>
        <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
          <p className="mb-3 text-xs font-bold text-brand">ასე დაინახავენ მომხმარებლები შენს მაღაზიას</p>
          <StoreHeroMockup
            storeName={storeName}
            city={city}
            hero={hero}
            contacts={hasPhysicalStore ? contacts : {...contacts, address:"", mapUrl:"", hours:""}}
            logoUrl={logoPreview}
            coverUrl={coverPreview || "/brand/samosell-shops-boutique.webp"}
            caption="ცოცხალი წინასწარი ნახვა · დემო"
          />
        </div>
      </div>
    </div>
  )
}
