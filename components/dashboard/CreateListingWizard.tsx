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
import {
  GEORGIA_CITIES,
  listingSizeTypeOptions,
  recommendedListingSizeType,
  sizeGroupMatchesType,
  type ListingSizeType,
} from "@/lib/marketplace-options"
import { createClient } from "@/lib/supabase/client"
import { MAX_LISTING_IMAGES, validateImageFile } from "@/lib/listings"

type Option = { id: string; name?: string; label?: string }
type CategoryOption = { id: number; name: string; slug?: string | null }
type SizeOption = { id: string; label?: string; group_name?: string | null }
type EditableImage = { id: string; imageUrl: string; file: File }
type ToggleOption = { value: string; label: string; helper?: string }
type Step = 1 | 2 | 3

type Props = {
  categories: CategoryOption[]
  brands: Option[]
  sizes: SizeOption[]
  initialSellerPhone: string
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

const stepMeta: Array<{ step: Step; label: string; helper: string }> = [
  { step: 1, label: "მთავარი", helper: "ფოტო, სათაური, ფასი" },
  { step: 2, label: "დეტალები", helper: "აღწერა და მახასიათებლები" },
  { step: 3, label: "დასრულება", helper: "შემოწმება და გამოქვეყნება" },
]

function fieldErrorId(id: string) {
  return `${id}-error`
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return <p id={fieldErrorId(id)} className="text-sm font-medium text-red-700">{message}</p>
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
  inputMode?: "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url"
  maxLength?: number
  helper?: string
}) {
  const helperId = helper ? `${id}-helper` : undefined
  const describedBy = [helperId, error ? fieldErrorId(id) : null].filter(Boolean).join(" ") || undefined

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-bold text-text">
        {label}{required ? <span className="ml-1 text-red-700" aria-hidden="true">*</span> : null}
      </label>
      <input
        id={id}
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
      {helper ? <p id={helperId} className="text-xs leading-5 text-text-soft">{helper}</p> : null}
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
        {label}{required ? <span className="ml-1 text-red-700" aria-hidden="true">*</span> : null}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? fieldErrorId(id) : undefined}
        className={`ui-input appearance-none pr-10 ${error ? "border-red-500 focus:border-red-600 focus:ring-red-100" : ""}`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
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
}: {
  legend: string
  value: string
  onChange: (value: string) => void
  options: ToggleOption[]
  error?: string
}) {
  const errorId = useId()

  return (
    <fieldset aria-describedby={error ? fieldErrorId(errorId) : undefined} className="space-y-2">
      <legend className="text-sm font-bold text-text">{legend}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((option) => {
          const active = value === option.value
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
              {option.helper ? <span className="mt-1 hidden text-xs text-text-soft sm:block">{option.helper}</span> : null}
            </button>
          )
        })}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  )
}

