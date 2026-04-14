"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Avatar from "@/components/shared/Avatar"
import SmartImage from "@/components/shared/SmartImage"
import { extractStoragePathFromPublicUrl, humanizeSupabaseError } from "@/lib/listings"
import { getSellerVisualAvatar, sellerTypeLabel } from "@/lib/profiles"
import { createClient } from "@/lib/supabase/client"

type ProfileFormProps = {
  userId: string
  initialProfile: {
    username: string
    full_name: string
    bio: string
    city: string
    avatar_url: string
    seller_type: string
    store_logo_url: string
    store_banner_url: string
    store_phone: string
    store_whatsapp: string
    store_telegram: string
    store_instagram: string
    store_facebook: string
    store_website: string
    store_hours: string
    store_address: string
    store_map_url: string
  }
}

const sellerTypeOptions = [
  { value: "individual", label: "ფიზიკური პირი", helper: "ყიდი პირადი კარადიდან ან კერძო ანგარიშით." },
  { value: "store", label: "მაღაზია", helper: "ბრენდის, შოურუმის ან ონლაინ მაღაზიის პროფილი." },
] as const

const AVATAR_BUCKET = "avatars"
const BRANDING_BUCKET = "store-branding"
const MAX_AVATAR_FILE_SIZE_MB = 5
const MAX_BRANDING_FILE_SIZE_MB = 8

function validateImageFile(file: File, maxFileSizeMb: number) {
  if (!file.type.startsWith("image/")) return "მხოლოდ სურათის ატვირთვაა შესაძლებელი."
  if (file.size > maxFileSizeMb * 1024 * 1024) return `ფაილი ძალიან დიდია. მაქსიმალური ზომაა ${maxFileSizeMb}MB.`
  return null
}

function getFileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
  return extension.replace(/[^a-z0-9]/g, "") || "jpg"
}

type AssetCardProps = {
  title: string
  description: string
  preview: ReactNode
  onChoose: () => void
  onRemove: () => void
  buttonLabel: string
  hint: string
}

function AssetCard({ title, description, preview, onChoose, onRemove, buttonLabel, hint }: AssetCardProps) {
  return (
    <div className="rounded-[1.75rem] border border-neutral-200 bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.16em] text-neutral-500">{title}</div>
          <div className="mt-2 text-xl font-black text-neutral-950">{description}</div>
        </div>
        <div className="shrink-0">{preview}</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={onChoose} className="h-11 rounded-2xl bg-black px-5 text-sm font-semibold text-white">
          {buttonLabel}
        </button>
        <button type="button" onClick={onRemove} className="h-11 rounded-2xl border border-neutral-300 px-5 text-sm font-semibold text-neutral-700">
          წაშლა
        </button>
      </div>
      <div className="mt-3 text-xs leading-5 text-neutral-500">{hint}</div>
    </div>
  )
}

