"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Avatar from "@/components/shared/Avatar"
import SmartImage from "@/components/shared/SmartImage"
import { extractStoragePathFromPublicUrl, humanizeSupabaseError } from "@/lib/listings"
import { getSellerVisualAvatar, sellerTypeLabel } from "@/lib/profiles"
import StoreHeroMockup from "@/components/stores/StoreHeroMockup"
import { normalizeStoreHero, STORE_HERO_LIMITS, type StoreHeroContent } from "@/lib/store-hero"
import { createClient } from "@/lib/supabase/client"
import { isValidSellerPhone, normalizeSellerPhone, SELLER_PHONE_MAX_LENGTH } from "@/lib/phone"
import { isTikTokLiveActive, normalizeTikTokUsername } from "@/lib/tiktok"
import StoreSetupEditor, { type StoreSetupValues } from "@/components/stores/StoreSetupEditor"
import type { EditableProfile } from "@/lib/profile-editor"
import { getStoreSetupContinuePath } from "@/lib/store-onboarding"
import { isReadOnlyPreview } from "@/lib/preview-read-only"

type ProfileFormProps = {
  startStoreSetup?: boolean
  previewOnly?: boolean
  continuePath?: string
  userId: string
  initialProfile: EditableProfile
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
  status?: string
  previewKind?: "logo" | "banner" | "avatar"
}

function AssetCard({
  title,
  description,
  preview,
  onChoose,
  onRemove,
  buttonLabel,
  hint,
  status,
  previewKind = "logo",
}: AssetCardProps) {
  const previewStageClass =
    previewKind === "banner"
      ? "h-40 sm:h-44"
      : "h-40 sm:h-44"

  return (
    <div className="rounded-[1.4rem] border border-line/90 bg-white p-4 shadow-[0_10px_30px_rgba(23,23,23,0.035)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-extrabold leading-5 text-text">{title}</div>
          <p className="mt-1 max-w-md text-[13px] leading-5 text-text-soft">{description}</p>
        </div>
        {status ? (
          <span className="shrink-0 rounded-full border border-line bg-surface-alt px-2.5 py-1 text-[11px] font-bold text-text-soft">
            {status}
          </span>
        ) : null}
      </div>

      <div
        className={`mt-4 flex ${previewStageClass} w-full items-center justify-center overflow-hidden rounded-[1.15rem] border border-dashed border-line bg-surface-alt/65 p-3`}
      >
        <div className={previewKind === "banner" ? "h-full w-full" : "flex h-full w-full items-center justify-center"}>
          {preview}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onChoose}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-extrabold text-white transition hover:opacity-90"
        >
          {buttonLabel}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-text-soft transition hover:bg-surface-alt"
        >
          წაშლა
        </button>
      </div>

      <div className="mt-3 text-[11px] leading-5 text-text-soft">{hint}</div>
    </div>
  )
}

