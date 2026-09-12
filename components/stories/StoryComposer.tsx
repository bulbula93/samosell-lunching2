"use client"
/* eslint-disable @next/next/no-img-element -- Local Story previews must not invoke Vercel image transforms. */

import { useEffect, useState, useTransition } from "react"
import { abortStoryUploadAction, prepareStoryUploadAction, publishStoryAction } from "@/app/stories/actions"
import { createClient } from "@/lib/supabase/client"
import { STORY_VIDEO_MAX_DURATION_MS } from "@/lib/stories"
import type { StoryComposerListing } from "@/types/story"

async function optimizePhoto(file: File) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1080 / bitmap.width, 1920 / bitmap.height)
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width; canvas.height = height
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82))
  if (!blob) throw new Error("ფოტოს დამუშავება ვერ მოხერხდა")
  return { file: new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" }), width, height }
}

async function videoDimensions(file: File) {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<{ width: number; height: number; durationMs: number }>((resolve, reject) => {
      const video = document.createElement("video")
      video.preload = "metadata"
      video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight, durationMs: Math.round(video.duration * 1000) })
      video.onerror = () => reject(new Error("ვიდეო ვერ გაიხსნა"))
      video.src = url
    })
  } finally { URL.revokeObjectURL(url) }
}

export default function StoryComposer({ listings, onClose }: { listings: StoryComposerListing[]; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState("")
  const [caption, setCaption] = useState("")
  const [listingId, setListingId] = useState("")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  function publish() {
    if (pending) return
    if (!file) return setError("აირჩიე ფოტო ან ვიდეო")
    startTransition(async () => {
      setError("")
      let upload = file
      let width = 0, height = 0, durationMs: number | null = null
      try {
        const isVideo = file.type.startsWith("video/")
        if (isVideo) {
          const metadata = await videoDimensions(file); width = metadata.width; height = metadata.height; durationMs = metadata.durationMs
          if (durationMs > STORY_VIDEO_MAX_DURATION_MS) throw new Error("ვიდეო მაქსიმუმ 15 წამის უნდა იყოს")
        } else {
          const optimized = await optimizePhoto(file); upload = optimized.file; width = optimized.width; height = optimized.height
        }
        const preparation = await prepareStoryUploadAction({ mimeType: upload.type, size: upload.size })
        if (!preparation.ok) throw new Error(preparation.message)
        const supabase = createClient()
        const { error: uploadError } = await supabase.storage.from("story-media").uploadToSignedUrl(preparation.path, preparation.token, upload, { contentType: upload.type, cacheControl: "0" })
        if (uploadError) { await abortStoryUploadAction(preparation.storyId, preparation.path); throw new Error("ფაილის ატვირთვა ვერ დასრულდა") }
        const result = await publishStoryAction({ storyId: preparation.storyId, path: preparation.path, mediaType: isVideo ? "video" : "image", caption, linkedListingId: listingId || undefined, mediaWidth: width, mediaHeight: height, durationMs })
        if (!result.ok) throw new Error(result.message)
        onClose()
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Story ვერ გამოქვეყნდა") }
    })
  }

  return <div role="dialog" aria-modal="true" aria-label="Story-ის დამატება" className="fixed inset-0 z-[110] overflow-y-auto bg-black/80 p-4"><div className="mx-auto my-8 max-w-lg rounded-3xl bg-white p-5 text-text shadow-2xl">
    <div className="flex items-center justify-between"><h2 className="text-xl font-black">დაამატე Story</h2><button type="button" disabled={pending} onClick={() => { if (!pending) onClose() }} aria-label="დახურვა" className="p-2 text-2xl disabled:opacity-50">×</button></div>
    <label className="mt-5 flex min-h-56 cursor-pointer items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-brand/30 bg-brand-soft/40 text-center text-sm font-bold text-brand">
      {preview && file ? file.type.startsWith("video/") ? <video src={preview} controls className="max-h-[55vh] w-full object-contain" /> : <>{/* Direct blob preview avoids a pointless Next Image transformation. */}<img src={preview} alt="Story preview" className="max-h-[55vh] w-full object-contain" /></> : "აირჩიე ფოტო ან მაქსიმუმ 15-წამიანი ვიდეო"}
      <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" className="sr-only" onChange={(event) => { const next = event.target.files?.[0] ?? null; setFile(next); setPreview(next ? URL.createObjectURL(next) : "") }} />
    </label>
    <label className="mt-4 block text-sm font-bold">წარწერა (არასავალდებულო)<textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={280} rows={3} className="mt-2 w-full rounded-xl border border-line p-3 font-normal" /></label>
    <label className="mt-4 block text-sm font-bold">ნივთის მონიშვნა<select value={listingId} onChange={(event) => setListingId(event.target.value)} className="mt-2 w-full rounded-xl border border-line p-3 font-normal"><option value="">ნივთის გარეშე</option>{listings.map((listing) => <option key={listing.id} value={listing.id}>{listing.title} — {listing.price} {listing.currency}</option>)}</select></label>
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    <button type="button" disabled={pending || !file} onClick={publish} className="ui-btn-primary mt-5 w-full disabled:opacity-50">{pending ? "იტვირთება…" : "გამოქვეყნება"}</button>
  </div></div>
}
