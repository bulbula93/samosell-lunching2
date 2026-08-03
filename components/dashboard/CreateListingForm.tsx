"use client"

import Link from "next/link"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  abortListingUploadsAction,
  prepareListingUploadsAction,
  saveListingAction,
} from "@/app/dashboard/listings/form-actions"
import {
  LISTING_GENDERS,
  LISTING_IMAGE_ACCEPT,
  LISTING_TEXT_LIMITS,
  type ListingFieldErrors,
  type ListingFormInput,
  validateListingInput,
} from "@/lib/listing-form"
import { createClient } from "@/lib/supabase/client"
import {
  listingStatusLabel,
  MAX_LISTING_IMAGES,
  validateImageFile,
} from "@/lib/listings"
import type { ListingFormInitialData, ListingImage } from "@/types/marketplace"

type Option = { id: string; name?: string; label?: string }
type CategoryOption = { id: number; name: string }
type EditableImage = { id: string; kind: "existing" | "new"; imageUrl: string; file?: File }
type ToggleOption = { value: string; label: string; helper?: string }

export type CreateListingFormProps = {
  categories: CategoryOption[]
  brands: Option[]
  sizes: Option[]
  mode?: "create" | "edit"
  initialData?: ListingFormInitialData
}

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

const genderOptions: ToggleOption[] = [
  { value: "women", label: "ქალებისთვის" },
  { value: "men", label: "მამაკაცებისთვის" },
  { value: "kids", label: "ბავშვებისთვის" },
  { value: "unisex", label: "უნისექსი" },
]

const cityPresets = ["თბილისი", "ბათუმი", "ქუთაისი", "რუსთავი", "გორი", "თელავი"]

function mapExistingImages(images: ListingImage[]): EditableImage[] {
  return images
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image) => ({ id: image.id, kind: "existing", imageUrl: image.image_url }))
}

function fieldErrorId(id: string) {
  return `${id}-error`
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={fieldErrorId(id)} className="text-sm font-medium text-red-700">
      {message}
    </p>
  )
}

function TextInput({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  required = false,
  inputMode,
  maxLength,
  helper,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  placeholder?: string
  required?: boolean
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  maxLength?: number
  helper?: string
}) {
  const helperId = helper ? `${id}-helper` : undefined
  const describedBy = [helperId, error ? fieldErrorId(id) : null].filter(Boolean).join(" ") || undefined

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-bold text-text">
        {label}
        {required ? <span className="ml-1 text-red-700" aria-hidden="true">*</span> : null}
      </label>
      <input
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`ui-input ${error ? "border-red-500 focus:border-red-600 focus:ring-red-100" : ""}`}
      />
      {helper ? <p id={helperId} className="text-sm leading-5 text-text-soft">{helper}</p> : null}
      <FieldError id={id} message={error} />
    </div>
  )
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  required = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  placeholder: string
  error?: string
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-bold text-text">
        {label}
        {required ? <span className="ml-1 text-red-700" aria-hidden="true">*</span> : null}
      </label>
      <select
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? fieldErrorId(id) : undefined}
        className={`ui-input appearance-none pr-10 ${error ? "border-red-500 focus:border-red-600 focus:ring-red-100" : ""}`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError id={id} message={error} />
    </div>
  )
}

function TogglePills({
  legend,
  value,
  onChange,
  options,
  error,
  columns = 2,
}: {
  legend: string
  value: string
  onChange: (next: string) => void
  options: ToggleOption[]
  error?: string
  columns?: 2 | 4
}) {
  const groupId = useId()

  return (
    <fieldset aria-describedby={error ? fieldErrorId(groupId) : undefined} className="space-y-2">
      <legend className="text-sm font-bold text-text">{legend}</legend>
      <div className={`grid gap-2 ${columns === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"}`}>
        {options.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={`min-h-12 rounded-xl border px-3 py-3 text-left transition ${
                active
                  ? "border-brand bg-brand-soft text-brand shadow-[0_0_0_3px_rgba(7,90,83,0.08)]"
                  : "border-line bg-white text-text hover:border-brand/40 hover:bg-brand-soft/30"
              }`}
            >
              <span className="block text-sm font-bold">{option.label}</span>
              {option.helper ? <span className="mt-1 block text-xs text-text-soft">{option.helper}</span> : null}
            </button>
          )
        })}
      </div>
      <FieldError id={groupId} message={error} />
    </fieldset>
  )
}