export default function ProfileForm({ userId, initialProfile }: ProfileFormProps) {
  const [username, setUsername] = useState(initialProfile.username)
  const [fullName, setFullName] = useState(initialProfile.full_name)
  const [bio, setBio] = useState(initialProfile.bio)
  const [city, setCity] = useState(initialProfile.city)
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatar_url)
  const [sellerType, setSellerType] = useState(initialProfile.seller_type || "individual")
  const [storeLogoUrl, setStoreLogoUrl] = useState(initialProfile.store_logo_url)
  const [storeBannerUrl, setStoreBannerUrl] = useState(initialProfile.store_banner_url)
  const [storePhone, setStorePhone] = useState(initialProfile.store_phone)
  const [storeWhatsapp, setStoreWhatsapp] = useState(initialProfile.store_whatsapp)
  const [storeTelegram, setStoreTelegram] = useState(initialProfile.store_telegram)
  const [storeInstagram, setStoreInstagram] = useState(initialProfile.store_instagram)
  const [storeFacebook, setStoreFacebook] = useState(initialProfile.store_facebook)
  const [storeWebsite, setStoreWebsite] = useState(initialProfile.store_website)
  const [storeHours, setStoreHours] = useState(initialProfile.store_hours)
  const [storeAddress, setStoreAddress] = useState(initialProfile.store_address)
  const [storeMapUrl, setStoreMapUrl] = useState(initialProfile.store_map_url)

  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null)
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null)
  const [selectedBannerFile, setSelectedBannerFile] = useState<File | null>(null)

  const [selectedAvatarPreviewUrl, setSelectedAvatarPreviewUrl] = useState("")
  const [selectedLogoPreviewUrl, setSelectedLogoPreviewUrl] = useState("")
  const [selectedBannerPreviewUrl, setSelectedBannerPreviewUrl] = useState("")

  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [removeStoreLogo, setRemoveStoreLogo] = useState(false)
  const [removeStoreBanner, setRemoveStoreBanner] = useState(false)

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const logoInputRef = useRef<HTMLInputElement | null>(null)
  const bannerInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    return () => {
      if (selectedAvatarPreviewUrl) URL.revokeObjectURL(selectedAvatarPreviewUrl)
      if (selectedLogoPreviewUrl) URL.revokeObjectURL(selectedLogoPreviewUrl)
      if (selectedBannerPreviewUrl) URL.revokeObjectURL(selectedBannerPreviewUrl)
    }
  }, [selectedAvatarPreviewUrl, selectedLogoPreviewUrl, selectedBannerPreviewUrl])

  const visibleAvatarUrl = removeAvatar ? "" : selectedAvatarPreviewUrl || avatarUrl
  const visibleStoreLogoUrl = removeStoreLogo ? "" : selectedLogoPreviewUrl || storeLogoUrl
  const visibleStoreBannerUrl = removeStoreBanner ? "" : selectedBannerPreviewUrl || storeBannerUrl

  const publicFacingAvatar = useMemo(
    () => getSellerVisualAvatar({ seller_type: sellerType, avatar_url: visibleAvatarUrl, store_logo_url: visibleStoreLogoUrl }),
    [sellerType, visibleAvatarUrl, visibleStoreLogoUrl]
  )

  function refreshPreview(previousPreview: string, setPreview: (value: string) => void, file: File) {
    if (previousPreview) URL.revokeObjectURL(previousPreview)
    setPreview(URL.createObjectURL(file))
  }

  async function handleFileSelect(
    event: React.ChangeEvent<HTMLInputElement>,
    opts: {
      maxSizeMb: number
      previousPreview: string
      setPreview: (value: string) => void
      setFile: (file: File | null) => void
      clearRemove: () => void
    }
  ) {
    const file = event.target.files?.[0]
    if (!file) return

    const validationError = validateImageFile(file, opts.maxSizeMb)
    if (validationError) {
      setError(validationError)
      event.target.value = ""
      return
    }

    setError("")
    setSuccess("")
    opts.clearRemove()
    opts.setFile(file)
    refreshPreview(opts.previousPreview, opts.setPreview, file)
  }

  function clearSelectedFile(
    inputRef: React.RefObject<HTMLInputElement | null>,
    previousPreview: string,
    setPreview: (value: string) => void,
    setFile: (file: File | null) => void
  ) {
    if (previousPreview) URL.revokeObjectURL(previousPreview)
    setPreview("")
    setFile(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  async function uploadPublicImage(bucket: string, file: File, suffix: string) {
    const supabase = createClient()
    const filePath = `${userId}/${Date.now()}-${suffix}.${getFileExtension(file)}`
    const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    })
    if (uploadError) throw uploadError
    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath)
    return { filePath, publicUrl: publicUrlData.publicUrl }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    const supabase = createClient()

    const previousAvatarUrl = avatarUrl
    const previousStoreLogoUrl = storeLogoUrl
    const previousStoreBannerUrl = storeBannerUrl

    let nextAvatarUrl = removeAvatar ? "" : avatarUrl
    let nextStoreLogoUrl = removeStoreLogo ? "" : storeLogoUrl
    let nextStoreBannerUrl = removeStoreBanner ? "" : storeBannerUrl

    let uploadedAvatarPath: string | null = null
    let uploadedLogoPath: string | null = null
    let uploadedBannerPath: string | null = null

    try {
      if (selectedAvatarFile) {
        const uploaded = await uploadPublicImage(AVATAR_BUCKET, selectedAvatarFile, "avatar")
        uploadedAvatarPath = uploaded.filePath
        nextAvatarUrl = uploaded.publicUrl
      }

      if (sellerType === "store" && selectedLogoFile) {
        const uploaded = await uploadPublicImage(BRANDING_BUCKET, selectedLogoFile, "store-logo")
        uploadedLogoPath = uploaded.filePath
        nextStoreLogoUrl = uploaded.publicUrl
      }

      if (sellerType === "store" && selectedBannerFile) {
        const uploaded = await uploadPublicImage(BRANDING_BUCKET, selectedBannerFile, "store-banner")
        uploadedBannerPath = uploaded.filePath
        nextStoreBannerUrl = uploaded.publicUrl
      }

      const { error: saveError } = await supabase.from("profiles").upsert({
        id: userId,
        username,
        full_name: fullName,
        bio,
        city,
        avatar_url: nextAvatarUrl || null,
        seller_type: sellerType,
        store_logo_url: sellerType === "store" ? nextStoreLogoUrl || null : null,
        store_banner_url: sellerType === "store" ? nextStoreBannerUrl || null : null,
        store_phone: sellerType === "store" ? storePhone.trim() || null : null,
        store_whatsapp: sellerType === "store" ? storeWhatsapp.trim() || null : null,
        store_telegram: sellerType === "store" ? storeTelegram.trim() || null : null,
        store_instagram: sellerType === "store" ? storeInstagram.trim() || null : null,
        store_facebook: sellerType === "store" ? storeFacebook.trim() || null : null,
        store_website: sellerType === "store" ? storeWebsite.trim() || null : null,
        store_hours: sellerType === "store" ? storeHours.trim() || null : null,
        store_address: sellerType === "store" ? storeAddress.trim() || null : null,
        store_map_url: sellerType === "store" ? storeMapUrl.trim() || null : null,
      })
      if (saveError) throw saveError

      const previousAvatarPath = previousAvatarUrl ? extractStoragePathFromPublicUrl(previousAvatarUrl, AVATAR_BUCKET) : null
      const previousStoreLogoPath = previousStoreLogoUrl ? extractStoragePathFromPublicUrl(previousStoreLogoUrl, BRANDING_BUCKET) : null
      const previousStoreBannerPath = previousStoreBannerUrl ? extractStoragePathFromPublicUrl(previousStoreBannerUrl, BRANDING_BUCKET) : null

      const avatarChanged = removeAvatar || previousAvatarUrl !== nextAvatarUrl
      const logoChanged = removeStoreLogo || previousStoreLogoUrl !== nextStoreLogoUrl
      const bannerChanged = removeStoreBanner || previousStoreBannerUrl !== nextStoreBannerUrl

      if (previousAvatarPath && avatarChanged && previousAvatarPath !== uploadedAvatarPath) {
        await supabase.storage.from(AVATAR_BUCKET).remove([previousAvatarPath])
      }
      if (previousStoreLogoPath && logoChanged && previousStoreLogoPath !== uploadedLogoPath) {
        await supabase.storage.from(BRANDING_BUCKET).remove([previousStoreLogoPath])
      }
      if (previousStoreBannerPath && bannerChanged && previousStoreBannerPath !== uploadedBannerPath) {
        await supabase.storage.from(BRANDING_BUCKET).remove([previousStoreBannerPath])
      }

      setAvatarUrl(nextAvatarUrl)
      setStoreLogoUrl(nextStoreLogoUrl)
      setStoreBannerUrl(nextStoreBannerUrl)

      setRemoveAvatar(false)
      setRemoveStoreLogo(false)
      setRemoveStoreBanner(false)

      clearSelectedFile(avatarInputRef, selectedAvatarPreviewUrl, setSelectedAvatarPreviewUrl, setSelectedAvatarFile)
      clearSelectedFile(logoInputRef, selectedLogoPreviewUrl, setSelectedLogoPreviewUrl, setSelectedLogoFile)
      clearSelectedFile(bannerInputRef, selectedBannerPreviewUrl, setSelectedBannerPreviewUrl, setSelectedBannerFile)

      setSuccess("პროფილი წარმატებით განახლდა.")
    } catch (submitError) {
      const fallbackMessage = submitError instanceof Error ? submitError.message : "პროფილის შენახვა ვერ მოხერხდა."
      setError(humanizeSupabaseError(fallbackMessage))
      setLoading(false)
      return
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-neutral-50">
        {sellerType === "store" ? (
          <div className="relative h-36 border-b border-neutral-200 bg-neutral-100 sm:h-44">
            <SmartImage
              src={visibleStoreBannerUrl}
              alt={fullName || username || "მაღაზიის banner"}
              wrapperClassName="h-full w-full"
              className="object-cover"
              fallbackLabel="აქ გამოჩნდება შენი მაღაზიის cover / banner"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
          </div>
        ) : null}
        <div className="p-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar src={publicFacingAvatar} alt={fullName || username || "მომხმარებელი"} fallbackText={fullName || username || "SS"} sizeClassName="h-20 w-20" textClassName="text-2xl" />
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">საჯარო პროფილი</div>
                <div className="mt-2 text-2xl font-black text-neutral-950">{fullName || username || "შენი პროფილი"}</div>
                <div className="mt-1 text-sm text-neutral-600">{sellerTypeLabel(sellerType)} • {city || "ქალაქი ჯერ არ არის მითითებული"}</div>
              </div>
            </div>
            <div className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700">ეს ინფორმაცია ჩანს საჯარო პროფილზე და განცხადებებში.</div>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-3 block text-sm font-semibold">ანგარიშის ტიპი</label>
        <div className="grid gap-3 md:grid-cols-2">
          {sellerTypeOptions.map((option) => {
            const active = sellerType === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSellerType(option.value)}
                className={`rounded-[1.5rem] border px-4 py-4 text-left transition ${active ? "border-neutral-900 bg-neutral-100 shadow-sm" : "border-neutral-200 bg-white hover:border-neutral-300"}`}
              >
                <div className="text-base font-bold text-neutral-900">{option.label}</div>
                <div className="mt-1 text-sm leading-6 text-neutral-600">{option.helper}</div>
              </button>
            )
          })}
        </div>
      </div>

      <AssetCard
        title="ავატარი"
        description={sellerType === "store" ? "ეს არის ანგარიშის ძირითადი სურათი. სურვილის შემთხვევაში მაღაზიის ლოგო ცალკეც შეგიძლია ატვირთო ქვემოთ." : "ატვირთე შენი პროფილის ფოტო, რომელიც განცხადებებსა და ჩათებში გამოჩნდება."}
        preview={<Avatar src={visibleAvatarUrl} alt={fullName || username || "მომხმარებელი"} fallbackText={fullName || username || "SS"} sizeClassName="h-16 w-16" textClassName="text-xl" />}
        onChoose={() => avatarInputRef.current?.click()}
        onRemove={() => {
          clearSelectedFile(avatarInputRef, selectedAvatarPreviewUrl, setSelectedAvatarPreviewUrl, setSelectedAvatarFile)
          setRemoveAvatar(true)
          setSuccess("")
        }}
        buttonLabel={selectedAvatarFile ? "სხვა ფოტოს არჩევა" : "ფოტოს ატვირთვა"}
        hint={`დაშვებულია სურათის ფაილები. მაქსიმალური ზომაა ${MAX_AVATAR_FILE_SIZE_MB}MB. ცვლილება შენახვის შემდეგ აისახება პროფილზე.`}
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        onChange={(event) => handleFileSelect(event, { maxSizeMb: MAX_AVATAR_FILE_SIZE_MB, previousPreview: selectedAvatarPreviewUrl, setPreview: setSelectedAvatarPreviewUrl, setFile: setSelectedAvatarFile, clearRemove: () => setRemoveAvatar(false) })}
        className="hidden"
      />

      {sellerType === "store" ? (
        <>
          <div className="rounded-[1.75rem] border border-neutral-200 bg-neutral-50 p-5">
            <div className="text-sm font-semibold uppercase tracking-[0.16em] text-neutral-500">მაღაზიის ბრენდინგი</div>
            <div className="mt-2 text-xl font-black text-neutral-950">დაამატე მაღაზიის ცალკე ლოგო და cover / banner</div>
            <div className="mt-1 max-w-3xl text-sm leading-6 text-neutral-600">ლოგო გამოჩნდება საჯარო მაღაზიის პროფილზე და დეტალის გვერდზე. banner კი მაღაზიის გვერდს უფრო პროფესიონალურ იერს მისცემს.</div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <AssetCard
              title="მაღაზიის ლოგო"
              description="ლოგო დამოუკიდებლად გამოჩნდება მაღაზიის პროფილსა და ზოგიერთი trust block-ში."
              preview={<Avatar src={visibleStoreLogoUrl || visibleAvatarUrl} alt={fullName || username || "მაღაზიის ლოგო"} fallbackText={fullName || username || "SS"} sizeClassName="h-16 w-16" textClassName="text-xl" />}
              onChoose={() => logoInputRef.current?.click()}
              onRemove={() => {
                clearSelectedFile(logoInputRef, selectedLogoPreviewUrl, setSelectedLogoPreviewUrl, setSelectedLogoFile)
                setRemoveStoreLogo(true)
                setSuccess("")
              }}
              buttonLabel={selectedLogoFile ? "სხვა ლოგოს არჩევა" : "ლოგოს ატვირთვა"}
              hint={`ლოგოსთვისაც დაშვებულია სურათის ფაილები. მაქსიმალური ზომაა ${MAX_BRANDING_FILE_SIZE_MB}MB.`}
            />
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => handleFileSelect(event, { maxSizeMb: MAX_BRANDING_FILE_SIZE_MB, previousPreview: selectedLogoPreviewUrl, setPreview: setSelectedLogoPreviewUrl, setFile: setSelectedLogoFile, clearRemove: () => setRemoveStoreLogo(false) })}
              className="hidden"
            />

            <AssetCard
              title="მაღაზიის cover / banner"
              description="ეს ფართო სურათი გამოჩნდება მაღაზიის საჯარო გვერდის ზედა ნაწილში."
              preview={<div className="overflow-hidden rounded-[1.25rem] border border-neutral-200"><SmartImage src={visibleStoreBannerUrl} alt={fullName || username || "მაღაზიის banner"} wrapperClassName="h-24 w-56 bg-neutral-100" className="object-cover" fallbackLabel="აქ გამოჩნდება შენი მაღაზიის banner" /></div>}
              onChoose={() => bannerInputRef.current?.click()}
              onRemove={() => {
                clearSelectedFile(bannerInputRef, selectedBannerPreviewUrl, setSelectedBannerPreviewUrl, setSelectedBannerFile)
                setRemoveStoreBanner(true)
                setSuccess("")
              }}
              buttonLabel={selectedBannerFile ? "სხვა banner-ის არჩევა" : "banner-ის ატვირთვა"}
              hint={`რეკომენდებულია ფართო ფორმატის სურათი. მაქსიმალური ზომაა ${MAX_BRANDING_FILE_SIZE_MB}MB.`}
            />
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => handleFileSelect(event, { maxSizeMb: MAX_BRANDING_FILE_SIZE_MB, previousPreview: selectedBannerPreviewUrl, setPreview: setSelectedBannerPreviewUrl, setFile: setSelectedBannerFile, clearRemove: () => setRemoveStoreBanner(false) })}
              className="hidden"
            />
          </div>

          <div className="rounded-[1.75rem] border border-neutral-200 bg-white p-5">
            <div className="text-sm font-semibold uppercase tracking-[0.16em] text-neutral-500">მაღაზიის ინფორმაცია</div>
            <div className="mt-2 text-xl font-black text-neutral-950">კონტაქტები, სოციალური ბმულები და მისამართი</div>
            <div className="mt-1 max-w-3xl text-sm leading-6 text-neutral-600">თუ ეს ველები შეავსე, საჯარო მაღაზიის პროფილზე ცალკე სექციად გამოჩნდება — ტელეფონი, WhatsApp, Telegram, Instagram, სამუშაო საათები, მისამართი და რუკის ჩაშენებული preview.</div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold">ტელეფონი</label>
              <input value={storePhone} onChange={(e) => setStorePhone(e.target.value)} className="h-12 w-full rounded-2xl border border-neutral-300 px-4 outline-none" placeholder="მაგ: +995 555 12 34 56" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold">WhatsApp</label>
              <input value={storeWhatsapp} onChange={(e) => setStoreWhatsapp(e.target.value)} className="h-12 w-full rounded-2xl border border-neutral-300 px-4 outline-none" placeholder="მაგ: +995 555 12 34 56 ან wa.me ბმული" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold">Telegram</label>
              <input value={storeTelegram} onChange={(e) => setStoreTelegram(e.target.value)} className="h-12 w-full rounded-2xl border border-neutral-300 px-4 outline-none" placeholder="მაგ: @samosellshop" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold">Instagram</label>
              <input value={storeInstagram} onChange={(e) => setStoreInstagram(e.target.value)} className="h-12 w-full rounded-2xl border border-neutral-300 px-4 outline-none" placeholder="მაგ: @samosell.store" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold">Facebook</label>
              <input value={storeFacebook} onChange={(e) => setStoreFacebook(e.target.value)} className="h-12 w-full rounded-2xl border border-neutral-300 px-4 outline-none" placeholder="მაგ: facebook.com/samosell" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold">ვებსაიტი</label>
              <input value={storeWebsite} onChange={(e) => setStoreWebsite(e.target.value)} className="h-12 w-full rounded-2xl border border-neutral-300 px-4 outline-none" placeholder="მაგ: samosell.ge" />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold">სამუშაო დღეები და საათები</label>
              <textarea value={storeHours} onChange={(e) => setStoreHours(e.target.value)} className="min-h-32 w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" placeholder={"ორშაბათი: 11:00–19:00\nსამშაბათი: 11:00–19:00\nოთხშაბათი: 11:00–19:00\nხუთშაბათი: 11:00–19:00\nპარასკევი: 11:00–20:00\nშაბათი: 12:00–18:00\nკვირა: დაკეტილია"} />
              <div className="mt-2 text-xs leading-5 text-neutral-500">თითო დღე ახალ ხაზზე ჩაწერე. seller page-ზე ავტომატურად weekly layout-ად დალაგდება.</div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold">რუკის ბმული</label>
              <input value={storeMapUrl} onChange={(e) => setStoreMapUrl(e.target.value)} className="h-12 w-full rounded-2xl border border-neutral-300 px-4 outline-none" placeholder="Google Maps ან სხვა რუკის ბმული" />
              <div className="mt-2 text-xs leading-5 text-neutral-500">თუ მისამართსაც შეავსებ, პროფილზე გამოჩნდება ჩაშენებული რუკაც.</div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">მაღაზიის მისამართი</label>
            <textarea value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} className="min-h-24 w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" placeholder="მაგ: თბილისი, ვაკე, აბაშიძის ქუჩა 10" />
          </div>
        </>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold">მომხმარებლის სახელი</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="h-12 w-full rounded-2xl border border-neutral-300 px-4 outline-none" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold">{sellerType === "store" ? "მაღაზიის სახელი" : "სრული სახელი"}</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-12 w-full rounded-2xl border border-neutral-300 px-4 outline-none"
            placeholder={sellerType === "store" ? "მაგ: SamoSell Studio" : "მაგ: გიორგი ბულბულაშვილი"}
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold">ქალაქი</label>
        <input value={city} onChange={(e) => setCity(e.target.value)} className="h-12 w-full rounded-2xl border border-neutral-300 px-4 outline-none" placeholder="მაგ: თბილისი" />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold">შესახებ</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="min-h-32 w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
          placeholder={sellerType === "store" ? "მოკლედ მოგვიყევი მაღაზიის სტილის, ბრენდების, მიწოდებისა და სერვისის შესახებ." : "მოკლედ დაწერე რას ყიდი და როგორ მდგომარეობაშია შენი ნივთები."}
        />
      </div>

      {sellerType === "store" ? (
        <div className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700">
          მაღაზიის საჯარო გვერდზე გამოჩნდება: avatar ან ლოგო, cover / banner, მაღაზიის სახელი, აღწერა, WhatsApp / Telegram / Instagram / Facebook / ვებსაიტი, სამუშაო დღეები, ტელეფონი, მისამართი და რუკის preview.
        </div>
      ) : null}

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <button type="submit" disabled={loading} className="h-12 rounded-2xl bg-black px-6 font-semibold text-white disabled:opacity-60">
        {loading ? "ინახება..." : "პროფილის შენახვა"}
      </button>
    </form>
  )
}