export default function ProfileForm({ userId, initialProfile, startStoreSetup = false, previewOnly = false, continuePath }: ProfileFormProps) {
  const router = useRouter()
  const [username, setUsername] = useState(initialProfile.username)
  const [fullName, setFullName] = useState(initialProfile.full_name)
  const [bio, setBio] = useState(initialProfile.bio)
  const [city, setCity] = useState(initialProfile.city)
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatar_url)
  const [sellerType, setSellerType] = useState(startStoreSetup ? "store" : initialProfile.seller_type || "individual")
  const [storeLogoUrl, setStoreLogoUrl] = useState(initialProfile.store_logo_url)
  const [storeBannerUrl, setStoreBannerUrl] = useState(initialProfile.store_banner_url)
  const [storeHero, setStoreHero] = useState<StoreHeroContent>(() => normalizeStoreHero(initialProfile.store_hero))
  const [storePhone, setStorePhone] = useState(initialProfile.store_phone)
  const [storeWhatsapp, setStoreWhatsapp] = useState(initialProfile.store_whatsapp)
  const [storeTelegram, setStoreTelegram] = useState(initialProfile.store_telegram)
  const [storeInstagram, setStoreInstagram] = useState(initialProfile.store_instagram)
  const [storeFacebook, setStoreFacebook] = useState(initialProfile.store_facebook)
  const [storeWebsite, setStoreWebsite] = useState(initialProfile.store_website)
  const [storeHours, setStoreHours] = useState(initialProfile.store_hours)
  const [storeAddress, setStoreAddress] = useState(initialProfile.store_address)
  const [hasPhysicalStore, setHasPhysicalStore] = useState(Boolean(initialProfile.store_address?.trim() || initialProfile.store_map_url?.trim()))
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

  useEffect(() => () => { if (selectedAvatarPreviewUrl) URL.revokeObjectURL(selectedAvatarPreviewUrl) }, [selectedAvatarPreviewUrl])
  useEffect(() => () => { if (selectedLogoPreviewUrl) URL.revokeObjectURL(selectedLogoPreviewUrl) }, [selectedLogoPreviewUrl])
  useEffect(() => () => { if (selectedBannerPreviewUrl) URL.revokeObjectURL(selectedBannerPreviewUrl) }, [selectedBannerPreviewUrl])

  const visibleAvatarUrl = removeAvatar ? "" : selectedAvatarPreviewUrl || avatarUrl
  const visibleStoreLogoUrl = removeStoreLogo ? "" : selectedLogoPreviewUrl || storeLogoUrl
  const visibleStoreBannerUrl = removeStoreBanner ? "" : selectedBannerPreviewUrl || storeBannerUrl
  function updateHeroField(field: keyof StoreHeroContent, value: string) {
    setStoreHero((previous) => ({ ...previous, [field]: value.slice(0, STORE_HERO_LIMITS[field]) }))
    setSuccess("")
  }

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
    if (loading) return
    if (previewOnly || isReadOnlyPreview()) {
      setError("ეს Preview მხოლოდ სანახავადაა — მაღაზიის შენახვა გამორთულია")
      return
    }
    setLoading(true)
    setError("")
    setSuccess("")

    if (startStoreSetup && (!fullName.trim() || !/^[a-z0-9_.-]{3,40}$/i.test(username.trim()))) {
      setError("მიუთითე მაღაზიის სახელი და მომხმარებლის სახელი 3–40 ლათინური ასოთი, ციფრით, წერტილით ან ტირეთი")
      setLoading(false)
      return
    }

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
    let profileSaved = false

    try {
      // Confirm the store fields are readable before uploading any assets.
      if (sellerType === "store") {
        const { error: heroSchemaError } = await supabase.from("profiles").select("store_hero").eq("id", userId).maybeSingle()
        if (heroSchemaError) throw new Error("მაღაზიის მონაცემების გადამოწმება ვერ მოხერხდა — სცადე ხელახლა")
      }
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
        username: username.trim(),
        full_name: fullName.trim(),
        bio,
        city,
        avatar_url: nextAvatarUrl || null,
        seller_type: sellerType,
        store_logo_url: sellerType === "store" ? nextStoreLogoUrl || null : null,
        store_banner_url: sellerType === "store" ? nextStoreBannerUrl || null : null,
        ...(sellerType === "store" ? { store_hero: normalizeStoreHero(storeHero) } : {}),
        store_phone: normalizedPhone || null,
        store_whatsapp: sellerType === "store" ? storeWhatsapp.trim() || null : null,
        store_telegram: sellerType === "store" ? storeTelegram.trim() || null : null,
        store_instagram: sellerType === "store" ? storeInstagram.trim() || null : null,
        store_facebook: sellerType === "store" ? storeFacebook.trim() || null : null,
        store_website: sellerType === "store" ? storeWebsite.trim() || null : null,
        store_hours: sellerType === "store" && hasPhysicalStore ? storeHours.trim() || null : null,
        store_address: sellerType === "store" && hasPhysicalStore ? storeAddress.trim() || null : null,
        store_map_url: sellerType === "store" && hasPhysicalStore ? storeMapUrl.trim() || null : null,
        tiktok_username: normalizedTikTokUsername || null,
        tiktok_live_until: normalizedTikTokUsername ? tiktokLiveUntil || null : null,
      }).select("id").single()
      if (saveError) throw saveError
      profileSaved = true

      const previousAvatarPath = previousAvatarUrl ? extractStoragePathFromPublicUrl(previousAvatarUrl, AVATAR_BUCKET) : null
      const previousStoreLogoPath = previousStoreLogoUrl ? extractStoragePathFromPublicUrl(previousStoreLogoUrl, BRANDING_BUCKET) : null
      const previousStoreBannerPath = previousStoreBannerUrl ? extractStoragePathFromPublicUrl(previousStoreBannerUrl, BRANDING_BUCKET) : null

      const avatarChanged = removeAvatar || previousAvatarUrl !== nextAvatarUrl
      const logoChanged = removeStoreLogo || previousStoreLogoUrl !== nextStoreLogoUrl
      const bannerChanged = removeStoreBanner || previousStoreBannerUrl !== nextStoreBannerUrl

      await Promise.allSettled([
        ...(previousAvatarPath && avatarChanged && previousAvatarPath !== uploadedAvatarPath
          ? [supabase.storage.from(AVATAR_BUCKET).remove([previousAvatarPath])] : []),
        ...(previousStoreLogoPath && logoChanged && previousStoreLogoPath !== uploadedLogoPath
          ? [supabase.storage.from(BRANDING_BUCKET).remove([previousStoreLogoPath])] : []),
        ...(previousStoreBannerPath && bannerChanged && previousStoreBannerPath !== uploadedBannerPath
          ? [supabase.storage.from(BRANDING_BUCKET).remove([previousStoreBannerPath])] : []),
      ])

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
      if (startStoreSetup) {
        router.push(getStoreSetupContinuePath(continuePath))
        router.refresh()
      }
    } catch (submitError) {
      if (!profileSaved) {
        await Promise.allSettled([
          ...(uploadedAvatarPath ? [supabase.storage.from(AVATAR_BUCKET).remove([uploadedAvatarPath])] : []),
          ...(uploadedLogoPath ? [supabase.storage.from(BRANDING_BUCKET).remove([uploadedLogoPath])] : []),
          ...(uploadedBannerPath ? [supabase.storage.from(BRANDING_BUCKET).remove([uploadedBannerPath])] : []),
        ])
      }
      const fallbackMessage = submitError && typeof submitError === "object" && "message" in submitError
        ? String(submitError.message) : "პროფილის შენახვა ვერ მოხერხდა — სცადე ხელახლა"
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

  if (startStoreSetup) {
    const values: StoreSetupValues = {
      name: fullName, username, city, bio, hero: storeHero, phone: storePhone, hasPhysicalStore,
      contacts: { instagram: storeInstagram, facebook: storeFacebook, tiktok: tiktokUsername, whatsapp: storeWhatsapp,
        telegram: storeTelegram, website: storeWebsite, address: storeAddress, mapUrl: storeMapUrl, hours: storeHours },
    }
    function updateValues(next: StoreSetupValues) {
      setFullName(next.name); setUsername(next.username); setCity(next.city); setBio(next.bio); setStoreHero(next.hero)
      setStorePhone(next.phone); setHasPhysicalStore(next.hasPhysicalStore)
      setStoreInstagram(next.contacts.instagram || ""); setStoreFacebook(next.contacts.facebook || "")
      setTikTokUsername(next.contacts.tiktok || ""); setStoreWhatsapp(next.contacts.whatsapp || "")
      setStoreTelegram(next.contacts.telegram || ""); setStoreWebsite(next.contacts.website || "")
      setStoreAddress(next.contacts.address || ""); setStoreMapUrl(next.contacts.mapUrl || ""); setStoreHours(next.contacts.hours || "")
      setSuccess("")
    }
    function removeAsset(kind: "cover" | "logo") {
      if (kind === "cover") {
        clearSelectedFile(bannerInputRef, selectedBannerPreviewUrl, setSelectedBannerPreviewUrl, setSelectedBannerFile)
        setRemoveStoreBanner(true)
      } else {
        clearSelectedFile(logoInputRef, selectedLogoPreviewUrl, setSelectedLogoPreviewUrl, setSelectedLogoFile)
        setRemoveStoreLogo(true)
      }
      setSuccess("")
    }
    return (
      <form onSubmit={handleSubmit} aria-label="მაღაზიის შექმნა">
        <StoreSetupEditor value={values} onChange={updateValues}
          coverUrl={visibleStoreBannerUrl} logoUrl={visibleStoreLogoUrl || visibleAvatarUrl}
          coverInputRef={bannerInputRef} logoInputRef={logoInputRef}
          onAssetSelect={(kind, event) => handleFileSelect(event, kind === "cover" ? {
            maxSizeMb: MAX_BRANDING_FILE_SIZE_MB, previousPreview: selectedBannerPreviewUrl,
            setPreview: setSelectedBannerPreviewUrl, setFile: setSelectedBannerFile, clearRemove: () => setRemoveStoreBanner(false),
          } : {
            maxSizeMb: MAX_BRANDING_FILE_SIZE_MB, previousPreview: selectedLogoPreviewUrl,
            setPreview: setSelectedLogoPreviewUrl, setFile: setSelectedLogoFile, clearRemove: () => setRemoveStoreLogo(false),
          })}
          onAssetRemove={removeAsset} disabled={loading} demo={previewOnly}
          footer={<>
            {error ? <p role="alert" className="ui-status-error">{error}</p> : null}
            {success ? <p role="status" className="ui-status-success">{success}</p> : null}
            {previewOnly ? <>
              <button type="button" className="ui-btn-secondary" onClick={() => {
                updateValues({ name: "", username: "", city: "", bio: "", hero: normalizeStoreHero(null), phone: "", contacts: {}, hasPhysicalStore: false })
                removeAsset("cover"); removeAsset("logo"); setError("")
              }}>ყველაფრის გასუფთავება</button>
              <p className="text-xs leading-6 text-text-soft">ეს არის მაღაზიის შექმნის ფორმის დემო — მონაცემები სერვერზე არ იგზავნება</p>
            </> : <>
              <p className="text-xs leading-6 text-text-soft">შენახვის შემდეგ მაღაზიის გვერდი მყიდველებისთვის ხელმისაწვდომი გახდება — მოგვიანებით ყველაფრის შეცვლას პროფილიდან შეძლებ</p>
              <button type="submit" disabled={loading} className="ui-btn-primary min-h-12 w-full disabled:opacity-60">{loading ? "ინახება..." : "შეინახე მაღაზია და გააგრძელე"}</button>
            </>}
          </>} />
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="ui-card space-y-6 p-5 sm:p-6">
      <div className="rounded-[1.75rem] border border-brand/15 bg-brand-soft/35 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="ui-eyebrow">{sellerType === "store" ? "მაღაზიის გვერდის აწყობა" : "პროფილის აწყობა"}</div>
            <h2 className="mt-2 text-2xl font-black text-text">
              {sellerType === "store" ? "შექმენი მაღაზიის სახე, ტექსტები და ვიზუალი" : "შეავსე პროფილი და ნახე როგორ გამოჩნდება საჯაროდ"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-soft">
              {sellerType === "store"
                ? "ტექსტები, ფოტოები, სოციალური ქსელები და სურვილისამებრ ფიზიკური მისამართი განახლდება ცოცხალ წინასწარ ნახვაში. საჯარო გვერდზე ცვლილებები შენახვის შემდეგ აისახება."
                : "ფოტოს არჩევისთანავე preview აქვე გამოჩნდება. საჯარო პროფილზე ცვლილება მხოლოდ შენახვის შემდეგ აისახება."}
            </p>
          </div>
          {username ? (
            <Link
              href={"/seller/" + encodeURIComponent(username)}
              target="_blank"
              className="ui-btn-secondary shrink-0"
            >
              საჯარო გვერდის ნახვა ↗
            </Link>
          ) : null}
        </div>
      </div>

      <section>
        <div className="mb-3">
          <div className="ui-eyebrow">1. ანგარიშის ტიპი</div>
          <p className="mt-1 text-sm text-text-soft">აირჩიე როგორ გამოჩნდები SamoSell-ზე.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {sellerTypeOptions.map((option) => {
            const active = sellerType === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSellerType(option.value)}
                className={active
                  ? "rounded-[1.5rem] border border-brand/30 bg-brand-soft/55 px-4 py-4 text-left shadow-sm transition"
                  : "rounded-[1.5rem] border border-line bg-white px-4 py-4 text-left transition hover:border-brand/30 hover:bg-brand-soft/30"}
              >
                <div className="text-base font-bold text-text">{option.label}</div>
                <div className="mt-1 text-sm leading-6 text-text-soft">{option.helper}</div>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <div className="ui-eyebrow">Preview</div>
          <p className="mt-1 text-sm text-text-soft">
            {sellerType === "store" ? "ასე გამოჩნდება მაღაზიის მთავარი ნაწილი მომხმარებლისთვის." : "ასე გამოჩნდება შენი საჯარო პროფილის მთავარი ნაწილი."}
          </p>
        </div>
        {sellerType === "store" ? (
          <StoreHeroMockup
            storeName={fullName}
            username={username}
            city={city}
            hero={normalizeStoreHero({
              ...storeHero,
              description: storeHero.description || bio,
            })}
            contacts={{instagram:storeInstagram,facebook:storeFacebook,tiktok:tiktokUsername,whatsapp:storeWhatsapp,telegram:storeTelegram,website:storeWebsite,address:hasPhysicalStore?storeAddress:"",mapUrl:hasPhysicalStore?storeMapUrl:"",hours:hasPhysicalStore?storeHours:""}}
            logoUrl={visibleStoreLogoUrl || visibleAvatarUrl}
            coverUrl={visibleStoreBannerUrl}
            caption="შენი მაღაზიის მთავარი ბლოკი · ცოცხალი წინასწარი ნახვა"
          />
        ) : (
          <div className="flex items-center gap-4 rounded-[1.75rem] border border-line bg-surface-alt p-6">
            <Avatar src={publicFacingAvatar} alt={fullName || username || "მომხმარებელი"} fallbackText={fullName || username || "SS"} sizeClassName="h-20 w-20" textClassName="text-2xl" />
            <div><p className="font-bold text-text">{fullName || username || "შენი პროფილი"}</p><p className="text-sm text-text-soft">{sellerTypeLabel(sellerType)} · {city || "ქალაქი"}</p></div>
          </div>
        )}
      </section>

      {sellerType === "store" ? (
        <>
          <section className="space-y-4">
            <div>
              <div className="ui-eyebrow">2. მაღაზიის ვიზუალი</div>
              <h3 className="mt-2 text-lg font-extrabold text-text">ლოგო და ქავერი</h3>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-text-soft">
                აირჩიე მთავარი ლოგო და ფართო ქავერი. ორივე სურათი არჩევისთანავე გამოჩნდება preview-ში.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <AssetCard
                title="მაღაზიის ლოგო"
                description="გამოჩნდება პროფილზე და შენს განცხადებებთან."
                preview={
                  <Avatar
                    src={visibleStoreLogoUrl || visibleAvatarUrl}
                    alt={fullName || username || "მაღაზიის ლოგო"}
                    fallbackText={fullName || username || "SS"}
                    sizeClassName="h-24 w-24"
                    textClassName="text-xl"
                  />
                }
                onChoose={() => logoInputRef.current?.click()}
                onRemove={() => {
                  clearSelectedFile(logoInputRef, selectedLogoPreviewUrl, setSelectedLogoPreviewUrl, setSelectedLogoFile)
                  setRemoveStoreLogo(true)
                  setSuccess("")
                }}
                buttonLabel={selectedLogoFile ? "სხვა ლოგოს არჩევა" : "ლოგოს არჩევა"}
                status={selectedLogoFile ? "არჩეულია" : visibleStoreLogoUrl ? "შენახულია" : "არ არის დამატებული"}
                hint={"PNG/JPG • მაქს. " + MAX_BRANDING_FILE_SIZE_MB + "MB • სასურველია 1:1"}
                previewKind="logo"
              />
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={(event) => handleFileSelect(event, {
                  maxSizeMb: MAX_BRANDING_FILE_SIZE_MB,
                  previousPreview: selectedLogoPreviewUrl,
                  setPreview: setSelectedLogoPreviewUrl,
                  setFile: setSelectedLogoFile,
                  clearRemove: () => setRemoveStoreLogo(false),
                })}
                className="hidden"
              />

              <AssetCard
                title="ქავერი"
                description="მაღაზიის ქავერი საჯარო ვიტრინის ზედა ნაწილში ყოველთვის გამოჩნდება — VIP განცხადებები ცალკე სექციაშია."
                preview={
                  <SmartImage
                    src={visibleStoreBannerUrl}
                    alt={fullName || username || "მაღაზიის ქავერი"}
                    wrapperClassName="h-full w-full bg-surface-alt"
                    className="object-cover"
                    fallbackLabel="ქავერის preview"
                  />
                }
                onChoose={() => bannerInputRef.current?.click()}
                onRemove={() => {
                  clearSelectedFile(bannerInputRef, selectedBannerPreviewUrl, setSelectedBannerPreviewUrl, setSelectedBannerFile)
                  setRemoveStoreBanner(true)
                  setSuccess("")
                }}
                buttonLabel={selectedBannerFile ? "სხვა ქავერის არჩევა" : "ქავერის არჩევა"}
                status={selectedBannerFile ? "არჩეულია" : visibleStoreBannerUrl ? "შენახულია" : "არ არის დამატებული"}
                hint={"PNG/JPG • მაქს. " + MAX_BRANDING_FILE_SIZE_MB + "MB • სასურველია 3:1"}
                previewKind="banner"
              />
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                onChange={(event) => handleFileSelect(event, {
                  maxSizeMb: MAX_BRANDING_FILE_SIZE_MB,
                  previousPreview: selectedBannerPreviewUrl,
                  setPreview: setSelectedBannerPreviewUrl,
                  setFile: setSelectedBannerFile,
                  clearRemove: () => setRemoveStoreBanner(false),
                })}
                className="hidden"
              />
            </div>
          </section>

          <section className="space-y-4 rounded-[1.75rem] border border-brand/15 bg-[#fff8f0] p-5 sm:p-6">
            <div>
              <div className="ui-eyebrow">3. მთავარი ბლოკის ტექსტები</div>
              <h3 className="mt-2 text-xl font-black text-text">შექმენი საკუთარი Hero</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-text-soft">ყველა ტექსტი შენია. მათი შეცვლისას ზემოთ მდებარე ვიტრინის წინასწარი ნახვა მყისიერად განახლდება. ღილაკები და დიზაინის სტილი SamoSell-ის სისტემაში დარჩება.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                {field: "eyebrow", label: "პატარა წარწერა სათაურის ზემოთ", placeholder: "მაგ: ვინტაჟური ტანსაცმელი · თბილისი"},
                {field: "headline", label: "მთავარი სათაური", placeholder: "მაგ: ნივთები ახალი ისტორიებისთვის"},
                {field: "coverTitle", label: "ფოტოზე გამოსატანი ტექსტი", placeholder: "მაგ: შენი შემდეგი აღმოჩენა"},
                {field: "coverSubtitle", label: "ფოტოზე მცირე წარწერა", placeholder: "მაგ: შერჩეული კოლექცია"},
              ] as const).map(({field, label, placeholder}) => (
                <label key={field} className="block">
                  <span className="ui-field-label">{label}</span>
                  <input value={storeHero[field]} onChange={(e) => updateHeroField(field,e.target.value)} maxLength={STORE_HERO_LIMITS[field]} className="ui-input h-12 rounded-2xl" placeholder={placeholder} />
                  <span className="mt-1 block text-right text-xs text-text-soft">{storeHero[field].length}/{STORE_HERO_LIMITS[field]}</span>
                </label>
              ))}
            </div>
            <label className="block">
              <span className="ui-field-label">მთავარი აღწერა</span>
              <textarea value={storeHero.description} onChange={(e) => updateHeroField("description",e.target.value)} maxLength={STORE_HERO_LIMITS.description} rows={3} className="ui-textarea min-h-24" placeholder="მოკლედ აღწერე შენი მაღაზია და კოლექცია. ცარიელი ველის შემთხვევაში გამოყენებული იქნება „მაღაზიის შესახებ“ ტექსტი."/>
              <span className="mt-1 block text-right text-xs text-text-soft">{storeHero.description.length}/{STORE_HERO_LIMITS.description}</span>
            </label>
            <p className="text-xs leading-5 text-text-soft">ცარიელი პატარა წარწერები საჯარო გვერდზე არ გამოჩნდება. მთავარი სათაური ავტომატურად გამოიყენებს მაღაზიის სახელს, ხოლო აღწერა — პროფილის აღწერას.</p>
          </section>

          <section className="space-y-4">
            <div>
              <div className="ui-eyebrow">4. კონტაქტი და სოციალური ქსელები</div>
              <h3 className="mt-2 text-xl font-black text-text">როგორ დაგიკავშირდეს მყიდველი</h3>
              <p className="mt-1 text-sm leading-6 text-text-soft">შეავსე მხოლოდ ის არხები, რომლებსაც რეალურად იყენებ.</p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="seller-phone" className="ui-field-label">ტელეფონი</label>
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
                <label className="ui-field-label">TikTok</label>
                <input value={tiktokUsername} onChange={(e) => setTikTokUsername(e.target.value)} className="ui-input h-12 rounded-2xl" placeholder="მაგ: @myshop" />
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
          </section>

          <section className="space-y-4">
            <div>
              <div className="ui-eyebrow">5. ფიზიკური მაღაზია</div>
              <h3 className="mt-2 text-xl font-black text-text">მისამართი, რუკა და გრაფიკი</h3>
              <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-[#fff8f0] p-4 text-sm font-bold text-brand">
                <input type="checkbox" className="h-5 w-5 accent-brand" checked={hasPhysicalStore} onChange={(e) => setHasPhysicalStore(e.target.checked)} />
                მაქვს ფიზიკური მაღაზია
              </label>
              {!hasPhysicalStore ? <p className="mt-2 text-xs leading-6 text-text-soft">ონლაინ მაღაზიას ფიზიკური მისამართი არ მოეთხოვება. თუ ამ მონიშვნას გამორთავ და შეინახავ, ადრე მითითებული საჯარო მისამართი და რუკა აღარ გამოჩნდება.</p> : null}
            </div>

            {hasPhysicalStore ? <>
            <div>
              <label className="ui-field-label">მაღაზიის მისამართი</label>
              <textarea value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} className="ui-textarea min-h-24" placeholder="მაგ: თბილისი, ვაკე, აბაშიძის ქუჩა 10" />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="ui-field-label">სამუშაო დღეები და საათები</label>
                <textarea
                  value={storeHours}
                  onChange={(e) => setStoreHours(e.target.value)}
                  className="ui-textarea min-h-32"
                  placeholder={"ორშაბათი: 11:00–19:00\nსამშაბათი: 11:00–19:00\nოთხშაბათი: 11:00–19:00\nხუთშაბათი: 11:00–19:00\nპარასკევი: 11:00–20:00\nშაბათი: 12:00–18:00\nკვირა: დაკეტილია"}
                />
              </div>
              <div>
                <label className="ui-field-label">რუკის ბმული</label>
                <input value={storeMapUrl} onChange={(e) => setStoreMapUrl(e.target.value)} className="ui-input h-12 rounded-2xl" placeholder="Google Maps ან სხვა რუკის ბმული" />
                <div className="mt-2 text-xs leading-5 text-text-soft">თუ მისამართსაც შეავსებ, საჯარო პროფილზე რუკის preview გამოჩნდება.</div>
              </div>
            </div>
            </> : null}
          </section>

          <section className="space-y-4">
            <div>
              <div className="ui-eyebrow">6. ძირითადი ინფორმაცია</div>
              <h3 className="mt-2 text-xl font-black text-text">სახელი, ქალაქი და აღწერა</h3>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="ui-field-label">მაღაზიის სახელი</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="ui-input h-12 rounded-2xl"
                  placeholder="მაგ: SamoSell Studio"
                />
              </div>
              <div>
                <label className="ui-field-label">მომხმარებლის სახელი</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} className="ui-input h-12 rounded-2xl" />
              </div>
            </div>

            <div>
              <label className="ui-field-label">ქალაქი</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className="ui-input h-12 rounded-2xl" placeholder="მაგ: თბილისი" />
            </div>

            <div>
              <label className="ui-field-label">მაღაზიის შესახებ</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="ui-textarea min-h-32"
                placeholder="მოკლედ აღწერე მაღაზიის სტილი, ბრენდები, მიწოდება და სერვისი."
              />
            </div>
          </section>


        </>
      ) : (
        <>
          <section className="space-y-4">
            <div>
              <div className="ui-eyebrow">2. პროფილის ფოტო</div>
              <h3 className="mt-2 text-xl font-black text-text">შენი avatar</h3>
            </div>
            <AssetCard
              title="პროფილის ფოტო"
              description="ეს ფოტო გამოჩნდება განცხადებებთან, ჩათებში და საჯარო პროფილზე."
              preview={
                <Avatar
                  src={visibleAvatarUrl}
                  alt={fullName || username || "მომხმარებელი"}
                  fallbackText={fullName || username || "SS"}
                  sizeClassName="h-20 w-20"
                  textClassName="text-xl"
                />
              }
              onChoose={() => avatarInputRef.current?.click()}
              onRemove={() => {
                clearSelectedFile(avatarInputRef, selectedAvatarPreviewUrl, setSelectedAvatarPreviewUrl, setSelectedAvatarFile)
                setRemoveAvatar(true)
                setSuccess("")
              }}
              buttonLabel={selectedAvatarFile ? "სხვა ფოტოს არჩევა" : "ფოტოს არჩევა"}
              status={selectedAvatarFile ? "არჩეულია — ჯერ არ არის შენახული" : visibleAvatarUrl ? "ფოტო შენახულია" : "ფოტო ჯერ არ არის დამატებული"}
              hint={"მაქსიმალური ზომაა " + MAX_AVATAR_FILE_SIZE_MB + "MB."}
            />
          </section>

          <section className="space-y-4">
            <div>
              <div className="ui-eyebrow">3. ძირითადი ინფორმაცია</div>
              <h3 className="mt-2 text-xl font-black text-text">სახელი, ქალაქი და აღწერა</h3>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="ui-field-label">მომხმარებლის სახელი</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} className="ui-input h-12 rounded-2xl" />
              </div>
              <div>
                <label className="ui-field-label">სრული სახელი</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="ui-input h-12 rounded-2xl" placeholder="მაგ: გიორგი ბულბულაშვილი" />
              </div>
            </div>

            <div>
              <label className="ui-field-label">ქალაქი</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className="ui-input h-12 rounded-2xl" placeholder="მაგ: თბილისი" />
            </div>

            <div>
              <label className="ui-field-label">შესახებ</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="ui-textarea min-h-32" placeholder="მოკლედ დაწერე რას ყიდი და როგორ მდგომარეობაშია შენი ნივთები." />
            </div>
          </section>

          <section>
            <div className="ui-eyebrow">4. საკონტაქტო ტელეფონი</div>
            <div className="mt-3">
              <label htmlFor="seller-phone" className="ui-field-label">ტელეფონი</label>
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
          </section>
        </>
      )}

      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        onChange={(event) => handleFileSelect(event, {
          maxSizeMb: MAX_AVATAR_FILE_SIZE_MB,
          previousPreview: selectedAvatarPreviewUrl,
          setPreview: setSelectedAvatarPreviewUrl,
          setFile: setSelectedAvatarFile,
          clearRemove: () => setRemoveAvatar(false),
        })}
        className="hidden"
      />

      <section className="ui-subcard bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="ui-eyebrow">{sellerType === "store" ? "6. TikTok" : "5. TikTok"}</div>
            <div className="mt-2 text-xl font-black text-text">TikTok LIVE ნიშანი</div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-text-soft">
              მიუთითე TikTok username. LIVE-ში გასვლისას ჩართე სტატუსი და შენს avatar-ზე გამოჩნდება LIVE ნიშანი.
            </p>
          </div>
          <span className={isTikTokLiveActive(tiktokLiveUntil)
            ? "inline-flex w-fit rounded-full bg-[#ff2d55] px-3 py-1 text-xs font-black text-white"
            : "inline-flex w-fit rounded-full bg-surface-alt px-3 py-1 text-xs font-black text-text-soft"}>
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
      </section>

      {error ? <div className="ui-status-error">{error}</div> : null}
      {success ? <div className="ui-status-success">{success}</div> : null}

      <div className="sticky bottom-4 z-30 rounded-[1.5rem] border border-line bg-white/95 p-3 shadow-[0_18px_50px_rgba(23,23,23,0.14)] backdrop-blur sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="mb-3 text-xs leading-5 text-text-soft sm:mb-0">
          {selectedAvatarFile || selectedLogoFile || selectedBannerFile
            ? "არჩეული ფოტო ჯერ მხოლოდ preview-შია. შენახვის შემდეგ გამოჩნდება საჯარო გვერდზე."
            : "ცვლილებების დასასრულებლად დააჭირე შენახვას."}
        </div>
        <button type="submit" disabled={loading} className="ui-btn-primary h-12 w-full shrink-0 sm:w-auto disabled:opacity-60">
          {loading ? "ინახება..." : "ცვლილებების შენახვა"}
        </button>
      </div>
    </form>
  )
}
