import Link from "next/link"
import type { ReactNode } from "react"
import {
  buildMapEmbedUrl,
  buildMapUrl,
  normalizeInstagramHandle,
  normalizeTelegramHandle,
  normalizeUrl,
  parseWeeklyHours,
  toInstagramUrl,
  toTelegramUrl,
  toTelHref,
  toWhatsAppUrl,
} from "@/lib/profiles"

type StorefrontPanelsProps = {
  phone?: string | null
  whatsapp?: string | null
  telegram?: string | null
  instagram?: string | null
  facebook?: string | null
  website?: string | null
  hours?: string | null
  address?: string | null
  mapUrl?: string | null
  compact?: boolean
  variant?: "default" | "sidebar"
  sellerName?: string
  primaryListingHref?: string | null
}

function SocialPill({ href, label, icon, helper }: { href: string; label: string; icon: ReactNode; helper?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:border-neutral-400 hover:bg-neutral-50"
    >
      <span className="inline-flex h-5 w-5 items-center justify-center text-neutral-700">{icon}</span>
      <span>{label}</span>
      {helper ? <span className="hidden text-neutral-500 sm:inline">{helper}</span> : null}
    </a>
  )
}

function ActionButton({ href, label, primary = false, external = false }: { href: string; label: string; primary?: boolean; external?: boolean }) {
  const className = primary
    ? "inline-flex min-h-11 items-center justify-center rounded-full bg-neutral-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
    : "inline-flex min-h-11 items-center justify-center rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-800 transition hover:border-neutral-400 hover:bg-neutral-50"

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {label}
      </a>
    )
  }

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="0.9" className="fill-current stroke-none" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <path d="M12 20a8 8 0 1 0-4.1-1.1L4 20l1.3-3.7A8 8 0 0 0 12 20Z" />
      <path d="M9.4 8.8c.2-.4.5-.4.7-.4h.5c.2 0 .4 0 .5.4l.6 1.5c.1.2 0 .5-.1.6l-.5.6c-.1.1-.2.3 0 .5.3.6.9 1.2 1.5 1.5.2.1.4.1.5 0l.6-.5c.1-.1.4-.2.6-.1l1.5.6c.3.1.4.3.4.5v.5c0 .2 0 .5-.4.7-.4.2-1 .4-1.7.2-1.1-.3-2.4-1.2-3.5-2.3-1.1-1.1-2-2.4-2.3-3.5-.2-.7 0-1.3.2-1.7Z" />
    </svg>
  )
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <path d="M21 4 3 11l6.5 2.2L12 20l2.1-5.3L21 4Z" />
      <path d="m9.5 13.2 8.9-7.4" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <path d="M13 21v-7h2.6l.4-3H13V9.2c0-.9.3-1.5 1.6-1.5H16V5.1c-.3 0-1.2-.1-2.2-.1-2.2 0-3.8 1.3-3.8 3.9V11H7v3h2.8v7H13Z" />
    </svg>
  )
}

function WebsiteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 12h17" />
      <path d="M12 3c2.8 2.6 4.4 5.6 4.4 9S14.8 18.4 12 21" />
      <path d="M12 3c-2.8 2.6-4.4 5.6-4.4 9S9.2 18.4 12 21" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z" />
      <path d="M9 3v15" />
      <path d="M15 6v15" />
    </svg>
  )
}

function dayOrder(label: string) {
  const value = label.toLowerCase().trim()
  if (/(ორშ|monday|mon)/.test(value)) return 1
  if (/(სამშ|tuesday|tue)/.test(value)) return 2
  if (/(ოთხ|wednesday|wed)/.test(value)) return 3
  if (/(ხუთ|thursday|thu)/.test(value)) return 4
  if (/(პარასკ|friday|fri)/.test(value)) return 5
  if (/(შაბათ|saturday|sat)/.test(value)) return 6
  if (/(კვირა|sunday|sun)/.test(value)) return 7
  return 99
}

function isClosedLabel(value: string) {
  return /(დახურული|closed|უქმე|არ მუშაობს)/i.test(value)
}

