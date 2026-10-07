"use client"

import Link from "next/link"
import BrandCombobox from "@/components/dashboard/BrandCombobox"
import { trackGrowth, listingAttempt, clearListingAttempt } from "@/lib/growth/client"
import { PERFUME_BRAND_NAMES } from "@/lib/perfume-brands"
import { useBrowserConsent } from "@/components/privacy/useBrowserConsent"
import { readListingDraft, saveListingDraft, deleteListingDraft, type ListingDraft } from "@/lib/listing-draft"
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
  recommendedListingSizeType,
  sizeGroupMatchesType,
  type ListingSizeType,
} from "@/lib/marketplace-options"
import { createClient } from "@/lib/supabase/client"
import { buildListingCategoryOptions, isVirtualListingCategory } from "@/lib/listing-categories"
import { MAX_LISTING_IMAGES, validateImageFile } from "@/lib/listings"

type Option = { id: string; name?: string; label?: string }
type CategoryOption = { id: number; name: string; slug?: string | null }
type SizeOption = { id: string; label?: string; group_name?: string | null }
type EditableImage = { id: string; imageUrl: string; file: File }
type ToggleOption = { value: string; label: string; helper?: string }
type Step = 1 | 2 | 3 | 4
type ListingSuccessResult = {
  listingId: string
  slug: string
  status: string
  title: string
  coverImageUrl: string | null
}

const PERFUME_VOLUME_FALLBACK_SIZES: SizeOption[] = [
  { id: "preview-perfume-15", label: "15 ml", group_name: "perfume" },
  { id: "preview-perfume-30", label: "30 ml", group_name: "perfume" },
  { id: "preview-perfume-50", label: "50 ml", group_name: "perfume" },
  { id: "preview-perfume-75", label: "75 ml", group_name: "perfume" },
  { id: "preview-perfume-100", label: "100 ml", group_name: "perfume" },
  { id: "preview-perfume-125", label: "125 ml", group_name: "perfume" },
  { id: "preview-perfume-150", label: "150 ml", group_name: "perfume" },
  { id: "preview-perfume-200", label: "200 ml", group_name: "perfume" },
]


type Props = {
  categories: CategoryOption[]
  brands: Option[]
  sizes: SizeOption[]
  initialSellerPhone: string
  userId?: string
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
  { value: "gift", label: "გავაჩუქებ", helper: "ფასი არ არის საჭირო" },
]

const genderOptions: ToggleOption[] = [
  { value: "women", label: "ქალებისთვის" },
  { value: "men", label: "მამაკაცებისთვის" },
  { value: "kids", label: "ბავშვებისთვის" },
  { value: "unisex", label: "უნისექსი" },
]

const perfumeConcentrationOptions = [
  { value: "parfum", label: "Parfum / Extrait" },
  { value: "edp", label: "Eau de Parfum (EDP)" },
  { value: "edt", label: "Eau de Toilette (EDT)" },
  { value: "edc", label: "Eau de Cologne (EDC)" },
  { value: "body-mist", label: "Body Mist" },
]

