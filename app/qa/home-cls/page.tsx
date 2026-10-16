import { notFound } from "next/navigation"
import { isReadOnlyPreview } from "@/lib/preview-read-only"

export const dynamic = "force-dynamic"
export const metadata = { robots: { index: false, follow: false } }

// Exact responsive viewport sizes in the existing Cloud Browser. This is not
// device/UA emulation or CPU/network throttling. Never available in Production.
export default function HomeClsAudit() {
  if (process.env.VERCEL_ENV !== "preview" || !isReadOnlyPreview()) notFound()
  return <main className="p-6">
    <h1 className="text-xl font-bold">Homepage CLS · Preview audit</h1>
    <p>20-second Layout Instability API sample. Responsive iframes, desktop Chrome UA, no throttling. Reload for another sample.</p>
    <div className="mt-4 flex flex-wrap items-start gap-6">
      {[[390, 844], [375, 812]].map(([width, height]) => <section key={width}>
        <h2>{width} × {height}</h2>
        <iframe title={`Homepage ${width}x${height}`} src="/?_cls_audit=1" width={width} height={height} style={{ border: "1px solid #777", boxSizing: "content-box" }} />
      </section>)}
    </div>
  </main>
}
