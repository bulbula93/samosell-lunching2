"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Avatar from "@/components/shared/Avatar"
import SmartImage from "@/components/shared/SmartImage"
import { extractStoragePathFromPublicUrl, humanizeSupabaseError } from "@/lib/listings"
import { getSellerVisualAvatar, sellerTypeLabel } from "@/lib/profiles"
import { createClient } from "@/lib/supabase/client"
import { isValidSellerPhone, normalizeSellerPhone, SELLER_PHONE_MAX_LENGTH } from "@/lib/phone"
import { isTikTokLiveActive, normalizeTikTokUsername } from "@/lib/tiktok"

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
    tiktok_username: string
    tiktok_live_until: string
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
    <div className="ui-subcard bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="ui-eyebrow">{title}</div>
          <div className="mt-2 text-xl font-black text-text">{description}</div>
        </div>
        <div className="shrink-0">{preview}</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={onChoose} className="ui-btn-primary">
          {buttonLabel}
        </button>
        <button type="button" onClick={onRemove} className="ui-btn-secondary">
          წაშლა
        </button>
      </div>
      <div className="mt-3 text-xs leading-5 text-text-soft">{hint}</div>
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
  const [tiktokUsername, setTikTokUsername] = useState(initialProfile.tiktok_username)
  const [tiktokLiveUntil, setTikTokLiveUntil] = useState(initialProfile.tiktok_live_until)

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
  const [tiktokLoading, setTikTokLoading] = useState(false)

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

    const normalizedPhone = normalizeSellerPhone(storePhone)
    const normalizedTikTokUsername = normalizeTikTokUsername(tiktokUsername)
    if (tiktokUsername.trim() && !normalizedTikTokUsername) {
      setError("შეიყვანე სწორი TikTok username, მაგალითად @samosell ან tiktok.com/@samosell.")
      setLoading(false)
      return
    }
    if (normalizedPhone && !isValidSellerPhone(normalizedPhone)) {
      setError("შეიყვანე მოქმედი საკონტაქტო ტელეფონი 7–15 ციფრით.")
      setLoading(false)
      return
    }

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
        store_phone: normalizedPhone || null,
        store_whatsapp: sellerType === "store" ? storeWhatsapp.trim() || null : null,
        store_telegram: sellerType === "store" ? storeTelegram.trim() || null : null,
        store_instagram: sellerType === "store" ? storeInstagram.trim() || null : null,
        store_facebook: sellerType === "store" ? storeFacebook.trim() || null : null,
        store_website: sellerType === "store" ? storeWebsite.trim() || null : null,
        store_hours: sellerType === "store" ? storeHours.trim() || null : null,
        store_address: sellerType === "store" ? storeAddress.trim() || null : null,
        store_map_url: sellerType === "store" ? storeMapUrl.trim() || null : null,
        tiktok_username: normalizedTikTokUsername || null,
        tiktok_live_until: normalizedTikTokUsername ? tiktokLiveUntil || null : null,
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

  async function updateTikTokLive(nextLive: boolean) {
    const normalizedUsername = normalizeTikTokUsername(tiktokUsername)
    if (!normalizedUsername) {
      setError("TikTok LIVE-ის ჩასართავად ჯერ მიუთითე სწორი TikTok username.")
      return
    }

    setTikTokLoading(true)
    setError("")
    setSuccess("")

    try {
      const supabase = createClient()
      const { data, error: liveError } = await supabase.rpc("set_tiktok_live_status", {
        p_username: normalizedUsername,
        p_live: nextLive,
      })
      if (liveError) throw liveError

      const result = (data ?? {}) as { username?: string; live_until?: string | null }
      setTikTokUsername(result.username || normalizedUsername)
      setTikTokLiveUntil(result.live_until || "")
      setSuccess(
        nextLive
          ? "TikTok LIVE ჩაირთო — საჯარო პროფილსა და პროდუქტის გვერდზე LIVE ნიშანი გამოჩნდება მაქსიმუმ 4 საათით."
          : "TikTok LIVE სტატუსი გამორთულია.",
      )
    } catch (liveError) {
      const fallbackMessage = liveError instanceof Error ? liveError.message : "TikTok LIVE სტატუსის განახლება ვერ მოხერხდა."
      setError(humanizeSupabaseError(fallbackMessage))
    } finally {
      setTikTokLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="ui-card space-y-6 p-5 sm:p-6">
      <div className="overflow-hidden rounded-[1.75rem] border border-line bg-surface-alt">
        {sellerType === "store" ? (
          <div className="relative h-36 border-b border-line bg-brand-soft/45 sm:h-44">
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
                <div className="ui-eyebrow">საჯარო პროფილი</div>
                <div className="mt-2 text-2xl font-black text-text">{fullName || username || "შენი პროფილი"}</div>
                <div className="mt-1 text-sm text-text-soft">{sellerTypeLabel(sellerType)} • {city || "ქალაქი ჯერ არ არის მითითებული"}</div>
              </div>
            </div>
            <div className="ui-pill bg-white text-text-soft">ეს ინფორმაცია ჩანს საჯარო პროფილზე და განცხადებებში.</div>
          </div>
        </div>
      </div>

      <div>
        <label className="ui-field-label">ანგარიშის ტიპი</label>
        <div className="grid gap-3 md:grid-cols-2">
          {sellerTypeOptions.map((option) => {
            const active = sellerType === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSellerType(option.value)}
                className={`rounded-[1.5rem] border px-4 py-4 text-left transition ${active ? "border-brand/30 bg-brand-soft/55 shadow-sm" : "border-line bg-white hover:border-brand/30 hover:bg-brand-soft/30"}`}
              >
                <div className="text-base font-bold text-text">{option.label}</div>
                <div className="mt-1 text-sm leading-6 text-text-soft">{option.helper}</div>
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

      <div className="ui-subcard bg-white p-5">
        <div className="ui-eyebrow">საჯარო კონტაქტი</div>
        <div className="mt-2 text-xl font-black text-text">გამყიდველის ტელეფონი</div>
        <p className="mt-1 text-sm leading-6 text-text-soft">
          გამყიდველისთვის ნომერი სავალდებულოა: ის საჯაროდ გამოჩნდება განცხადებებზე და მყიდველი პირდაპირ დარეკვას შეძლებს.
        </p>
        <label htmlFor="seller-phone" className="mt-4 ui-field-label">ტელეფონი</label>
        <input
          id="seller-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={SELLER_PHONE_MAX_LENGTH}
          value={storePhone}
          onChange={(event) => setStorePhone(event.target.value)}
          className="ui-input h-12 rounded-2xl"
          placeholder="მაგ: +995 555 12 34 56"
        />
      </div>

      <div className="ui-subcard bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="ui-eyebrow">TikTok</div>
            <div className="mt-2 text-xl font-black text-text">TikTok LIVE ნიშანი</div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-text-soft">
              მიუთითე TikTok username. როცა LIVE-ში გახვალ, ჩართე სტატუსი — შენს ავატარზე გამოჩნდება LIVE და დაჭერისას გაიხსნება TikTok-ის LIVE გვერდი. სტატუსი 4 საათში ავტომატურად ქრება.
            </p>
          </div>
          <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-black ${isTikTokLiveActive(tiktokLiveUntil) ? "bg-[#ff2d55] text-white" : "bg-surface-alt text-text-soft"}`}>
            {isTikTokLiveActive(tiktokLiveUntil) ? "LIVE" : "OFFLINE"}
          </span>
        </div>

        <label htmlFor="tiktok-username" className="mt-4 ui-field-label">TikTok username</label>
        <input
          id="tiktok-username"
          value={tiktokUsername}
          onChange={(event) => setTikTokUsername(event.target.value)}
          className="ui-input h-12 rounded-2xl"
          placeholder="მაგ: @samosell ან tiktok.com/@samosell"
          autoCapitalize="none"
          autoCorrect="off"
        />

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => updateTikTokLive(true)}
            disabled={tiktokLoading}
            className="h-11 rounded-2xl bg-[#ff2d55] px-5 text-sm font-black text-white disabled:opacity-60"
          >
            {tiktokLoading ? "ახლდება..." : "TikTok LIVE ჩართვა"}
          </button>
          <button
            type="button"
            onClick={() => updateTikTokLive(false)}
            disabled={tiktokLoading || !isTikTokLiveActive(tiktokLiveUntil)}
            className="ui-btn-secondary disabled:opacity-50"
          >
            LIVE გამორთვა
          </button>
        </div>

        <p className="mt-3 text-xs leading-5 text-text-soft">
          TikTok-ის საჯარო API ამჟამად LIVE სტატუსს არ გვაძლევს, ამიტომ ჩართვა ხელით ხდება. დროის გასვლის შემდეგ SamoSell LIVE ნიშანს ავტომატურად აღარ აჩვენებს.
        </p>
      </div>

      {sellerType === "store" ? (
        <>
          <div className="ui-subcard p-5">
            <div className="ui-eyebrow">მაღაზიის ბრენდინგი</div>
            <div className="mt-2 text-xl font-black text-text">დაამატე მაღაზიის ცალკე ლოგო და cover / banner</div>
            <div className="mt-1 max-w-3xl text-sm leading-6 text-text-soft">ლოგო გამოჩნდება საჯარო მაღაზიის პროფილზე და დეტალის გვერდზე. banner კი მაღაზიის გვერდს უფრო პროფესიონალურ იერს მისცემს.</div>
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
              preview={<div className="overflow-hidden rounded-[1.25rem] border border-line"><SmartImage src={visibleStoreBannerUrl} alt={fullName || username || "მაღაზიის banner"} wrapperClassName="h-24 w-56 bg-surface-alt" className="object-cover" fallbackLabel="აქ გამოჩნდება შენი მაღაზიის banner" /></div>}
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

          <div className="ui-subcard bg-white p-5">
            <div className="ui-eyebrow">მაღაზიის ინფორმაცია</div>
            <div className="mt-2 text-xl font-black text-text">კონტაქტები, სოციალური ბმულები და მისამართი</div>
            <div className="mt-1 max-w-3xl text-sm leading-6 text-text-soft">თუ ეს ველები შეავსე, საჯარო მაღაზიის პროფილზე ცალკე სექციად გამოჩნდება — ტელეფონი, WhatsApp, Telegram, Instagram, სამუშაო საათები, მისამართი და რუკის ჩაშენებული preview.</div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="ui-field-label">WhatsApp</label>
              <input value={storeWhatsapp} onChange={(e) => setStoreWhatsapp(e.target.value)} className="ui-input h-12 rounded-2xl" placeholder="მაგ: +995 555 12 34 56 ან wa.me ბმული" />
            </div>
            <div>
              <label className="ui-field-label">Telegram</label>
              <input value={storeTelegram} onChange={(e) => setStoreTelegram(e.target.value)} className="ui-input h-12 rounded-2xl" placeholder="მაგ: @samosellshop" />
            </div>
            <div>
              <label className="ui-field-label">Instagram</label>
              <input value={storeInstagram} onChange={(e) => setStoreInstagram(e.target.value)} className="ui-input h-12 rounded-2xl" placeholder="მაგ: @samosell.store" />
            </div>
            <div>
              <label className="ui-field-label">Facebook</label>
              <input value={storeFacebook} onChange={(e) => setStoreFacebook(e.target.value)} className="ui-input h-12 rounded-2xl" placeholder="მაგ: facebook.com/samosell" />
            </div>
            <div>
              <label className="ui-field-label">ვებსაიტი</label>
              <input value={storeWebsite} onChange={(e) => setStoreWebsite(e.target.value)} className="ui-input h-12 rounded-2xl" placeholder="მაგ: samosell.ge" />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="ui-field-label">სამუშაო დღეები და საათები</label>
              <textarea value={storeHours} onChange={(e) => setStoreHours(e.target.value)} className="ui-textarea min-h-32" placeholder={"ორშაბათი: 11:00–19:00\nსამშაბათი: 11:00–19:00\nოთხშაბათი: 11:00–19:00\nხუთშაბათი: 11:00–19:00\nპარასკევი: 11:00–20:00\nშაბათი: 12:00–18:00\nკვირა: დაკეტილია"} />
              <div className="mt-2 text-xs leading-5 text-text-soft">თითო დღე ახალ ხაზზე ჩაწერე. seller page-ზე ავტომატურად weekly layout-ად დალაგდება.</div>
            </div>
            <div>
              <label className="ui-field-label">რუკის ბმული</label>
              <input value={storeMapUrl} onChange={(e) => setStoreMapUrl(e.target.value)} className="ui-input h-12 rounded-2xl" placeholder="Google Maps ან სხვა რუკის ბმული" />
              <div className="mt-2 text-xs leading-5 text-text-soft">თუ მისამართსაც შეავსებ, პროფილზე გამოჩნდება ჩაშენებული რუკაც.</div>
            </div>
          </div>

          <div>
            <label className="ui-field-label">მაღაზიის მისამართი</label>
            <textarea value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} className="ui-textarea min-h-24" placeholder="მაგ: თბილისი, ვაკე, აბაშიძის ქუჩა 10" />
          </div>
        </>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="ui-field-label">მომხმარებლის სახელი</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="ui-input h-12 rounded-2xl" />
        </div>
        <div>
          <label className="ui-field-label">{sellerType === "store" ? "მაღაზიის სახელი" : "სრული სახელი"}</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="ui-input h-12 rounded-2xl"
            placeholder={sellerType === "store" ? "მაგ: SamoSell Studio" : "მაგ: გიორგი ბულბულაშვილი"}
          />
        </div>
      </div>

      <div>
        <label className="ui-field-label">ქალაქი</label>
        <input value={city} onChange={(e) => setCity(e.target.value)} className="ui-input h-12 rounded-2xl" placeholder="მაგ: თბილისი" />
      </div>

      <div>
        <label className="ui-field-label">შესახებ</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="ui-textarea min-h-32"
          placeholder={sellerType === "store" ? "მოკლედ მოგვიყევი მაღაზიის სტილის, ბრენდების, მიწოდებისა და სერვისის შესახებ." : "მოკლედ დაწერე რას ყიდი და როგორ მდგომარეობაშია შენი ნივთები."}
        />
      </div>

      {sellerType === "store" ? (
        <div className="ui-subcard text-sm leading-6 text-text-soft">
          მაღაზიის საჯარო გვერდზე გამოჩნდება: avatar ან ლოგო, cover / banner, მაღაზიის სახელი, აღწერა, WhatsApp / Telegram / Instagram / Facebook / ვებსაიტი, სამუშაო დღეები, ტელეფონი, მისამართი და რუკის preview.
        </div>
      ) : null}

      {error ? <div className="ui-status-error">{error}</div> : null}
      {success ? <div className="ui-status-success">{success}</div> : null}

      <button type="submit" disabled={loading} className="ui-btn-primary h-12 w-full sm:w-auto disabled:opacity-60">
        {loading ? "ინახება..." : "პროფილის შენახვა"}
      </button>
    </form>
  )
}