export default function StorefrontPanels({
  phone,
  whatsapp,
  telegram,
  instagram,
  facebook,
  website,
  hours,
  address,
  mapUrl,
  compact = false,
  variant = "default",
  sellerName,
  primaryListingHref,
}: StorefrontPanelsProps) {
  const instagramHandle = normalizeInstagramHandle(instagram)
  const instagramUrl = toInstagramUrl(instagram)
  const facebookUrl = normalizeUrl(facebook)
  const websiteUrl = normalizeUrl(website)
  const phoneHref = toTelHref(phone)
  const whatsappUrl = toWhatsAppUrl(whatsapp || phone)
  const telegramHandle = normalizeTelegramHandle(telegram)
  const telegramUrl = toTelegramUrl(telegram)
  const directMapUrl = buildMapUrl(address, mapUrl)
  const embeddedMapUrl = buildMapEmbedUrl(address, mapUrl)
  const weeklyHours = parseWeeklyHours(hours).sort((a, b) => dayOrder(a.label) - dayOrder(b.label))

  const hasAny = Boolean(phone || whatsappUrl || telegramUrl || instagramUrl || facebookUrl || websiteUrl || weeklyHours.length || address || directMapUrl || embeddedMapUrl)
  if (!hasAny) return null

  const ctaTitle = sellerName ? `ესაუბრე ${sellerName}` : "ესაუბრე მაღაზიას"
  const primaryAction = whatsappUrl
    ? { href: whatsappUrl, label: "WhatsApp-ზე მიწერა", external: true }
    : telegramUrl
      ? { href: telegramUrl, label: "Telegram-ზე მიწერა", external: true }
      : instagramUrl
        ? { href: instagramUrl, label: "Instagram-ზე გადასვლა", external: true }
        : phoneHref
          ? { href: phoneHref, label: "დარეკვა", external: true }
          : primaryListingHref
            ? { href: primaryListingHref, label: "აირჩიე ნივთი და მისწერე", external: false }
            : null

  const secondaryAction = primaryListingHref ? { href: primaryListingHref, label: "აქტიური განცხადებების ნახვა", external: false } : null
  const quickChannels = [instagramUrl, whatsappUrl, telegramUrl, facebookUrl, websiteUrl, directMapUrl].filter(Boolean).length

  if (variant === "sidebar") {
    return (
      <div className="space-y-4 lg:sticky lg:top-24">
        <div className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,1),_rgba(245,245,245,1),_rgba(234,234,234,1))] px-5 py-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">სწრაფი კონტაქტი</div>
            <div className="mt-2 text-2xl font-black text-neutral-950">{ctaTitle}</div>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              {quickChannels > 0
                ? "მაღაზიასთან დაკავშირება შეგიძლია პირდაპირ სოციალური არხებით, ტელეფონით ან განცხადების გვერდიდან ჩატის დაწყებით."
                : "თუ შიდა ჩატის გამოყენება გინდა, გახსენი ნებისმიერი აქტიური განცხადება და იქიდან დაიწყე მიწერა."}
            </p>
          </div>
          <div className="space-y-3 px-5 py-5">
            {primaryAction ? <ActionButton href={primaryAction.href} label={primaryAction.label} external={primaryAction.external} primary /> : null}
            {secondaryAction ? <ActionButton href={secondaryAction.href} label={secondaryAction.label} external={secondaryAction.external} /> : null}
            <div className="grid gap-2 pt-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {phone ? (
                <a href={phoneHref || undefined} className="rounded-[1.25rem] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm transition hover:border-neutral-300 hover:bg-white">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">ტელეფონი</div>
                  <div className="mt-1 font-black text-neutral-950">{phone}</div>
                </a>
              ) : null}
              {telegram ? (
                <a href={telegramUrl || undefined} target="_blank" rel="noreferrer" className="rounded-[1.25rem] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm transition hover:border-neutral-300 hover:bg-white">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Telegram</div>
                  <div className="mt-1 font-black text-neutral-950">{telegramHandle ? `@${telegramHandle}` : telegram}</div>
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {(instagramUrl || whatsappUrl || telegramUrl || facebookUrl || websiteUrl || directMapUrl) ? (
          <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">საკონტაქტო არხები</div>
            <div className="mt-2 text-xl font-black text-neutral-950">მაღაზიის კონტაქტები</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {instagramUrl ? <SocialPill href={instagramUrl} label="Instagram" helper={instagramHandle ? `@${instagramHandle}` : undefined} icon={<InstagramIcon />} /> : null}
              {whatsappUrl ? <SocialPill href={whatsappUrl} label="WhatsApp" icon={<WhatsAppIcon />} /> : null}
              {telegramUrl ? <SocialPill href={telegramUrl} label="Telegram" icon={<TelegramIcon />} /> : null}
              {facebookUrl ? <SocialPill href={facebookUrl} label="Facebook" icon={<FacebookIcon />} /> : null}
              {websiteUrl ? <SocialPill href={websiteUrl} label="ვებსაიტი" icon={<WebsiteIcon />} /> : null}
              {directMapUrl ? <SocialPill href={directMapUrl} label="რუკაზე გახსნა" icon={<MapIcon />} /> : null}
            </div>
          </div>
        ) : null}

        {weeklyHours.length > 0 ? (
          <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">სამუშაო გრაფიკი</div>
            <div className="mt-2 text-xl font-black text-neutral-950">სამუშაო დღეები და საათები</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {weeklyHours.map((item, index) => {
                const closed = isClosedLabel(item.value)
                return (
                  <div
                    key={`${item.label}-${index}`}
                    className="overflow-hidden rounded-[1.35rem] border border-neutral-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#fafafa_100%)] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.04)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">დღე</div>
                        <div className="mt-1 text-base font-black text-neutral-950">{item.label}</div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${closed ? "bg-neutral-200 text-neutral-700" : "bg-emerald-100 text-emerald-800"}`}>
                        {closed ? "დახურულია" : "ღიაა"}
                      </span>
                    </div>
                    <div className="mt-4 rounded-[1rem] bg-neutral-950 px-3 py-2 text-sm font-semibold text-white">{item.value}</div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        {(address || embeddedMapUrl) ? (
          <div className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-sm">
            <div className="px-5 pt-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">მდებარეობა</div>
              <div className="mt-2 text-xl font-black text-neutral-950">მაღაზიის მისამართი და რუკა</div>
              {address ? <p className="mt-3 text-sm leading-6 text-neutral-600">{address}</p> : null}
            </div>
            {embeddedMapUrl ? (
              <div className="mt-4 border-t border-neutral-200 bg-neutral-100">
                <iframe
                  title="მაღაზიის რუკა"
                  src={embeddedMapUrl}
                  className="h-72 w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={`${compact ? "mt-4" : "mt-8"} rounded-[1.75rem] border border-neutral-200 bg-white/90 p-5 shadow-sm`}>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">მაღაზიის ინფორმაცია</div>
      <div className="mt-2 text-2xl font-black text-neutral-950">კონტაქტები და ვიზიტის დეტალები</div>

      {(instagramUrl || whatsappUrl || telegramUrl || facebookUrl || websiteUrl || directMapUrl) ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {instagramUrl ? <SocialPill href={instagramUrl} label="Instagram" helper={instagramHandle ? `@${instagramHandle}` : undefined} icon={<InstagramIcon />} /> : null}
          {whatsappUrl ? <SocialPill href={whatsappUrl} label="WhatsApp" icon={<WhatsAppIcon />} /> : null}
          {telegramUrl ? <SocialPill href={telegramUrl} label="Telegram" icon={<TelegramIcon />} /> : null}
          {facebookUrl ? <SocialPill href={facebookUrl} label="Facebook" icon={<FacebookIcon />} /> : null}
          {websiteUrl ? <SocialPill href={websiteUrl} label="ვებსაიტი" icon={<WebsiteIcon />} /> : null}
          {directMapUrl ? <SocialPill href={directMapUrl} label="რუკაზე გახსნა" icon={<MapIcon />} /> : null}
        </div>
      ) : null}

      <div className={`mt-4 grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
        {phone ? (
          <a href={phoneHref || undefined} className="rounded-[1.25rem] border border-neutral-200 bg-white px-4 py-4 text-sm font-semibold text-neutral-800 transition hover:border-neutral-300">
            <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">ტელეფონი</div>
            <div className="mt-2 text-base font-black">{phone}</div>
          </a>
        ) : null}
        {whatsapp ? (
          <a href={whatsappUrl || undefined} target="_blank" rel="noreferrer" className="rounded-[1.25rem] border border-neutral-200 bg-white px-4 py-4 text-sm font-semibold text-neutral-800 transition hover:border-neutral-300">
            <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">WhatsApp</div>
            <div className="mt-2 text-base font-black">{whatsapp}</div>
          </a>
        ) : null}
        {telegram ? (
          <a href={telegramUrl || undefined} target="_blank" rel="noreferrer" className="rounded-[1.25rem] border border-neutral-200 bg-white px-4 py-4 text-sm font-semibold text-neutral-800 transition hover:border-neutral-300">
            <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">Telegram</div>
            <div className="mt-2 text-base font-black">{telegramHandle ? `@${telegramHandle}` : telegram}</div>
          </a>
        ) : null}
      </div>

      {weeklyHours.length > 0 ? (
        <div className="mt-4 rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">სამუშაო დღეები და საათები</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {weeklyHours.map((item, index) => (
              <div key={`${item.label}-${index}`} className="flex items-center justify-between rounded-[1rem] border border-neutral-200 bg-white px-4 py-3 text-sm">
                <span className="font-semibold text-neutral-900">{item.label}</span>
                <span className="text-neutral-600">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {address ? (
        <div className="mt-4 rounded-[1.25rem] border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm leading-6 text-neutral-700">
          <span className="font-semibold text-neutral-900">მისამართი:</span> {address}
        </div>
      ) : null}

      {embeddedMapUrl ? (
        <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-neutral-200 bg-neutral-100">
          <iframe
            title="მაღაზიის რუკა"
            src={embeddedMapUrl}
            className={`w-full border-0 ${compact ? "h-56" : "h-72"}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      ) : null}
    </div>
  )
}