const stepMeta: Array<{ step: Step; label: string; helper: string }> = [
  { step: 1, label: "ფოტოები", helper: "კამერა, გალერეა, რიგი" },
  { step: 2, label: "დეტალები", helper: "სათაური და მახასიათებლები" },
  { step: 3, label: "ფასი", helper: "ფასი და გაყიდვის ტიპი" },
  { step: 4, label: "Preview", helper: "შემოწმება და გამოქვეყნება" },
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
        className={`ui-input scroll-mt-24 text-base sm:text-sm ${error ? "border-red-500 focus:border-red-600 focus:ring-red-100" : ""}`}
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

export default function CreateListingWizard({ categories, brands, sizes, initialSellerPhone, userId = "" }: Props) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const formPrefix = useId().replace(/:/g, "")
  const topRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const submittingRef = useRef(false)
  const imagesRef = useRef<EditableImage[]>([])
  const draggingImageIdRef = useRef("")

  const [step, setStep] = useState<Step>(1)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [categoryId, setCategoryId] = useState<number | "">("")
  const [brandId, setBrandId] = useState("")
  const [customBrand, setCustomBrand] = useState("")
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
  const [uploadedImageCount, setUploadedImageCount] = useState(0)
  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null)
  const [successResult, setSuccessResult] = useState<ListingSuccessResult | null>(null)
  const [draggingImageId, setDraggingImageId] = useState("")

  const consent = useBrowserConsent()
  const growthAttempt = useRef<string | null>(null)
  function markListingStarted() {
    if (!consent?.analytics || growthAttempt.current) return
    const id = listingAttempt(userId)
    growthAttempt.current = id
    void trackGrowth("listing_started", `listing_started:${id}`, id)
  }
  const [pendingDraft, setPendingDraft] = useState<ListingDraft | null>(null)
  const [draftChecked, setDraftChecked] = useState(false)
  const [draftStatus, setDraftStatus] = useState("")
  const publishedRef = useRef(false)
  const draftFields = useMemo(() => ({ title, description, price, categoryId, brandId, customBrand, sizeId, condition,
    saleType, gender, color, material, city, publishNow }),
    [title, description, price, categoryId, brandId, customBrand, sizeId, condition, saleType, gender, color, material, city, publishNow])

  useEffect(() => {
    let cancelled = false
    if (!consent?.personalization || !userId) {
      queueMicrotask(() => { if (!cancelled) { setPendingDraft(null); setDraftChecked(false); setDraftStatus("") } })
      return () => { cancelled = true }
    }
    readListingDraft(userId).then((draft) => {
      if (!cancelled) { setPendingDraft(draft); setDraftChecked(true) }
    }).catch(() => {
      if (!cancelled) { setDraftChecked(true); setDraftStatus("ამ ბრაუზერში მონახაზის შენახვა მიუწვდომელია.") }
    })
    return () => { cancelled = true }
  }, [consent?.personalization, userId])

  useEffect(() => {
    if (!consent?.personalization || !userId || !draftChecked || pendingDraft || loading || publishedRef.current) return
    let cancelled = false
    const hasContent = Boolean(title || description || price || categoryId || images.length)

    const statusTimer = setTimeout(() => {
      if (!cancelled) setDraftStatus(hasContent ? "ინახება…" : "")
    }, 0)

    const timer = setTimeout(() => {
      const operation = hasContent ? saveListingDraft({ userId, updatedAt: Date.now(), fields: draftFields, sizeType,
        images: images.map((image) => ({ id: image.id, name: image.file.name, type: image.file.type,
          lastModified: image.file.lastModified, blob: image.file })) }) : deleteListingDraft(userId)
      operation.then((saved) => {
        if (!cancelled && saved !== false) setDraftStatus(hasContent ? "შენახულია ✓" : "")
      }).catch(() => {
        if (!cancelled) setDraftStatus("ავტოშენახვა ვერ მოხერხდა")
      })
    }, 700)
    return () => { cancelled = true; clearTimeout(statusTimer); clearTimeout(timer) }
  }, [consent?.personalization, userId, draftChecked, pendingDraft, loading, draftFields, sizeType, images,
    title, description, price, categoryId])

  function restoreDraft() {
    if (!pendingDraft) return
    const fields = pendingDraft.fields
    setTitle(fields.title); setDescription(fields.description); setPrice(fields.price)
    setCategoryId(listingCategories.some((item) => item.id === Number(fields.categoryId)) ? Number(fields.categoryId) : "")
    setBrandId(brands.some((item) => item.id === fields.brandId) ? fields.brandId : "")
    setCustomBrand(fields.customBrand ?? "")
    setSizeId(sizes.some((item) => item.id === fields.sizeId) ? fields.sizeId : "")
    setSizeType(pendingDraft.sizeType); setCondition(fields.condition); setSaleType(fields.saleType)
    setGender(fields.gender); setColor(fields.color); setMaterial(fields.material); setCity(fields.city)
    setPublishNow(fields.publishNow)
    const restored = pendingDraft.images.map((image) => {
      const file = new File([image.blob], image.name, { type: image.type, lastModified: image.lastModified })
      return { id: image.id, file, imageUrl: URL.createObjectURL(file) }
    })
    for (const image of imagesRef.current) URL.revokeObjectURL(image.imageUrl)
    imagesRef.current = restored
    setImages(restored); setPendingDraft(null); setStep(1)
    setDraftStatus("მონახაზი აღდგენილია. გადაამოწმე მონაცემები გამოქვეყნებამდე.")
  }

  async function discardDraft() {
    try {
      await deleteListingDraft(userId)
      setPendingDraft(null)
      setDraftStatus("")
    } catch { setDraftStatus("ძველი მონახაზის წაშლა ვერ მოხერხდა. სცადე ხელახლა.") }
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

  function validationStep(errors: ListingFieldErrors): Step {
    if (errors.images) return 1
    if (
      errors.title ||
      errors.categoryId ||
      errors.description ||
      errors.brandId ||
      errors.customBrand ||
      errors.sizeId ||
      errors.condition ||
      errors.gender ||
      errors.color ||
      errors.material ||
      errors.city
    ) return 2
    if (errors.price || errors.saleType) return 3
    return 4
  }

  function validationStepLabel(targetStep: Step) {
    return stepMeta.find((item) => item.step === targetStep)?.label ?? "ფორმა"
  }

  function focusFirstInvalidField(errors: ListingFieldErrors, targetStep: Step) {
    const fieldId =
      targetStep === 1 ? imagesId :
      errors.title ? titleId :
      errors.categoryId ? categoryIdField :
      errors.description ? descriptionId :
      errors.brandId || errors.customBrand ? brandIdField :
      errors.sizeId ? sizeIdField :
      errors.color ? colorId :
      errors.material ? materialId :
      errors.city ? cityId :
      errors.price ? priceId :
      null

    requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      if (fieldId) window.setTimeout(() => document.getElementById(fieldId)?.focus(), 350)
    })
  }

  const listingCategories = buildListingCategoryOptions(categories)
  const selectedCategory = listingCategories.find((item) => item.id === categoryId)
  const isPerfume = selectedCategory?.slug === "perfume"
  const filteredSizes = useMemo(() => {
    const byLabel = new Map<string, SizeOption>()
    for (const item of sizes) {
      if (!sizeGroupMatchesType(item.group_name, sizeType)) continue
      const key = item.label ?? item.id
      if (!byLabel.has(key)) byLabel.set(key, item)
    }

    if (sizeType === "perfume" && byLabel.size === 0) {
      for (const item of PERFUME_VOLUME_FALLBACK_SIZES) {
        byLabel.set(item.label ?? item.id, item)
      }
    }

    return Array.from(byLabel.values())
  }, [sizes, sizeType])
  const cityOptions = useMemo(() => GEORGIA_CITIES, [])
  const selectedBrand = brands.find((item) => item.id === brandId)
  const selectedBrandName = selectedBrand?.name ?? customBrand.trim()
  const selectedSize = filteredSizes.find((item) => item.id === sizeId)

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
    customBrand,
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

  function validateCurrentStep(currentStep: 1 | 2 | 3) {
    if (currentStep === 1) {
      if (images.length > 0) return true
      setFieldErrors((current) => ({ ...current, images: "დაამატე მინიმუმ ერთი ფოტო." }))
      setFormError("ფოტოს გარეშე განცხადება ვერ გაგრძელდება.")
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
      return false
    }

    if (currentStep === 2 && isVirtualListingCategory(selectedCategory)) {
      setFieldErrors((current) => ({ ...current, categoryId: "ეს კატეგორია preview-ში დამატებულია და production migration-ის შემდეგ ჩაირთვება." }))
      setFormError("არჩეული კატეგორია ჯერ preview რეჟიმშია.")
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
      return false
    }

    const validation = validateListingInput(formInput)
    const allowedFields: Array<keyof ListingFormInput> = currentStep === 2
      ? ["title", "categoryId", "description", "brandId", "customBrand", "sizeId", "condition", "gender", "color", "material", "city"]
      : ["price", "saleType"]
    const nextErrors: ListingFieldErrors = {}

    for (const field of allowedFields) {
      if (!validation.ok && validation.fieldErrors[field]) nextErrors[field] = validation.fieldErrors[field]
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
    if (step === 3 && validateCurrentStep(3)) jumpToStep(4)
  }

  async function handleFilesSelected(fileList: FileList | null) {
    if (fileList?.length) markListingStarted()
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


  function reorderImage(sourceId: string, targetId: string) {
    if (!sourceId || !targetId || sourceId === targetId) return

    setImages((current) => {
      const sourceIndex = current.findIndex((item) => item.id === sourceId)
      const targetIndex = current.findIndex((item) => item.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current

      const copy = [...current]
      const [source] = copy.splice(sourceIndex, 1)
      copy.splice(targetIndex, 0, source)
      return copy
    })
  }

  function beginPointerReorder(event: React.PointerEvent<HTMLButtonElement>, imageId: string) {
    if (loading) return
    draggingImageIdRef.current = imageId
    setDraggingImageId(imageId)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function continuePointerReorder(event: React.PointerEvent<HTMLButtonElement>) {
    const sourceId = draggingImageIdRef.current
    if (!sourceId) return
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-listing-image-id]")
      ?.dataset.listingImageId
    if (target) reorderImage(sourceId, target)
  }

  function endPointerReorder(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    draggingImageIdRef.current = ""
    setDraggingImageId("")
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step !== 4 || submittingRef.current) return

    if (images.length === 0) {
      setStep(1)
      setFieldErrors((current) => ({ ...current, images: "დაამატე მინიმუმ ერთი ფოტო." }))
      setFormError("განცხადების შესანახად ფოტო სავალდებულოა.")
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
      return
    }

    const validation = validateListingInput(formInput)
    if (!validation.ok) {
      setFieldErrors(validation.fieldErrors)
      const targetStep = validationStep(validation.fieldErrors)
      setStep(targetStep)
      setFormError(`ნაბიჯი ${targetStep} — ${validationStepLabel(targetStep)}: შეამოწმე მონიშნული ველები.`)
      focusFirstInvalidField(validation.fieldErrors, targetStep)
      return
    }

    submittingRef.current = true
    setLoading(true)
    setFieldErrors({})
    setFormError("")
    setProgressText("მონაცემები მოწმდება…")
    setProgressPercent(5)
    setUploadedImageCount(0)
    setUploadingImageIndex(null)

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

        setUploadingImageIndex(index)
        setProgressText(`ფოტოები იტვირთება… ${index + 1}/${images.length}`)
        setProgressPercent(10 + Math.round((index / Math.max(images.length, 1)) * 55))

        const { error } = await supabase.storage
          .from("listing-images")
          .uploadToSignedUrl(plan.path, plan.token, image.file, {
            contentType: image.file.type,
            cacheControl: "3600",
          })
        if (error) throw new Error("სურათის ატვირთვა ვერ დასრულდა. კავშირი შეამოწმე და სცადე ხელახლა.")
        uploadedPaths.push(plan.path)
        setUploadedImageCount(index + 1)
        setProgressPercent(10 + Math.round(((index + 1) / Math.max(images.length, 1)) * 55))
      }

      setUploadingImageIndex(null)
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
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors)
          const targetStep = validationStep(result.fieldErrors)
          setStep(targetStep)
          focusFirstInvalidField(result.fieldErrors, targetStep)
          throw new Error(`ნაბიჯი ${targetStep} — ${validationStepLabel(targetStep)}: ${result.message}`)
        }
        if (result.code === "unauthorized") {
          router.push(`/login?next=${encodeURIComponent("/dashboard/listings/new")}`)
          return
        }
        throw new Error(result.message)
      }

      uploadedPaths = []
      completed = true
      clearListingAttempt(userId)
      if (result.status === "active") void trackGrowth("identify")
      publishedRef.current = true
      if (userId) await deleteListingDraft(userId).catch(() => undefined)
      setUploadingImageIndex(null)
      setUploadedImageCount(images.length)
      setProgressPercent(100)
      setProgressText(publishNow ? "განცხადება გამოქვეყნდა." : "დრაფტი შეიქმნა.")
      setSuccessResult({
        listingId: result.listingId,
        slug: result.slug,
        status: result.status,
        title,
        coverImageUrl: images[0]?.imageUrl ?? null,
      })
      submittingRef.current = false
      setLoading(false)
      router.refresh()
    } catch (error) {
      if (publishNow) void trackGrowth("listing_publish_failed")
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

  if (successResult) {
    const published = successResult.status === "active"

    return (
      <section className="mx-auto w-full max-w-3xl">
        <div className="ui-card relative overflow-hidden p-6 text-center sm:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent-soft blur-2xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-14 -left-8 h-36 w-36 rounded-full bg-brand-soft blur-2xl" />

          <div className="relative">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-3xl text-white shadow-[0_12px_30px_rgba(7,90,83,0.2)]">
              {published ? "🎉" : "✓"}
            </div>
            <p className="ui-eyebrow mt-5">{published ? "გამოქვეყნებულია" : "დრაფტი მზადაა"}</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-text sm:text-4xl">
              {published ? "განცხადება გამოქვეყნდა 🎉" : "დრაფტი შეინახა"}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-text-soft sm:text-base">
              {published
                ? `„${successResult.title}“ უკვე ხელმისაწვდომია SamoSell-ზე. შეგიძლია ნახო საჯარო გვერდი ან გაზარდო ხილვადობა VIP-ით.`
                : `„${successResult.title}“ შენახულია დრაფტად და მხოლოდ შენს კაბინეტში ჩანს.`}
            </p>

            {successResult.coverImageUrl ? (
              <div className="mx-auto mt-6 aspect-[4/5] w-32 overflow-hidden rounded-2xl border border-line bg-surface-alt shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={successResult.coverImageUrl} alt={successResult.title} className="h-full w-full object-cover" />
              </div>
            ) : null}

            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              {published ? (
                <>
                  <Link href={`/listing/${successResult.slug}`} className="ui-btn-primary">ნახე განცხადება</Link>
                  <Link href={`/dashboard/listings/${successResult.listingId}/promote`} className="ui-btn-secondary">გახადე VIP</Link>
                </>
              ) : (
                <Link href="/dashboard/listings" className="ui-btn-primary">ჩემი განცხადებები</Link>
              )}
              <button
                type="button"
                onClick={() => window.location.assign("/dashboard/listings/new")}
                className="ui-btn-secondary"
              >
                კიდევ დაამატე
              </button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <form onChangeCapture={markListingStarted} onSubmit={handleSubmit} noValidate className="mx-auto w-full max-w-5xl space-y-5">
      {pendingDraft ? <section aria-label="შენახული მონახაზი" className="ui-card border-brand/25 bg-brand-soft p-4">
        <h2 className="font-black">შენახული მონახაზი იპოვე</h2>
        <p className="mt-1 text-sm leading-6">{pendingDraft.fields.title || "დაუსრულებელი განცხადება"} · {pendingDraft.images.length} ფოტო. აღადგინო ტექსტი და ფოტოები?</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" onClick={restoreDraft} className="ui-btn-primary">მონახაზის აღდგენა</button>
          <button type="button" onClick={() => void discardDraft()} className="ui-btn-secondary">მონახაზის წაშლა</button>
        </div>
      </section> : null}
      <div ref={topRef} className="scroll-mt-28" />

      <header className="ui-card overflow-hidden">
        <div className="bg-[linear-gradient(135deg,#eff8f6_0%,#ffffff_62%)] px-5 py-7 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="ui-eyebrow">ახალი განცხადება</p>
            {draftStatus ? (
              <span
                role="status"
                className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-[11px] font-bold ${
                  draftStatus.includes("ვერ")
                    ? "border-red-200 bg-red-50 text-red-700"
                    : draftStatus.includes("ინახება")
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-brand/15 bg-brand-soft text-brand"
                }`}
              >
                {draftStatus}
              </span>
            ) : null}
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-text sm:text-3xl">გაყიდე ნივთი 4 ნაბიჯში</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-soft">
            დაიწყე ფოტოებით, შემდეგ შეავსე დეტალები და ფასი. ბოლოს ნახავ ზუსტად როგორ გამოიყურება განცხადება.
          </p>

          <ol className="mt-6 grid grid-cols-4 gap-1.5 sm:gap-2" aria-label="განცხადების შექმნის პროგრესი">
            {stepMeta.map((item) => {
              const active = item.step === step
              const complete = item.step < step
              return (
                <li key={item.step} className="min-w-0">
                  <button
                    type="button"
                    disabled={item.step > step || loading}
                    onClick={() => item.step <= step && jumpToStep(item.step)}
                    className={`flex min-h-[76px] w-full min-w-0 flex-col items-center justify-center rounded-xl border px-1.5 py-2 text-center transition sm:min-h-0 sm:items-start sm:px-3 sm:py-3 sm:text-left ${
                      active
                        ? "border-brand bg-brand text-white"
                        : complete
                          ? "border-brand/25 bg-brand-soft text-brand"
                          : "border-line bg-white text-text-soft"
                    } disabled:cursor-default`}
                    aria-current={active ? "step" : undefined}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black sm:hidden ${
                        active
                          ? "bg-white/18 text-white"
                          : complete
                            ? "bg-white text-brand"
                            : "bg-surface-alt text-text-soft"
                      }`}
                      aria-hidden="true"
                    >
                      {item.step}
                    </span>
                    <span className="mt-1.5 block max-w-full truncate text-[10px] font-black leading-tight sm:hidden">
                      {item.label}
                    </span>

                    <span className="hidden text-xs font-black sm:block">{item.step}/4 · {item.label}</span>
                    <span className={`mt-1 hidden text-[11px] sm:block ${active ? "text-white/80" : "text-text-soft"}`}>
                      {item.helper}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </header>

      {formError ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-black">ნაბიჯი {step}/4</span>
            <p className="font-black">{validationStepLabel(step)}</p>
          </div>
          <p className="mt-2">{formError}</p>
        </div>
      ) : null}

      {step === 1 ? (
        <section className="ui-card p-5 sm:p-8" aria-labelledby={`${imagesId}-heading`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={`${imagesId}-heading`} className="text-lg font-black text-text">1. დაამატე ფოტოები <span className="text-red-700" aria-hidden="true">*</span></h2>
              <p className="mt-1 text-sm leading-6 text-text-soft">პირველი ფოტო გახდება მთავარი. დაჭერით და გადაადგილებით შეგიძლია რიგის შეცვლა.</p>
            </div>
            <span className="shrink-0 text-sm font-bold text-text-soft">{images.length}/{MAX_LISTING_IMAGES}</span>
          </div>

          <input
            ref={fileInputRef}
            id={imagesId}
            type="file"
            accept={LISTING_IMAGE_ACCEPT}
            multiple
            required={images.length === 0}
            className="sr-only"
            aria-label="განცხადების სურათების არჩევა"
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.images)}
            aria-describedby={fieldErrors.images ? fieldErrorId(imagesId) : `${imagesId}-heading`}
            onChange={(event) => {
              void handleFilesSelected(event.target.files)
              event.currentTarget.value = ""
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept={LISTING_IMAGE_ACCEPT}
            capture="environment"
            className="sr-only"
            aria-label="კამერით ფოტოს გადაღება"
            onChange={(event) => {
              void handleFilesSelected(event.target.files)
              event.currentTarget.value = ""
            }}
          />

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={loading || images.length >= MAX_LISTING_IMAGES}
              onClick={() => cameraInputRef.current?.click()}
              className="flex min-h-28 flex-col items-center justify-center rounded-2xl border border-brand/25 bg-brand-soft/35 px-4 text-center text-brand transition hover:border-brand disabled:opacity-50 sm:min-h-32"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.8">
                <path d="M4 7.5h3l1.5-2h7l1.5 2h3a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2Z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              <span className="mt-2 text-sm font-black">კამერით გადაღება</span>
              <span className="mt-1 text-[11px] text-text-soft">გახსენი ტელეფონის კამერა</span>
            </button>
            <button
              type="button"
              disabled={loading || images.length >= MAX_LISTING_IMAGES}
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-28 flex-col items-center justify-center rounded-2xl border border-line bg-white px-4 text-center text-text transition hover:border-brand/40 hover:bg-brand-soft/20 disabled:opacity-50 sm:min-h-32"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current text-brand" strokeWidth="1.8">
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <circle cx="9" cy="10" r="2" />
                <path d="m21 15-4.5-4.5L7 20" />
              </svg>
              <span className="mt-2 text-sm font-black">გალერეიდან არჩევა</span>
              <span className="mt-1 text-[11px] text-text-soft">აირჩიე რამდენიმე ფოტო ერთად</span>
            </button>
          </div>

          {images.length > 0 ? (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {images.map((image, index) => (
                <article
                  key={image.id}
                  data-listing-image-id={image.id}
                  draggable={!loading}
                  onDragStart={(event) => {
                    draggingImageIdRef.current = image.id
                    setDraggingImageId(image.id)
                    event.dataTransfer.effectAllowed = "move"
                    event.dataTransfer.setData("text/plain", image.id)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    reorderImage(draggingImageIdRef.current || event.dataTransfer.getData("text/plain"), image.id)
                  }}
                  onDragEnd={() => {
                    draggingImageIdRef.current = ""
                    setDraggingImageId("")
                  }}
                  className={`relative aspect-square overflow-hidden rounded-2xl border bg-surface-alt transition ${draggingImageId === image.id ? "scale-[0.98] border-brand opacity-80" : "border-line"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.imageUrl} alt={`ფოტო ${index + 1}`} className="h-full w-full object-cover" />
                  <div className="absolute inset-x-2 top-2 flex items-start justify-end gap-2">
                    <button
                      type="button"
                      disabled={loading}
                      onPointerDown={(event) => beginPointerReorder(event, image.id)}
                      onPointerMove={continuePointerReorder}
                      onPointerUp={endPointerReorder}
                      onPointerCancel={endPointerReorder}
                      className="touch-none rounded-full bg-white/95 px-2.5 py-1.5 text-sm font-black text-text shadow-sm active:cursor-grabbing"
                      aria-label={`ფოტო ${index + 1} გადაალაგე დაჭერით და გადაადგილებით`}
                    >
                      ☰
                    </button>
                  </div>
                  <div className="absolute inset-x-1.5 bottom-1.5 flex gap-1 rounded-xl bg-white/95 p-1 shadow-sm backdrop-blur">
                    <button type="button" disabled={index === 0 || loading} onClick={() => moveImage(image.id, -1)} className="min-h-10 min-w-10 rounded-lg text-sm font-black disabled:opacity-30" aria-label={`ფოტო ${index + 1} გადაიტანე მარცხნივ`}>←</button>
                    <button type="button" disabled={index === images.length - 1 || loading} onClick={() => moveImage(image.id, 1)} className="min-h-10 min-w-10 rounded-lg text-sm font-black disabled:opacity-30" aria-label={`ფოტო ${index + 1} გადაიტანე მარჯვნივ`}>→</button>
                    <button type="button" disabled={loading} onClick={() => removeImage(image.id)} className="ml-auto min-h-10 min-w-10 rounded-lg font-black text-red-700" aria-label={`ფოტო ${index + 1} წაშალე`}>×</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-line bg-surface-alt/35 px-5 py-6 text-center">
              <p className="text-sm font-bold text-text">ჯერ ფოტო არ აგირჩევია</p>
              <p className="mt-1 text-xs leading-5 text-text-soft">კარგი მთავარი ფოტო ზრდის განცხადების ნახვის შანსს.</p>
            </div>
          )}
          <p className="mt-3 text-xs leading-5 text-text-soft">JPEG, PNG ან WEBP · მაქს. 7 MB თითო ფოტო · მაქსიმუმ {MAX_LISTING_IMAGES} ფოტო.</p>
          <FieldError id={imagesId} message={fieldErrors.images} />
        </section>
      ) : null}

      {step === 2 ? (
        <>
          <section className="ui-card p-5 sm:p-8" aria-labelledby={`${formPrefix}-main-heading`}>
            <h2 id={`${formPrefix}-main-heading`} className="text-lg font-black text-text">2. რა ნივთს ყიდი?</h2>
            <p className="mt-1 text-sm text-text-soft">სათაური და კატეგორია მომხმარებელს სწრაფად ეხმარება ნივთის პოვნაში.</p>
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
                  const nextCategorySlug = listingCategories.find((item) => item.id === nextCategoryId)?.slug
                  setCategoryId(nextCategoryId)
                  setSizeType(recommendedListingSizeType(nextCategorySlug, gender))
                  setSizeId("")
                  clearFieldError("categoryId")
                  clearFieldError("sizeId")
                }}
                options={listingCategories.map((item) => ({ value: String(item.id), label: item.name }))}
                placeholder="აირჩიე კატეგორია"
                error={fieldErrors.categoryId}
                required
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
          </section>

          <section className="ui-card p-5 sm:p-8" aria-labelledby={`${formPrefix}-description-heading`}>
            <h2 id={`${formPrefix}-description-heading`} className="text-lg font-black text-text">აღწერე ნივთი</h2>
            <p className="mt-1 text-sm text-text-soft">მიუთითე მნიშვნელოვანი ინფორმაცია და ნებისმიერი დეფექტი.</p>
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
                enterKeyHint="next"
                aria-invalid={Boolean(fieldErrors.description)}
                aria-describedby={fieldErrors.description ? fieldErrorId(descriptionId) : undefined}
                placeholder="მაგ: თითქმის ახალია, ორჯერ მეცვა. დეფექტი არ აქვს."
                className={`min-h-36 w-full scroll-mt-24 resize-y rounded-xl border bg-white px-4 py-3 text-base leading-6 text-text outline-none transition placeholder:text-text-soft focus:ring-4 sm:text-sm ${fieldErrors.description ? "border-red-500 focus:border-red-600 focus:ring-red-100" : "border-line focus:border-brand focus:ring-brand-soft"}`}
              />
              <FieldError id={descriptionId} message={fieldErrors.description} />
            </div>
          </section>

          <section className="ui-card p-5 sm:p-8" aria-labelledby={`${formPrefix}-attributes-heading`}>
            <h2 id={`${formPrefix}-attributes-heading`} className="text-lg font-black text-text">მახასიათებლები</h2>
            <div className="mt-5 grid gap-6">
              <TogglePills legend="მდგომარეობა" value={condition} onChange={(value) => { setCondition(value); clearFieldError("condition") }} options={conditionOptions} error={fieldErrors.condition} />
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
            </div>
          </section>

          <section className="ui-card p-5 sm:p-8" aria-labelledby={`${formPrefix}-fit-heading`}>
            <h2 id={`${formPrefix}-fit-heading`} className="text-lg font-black text-text">{isPerfume ? "ბრენდი და მოცულობა" : "ზომა და ბრენდი"}</h2>
            <p className="mt-1 text-sm text-text-soft">
  {isPerfume
    ? "მიუთითე სუნამოს ბრენდი, მოცულობა და კონცენტრაცია — ეს მონაცემები პარფიუმერიის ფილტრებში გამოჩნდება."
    : "არჩევითია, მაგრამ ზუსტი მონაცემები ძებნის ფილტრებში უკეთ გამოჩნდება."}
</p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <BrandCombobox
                id={brandIdField}
                brands={brands}
                brandId={brandId}
                customBrand={customBrand}
                onChange={({ brandId: nextBrandId, customBrand: nextCustomBrand }) => {
                  setBrandId(nextBrandId)
                  setCustomBrand(nextCustomBrand)
                  clearFieldError("brandId")
                  clearFieldError("customBrand")
                }}
                error={fieldErrors.brandId ?? fieldErrors.customBrand}
                extraSuggestions={isPerfume ? PERFUME_BRAND_NAMES : []}
              />
              <SelectField
  id={sizeIdField}
  label={isPerfume
              ? "მოცულობა"
              : selectedCategory?.slug === "footwear"
                ? "ფეხსაცმლის ზომა"
                : selectedCategory?.slug === "kids"
                  ? "საბავშვო ზომა"
                  : "ზომა"}
  value={sizeId}
  onChange={(value) => { setSizeId(value); clearFieldError("sizeId") }}
  options={filteredSizes.map((item) => ({ value: item.id, label: item.label ?? item.id }))}
  placeholder={isPerfume
              ? "აირჩიე მოცულობა"
              : selectedCategory?.slug === "footwear"
                ? "აირჩიე ფეხსაცმლის ზომა"
                : selectedCategory?.slug === "kids"
                  ? "აირჩიე საბავშვო ზომა"
                  : "აირჩიე ზომა"}
  error={fieldErrors.sizeId}
/>
{isPerfume ? (
  <SelectField
    id={materialId}
    label="კონცენტრაცია"
    value={material}
    onChange={(value) => { setMaterial(value); clearFieldError("material") }}
    options={perfumeConcentrationOptions}
    placeholder="აირჩიე კონცენტრაცია"
    error={fieldErrors.material}
  />
) : null}
            </div>
            {!isPerfume ? (
<details className="mt-5 rounded-2xl border border-line bg-surface-alt/35 p-4">
              <summary className="cursor-pointer text-sm font-black text-brand">+ ფერი და მასალა</summary>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <TextInput id={colorId} label="ფერი" value={color} onChange={(value) => { setColor(value); clearFieldError("color") }} error={fieldErrors.color} maxLength={LISTING_TEXT_LIMITS.colorMax} placeholder="მაგ: შავი" />
                <TextInput id={materialId} label="მასალა" value={material} onChange={(value) => { setMaterial(value); clearFieldError("material") }} error={fieldErrors.material} maxLength={LISTING_TEXT_LIMITS.materialMax} placeholder="მაგ: ტყავი" />
              </div>
            </details>
) : null}
          </section>
        </>
      ) : null}

      {step === 3 ? (
        <section className="ui-card p-5 sm:p-8" aria-labelledby={`${formPrefix}-price-heading`}>
          <h2 id={`${formPrefix}-price-heading`} className="text-lg font-black text-text">3. ფასი და გაყიდვის ტიპი</h2>
          <p className="mt-1 text-sm leading-6 text-text-soft">აირჩიე გაყიდვა, გაცვლა ან ჩუქება. ჩუქების შემთხვევაში ფასი საჭირო არ არის.</p>
          <div className="mt-5 grid gap-6">
            {saleType !== "gift" ? (
              <div className="max-w-md">
                <TextInput
                  id={priceId}
                  label="ფასი (₾)"
                  value={price}
                  onChange={(value) => { setPrice(value); clearFieldError("price") }}
                  error={fieldErrors.price}
                  required
                  inputMode="decimal"
                  placeholder="მაგ: 120"
                  helper="მიუთითე მხოლოდ რიცხვი, მაგალითად 120 ან 120.50"
                />
              </div>
            ) : null}
            <TogglePills
              legend="რას სთავაზობ?"
              value={saleType}
              onChange={(value) => {
                setSaleType(value)
                if (value === "gift") {
                  setPrice("")
                  clearFieldError("price")
                }
                clearFieldError("saleType")
              }}
              options={saleTypeOptions}
              error={fieldErrors.saleType}
            />
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <>
          <section className="ui-card p-5 sm:p-8" aria-labelledby={`${formPrefix}-review-heading`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 id={`${formPrefix}-review-heading`} className="text-lg font-black text-text">Preview — ასე გამოჩნდება განცხადება</h2>
                <p className="mt-1 text-sm text-text-soft">თუ რამე შესაცვლელია, შესაბამის ნაბიჯზე დაბრუნდი.</p>
              </div>
              <span className="ui-pill-soft self-start">{images.length} ფოტო</span>
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
                <p className="mt-2 text-xl font-black text-brand">{saleType === "gift" ? "ჩუქება" : price ? `${price} ₾` : "ფასი არ არის"}</p>
                <p className="mt-4 whitespace-pre-line text-sm leading-6 text-text-soft">{description}</p>
                <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-text-soft">
                  <span className="ui-pill-soft">{conditionOptions.find((item) => item.value === condition)?.label}</span>
                  <span className="ui-pill-soft">{genderOptions.find((item) => item.value === gender)?.label}</span>
                  <span className="ui-pill-soft">{saleTypeOptions.find((item) => item.value === saleType)?.label}</span>
                  {selectedBrandName ? <span className="ui-pill-soft">{selectedBrandName}</span> : null}
                  {selectedSize ? <span className="ui-pill-soft">{isPerfume ? "მოცულობა" : "ზომა"} {selectedSize.label}</span> : null}
                  {isPerfume && material ? <span className="ui-pill-soft">{perfumeConcentrationOptions.find((item) => item.value === material)?.label ?? material}</span> : null}
                  {city ? <span className="ui-pill-soft">{city}</span> : null}
                </div>
              </div>
            </div>
            {images.length > 1 ? (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {images.slice(1).map((image, index) => (
                  <div key={image.id} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-alt">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.imageUrl} alt={`დამატებითი ფოტო ${index + 2}`} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="ui-card p-5 sm:p-8" aria-labelledby={`${formPrefix}-publish-heading`}>
            <h2 id={`${formPrefix}-publish-heading`} className="text-lg font-black text-text">4. გამოქვეყნება</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setPublishNow(true)} aria-pressed={publishNow} className={`rounded-2xl border p-5 text-left transition ${publishNow ? "border-brand bg-brand-soft shadow-[0_0_0_3px_rgba(7,90,83,0.08)]" : "border-line bg-white hover:border-brand/40"}`}>
                <span className="text-sm font-black text-text">გამოქვეყნება ახლავე</span>
                <span className="mt-1 block text-xs leading-5 text-text-soft">განცხადება დაუყოვნებლივ გამოჩნდება კატალოგში.</span>
              </button>
              <button type="button" onClick={() => setPublishNow(false)} aria-pressed={!publishNow} className={`rounded-2xl border p-5 text-left transition ${!publishNow ? "border-brand bg-brand-soft shadow-[0_0_0_3px_rgba(7,90,83,0.08)]" : "border-line bg-white hover:border-brand/40"}`}>
                <span className="text-sm font-black text-text">დრაფტად შენახვა</span>
                <span className="mt-1 block text-xs leading-5 text-text-soft">მხოლოდ შენს კაბინეტში დარჩება და მოგვიანებით გამოაქვეყნებ.</span>
              </button>
            </div>
          </section>
        </>
      ) : null}

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
              className="h-full rounded-full bg-brand transition-[width] duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {loading && images.length > 0 ? (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {images.map((image, index) => {
                const uploaded = index < uploadedImageCount
                const activeUpload = index === uploadingImageIndex

                return (
                  <div
                    key={image.id}
                    className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border bg-surface-alt ${
                      uploaded
                        ? "border-brand/40"
                        : activeUpload
                          ? "border-accent shadow-[0_0_0_3px_rgba(255,122,0,0.12)]"
                          : "border-line opacity-65"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.imageUrl} alt="" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                      {uploaded ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-black text-white">✓</span>
                      ) : activeUpload ? (
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-white/80" />
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <footer className="ui-card sticky bottom-[calc(var(--mobile-nav-offset)+0.5rem+env(safe-area-inset-bottom))] z-10 flex items-center justify-between gap-3 p-3 shadow-[0_16px_45px_rgba(7,63,59,0.14)] sm:static sm:p-5">
        {step === 1 ? (
          <Link href="/dashboard/listings" className="ui-btn-secondary">გაუქმება</Link>
        ) : (
          <button type="button" disabled={loading} onClick={() => jumpToStep((step - 1) as Step)} className="ui-btn-secondary">← უკან</button>
        )}

        {step < 4 ? (
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