export default function CreateListingWizard({ categories, brands, sizes, initialSellerPhone }: Props) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const formPrefix = useId().replace(/:/g, "")
  const topRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const submittingRef = useRef(false)
  const imagesRef = useRef<EditableImage[]>([])

  const [step, setStep] = useState<Step>(1)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [categoryId, setCategoryId] = useState<number | "">("")
  const [brandId, setBrandId] = useState("")
  const [sizeType, setSizeType] = useState<ListingSizeType>("clothing")
  const [sizeId, setSizeId] = useState("")
  const [condition, setCondition] = useState("good")
  const [saleType, setSaleType] = useState("sell")
  const [gender, setGender] = useState("unisex")
  const [color, setColor] = useState("")
  const [material, setMaterial] = useState("")
  const [city, setCity] = useState("")
  const [publishNow, setPublishNow] = useState(true)
  const [images, setImages] = useState<EditableImage[]>([])
  const [fieldErrors, setFieldErrors] = useState<ListingFieldErrors>({})
  const [formError, setFormError] = useState("")
  const [loading, setLoading] = useState(false)
  const [progressText, setProgressText] = useState("")
  const [progressPercent, setProgressPercent] = useState(0)

  const titleId = `${formPrefix}-title`
  const descriptionId = `${formPrefix}-description`
  const priceId = `${formPrefix}-price`
  const categoryIdField = `${formPrefix}-category`
  const brandIdField = `${formPrefix}-brand`
  const sizeTypeId = `${formPrefix}-size-type`
  const sizeIdField = `${formPrefix}-size`
  const colorId = `${formPrefix}-color`
  const materialId = `${formPrefix}-material`
  const cityId = `${formPrefix}-city`
  const imagesId = `${formPrefix}-images`

  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === categoryId),
    [categories, categoryId],
  )
  const sizeTypeChoices = useMemo(() => listingSizeTypeOptions(gender), [gender])
  const filteredSizes = useMemo(() => {
    const byLabel = new Map<string, SizeOption>()
    for (const item of sizes) {
      if (!sizeGroupMatchesType(item.group_name, sizeType)) continue
      const key = item.label ?? item.id
      if (!byLabel.has(key)) byLabel.set(key, item)
    }
    return Array.from(byLabel.values())
  }, [sizes, sizeType])
  const cityOptions = useMemo(() => GEORGIA_CITIES, [])
  const selectedBrand = brands.find((item) => item.id === brandId)
  const selectedSize = sizes.find((item) => item.id === sizeId)

  useEffect(() => {
    imagesRef.current = images
  }, [images])

  useEffect(() => {
    return () => {
      for (const image of imagesRef.current) {
        if (image.imageUrl.startsWith("blob:")) URL.revokeObjectURL(image.imageUrl)
      }
    }
  }, [])

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
    sellerPhone: initialSellerPhone,
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

  function jumpToStep(next: Step) {
    setStep(next)
    setFormError("")
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  function validateCurrentStep(currentStep: 1 | 2) {
    const validation = validateListingInput(formInput)
    if (validation.ok) return true

    const allowedFields: Array<keyof ListingFormInput> = currentStep === 1
      ? ["title", "price", "categoryId"]
      : ["description", "brandId", "sizeId", "condition", "saleType", "gender", "color", "material", "city"]
    const nextErrors: ListingFieldErrors = {}
    for (const field of allowedFields) {
      if (validation.fieldErrors[field]) nextErrors[field] = validation.fieldErrors[field]
    }

    if (Object.keys(nextErrors).length === 0) return true
    setFieldErrors((current) => ({ ...current, ...nextErrors }))
    setFormError("შეამოწმე მონიშნული ველები და გააგრძელე.")
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
    return false
  }

  function handleNext() {
    if (step === 1 && validateCurrentStep(1)) jumpToStep(2)
    if (step === 2 && validateCurrentStep(2)) jumpToStep(3)
  }

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList?.length) return
    const incoming = Array.from(fileList)
    if (images.length + incoming.length > MAX_LISTING_IMAGES) {
      setFieldErrors((current) => ({ ...current, images: `მაქსიმუმ ${MAX_LISTING_IMAGES} სურათის დამატებაა შესაძლებელი.` }))
      return
    }

    const next: EditableImage[] = []
    for (const file of incoming) {
      const validationError = validateImageFile(file)
      if (validationError) {
        for (const image of next) URL.revokeObjectURL(image.imageUrl)
        setFieldErrors((current) => ({ ...current, images: validationError }))
        return
      }
      next.push({ id: `new-${crypto.randomUUID()}`, imageUrl: URL.createObjectURL(file), file })
    }

    setImages((current) => [...current, ...next])
    setFieldErrors((current) => {
      const copy = { ...current }
      delete copy.images
      return copy
    })
  }

  function removeImage(imageId: string) {
    setImages((current) => {
      const target = current.find((item) => item.id === imageId)
      if (target?.imageUrl.startsWith("blob:")) URL.revokeObjectURL(target.imageUrl)
      return current.filter((item) => item.id !== imageId)
    })
  }

  function moveImage(imageId: string, direction: -1 | 1) {
    setImages((current) => {
      const index = current.findIndex((item) => item.id === imageId)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.length) return current
      const copy = [...current]
      const [item] = copy.splice(index, 1)
      copy.splice(target, 0, item)
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
    if (step !== 3 || submittingRef.current) return

    const validation = validateListingInput(formInput)
    if (!validation.ok) {
      setFieldErrors(validation.fieldErrors)
      const stepOneError = ["title", "price", "categoryId"].some((field) => Boolean(validation.fieldErrors[field as keyof ListingFieldErrors]))
      const stepTwoError = ["description", "brandId", "sizeId", "condition", "saleType", "gender", "color", "material", "city"]
        .some((field) => Boolean(validation.fieldErrors[field as keyof ListingFieldErrors]))
      if (stepOneError) setStep(1)
      else if (stepTwoError) setStep(2)
      setFormError("შეამოწმე მონიშნული ველები და სცადე ხელახლა.")
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
      return
    }

    submittingRef.current = true
    setLoading(true)
    setFieldErrors({})
    setFormError("")
    setProgressText("მონაცემები მოწმდება…")
    setProgressPercent(5)

    let listingId = ""
    let uploadedPaths: string[] = []
    let completed = false

    try {
      const preparation = await prepareListingUploadsAction({
        mode: "create",
        files: images.map((image) => ({ clientId: image.id, mimeType: image.file.type, size: image.file.size })),
      })

      if (!preparation.ok) {
        if (preparation.code === "unauthorized") {
          router.push(`/login?next=${encodeURIComponent("/dashboard/listings/new")}`)
          return
        }
        throw new Error(preparation.message)
      }

      listingId = preparation.listingId
      const plansByClientId = new Map(preparation.plans.map((plan) => [plan.clientId, plan]))

      for (let index = 0; index < images.length; index += 1) {
        const image = images[index]
        const plan = plansByClientId.get(image.id)
        if (!plan) throw new Error("სურათის ატვირთვის უსაფრთხო მისამართი ვერ მომზადდა.")

        setProgressText(`სურათები იტვირთება… ${index + 1}/${images.length}`)
        setProgressPercent(10 + Math.round(((index + 1) / Math.max(images.length, 1)) * 55))

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
        mode: "create",
        listingId,
        form: formInput,
        images: images.map((image) => {
          const path = pathByClientId.get(image.id)
          if (!path) throw new Error("ერთ-ერთი ატვირთული სურათი ვერ მოიძებნა.")
          return { kind: "uploaded" as const, path }
        }),
      })

      if (!result.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors)
        if (result.code === "unauthorized") {
          router.push(`/login?next=${encodeURIComponent("/dashboard/listings/new")}`)
          return
        }
        throw new Error(result.message)
      }

      uploadedPaths = []
      completed = true
      setProgressPercent(100)
      setProgressText(publishNow ? "განცხადება გამოქვეყნდა." : "დრაფტი შეიქმნა.")
      router.push(result.status === "active" ? `/listing/${result.slug}` : "/dashboard/listings")
      router.refresh()
    } catch (error) {
      if (listingId && uploadedPaths.length > 0) await abortListingUploadsAction(listingId, uploadedPaths)
      const message = error instanceof Error ? error.message : ""
      setFormError(/[\u10a0-\u10ff]/i.test(message) ? message : "ოპერაცია ვერ შესრულდა. მონაცემები შენარჩუნებულია — სცადე ხელახლა.")
    } finally {
      if (!completed) {
        submittingRef.current = false
        setLoading(false)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto w-full max-w-5xl space-y-5">
      <div ref={topRef} className="scroll-mt-28" />

      <header className="ui-card overflow-hidden">
        <div className="bg-[linear-gradient(135deg,#eff8f6_0%,#ffffff_62%)] px-5 py-7 sm:px-8">
          <p className="ui-eyebrow">ახალი განცხადება</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-text sm:text-3xl">გაყიდე ნივთი 3 ნაბიჯში</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-soft">
            პირველ ეტაპზე მხოლოდ მთავარი ინფორმაცია გვჭირდება. დანარჩენ დეტალებს შემდეგ ნაბიჯზე დაამატებ.
          </p>

          <ol className="mt-6 grid grid-cols-3 gap-2" aria-label="განცხადების შექმნის პროგრესი">
            {stepMeta.map((item) => {
              const active = item.step === step
              const complete = item.step < step
              return (
                <li key={item.step}>
                  <button
                    type="button"
                    disabled={item.step > step || loading}
                    onClick={() => item.step <= step && jumpToStep(item.step)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-brand bg-brand text-white"
                        : complete
                          ? "border-brand/25 bg-brand-soft text-brand"
                          : "border-line bg-white text-text-soft"
                    } disabled:cursor-default`}
                    aria-current={active ? "step" : undefined}
                  >
                    <span className="block text-xs font-black">{item.step}/3 · {item.label}</span>
                    <span className={`mt-1 hidden text-[11px] sm:block ${active ? "text-white/80" : "text-text-soft"}`}>{item.helper}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </header>

      {formError ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          <p className="font-black">შეამოწმე ფორმა</p>
          <p className="mt-1">{formError}</p>
        </div>
      ) : null}

      {step === 1 ? (
        <>
          <section className="ui-card p-5 sm:p-8" aria-labelledby={`${imagesId}-heading`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={`${imagesId}-heading`} className="text-lg font-black text-text">1. დაამატე ფოტოები</h2>
                <p className="mt-1 text-sm leading-6 text-text-soft">ფოტო არჩევითია, მაგრამ კარგი მთავარი ფოტო გაყიდვის შანსს მნიშვნელოვნად ზრდის.</p>
              </div>
              <span className="shrink-0 text-sm font-bold text-text-soft">{images.length}/{MAX_LISTING_IMAGES}</span>
            </div>

            <input
              ref={fileInputRef}
              id={imagesId}
              type="file"
              accept={LISTING_IMAGE_ACCEPT}
              multiple
              className="sr-only"
              onChange={(event) => {
                void handleFilesSelected(event.target.files)
                event.currentTarget.value = ""
              }}
            />

            {images.length === 0 ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-5 flex min-h-44 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand/35 bg-brand-soft/25 px-6 text-center text-brand transition hover:border-brand hover:bg-brand-soft/50"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl shadow-sm" aria-hidden="true">+</span>
                <span className="mt-3 text-sm font-black">ფოტოების არჩევა</span>
                <span className="mt-1 text-xs text-text-soft">JPEG, PNG ან WEBP · მაქს. 7 MB თითო ფოტო</span>
              </button>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {images.map((image, index) => (
                  <article key={image.id} className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-surface-alt">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.imageUrl} alt={`ფოტო ${index + 1}`} className="h-full w-full object-cover" />
                    {index === 0 ? <span className="absolute left-2 top-2 rounded-full bg-brand px-2.5 py-1 text-[11px] font-black text-white">მთავარი</span> : null}
                    <div className="absolute inset-x-1.5 bottom-1.5 flex gap-1 rounded-xl bg-white/95 p-1 shadow-sm backdrop-blur">
                      <button type="button" disabled={index === 0 || loading} onClick={() => moveImage(image.id, -1)} className="min-h-9 min-w-9 rounded-lg text-sm font-black disabled:opacity-30">←</button>
                      <button type="button" disabled={index === images.length - 1 || loading} onClick={() => moveImage(image.id, 1)} className="min-h-9 min-w-9 rounded-lg text-sm font-black disabled:opacity-30">→</button>
                      {index > 0 ? <button type="button" disabled={loading} onClick={() => setAsCover(image.id)} className="min-h-9 rounded-lg px-2 text-[10px] font-black text-brand">მთავარი</button> : null}
                      <button type="button" disabled={loading} onClick={() => removeImage(image.id)} className="ml-auto min-h-9 min-w-9 rounded-lg font-black text-red-700">×</button>
                    </div>
                  </article>
                ))}
                {images.length < MAX_LISTING_IMAGES ? (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-brand/35 bg-brand-soft/20 text-2xl text-brand">+</button>
                ) : null}
              </div>
            )}
            <FieldError id={imagesId} message={fieldErrors.images} />
          </section>

          <section className="ui-card p-5 sm:p-8" aria-labelledby={`${formPrefix}-main-heading`}>
            <h2 id={`${formPrefix}-main-heading`} className="text-lg font-black text-text">2. მთავარი ინფორმაცია</h2>
            <p className="mt-1 text-sm text-text-soft">ამ სამი ველით უკვე ვიგებთ რას ყიდი და რა ფასად.</p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <TextInput
                  id={titleId}
                  label="რას ყიდი?"
                  value={title}
                  onChange={(value) => { setTitle(value); clearFieldError("title") }}
                  error={fieldErrors.title}
                  required
                  maxLength={LISTING_TEXT_LIMITS.titleMax}
                  placeholder="მაგ: Zara-ს ტყავის ქურთუკი"
                  helper={`${Array.from(title).length}/${LISTING_TEXT_LIMITS.titleMax} სიმბოლო`}
                />
              </div>
              <SelectField
                id={categoryIdField}
                label="კატეგორია"
                value={categoryId ? String(categoryId) : ""}
                onChange={(value) => {
                  const nextCategoryId = Number(value) || ""
                  const nextCategorySlug = categories.find((item) => item.id === nextCategoryId)?.slug
                  setCategoryId(nextCategoryId)
                  setSizeType(recommendedListingSizeType(nextCategorySlug, gender))
                  setSizeId("")
                  clearFieldError("categoryId")
                  clearFieldError("sizeId")
                }}
                options={categories.map((item) => ({ value: String(item.id), label: item.name }))}
                placeholder="აირჩიე კატეგორია"
                error={fieldErrors.categoryId}
                required
              />
              <TextInput
                id={priceId}
                label="ფასი (₾)"
                value={price}
                onChange={(value) => { setPrice(value); clearFieldError("price") }}
                error={fieldErrors.price}
                required
                inputMode="decimal"
                placeholder="მაგ: 120"
              />
            </div>
          </section>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <section className="ui-card p-5 sm:p-8" aria-labelledby={`${formPrefix}-description-heading`}>
            <h2 id={`${formPrefix}-description-heading`} className="text-lg font-black text-text">აღწერე ნივთი</h2>
            <p className="mt-1 text-sm text-text-soft">მიუთითე მნიშვნელოვანი ინფორმაცია და ნებისმიერი დეფექტი — ეს ამცირებს ზედმეტ კითხვებს ჩატში.</p>
            <div className="mt-5 space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={descriptionId} className="text-sm font-bold text-text">აღწერა<span className="ml-1 text-red-700" aria-hidden="true">*</span></label>
                <span className="text-xs font-semibold text-text-soft">{Array.from(description).length}/{LISTING_TEXT_LIMITS.descriptionMax}</span>
              </div>
              <textarea
                id={descriptionId}
                value={description}
                onChange={(event) => { setDescription(event.target.value); clearFieldError("description") }}
                required
                maxLength={LISTING_TEXT_LIMITS.descriptionMax}
                aria-invalid={Boolean(fieldErrors.description)}
                aria-describedby={fieldErrors.description ? fieldErrorId(descriptionId) : undefined}
                placeholder="მაგ: თითქმის ახალია, ორჯერ მეცვა. დეფექტი არ აქვს."
                className={`min-h-36 w-full resize-y rounded-xl border bg-white px-4 py-3 text-sm leading-6 text-text outline-none transition placeholder:text-text-soft focus:ring-4 ${fieldErrors.description ? "border-red-500 focus:border-red-600 focus:ring-red-100" : "border-line focus:border-brand focus:ring-brand-soft"}`}
              />
              <FieldError id={descriptionId} message={fieldErrors.description} />
            </div>
          </section>

          <section className="ui-card p-5 sm:p-8" aria-labelledby={`${formPrefix}-attributes-heading`}>
            <h2 id={`${formPrefix}-attributes-heading`} className="text-lg font-black text-text">მახასიათებლები</h2>
            <div className="mt-5 grid gap-6">
              <TogglePills
                legend="მდგომარეობა"
                value={condition}
                onChange={(value) => { setCondition(value); clearFieldError("condition") }}
                options={conditionOptions}
                error={fieldErrors.condition}
              />
              <TogglePills
                legend="ვისთვისაა"
                value={gender}
                onChange={(value) => {
                  setGender(value)
                  setSizeType(recommendedListingSizeType(selectedCategory?.slug, value))
                  setSizeId("")
                  clearFieldError("gender")
                  clearFieldError("sizeId")
                }}
                options={genderOptions.filter((option) => LISTING_GENDERS.includes(option.value as typeof LISTING_GENDERS[number]))}
                error={fieldErrors.gender}
              />
              <TogglePills
                legend="გაყიდვა ან გაცვლა"
                value={saleType}
                onChange={(value) => { setSaleType(value); clearFieldError("saleType") }}
                options={saleTypeOptions}
                error={fieldErrors.saleType}
              />
            </div>
          </section>

          <section className="ui-card p-5 sm:p-8" aria-labelledby={`${formPrefix}-fit-heading`}>
            <h2 id={`${formPrefix}-fit-heading`} className="text-lg font-black text-text">ზომა და ბრენდი</h2>
            <p className="mt-1 text-sm text-text-soft">არჩევითია, მაგრამ ზუსტი მონაცემები ძებნის ფილტრებში უკეთ გამოჩნდება.</p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
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
                id={sizeTypeId}
                label="ზომის ტიპი"
                value={sizeType}
                onChange={(value) => { setSizeType(value as ListingSizeType); setSizeId(""); clearFieldError("sizeId") }}
                options={sizeTypeChoices}
                placeholder="აირჩიე ზომის ტიპი"
              />
              <SelectField
                id={sizeIdField}
                label="ზომა"
                value={sizeId}
                onChange={(value) => { setSizeId(value); clearFieldError("sizeId") }}
                options={filteredSizes.map((item) => ({ value: item.id, label: item.label ?? item.id }))}
                placeholder="ზომის გარეშე"
                error={fieldErrors.sizeId}
              />
              <SelectField
                id={cityId}
                label="ქალაქი"
                value={city}
                onChange={(value) => { setCity(value); clearFieldError("city") }}
                options={cityOptions.map((item) => ({ value: item, label: item }))}
                placeholder="აირჩიე ქალაქი"
                error={fieldErrors.city}
              />
            </div>

            <details className="mt-5 rounded-2xl border border-line bg-surface-alt/35 p-4">
              <summary className="cursor-pointer text-sm font-black text-brand">+ ფერი და მასალა</summary>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <TextInput id={colorId} label="ფერი" value={color} onChange={(value) => { setColor(value); clearFieldError("color") }} error={fieldErrors.color} maxLength={LISTING_TEXT_LIMITS.colorMax} placeholder="მაგ: შავი" />
                <TextInput id={materialId} label="მასალა" value={material} onChange={(value) => { setMaterial(value); clearFieldError("material") }} error={fieldErrors.material} maxLength={LISTING_TEXT_LIMITS.materialMax} placeholder="მაგ: ტყავი" />
              </div>
            </details>
          </section>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <section className="ui-card p-5 sm:p-8" aria-labelledby={`${formPrefix}-review-heading`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 id={`${formPrefix}-review-heading`} className="text-lg font-black text-text">შეამოწმე განცხადება</h2>
                <p className="mt-1 text-sm text-text-soft">თუ რამე შესაცვლელია, შესაბამის ნაბიჯზე დაბრუნდი.</p>
              </div>
              <span className="ui-pill-soft self-start">{images.length ? `${images.length} ფოტო` : "ფოტოს გარეშე"}</span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-[180px_1fr]">
              <div className="aspect-[4/5] overflow-hidden rounded-2xl border border-line bg-surface-alt">
                {images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={images[0].imageUrl} alt="მთავარი ფოტო" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center text-xs font-bold text-text-soft">ფოტო არ არის დამატებული</div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">{selectedCategory?.name ?? "კატეგორია"}</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-text">{title || "უსათაურო"}</h3>
                <p className="mt-2 text-xl font-black text-brand">{price ? `${price} ₾` : "ფასი არ არის"}</p>
                <p className="mt-4 whitespace-pre-line text-sm leading-6 text-text-soft">{description}</p>
                <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-text-soft">
                  <span className="ui-pill-soft">{conditionOptions.find((item) => item.value === condition)?.label}</span>
                  <span className="ui-pill-soft">{genderOptions.find((item) => item.value === gender)?.label}</span>
                  {selectedBrand ? <span className="ui-pill-soft">{selectedBrand.name}</span> : null}
                  {selectedSize ? <span className="ui-pill-soft">ზომა {selectedSize.label}</span> : null}
                  {city ? <span className="ui-pill-soft">{city}</span> : null}
                </div>
              </div>
            </div>
          </section>

          <section className="ui-card p-5 sm:p-8" aria-labelledby={`${formPrefix}-publish-heading`}>
            <h2 id={`${formPrefix}-publish-heading`} className="text-lg font-black text-text">როგორ შეინახოს?</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPublishNow(true)}
                aria-pressed={publishNow}
                className={`rounded-2xl border p-5 text-left transition ${publishNow ? "border-brand bg-brand-soft shadow-[0_0_0_3px_rgba(7,90,83,0.08)]" : "border-line bg-white hover:border-brand/40"}`}
              >
                <span className="text-sm font-black text-text">გამოქვეყნება ახლავე</span>
                <span className="mt-1 block text-xs leading-5 text-text-soft">განცხადება დაუყოვნებლივ გამოჩნდება კატალოგში.</span>
              </button>
              <button
                type="button"
                onClick={() => setPublishNow(false)}
                aria-pressed={!publishNow}
                className={`rounded-2xl border p-5 text-left transition ${!publishNow ? "border-brand bg-brand-soft shadow-[0_0_0_3px_rgba(7,90,83,0.08)]" : "border-line bg-white hover:border-brand/40"}`}
              >
                <span className="text-sm font-black text-text">დრაფტად შენახვა</span>
                <span className="mt-1 block text-xs leading-5 text-text-soft">მხოლოდ შენს კაბინეტში დარჩება და მოგვიანებით გამოაქვეყნებ.</span>
              </button>
            </div>
          </section>
        </>
      ) : null}

      {progressText ? (
        <div className="ui-card px-5 py-4" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-sm font-bold text-text"><span>{progressText}</span><span>{progressPercent}%</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-soft">
            <div role="progressbar" aria-label="შენახვის პროგრესი" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent} className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      ) : null}

      <footer className="ui-card sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10 flex items-center justify-between gap-3 p-4 shadow-[0_16px_45px_rgba(7,63,59,0.14)] sm:static sm:p-5">
        {step === 1 ? (
          <Link href="/dashboard/listings" className="ui-btn-secondary">გაუქმება</Link>
        ) : (
          <button type="button" disabled={loading} onClick={() => jumpToStep((step - 1) as Step)} className="ui-btn-secondary">← უკან</button>
        )}

        {step < 3 ? (
          <button type="button" disabled={loading} onClick={handleNext} className="ui-btn-primary min-h-12 px-7">გაგრძელება →</button>
        ) : (
          <button type="submit" disabled={loading} className="ui-btn-primary min-h-12 px-7 text-base">
            {loading ? "ინახება…" : publishNow ? "განცხადების გამოქვეყნება" : "დრაფტის შექმნა"}
          </button>
        )}
      </footer>
    </form>
  )
}
