"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  MAX_LISTING_IMAGES,
  extractStoragePathFromPublicUrl,
  generateUniqueListingSlug,
  humanizeSupabaseError,
  validateImageFile,
} from "@/lib/listings"
import { enforceRateLimit } from "@/lib/rate-limit"
import type { ListingFormInitialData, ListingImage } from "@/types/marketplace"

type Option = { id: string; name?: string; label?: string }
type CategoryOption = { id: number; name: string }
type EditableImage = { id: string; kind: "existing" | "new"; imageUrl: string; file?: File }

type CreateListingFormProps = {
  categories: CategoryOption[]
  brands: Option[]
  sizes: Option[]
  mode?: "create" | "edit"
  initialData?: ListingFormInitialData
}

type ToggleOption = { value: string; label: string; helper?: string }

const emptyInitialData: ListingFormInitialData = {
  title: "",
  description: "",
  price: "",
  category_id: "",
  brand_id: "",
  size_id: "",
  condition: "good",
  sale_type: "sell",
  gender: "unisex",
  color: "",
  material: "",
  city: "",
  status: "active",
  published_at: null,
  images: [],
}

const conditionOptions: ToggleOption[] = [
  { value: "new", label: "ახალი", helper: "უხმარი ან ეტიკეტით" },
  { value: "like_new", label: "თითქმის ახალი", helper: "მინიმალური კვალით" },
  { value: "good", label: "კარგი", helper: "ყოველდღიური გამოყენებით" },
  { value: "fair", label: "საშუალო", helper: "შესამჩნევი კვალით" },
]

const saleTypeOptions: ToggleOption[] = [
  { value: "sell", label: "გაყიდვა", helper: "ფიქსირებული ფასით" },
  { value: "exchange", label: "გაცვლა", helper: "შემოთავაზებების მისაღებად" },
]

const cityPresets = ["თბილისი", "ბათუმი", "ქუთაისი", "რუსთავი", "გორი", "თელავი"]

function mapExistingImages(images: ListingImage[]): EditableImage[] {
  return images
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image) => ({ id: image.id, kind: "existing", imageUrl: image.image_url }))
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-[#2E3134]">{children}</label>
}

function HelperText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-5 text-[#5D6369]">{children}</p>
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  min,
  step,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  required?: boolean
  min?: string
  step?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        min={min}
        step={step}
        placeholder={placeholder}
        className="h-11 w-full rounded-md border border-[#2E3134] bg-white px-3 text-sm text-[#2D2D2D] shadow-[0_1px_2px_rgba(0,0,0,0.05)] outline-none transition placeholder:text-[#80868B] focus:border-[#8F3AF6] focus:ring-2 focus:ring-[#8F3AF6]/15"
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  placeholder: string
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="h-11 w-full appearance-none rounded-md border border-[#2E3134] bg-white px-3 pr-10 text-sm text-[#2D2D2D] shadow-[0_1px_2px_rgba(0,0,0,0.05)] outline-none transition focus:border-[#8F3AF6] focus:ring-2 focus:ring-[#8F3AF6]/15"
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#3C4043]">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </div>
  )
}

