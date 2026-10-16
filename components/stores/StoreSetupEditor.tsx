import type { ChangeEvent, ReactNode, Ref } from "react"
import StoreHeroMockup from "@/components/stores/StoreHeroMockup"
import type { StoreContacts } from "@/components/stores/StoreContactStrip"
import { normalizeStoreHero, STORE_HERO_LIMITS, type StoreHeroContent } from "@/lib/store-hero"
import { SELLER_PHONE_MAX_LENGTH } from "@/lib/phone"

export type StoreSetupValues = {
  name: string
  username: string
  city: string
  bio: string
  hero: StoreHeroContent
  phone: string
  contacts: StoreContacts
  hasPhysicalStore: boolean
}

type Props = {
  value: StoreSetupValues
  onChange: (value: StoreSetupValues) => void
  coverUrl: string
  logoUrl: string
  coverInputRef: Ref<HTMLInputElement>
  logoInputRef: Ref<HTMLInputElement>
  onAssetSelect: (kind: "cover" | "logo", event: ChangeEvent<HTMLInputElement>) => void
  onAssetRemove: (kind: "cover" | "logo") => void
  disabled: boolean
  demo: boolean
  footer: ReactNode
}

export default function StoreSetupEditor({ value, onChange, coverUrl, logoUrl, coverInputRef, logoInputRef, onAssetSelect, onAssetRemove, disabled, demo, footer }: Props) {
  const update = <K extends keyof StoreSetupValues>(key: K, next: StoreSetupValues[K]) => onChange({ ...value, [key]: next })
  const updateHero = (key: keyof StoreHeroContent, text: string) => update("hero", { ...value.hero, [key]: text.slice(0, STORE_HERO_LIMITS[key]) })
  const updateContact = (key: keyof StoreContacts, text: string) => update("contacts", { ...value.contacts, [key]: text })

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <fieldset disabled={disabled} className="ui-card min-w-0 space-y-5 p-5 sm:p-6">
        <legend className="sr-only">მაღაზიის ინფორმაცია</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="ui-field-label">მაღაზიის სახელი</span>
            <input className="ui-input h-12 rounded-2xl" required={!demo} maxLength={80} value={value.name} onChange={e => update("name", e.target.value)} placeholder="შენი მაღაზიის სახელი" />
          </label>
          <label className="block"><span className="ui-field-label">ქალაქი</span>
            <input className="ui-input h-12 rounded-2xl" maxLength={80} value={value.city} onChange={e => update("city", e.target.value)} placeholder="მაგ: თბილისი" />
          </label>
        </div>
        <label className="block"><span className="ui-field-label">მომხმარებლის სახელი</span>
          <input className="ui-input h-12 rounded-2xl" required={!demo} maxLength={40} pattern="[A-Za-z0-9_.-]{3,40}" value={value.username} onChange={e => update("username", e.target.value)} placeholder="my_shop" autoCapitalize="none" autoCorrect="off" />
          <span className="mt-1 block text-xs leading-5 text-text-soft">მაღაზიის ბმული: samosell.ge/seller/{value.username || "my_shop"} — გამოიყენე 3–40 ლათინური ასო, ციფრი, წერტილი, ტირე ან ქვედა ტირე</span>
        </label>

        {([
          { key: "eyebrow", label: "ზედა წარწერა", placeholder: "მაგ: ვინტაჟური მაღაზია" },
          { key: "headline", label: "მთავარი სათაური", placeholder: "შენი მაღაზიის სათაური" },
          { key: "coverTitle", label: "ქავერის ბარათის სათაური", placeholder: "მოკლე სლოგანი" },
          { key: "coverSubtitle", label: "ქავერის ბარათის მცირე ტექსტი", placeholder: "მცირე აღწერა" },
        ] as const).map(({ key, label, placeholder }) => (
          <label key={key} className="block"><span className="ui-field-label">{label}</span>
            <input className="ui-input h-12 rounded-2xl" maxLength={STORE_HERO_LIMITS[key]} value={value.hero[key]} onChange={e => updateHero(key, e.target.value)} placeholder={placeholder} />
          </label>
        ))}
        <label className="block"><span className="ui-field-label">მთავარი აღწერა</span>
          <textarea className="ui-textarea min-h-28" rows={3} maxLength={STORE_HERO_LIMITS.description} value={value.hero.description} onChange={e => updateHero("description", e.target.value)} placeholder="მოკლედ აღწერე შენი მაღაზია და კოლექცია" />
        </label>
        <label className="block"><span className="ui-field-label">მაღაზიის შესახებ</span>
          <textarea className="ui-textarea min-h-20" rows={2} maxLength={2000} value={value.bio} onChange={e => update("bio", e.target.value)} placeholder="დამატებითი ინფორმაცია ბრენდებზე, მიწოდებასა და სერვისზე" />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          {([
            { kind: "cover", label: "ატვირთე ქავერი", url: coverUrl, ref: coverInputRef, ariaLabel: demo ? "დემო ქავერის ფოტო" : "მაღაზიის ქავერი" },
            { kind: "logo", label: "ატვირთე ლოგო", url: logoUrl, ref: logoInputRef, ariaLabel: demo ? "დემო მაღაზიის ლოგო" : "მაღაზიის ლოგო" },
          ] as const).map(({ kind, label, url, ref, ariaLabel }) => (
            <div key={kind} className="min-w-0 rounded-xl border border-line bg-surface-alt p-3">
              <label className="block text-sm font-semibold text-brand">{label}
                <input aria-label={ariaLabel} ref={ref} type="file" accept="image/*" onChange={e => onAssetSelect(kind, e)} className="mt-2 w-full min-w-0 text-xs text-text-soft" />
              </label>
              {url ? <button type="button" onClick={() => onAssetRemove(kind)} className="mt-2 text-xs font-bold text-brand underline underline-offset-4">{kind === "cover" ? "ქავერის წაშლა" : "ლოგოს წაშლა"}</button> : null}
            </div>
          ))}
        </div>
        <p className="text-xs leading-5 text-text-soft">სურათის მაქსიმალური ზომაა 8 მბ — ქავერის ფერები ვიტრინის ფონს ავტომატურად მოერგება</p>

        <section aria-label="სოციალური ქსელები" className="space-y-4 border-t border-line pt-5">
          <h2 className="text-lg font-bold text-brand">საკონტაქტო ინფორმაცია და სოციალური ქსელები</h2>
          <label className="block"><span className="ui-field-label">ტელეფონი</span>
            <input type="tel" inputMode="tel" autoComplete="tel" className="ui-input h-12 rounded-2xl" value={value.phone} maxLength={SELLER_PHONE_MAX_LENGTH} placeholder="+995 555 12 34 56" onChange={e => update("phone", e.target.value)} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              { key: "instagram", label: "Instagram", placeholder: "@myshop" },
              { key: "facebook", label: "Facebook", placeholder: "facebook.com/myshop" },
              { key: "tiktok", label: "TikTok", placeholder: "@myshop" },
              { key: "whatsapp", label: "WhatsApp", placeholder: "+995 555 12 34 56" },
              { key: "telegram", label: "Telegram", placeholder: "@myshop" },
              { key: "website", label: "ვებსაიტი", placeholder: "myshop.ge" },
            ] as const).map(({ key, label, placeholder }) => (
              <label key={key} className="block"><span className="ui-field-label">{label}</span>
                <input className="ui-input h-12 rounded-2xl" value={value.contacts[key] || ""} maxLength={250} placeholder={placeholder} onChange={e => updateContact(key, e.target.value)} />
              </label>
            ))}
          </div>
        </section>

        <section aria-label="ფიზიკური მაღაზია" className="space-y-4 rounded-2xl border border-line bg-[#fff8f0] p-4">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-brand">
            <input type="checkbox" checked={value.hasPhysicalStore} onChange={e => update("hasPhysicalStore", e.target.checked)} className="h-5 w-5 accent-brand" />
            მაქვს ფიზიკური მაღაზია
          </label>
          {value.hasPhysicalStore ? <>
            <label className="block"><span className="ui-field-label">ფიზიკური მაღაზიის მისამართი</span>
              <textarea className="ui-textarea min-h-20" value={value.contacts.address || ""} maxLength={250} placeholder="მაგ: თბილისი, აბაშიძის ქუჩა 10" onChange={e => updateContact("address", e.target.value)} />
            </label>
            <label className="block"><span className="ui-field-label">რუკის ბმული (არასავალდებულო)</span>
              <input className="ui-input h-12 rounded-2xl" value={value.contacts.mapUrl || ""} maxLength={250} placeholder="https://maps.google.com/..." onChange={e => updateContact("mapUrl", e.target.value)} />
            </label>
            <label className="block"><span className="ui-field-label">სამუშაო საათები</span>
              <textarea className="ui-textarea min-h-20" value={value.contacts.hours || ""} maxLength={500} placeholder="ორშაბათი–შაბათი: 10:00–19:00" onChange={e => updateContact("hours", e.target.value)} />
            </label>
          </> : <p className="text-xs leading-5 text-text-soft">თუ მხოლოდ ონლაინ ყიდი, ფიზიკური მისამართი არ მოითხოვება</p>}
        </section>
        {footer}
      </fieldset>

      <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
        <p className="mb-3 text-xs font-bold text-brand">ასე დაინახავენ მომხმარებლები შენს მაღაზიას</p>
        <StoreHeroMockup storeName={value.name} username={value.username} city={value.city}
          hero={normalizeStoreHero({ ...value.hero, description: value.hero.description || value.bio })}
          contacts={value.hasPhysicalStore ? value.contacts : { ...value.contacts, address: "", mapUrl: "", hours: "" }}
          coverUrl={coverUrl} logoUrl={logoUrl} caption={demo ? "ცოცხალი წინასწარი ნახვა · დემო" : "შენი მაღაზიის ცოცხალი წინასწარი ნახვა"} />
      </div>
    </div>
  )
}