export default function CreateListingForm({
  categories,
  brands,
  sizes,
  mode = "create",
  initialData = emptyInitialData,
}: CreateListingFormProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const isEdit = mode === "edit"
  const canChangePublication = !isEdit || initialData.status === "active" || initialData.status === "draft"

  const [title, setTitle] = useState(initialData.title)
  const [description, setDescription] = useState(initialData.description)
  const [price, setPrice] = useState(initialData.price)
  const [categoryId, setCategoryId] = useState<number | "">(initialData.category_id)
  const [brandId, setBrandId] = useState(initialData.brand_id)
  const [sizeId, setSizeId] = useState(initialData.size_id)
  const [condition, setCondition] = useState(initialData.condition)
  const [saleType, setSaleType] = useState(initialData.sale_type)
  const [gender, setGender] = useState(initialData.gender)
  const [color, setColor] = useState(initialData.color)
  const [material, setMaterial] = useState(initialData.material)
  const [city, setCity] = useState(initialData.city)
  const [publishNow, setPublishNow] = useState(initialData.status === "active")
  const [images, setImages] = useState<EditableImage[]>(() => mapExistingImages(initialData.images))
  const [fieldErrors, setFieldErrors] = useState<ListingFieldErrors>({})
  const [formError, setFormError] = useState("")
  const [loading, setLoading] = useState(false)
  const [progressText, setProgressText] = useState("")
  const [progressPercent, setProgressPercent] = useState(0)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const errorSummaryRef = useRef<HTMLDivElement | null>(null)
  const submittingRef = useRef(false)
  const imagesRef = useRef(images)
  const formPrefix = useId().replace(/:/g, "")

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

  useEffect(() => {
    if (formError || Object.keys(fieldErrors).length > 0) {
      errorSummaryRef.current?.focus()
    }
  }, [fieldErrors, formError])

  const imageSlots = useMemo<(EditableImage | null)[]>(() => {
    const slots: Array<EditableImage | null> = [...images]
    while (slots.length < MAX_LISTING_IMAGES) slots.push(null)
    return slots
  }, [images])

  const formInput: ListingFormInput = {
    title,
    description,
    price,
    categoryId,
    brandId,
    sizeId,
    condition,
    saleType,
    gender,
    color,
    material,
    city,
    publishNow,
  }

  function clearFieldError(field: keyof ListingFormInput) {
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList?.length) return
    const incomingFiles = Array.from(fileList)
    if (images.length + incomingFiles.length > MAX_LISTING_IMAGES) {
      setFieldErrors((current) => ({
        ...current,
        images: `მაქსიმუმ ${MAX_LISTING_IMAGES} სურათის დამატებაა შესაძლებელი.`,
      }))
      return
    }

    const nextItems: EditableImage[] = []
    for (const file of incomingFiles) {
      const validationError = validateImageFile(file)
      if (validationError) {
        for (const item of nextItems) URL.revokeObjectURL(item.imageUrl)
        setFieldErrors((current) => ({ ...current, images: validationError }))
        return
      }
      nextItems.push({
        id: `new-${crypto.randomUUID()}`,
        kind: "new",
        imageUrl: URL.createObjectURL(file),
        file,
      })
    }

    setFieldErrors((current) => {
      const next = { ...current }
      delete next.images
      return next
    })
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
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current
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
    if (submittingRef.current) return

    const validation = validateListingInput(formInput)
    if (!validation.ok) {
      setFieldErrors(validation.fieldErrors)
      setFormError("შეამოწმე მონიშნული ველები და სცადე ხელახლა.")
      return
    }

    submittingRef.current = true
    setLoading(true)
    setFieldErrors({})
    setFormError("")
    setProgressText("მონაცემები მოწმდება…")
    setProgressPercent(5)

    const newImages = images.filter(
      (image): image is EditableImage & { kind: "new"; file: File } =>
        image.kind === "new" && Boolean(image.file)
    )
    let preparedListingId = initialData.id ?? ""
    let uploadedPaths: string[] = []
    let completed = false

    try {
      const preparation = await prepareListingUploadsAction({
        mode,
        listingId: initialData.id,
        files: newImages.map((image) => ({
          clientId: image.id,
          mimeType: image.file.type,
          size: image.file.size,
        })),
      })

      if (!preparation.ok) {
        if (preparation.code === "unauthorized") {
          const nextPath = isEdit && initialData.id
            ? `/dashboard/listings/${initialData.id}/edit`
            : "/dashboard/listings/new"
          router.push(`/login?next=${encodeURIComponent(nextPath)}`)
          return
        }
        throw new Error(preparation.message)
      }

      preparedListingId = preparation.listingId
      const plansByClientId = new Map(preparation.plans.map((plan) => [plan.clientId, plan]))

      for (let index = 0; index < newImages.length; index += 1) {
        const image = newImages[index]
        const plan = plansByClientId.get(image.id)
        if (!plan) throw new Error("სურათის ატვირთვის უსაფრთხო მისამართი ვერ მომზადდა.")

        setProgressText(`სურათები იტვირთება… ${index + 1}/${newImages.length}`)
        setProgressPercent(10 + Math.round(((index + 1) / Math.max(newImages.length, 1)) * 55))

        const { error } = await supabase.storage
          .from("listing-images")
          .uploadToSignedUrl(plan.path, plan.token, image.file, {
            contentType: image.file.type,
            cacheControl: "3600",
          })
        if (error) throw new Error("სურათის ატვირთვა ვერ დასრულდა. კავშირი შეამოწმე და სცადე ხელახლა.")
        uploadedPaths.push(plan.path)
      }

      setProgressText("განცხადება უსაფრთხოდ ინახება…")
      setProgressPercent(75)

      const pathByClientId = new Map(preparation.plans.map((plan) => [plan.clientId, plan.path]))
      const result = await saveListingAction({
        mode,
        listingId: preparation.listingId,
        form: formInput,
        images: images.map((image) => {
          if (image.kind === "existing") return { kind: "existing" as const, id: image.id }
          const path = pathByClientId.get(image.id)
          if (!path) throw new Error("ერთ-ერთი ატვირთული სურათი ვერ მოიძებნა.")
          return { kind: "uploaded" as const, path }
        }),
      })

      if (!result.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors)
        if (result.code === "unauthorized") {
          const nextPath = isEdit && initialData.id
            ? `/dashboard/listings/${initialData.id}/edit`
            : "/dashboard/listings/new"
          router.push(`/login?next=${encodeURIComponent(nextPath)}`)
          return
        }
        throw new Error(result.message)
      }

      uploadedPaths = []
      setProgressPercent(100)
      setProgressText(result.cleanupWarning
        ? "განცხადება შენახულია. ერთი ძველი ფაილის ავტომატური გასუფთავება მოგვიანებით განმეორდება."
        : isEdit ? "განცხადება განახლდა." : "განცხადება შეიქმნა.")
      completed = true
      const hasPrivateDetail = !["active", "reserved", "sold"].includes(result.status)
      router.push(hasPrivateDetail ? "/dashboard/listings" : `/listing/${result.slug}`)
      router.refresh()
    } catch (submitError) {
      if (preparedListingId && uploadedPaths.length > 0) {
        await abortListingUploadsAction(preparedListingId, uploadedPaths)
      }
      const message = submitError instanceof Error ? submitError.message : ""
      setFormError(
        /[\u10a0-\u10ff]/i.test(message)
          ? message
          : "ოპერაცია ვერ შესრულდა. ფორმის მონაცემები შენარჩუნებულია — სცადე ხელახლა."
      )
    } finally {
      if (!completed) {
        submittingRef.current = false
        setLoading(false)
      }
    }
  }

  const titleId = `${formPrefix}-title`
  const descriptionId = `${formPrefix}-description`
  const priceId = `${formPrefix}-price`
  const categoryIdField = `${formPrefix}-category`
  const brandIdField = `${formPrefix}-brand`
  const sizeIdField = `${formPrefix}-size`
  const colorId = `${formPrefix}-color`
  const materialId = `${formPrefix}-material`
  const cityId = `${formPrefix}-city`
  const imagesId = `${formPrefix}-images`
  const cancelHref = isEdit && initialData.slug ? `/listing/${initialData.slug}` : "/dashboard/listings"

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto w-full max-w-5xl space-y-6">
      <header className="ui-card overflow-hidden">
        <div className="border-b border-line bg-[linear-gradient(135deg,#eff8f6_0%,#ffffff_62%)] px-5 py-7 sm:px-8">
          <p className="ui-eyebrow">{isEdit ? "განცხადების მართვა" : "ახალი განცხადება"}</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-text sm:text-3xl">
                {isEdit ? "განცხადების რედაქტირება" : "გაყიდე ნივთი მარტივად"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text-soft">
                {isEdit
                  ? "განაახლე საჯარო ინფორმაცია და ფოტოები. ცვლილებას მხოლოდ შენს განცხადებაზე შეძლებ."
                  : "შეავსე აუცილებელი ველები, სურვილის შემთხვევაში დაამატე ფოტოები და გამოაქვეყნე ან შეინახე დრაფტად."}
              </p>
            </div>

            {canChangePublication ? (
              <button
                type="button"
                onClick={() => setPublishNow((current) => !current)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-3 self-start rounded-xl border px-4 py-2 text-sm font-bold transition ${
                  publishNow
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-line bg-white text-text-soft hover:border-brand/40"
                }`}
                aria-pressed={publishNow}
              >
                <span className={`relative h-6 w-11 rounded-full ${publishNow ? "bg-brand" : "bg-neutral-300"}`} aria-hidden="true">
                  <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${publishNow ? "left-6" : "left-1"}`} />
                </span>
                {publishNow ? "გამოქვეყნდება" : "დრაფტად შეინახება"}
              </button>
            ) : (
              <span className="ui-pill-soft self-start">{listingStatusLabel(initialData.status)}</span>
            )}
          </div>
        </div>
      </header>

      {(formError || Object.keys(fieldErrors).length > 0) ? (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 focus:outline-none"
        >
          <p className="font-black">ფორმა ვერ შეინახა</p>
          <p className="mt-1">{formError || "შეამოწმე მონიშნული ველები."}</p>
        </div>
      ) : null}

      <section className="ui-card p-5 sm:p-8" aria-labelledby={`${imagesId}-heading`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id={`${imagesId}-heading`} className="text-lg font-black text-text">ფოტოები</h2>
            <p className="mt-1 text-sm leading-6 text-text-soft">
              JPEG, PNG ან WEBP; თითოეული მაქსიმუმ 7 MB. პირველი ფოტო გახდება მთავარი.
            </p>
          </div>
          <span className="text-sm font-bold text-text-soft">{images.length}/{MAX_LISTING_IMAGES}</span>
        </div>

        <input
          ref={fileInputRef}
          id={imagesId}
          type="file"
          accept={LISTING_IMAGE_ACCEPT}
          multiple
          className="sr-only"
          aria-label="განცხადების სურათების არჩევა"
          aria-describedby={fieldErrors.images ? fieldErrorId(imagesId) : `${imagesId}-heading`}
          onChange={(event) => {
            void handleFilesSelected(event.target.files)
            event.currentTarget.value = ""
          }}
        />

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {imageSlots.map((slot, index) => {
            if (!slot) {
              const canAdd = index === images.length
              return (
                <button
                  key={`slot-${index}`}
                  type="button"
                  disabled={!canAdd || loading}
                  onClick={() => canAdd && fileInputRef.current?.click()}
                  className={`aspect-square min-h-24 rounded-2xl border-2 border-dashed transition ${
                    canAdd
                      ? "border-brand/45 bg-brand-soft/35 text-brand hover:border-brand hover:bg-brand-soft"
                      : "border-line bg-surface-alt/50"
                  } disabled:cursor-not-allowed`}
                  aria-label={canAdd ? "სურათების არჩევა" : `ცარიელი ფოტო ადგილი ${index + 1}`}
                >
                  {canAdd ? (
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl font-light shadow-sm" aria-hidden="true">
                      +
                    </span>
                  ) : null}
                </button>
              )
            }

            return (
              <article key={slot.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-line bg-surface-alt">
                {/* Blob previews and existing public Storage URLs cannot be passed through next/image together. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slot.imageUrl}
                  alt={`${title.trim() || "განცხადება"} — ფოტო ${index + 1}`}
                  className="h-full w-full object-cover"
                />
                {index === 0 ? (
                  <span className="absolute left-2 top-2 rounded-full bg-brand px-2.5 py-1 text-[11px] font-black text-white">
                    მთავარი
                  </span>
                ) : null}
                <div className="absolute inset-x-1.5 bottom-1.5 flex items-center gap-1 rounded-xl bg-white/95 p-1 shadow-sm backdrop-blur">
                  <button
                    type="button"
                    disabled={index === 0 || loading}
                    onClick={() => moveImage(slot.id, -1)}
                    className="min-h-10 min-w-10 rounded-lg text-sm font-black text-text hover:bg-brand-soft disabled:opacity-35"
                    aria-label={`ფოტო ${index + 1} გადაიტანე მარცხნივ`}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={index === images.length - 1 || loading}
                    onClick={() => moveImage(slot.id, 1)}
                    className="min-h-10 min-w-10 rounded-lg text-sm font-black text-text hover:bg-brand-soft disabled:opacity-35"
                    aria-label={`ფოტო ${index + 1} გადაიტანე მარჯვნივ`}
                  >
                    →
                  </button>
                  {index > 0 ? (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => setAsCover(slot.id)}
                      className="min-h-10 rounded-lg px-2 text-[11px] font-black text-brand hover:bg-brand-soft disabled:opacity-35"
                      aria-label={`ფოტო ${index + 1} გახადე მთავარი`}
                    >
                      მთავარი
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => removeImage(slot.id)}
                    className="ml-auto min-h-10 min-w-10 rounded-lg text-sm font-black text-red-700 hover:bg-red-50 disabled:opacity-35"
                    aria-label={`ფოტო ${index + 1} წაშალე`}
                  >
                    ×
                  </button>
                </div>
              </article>
            )
          })}
        </div>
        <FieldError id={imagesId} message={fieldErrors.images} />
      </section>

      <section className="ui-card p-5 sm:p-8" aria-labelledby={`${formPrefix}-details-heading`}>
        <h2 id={`${formPrefix}-details-heading`} className="text-lg font-black text-text">ძირითადი ინფორმაცია</h2>
        <div className="mt-5 grid gap-5">
          <TextInput
            id={titleId}
            label="სათაური"
            value={title}
            onChange={(value) => { setTitle(value); clearFieldError("title") }}
            error={fieldErrors.title}
            required
            maxLength={LISTING_TEXT_LIMITS.titleMax}
            placeholder="მაგ: Zara-ს ტყავის ქურთუკი"
            helper={`${Array.from(title).length}/${LISTING_TEXT_LIMITS.titleMax} სიმბოლო`}
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={descriptionId} className="text-sm font-bold text-text">
                აღწერა<span className="ml-1 text-red-700" aria-hidden="true">*</span>
              </label>
              <span className="text-xs font-semibold text-text-soft">
                {Array.from(description).length}/{LISTING_TEXT_LIMITS.descriptionMax}
              </span>
            </div>
            <textarea
              id={descriptionId}
              name="description"
              value={description}
              onChange={(event) => { setDescription(event.target.value); clearFieldError("description") }}
              required
              maxLength={LISTING_TEXT_LIMITS.descriptionMax}
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={fieldErrors.description ? fieldErrorId(descriptionId) : undefined}
              placeholder="აღწერე მდგომარეობა, ზომა, დეფექტები და სხვა მნიშვნელოვანი დეტალები"
              className={`min-h-40 w-full resize-y rounded-xl border bg-white px-4 py-3 text-sm leading-6 text-text outline-none transition placeholder:text-text-soft focus:ring-4 ${
                fieldErrors.description
                  ? "border-red-500 focus:border-red-600 focus:ring-red-100"
                  : "border-line focus:border-brand focus:ring-brand-soft"
              }`}
            />
            <FieldError id={descriptionId} message={fieldErrors.description} />
          </div>
        </div>
      </section>

      <section className="ui-card p-5 sm:p-8" aria-labelledby={`${formPrefix}-attributes-heading`}>
        <h2 id={`${formPrefix}-attributes-heading`} className="text-lg font-black text-text">ფასი და მახასიათებლები</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <TextInput
            id={priceId}
            label="ფასი (₾)"
            value={price}
            onChange={(value) => { setPrice(value); clearFieldError("price") }}
            error={fieldErrors.price}
            required
            inputMode="decimal"
            placeholder="მაგ: 120.00"
            helper="გამოიყენე მაქსიმუმ ორი ათწილადი ნიშანი."
          />
          <SelectField
            id={categoryIdField}
            label="კატეგორია"
            value={categoryId ? String(categoryId) : ""}
            onChange={(value) => { setCategoryId(Number(value) || ""); clearFieldError("categoryId") }}
            options={categories.map((item) => ({ value: String(item.id), label: item.name }))}
            placeholder="აირჩიე კატეგორია"
            error={fieldErrors.categoryId}
            required
          />
          <SelectField
            id={brandIdField}
            label="ბრენდი"
            value={brandId}
            onChange={(value) => { setBrandId(value); clearFieldError("brandId") }}
            options={brands.map((item) => ({ value: item.id, label: item.name ?? item.id }))}
            placeholder="ბრენდის გარეშე"
            error={fieldErrors.brandId}
          />
          <SelectField
            id={sizeIdField}
            label="ზომა"
            value={sizeId}
            onChange={(value) => { setSizeId(value); clearFieldError("sizeId") }}
            options={sizes.map((item) => ({ value: item.id, label: item.label ?? item.id }))}
            placeholder="ზომის გარეშე"
            error={fieldErrors.sizeId}
          />
        </div>

        <div className="mt-6 grid gap-6">
          <TogglePills
            legend="მდგომარეობა"
            value={condition}
            onChange={(value) => { setCondition(value); clearFieldError("condition") }}
            options={conditionOptions}
            error={fieldErrors.condition}
            columns={4}
          />
          <TogglePills
            legend="გაყიდვა ან გაცვლა"
            value={saleType}
            onChange={(value) => { setSaleType(value); clearFieldError("saleType") }}
            options={saleTypeOptions}
            error={fieldErrors.saleType}
          />
          <TogglePills
            legend="ვისთვისაა"
            value={gender}
            onChange={(value) => { setGender(value); clearFieldError("gender") }}
            options={genderOptions.filter((option) => LISTING_GENDERS.includes(option.value as typeof LISTING_GENDERS[number]))}
            error={fieldErrors.gender}
            columns={4}
          />
        </div>
      </section>

      <section className="ui-card p-5 sm:p-8" aria-labelledby={`${formPrefix}-optional-heading`}>
        <h2 id={`${formPrefix}-optional-heading`} className="text-lg font-black text-text">დამატებითი ინფორმაცია</h2>
        <p className="mt-1 text-sm text-text-soft">ზუსტი პირადი მისამართი არ მიუთითო — ქალაქი საკმარისია.</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <TextInput
            id={colorId}
            label="ფერი"
            value={color}
            onChange={(value) => { setColor(value); clearFieldError("color") }}
            error={fieldErrors.color}
            maxLength={LISTING_TEXT_LIMITS.colorMax}
            placeholder="მაგ: შავი"
          />
          <TextInput
            id={materialId}
            label="მასალა"
            value={material}
            onChange={(value) => { setMaterial(value); clearFieldError("material") }}
            error={fieldErrors.material}
            maxLength={LISTING_TEXT_LIMITS.materialMax}
            placeholder="მაგ: ტყავი"
          />
          <div className="sm:col-span-2">
            <TextInput
              id={cityId}
              label="ქალაქი"
              value={city}
              onChange={(value) => { setCity(value); clearFieldError("city") }}
              error={fieldErrors.city}
              maxLength={LISTING_TEXT_LIMITS.cityMax}
              placeholder="მაგ: თბილისი"
            />
            <div className="mt-3 flex flex-wrap gap-2" aria-label="ქალაქის სწრაფი არჩევა">
              {cityPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => { setCity(preset); clearFieldError("city") }}
                  aria-pressed={city === preset}
                  className={`min-h-11 rounded-full border px-4 py-2 text-sm font-bold transition ${
                    city === preset
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line bg-white text-text-soft hover:border-brand/40"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {progressText ? (
        <div className="ui-card px-5 py-4" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-sm font-bold text-text">
            <span>{progressText}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-soft">
            <div
              role="progressbar"
              aria-label="შენახვის პროგრესი"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
              className="h-full rounded-full bg-brand transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      <footer className="ui-card sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10 flex flex-col-reverse gap-3 p-4 shadow-[0_16px_45px_rgba(7,63,59,0.14)] sm:static sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <Link href={cancelHref} className="ui-btn-secondary w-full sm:w-auto">
          გაუქმება
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className="text-center text-xs leading-5 text-text-soft sm:max-w-xs sm:text-right">
            {canChangePublication
              ? publishNow
                ? "შენახვის შემდეგ განცხადება საჯარო კატალოგში გამოჩნდება."
                : "განცხადება მხოლოდ შენს კაბინეტში დარჩება."
              : `სტატუსი „${listingStatusLabel(initialData.status)}“ შენარჩუნდება.`}
          </p>
          <button type="submit" disabled={loading} className="ui-btn-primary min-h-12 w-full px-8 text-base sm:w-auto">
            {loading ? "ინახება…" : isEdit ? "ცვლილებების შენახვა" : publishNow ? "გამოქვეყნება" : "დრაფტის შექმნა"}
          </button>
        </div>
      </footer>
    </form>
  )
}