function TogglePills({
  label,
  value,
  onChange,
  options,
  columns = 2,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  options: ToggleOption[]
  columns?: 2 | 4
}) {
  return (
    <div className="space-y-2">
      <FieldLabel>{label}</FieldLabel>
      <div className={`grid gap-2 ${columns === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"}`}>
        {options.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-lg border px-3 py-3 text-left transition ${
                active
                  ? "border-[#8F3AF6] bg-[#F7F1FF] text-[#4B1F87] shadow-[0_0_0_3px_rgba(143,58,246,0.08)]"
                  : "border-[#D4D7DB] bg-white text-[#2D2D2D] hover:border-[#B5BBC2]"
              }`}
            >
              <div className="text-sm font-semibold">{option.label}</div>
              {option.helper ? <div className="mt-1 text-xs text-[#6A7178]">{option.helper}</div> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function CreateListingForm({ categories, brands, sizes, mode = "create", initialData = emptyInitialData }: CreateListingFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const isEdit = mode === "edit"

  const [title, setTitle] = useState(initialData.title)
  const [description, setDescription] = useState(initialData.description)
  const [price, setPrice] = useState(initialData.price)
  const [categoryId, setCategoryId] = useState<number | "">(initialData.category_id)
  const [brandId, setBrandId] = useState(initialData.brand_id)
  const [sizeId, setSizeId] = useState(initialData.size_id)
  const [condition, setCondition] = useState(initialData.condition)
  const [saleType, setSaleType] = useState(initialData.sale_type)
  const gender = initialData.gender
  const [color, setColor] = useState(initialData.color)
  const [material, setMaterial] = useState(initialData.material)
  const [city, setCity] = useState(initialData.city)
  const [publishNow, setPublishNow] = useState(initialData.status === "active")
  const [images, setImages] = useState<EditableImage[]>(() => mapExistingImages(initialData.images))
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [progressText, setProgressText] = useState("")
  const [progressPercent, setProgressPercent] = useState(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const imagesRef = useRef(images)

  useEffect(() => {
    imagesRef.current = images
  }, [images])

  useEffect(() => {
    return () => {
      for (const image of imagesRef.current) {
        if (image.kind === "new" && image.imageUrl.startsWith("blob:")) {
          URL.revokeObjectURL(image.imageUrl)
        }
      }
    }
  }, [])

  const imageSlots = useMemo<(EditableImage | null)[]>(() => {
    const slots: Array<EditableImage | null> = [...images]
    while (slots.length < MAX_LISTING_IMAGES) slots.push(null)
    return slots
  }, [images])

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList?.length) return
    const incomingFiles = Array.from(fileList)
    if (images.length + incomingFiles.length > MAX_LISTING_IMAGES) {
      setError(`მაქსიმუმ ${MAX_LISTING_IMAGES} სურათის დამატებაა შესაძლებელი.`)
      return
    }
    const nextItems: EditableImage[] = []
    for (const file of incomingFiles) {
      const validationError = validateImageFile(file)
      if (validationError) {
        setError(validationError)
        return
      }
      nextItems.push({ id: `new-${crypto.randomUUID()}`, kind: "new", imageUrl: URL.createObjectURL(file), file })
    }
    setError("")
    setImages((current) => [...current, ...nextItems])
  }

  function removeImage(imageId: string) {
    setImages((current) => {
      const target = current.find((item) => item.id === imageId)
      if (target?.kind === "new" && target.imageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(target.imageUrl)
      }
      return current.filter((item) => item.id !== imageId)
    })
  }

  function moveImage(imageId: string, direction: -1 | 1) {
    setImages((current) => {
      const index = current.findIndex((item) => item.id === imageId)
      if (index === -1) return current
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.length) return current
      const copy = [...current]
      const [item] = copy.splice(index, 1)
      copy.splice(nextIndex, 0, item)
      return copy
    })
  }

  function setAsCover(imageId: string) {
    setImages((current) => {
      const index = current.findIndex((item) => item.id === imageId)
      if (index <= 0) return current
      const copy = [...current]
      const [item] = copy.splice(index, 1)
      copy.unshift(item)
      return copy
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setProgressText("")
    setProgressPercent(0)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) throw new Error("ჯერ უნდა შეხვიდე სისტემაში.")
      if (!title.trim()) throw new Error("შეიყვანე სათაური.")
      if (!description.trim()) throw new Error("შეავსე აღწერა.")
      if (!categoryId) throw new Error("აირჩიე კატეგორია.")
      if (!price || Number(price) < 0) throw new Error("ფასი სწორად შეიყვანე.")

      if (!isEdit) {
        await enforceRateLimit(supabase, "listing_create")
      }

      const uniqueSlug = await generateUniqueListingSlug(supabase, title, initialData.id)
      const nextStatus = publishNow ? "active" : "draft"
      const nextPublishedAt = publishNow ? initialData.published_at || new Date().toISOString() : null

      const listingPayload = {
        seller_id: user.id,
        category_id: categoryId,
        brand_id: brandId || null,
        size_id: sizeId || null,
        title: title.trim(),
        slug: uniqueSlug,
        description: description.trim(),
        price: Number(price),
        condition,
        sale_type: saleType,
        gender,
        color: color.trim() || null,
        material: material.trim() || null,
        city: city.trim() || null,
        status: nextStatus,
        published_at: nextPublishedAt,
      }

      let listingId = initialData.id

      if (isEdit && listingId) {
        setProgressText("განცხადება ახლდება...")
        const { error: updateError } = await supabase.from("listings").update(listingPayload).eq("id", listingId)
        if (updateError) throw updateError
      } else {
        setProgressText("განცხადება იქმნება...")
        const { data: inserted, error: insertError } = await supabase.from("listings").insert(listingPayload).select("id").single()
        if (insertError || !inserted) throw insertError || new Error("განცხადების შექმნა ვერ მოხერხდა.")
        listingId = inserted.id
      }

      if (!listingId) throw new Error("listing id ვერ მოიძებნა.")

      const originalImages = initialData.images
      const remainingExistingIds = images.filter((image) => image.kind === "existing").map((image) => image.id)
      const removedExistingImages = originalImages.filter((image) => !remainingExistingIds.includes(image.id))

      if (removedExistingImages.length > 0) {
        const removedImageIds = removedExistingImages.map((image) => image.id)
        const { error: deleteRowsError } = await supabase.from("listing_images").delete().in("id", removedImageIds)
        if (deleteRowsError) throw deleteRowsError
        const storagePaths = removedExistingImages
          .map((image) => extractStoragePathFromPublicUrl(image.image_url))
          .filter((path): path is string => Boolean(path))
        if (storagePaths.length > 0) await supabase.storage.from("listing-images").remove(storagePaths)
      }

      const existingImagesById = new Map(initialData.images.map((image) => [image.id, image]))
      const uploadedImages: Array<{ tempId: string; publicUrl: string }> = []
      const newImages = images.filter((image) => image.kind === "new")
      const totalUploads = Math.max(newImages.length, 1)

      if (newImages.length > 0) {
        for (let index = 0; index < newImages.length; index += 1) {
          const image = newImages[index]
          const file = image.file
          if (!file) continue
          setProgressText(`სურათები იტვირთება... ${index + 1}/${newImages.length}`)
          setProgressPercent(Math.round(((index + 1) / totalUploads) * 100))
          const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
          const safeExt = extension.replace(/[^a-z0-9]/g, "") || "jpg"
          const path = `${user.id}/${listingId}/${Date.now()}-${index}.${safeExt}`
          const { error: uploadError } = await supabase.storage.from("listing-images").upload(path, file, {
            cacheControl: "3600",
            upsert: false,
          })
          if (uploadError) throw uploadError
          const { data: publicUrlData } = supabase.storage.from("listing-images").getPublicUrl(path)
          uploadedImages.push({ tempId: image.id, publicUrl: publicUrlData.publicUrl })
        }
      }

      const uploadedUrlByTempId = new Map(uploadedImages.map((item) => [item.tempId, item.publicUrl]))

      for (let index = 0; index < images.length; index += 1) {
        const image = images[index]
        if (image.kind === "existing") {
          const { error: reorderError } = await supabase.from("listing_images").update({ sort_order: index }).eq("id", image.id)
          if (reorderError) throw reorderError
        } else {
          const publicUrl = uploadedUrlByTempId.get(image.id)
          if (!publicUrl) throw new Error("ატვირთული სურათის URL ვერ მოიძებნა.")
          const { error: imageInsertError } = await supabase
            .from("listing_images")
            .insert({ listing_id: listingId, image_url: publicUrl, sort_order: index })
          if (imageInsertError) throw imageInsertError
        }
      }

      const coverUrl = images[0]
        ? images[0].kind === "existing"
          ? existingImagesById.get(images[0].id)?.image_url ?? null
          : uploadedUrlByTempId.get(images[0].id) ?? null
        : null

      const { error: listingUpdateError } = await supabase.from("listings").update({ cover_image_url: coverUrl }).eq("id", listingId)
      if (listingUpdateError) throw listingUpdateError

      setProgressPercent(100)
      setProgressText(isEdit ? "განცხადება განახლდა." : "განცხადება შეიქმნა.")
      router.push(`/dashboard/listings?${isEdit ? "updated=1" : "created=1"}`)
      router.refresh()
    } catch (submitError) {
      const fallbackMessage = submitError instanceof Error ? submitError.message : "ოპერაცია ვერ შესრულდა."
      setError(humanizeSupabaseError(fallbackMessage))
      setLoading(false)
      return
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="mx-auto w-full max-w-[856px] rounded-[28px] border border-[#E9E2F4] bg-white p-5 shadow-[0_18px_60px_rgba(33,37,41,0.08)] sm:p-8 lg:p-12">
        <div className="mx-auto flex w-full max-w-[536px] flex-col gap-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-center text-2xl font-semibold text-[#2D2D2D] sm:text-left">
                {isEdit ? "განცხადების რედაქტირება" : "დაამატე ნივთი"}
              </h1>
              <HelperText>
                {isEdit
                  ? "განაახლე ფოტოები, ტექსტი და პარამეტრები ამავე ფორმიდან."
                  : "შეავსე აუცილებელი ველები, ატვირთე ფოტოები და შეინახე განცხადება დრაფტად ან გამოაქვეყნე პირდაპირ."}
              </HelperText>
            </div>

            <button
              type="button"
              onClick={() => setPublishNow((current) => !current)}
              className={`inline-flex items-center gap-3 self-start rounded-full border px-3 py-2 text-sm font-medium transition ${
                publishNow
                  ? "border-[#8F3AF6] bg-[#F7F1FF] text-[#4B1F87]"
                  : "border-[#D6D8DE] bg-white text-[#4D535A]"
              }`}
              aria-pressed={publishNow}
            >
              <span
                className={`relative h-6 w-11 rounded-full transition ${publishNow ? "bg-[#8F3AF6]" : "bg-[#C7CBD1]"}`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${publishNow ? "left-6" : "left-1"}`}
                />
              </span>
              {publishNow ? "გამოქვეყნდეს შენახვისას" : "დრაფტად შეინახოს"}
            </button>
          </div>

          <section className="space-y-4">
            <div className="space-y-1">
              <FieldLabel>ფოტოები</FieldLabel>
              <p className="text-sm text-[#2D2D2D]">ატვირთე 8 სურათამდე PNG, JPEG ან WEBP ფორმატში. პირველი ფოტო გახდება მთავარი.</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                void handleFilesSelected(e.target.files)
                e.currentTarget.value = ""
              }}
            />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {imageSlots.map((slot, index) => {
                if (slot) {
                  return (
                    <div
                      key={slot.id}
                      className="group relative aspect-square overflow-hidden rounded-[6px] border-2 border-dashed border-[#8F3AF69C] bg-[#FAF7FF]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={slot.imageUrl} alt={`განცხადების სურათი ${index + 1}`} className="h-full w-full object-cover" />

                      {index === 0 ? (
                        <span className="absolute left-2 top-2 rounded-full bg-[#2D2D2D] px-2 py-1 text-[10px] font-semibold text-white">
                          მთავარი
                        </span>
                      ) : null}

                      <div className="absolute inset-x-1 bottom-1 flex flex-wrap gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => setAsCover(slot.id)}
                          className="rounded bg-white/95 px-2 py-1 text-[10px] font-medium text-[#2D2D2D] shadow-sm"
                        >
                          მთავარი
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(slot.id, -1)}
                          disabled={index === 0}
                          className="rounded bg-white/95 px-2 py-1 text-[10px] font-medium text-[#2D2D2D] shadow-sm disabled:opacity-40"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(slot.id, 1)}
                          disabled={index === images.length - 1}
                          className="rounded bg-white/95 px-2 py-1 text-[10px] font-medium text-[#2D2D2D] shadow-sm disabled:opacity-40"
                        >
                          →
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImage(slot.id)}
                          className="ml-auto rounded bg-[#2D2D2D]/90 px-2 py-1 text-[10px] font-medium text-white shadow-sm"
                        >
                          წაშლა
                        </button>
                      </div>
                    </div>
                  )
                }

                const canAdd = index === images.length
                return (
                  <button
                    key={`slot-${index}`}
                    type="button"
                    disabled={!canAdd}
                    onClick={() => canAdd && fileInputRef.current?.click()}
                    className={`relative aspect-square rounded-[6px] border-2 border-dashed transition ${
                      canAdd
                        ? "border-[#8F3AF69C] bg-[#FCF8FF] hover:bg-[#F7EEFF]"
                        : "border-[#8F3AF640] bg-white"
                    }`}
                    aria-label="სურათის დამატება"
                  >
                    {canAdd ? (
                      <>
                        <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#9747FF]/20" />
                        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center text-[#8F3AF691]">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M8.5 6.5H10.2L11.1 5H12.9L13.8 6.5H15.5C17.43 6.5 19 8.07 19 10V15.5C19 17.43 17.43 19 15.5 19H8.5C6.57 19 5 17.43 5 15.5V10C5 8.07 6.57 6.5 8.5 6.5Z" stroke="currentColor" strokeWidth="1.6" />
                            <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.6" />
                          </svg>
                        </div>
                      </>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="space-y-4">
            <TextInput
              label="სათაური"
              value={title}
              onChange={setTitle}
              required
              placeholder="მაგ: Zara ტყავის ქურთუკი"
            />

            <section className="space-y-1">
              <FieldLabel>აღწერა</FieldLabel>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                placeholder="აღწერე ნივთი, მდგომარეობა, ზომა, დეფექტები და სხვა მნიშვნელოვანი დეტალები"
                className="min-h-[133px] w-full resize-y rounded-md border border-[#2E3134] bg-white px-3 py-3 text-sm text-[#2D2D2D] shadow-[0_1px_2px_rgba(0,0,0,0.05)] outline-none transition placeholder:text-[#80868B] focus:border-[#8F3AF6] focus:ring-2 focus:ring-[#8F3AF6]/15"
              />
            </section>
          </section>

          <section className="space-y-4">
            <TextInput
              label="ფასი"
              value={price}
              onChange={setPrice}
              required
              type="number"
              min="0"
              step="0.01"
              placeholder="მაგ: 120"
            />

            <SelectField
              label="კატეგორია"
              value={categoryId ? String(categoryId) : ""}
              onChange={(value) => setCategoryId(Number(value) || "")}
              options={categories.map((item) => ({ value: String(item.id), label: item.name }))}
              placeholder="აირჩიე კატეგორია"
              required
            />

            <SelectField
              label="ბრენდი"
              value={brandId}
              onChange={setBrandId}
              options={brands.map((item) => ({ value: item.id, label: item.name ?? item.id }))}
              placeholder="აირჩიე ბრენდი"
            />

            <SelectField
              label="მდგომარეობა"
              value={condition}
              onChange={setCondition}
              options={conditionOptions.map((item) => ({ value: item.value, label: item.label }))}
              placeholder="აირჩიე ნივთის მდგომარეობა"
              required
            />

            <SelectField
              label="ზომა"
              value={sizeId}
              onChange={setSizeId}
              options={sizes.map((item) => ({ value: item.id, label: item.label ?? item.id }))}
              placeholder="აირჩიე ზომა"
            />
          </section>

          <section className="space-y-4">
            <TogglePills label="გაყიდვა / გაცვლა" value={saleType} onChange={setSaleType} options={saleTypeOptions} />
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <TextInput label="ფერი" value={color} onChange={setColor} placeholder="მაგ: შავი" />
            <TextInput label="მასალა" value={material} onChange={setMaterial} placeholder="მაგ: ტყავი" />
          </section>

          <section className="space-y-3">
            <TextInput label="ქალაქი" value={city} onChange={setCity} placeholder="მაგ: თბილისი" />
            <div className="flex flex-wrap gap-2">
              {cityPresets.map((preset) => {
                const active = city === preset
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCity(preset)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "border-[#8F3AF6] bg-[#F7F1FF] text-[#4B1F87]"
                        : "border-[#D6D8DE] bg-white text-[#5E646B] hover:border-[#B7BDC5]"
                    }`}
                  >
                    {preset}
                  </button>
                )
              })}
            </div>
          </section>

          {progressText ? (
            <div className="rounded-xl border border-[#E4E6EB] bg-[#FAFAFC] px-4 py-3 text-sm text-[#41464C]">
              <div className="flex items-center justify-between gap-3">
                <span>{progressText}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-[#8F3AF6] transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-14 w-full items-center justify-center rounded-lg border border-[#2E3134] bg-[#2D2D2D] px-8 text-base font-medium text-white transition hover:bg-[#1E1E1E] disabled:opacity-60 sm:w-[265px]"
            >
              {loading ? "ინახება..." : isEdit ? "ცვლილებების შენახვა" : publishNow ? "გამოქვეყნება" : "დრაფტის შექმნა"}
            </button>

            <div className="text-sm leading-6 text-[#61676E] sm:max-w-[240px] sm:text-right">
              {publishNow
                ? "შენახვისას განცხადება კატალოგშიც გამოჩნდება."
                : "შენახვისას განცხადება დრაფტად დარჩება და მოგვიანებით გამოაქვეყნებ."}
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
