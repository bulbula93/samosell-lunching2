import { buildMapUrl, normalizeInstagramHandle, normalizeTelegramHandle, normalizeUrl, toInstagramUrl, toTelegramUrl, toWhatsAppUrl } from "@/lib/profiles"
import { buildTikTokProfileUrl } from "@/lib/tiktok"

export type StoreContacts = {
  instagram?: string | null
  facebook?: string | null
  tiktok?: string | null
  whatsapp?: string | null
  telegram?: string | null
  website?: string | null
  address?: string | null
  mapUrl?: string | null
  hours?: string | null
}

type Channel = { key: string; label: string; display: string; href: string; icon: "instagram" | "facebook" | "tiktok" | "whatsapp" | "telegram" | "website" }

function displayHandle(value: string, label: string) {
  const text = value.trim()
  return text.startsWith("@") ? text : text ? "@" + text : label
}

export function getStoreContactLinks(contacts: StoreContacts): Channel[] {
  const links: Channel[] = []
  const instagram = toInstagramUrl(contacts.instagram)
  if (instagram) links.push({key:"instagram", label:"Instagram", display:displayHandle(normalizeInstagramHandle(contacts.instagram),"Instagram"), href:instagram, icon:"instagram"})
  const facebook = normalizeUrl(contacts.facebook)
  if (facebook && isSafeHttpUrl(facebook)) links.push({key:"facebook",label:"Facebook",display:"Facebook",href:facebook,icon:"facebook"})
  const tiktok = buildTikTokProfileUrl(contacts.tiktok)
  if (tiktok) links.push({key:"tiktok",label:"TikTok",display:displayHandle(String(contacts.tiktok).replace(/^@/,"").replace(/^https?:\/\/(?:www\.)?tiktok\.com\/@/i,""),"TikTok"),href:tiktok,icon:"tiktok"})
  const whatsapp = toWhatsAppUrl(contacts.whatsapp)
  if (whatsapp && isAllowedHost(whatsapp, ["wa.me", "api.whatsapp.com", "web.whatsapp.com", "chat.whatsapp.com"])) links.push({key:"whatsapp",label:"WhatsApp",display:"WhatsApp",href:whatsapp,icon:"whatsapp"})
  const telegram = toTelegramUrl(contacts.telegram)
  if (telegram) links.push({key:"telegram",label:"Telegram",display:displayHandle(normalizeTelegramHandle(contacts.telegram),"Telegram"),href:telegram,icon:"telegram"})
  const website = normalizeUrl(contacts.website)
  if (website && isSafeHttpUrl(website)) links.push({key:"website",label:"ვებსაიტი",display:"ვებსაიტი",href:website,icon:"website"})
  return links
}
function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname)
  } catch { return false }
}
function isAllowedHost(value: string, hosts: string[]) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && hosts.includes(url.hostname.toLowerCase())
  } catch { return false }
}

function ChannelIcon({name}: {name: Channel["icon"]}) {
  switch (name) {
    case "instagram": return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.8" r="0.9" fill="currentColor" stroke="none"/></svg>
    case "facebook": return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><path d="M14.1 21v-7.8h2.6l.4-3h-3V8.3c0-.9.3-1.6 1.6-1.6h1.6V4.1c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8.5v3h2.6V21h3Z"/></svg>
    case "tiktok": return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><path d="M15.5 2h-3.1v13.1a3.2 3.2 0 1 1-2.7-3.2V8.8a6.3 6.3 0 1 0 5.8 6.3V8.6a8.1 8.1 0 0 0 4.8 1.5V7.1c-2.7 0-4.8-2.2-4.8-5.1Z"/></svg>
    case "whatsapp": return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8"><path d="M12 20a8 8 0 1 0-4.1-1.1L4 20l1.3-3.7A8 8 0 0 0 12 20Z"/><path d="M8.7 8.7c1.8 4.3 3.9 6.2 6.9 6.8.6 0 1.3-.6 1.4-1.3l-2.3-1.1-1.1 1-3.2-3.2 1-1.1-1.1-2.3c-.9-.2-1.5.2-1.6 1.2Z"/></svg>
    case "telegram": return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8"><path d="M21 4 3 11l6.5 2.2L12 20l2.1-5.3L21 4Z"/><path d="m9.5 13.2 8.9-7.4"/></svg>
    case "website": return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18"/></svg>
  }
}

export default function StoreContactStrip({contacts,compact=false}: {contacts: StoreContacts;compact?:boolean}) {
  const links = getStoreContactLinks(contacts)
  const address = String(contacts.address || "").trim()
  const mapLink = buildMapUrl(address, contacts.mapUrl)
  const safeMap = isSafeHttpUrl(mapLink) ? mapLink : ""
  const hours = String(contacts.hours || "").trim()
  if (!links.length && !address && !hours) return null

  return <div aria-label="მაღაზიის სოციალური ქსელები და მდებარეობა" className={compact ? "mt-5 space-y-3" : "mt-6 space-y-4"}>
    {links.length ? (
      <div className="flex flex-wrap gap-2" aria-label="სოციალური ქსელები">
        {links.map(link => <a key={link.key} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label + " — " + link.display} title={link.label} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-[#ded7ce] bg-white/90 px-3 py-2 text-xs font-semibold text-brand shadow-sm transition hover:border-brand/40 hover:bg-white">
          <ChannelIcon name={link.icon}/>
          <span className="max-w-[125px] truncate">{link.display}</span>
        </a>)}
      </div>
    ) : null}
    {address ? <div className="rounded-2xl border border-[#e7d4c4] bg-white/75 p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 fill-none stroke-brand" strokeWidth="1.8"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-brand">ფიზიკური მაღაზიის მისამართი</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-text">{address}</p>
          {safeMap ? <a href={safeMap} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-8 items-center text-xs font-bold text-brand underline underline-offset-4">რუკაზე ნახვა ↗</a> : null}
        </div>
      </div>
    </div> : null}
    {hours ? <div className="flex items-start gap-2 text-xs leading-5 text-text-soft"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-none stroke-current" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg><span className="whitespace-pre-wrap break-words">{hours}</span></div> : null}
  </div>
}
