"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import CatalogFilterFields, {
  type CatalogFilterOptions,
  type CatalogFilterValues,
} from "@/components/listings/CatalogFilterFields"
import { ka } from "@/lib/i18n/ka"

export default function MobileFiltersDrawer({
  options,
  values,
  activeCount,
}: {
  options: CatalogFilterOptions
  values: CatalogFilterValues
  activeCount: number
}) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (event.key !== "Tab" || !panelRef.current) return
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleKeyDown)
      trigger?.focus()
    }
  }, [open])

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="ui-btn-secondary w-full"
      >
        {ka.catalog.filters}{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[90]">
          <button type="button" aria-label="ფილტრების დახურვა" className="absolute inset-0 bg-text/40" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-filter-title"
            className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-3xl bg-bg shadow-[0_-24px_60px_rgba(7,63,59,0.2)]"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-bg px-5 py-4">
              <h2 id="mobile-filter-title" className="text-xl font-black text-text">{ka.catalog.filters}</h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="ფილტრების დახურვა"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white text-2xl"
              >
                ×
              </button>
            </div>
            <form action="/catalog" className="p-5">
              {values.q ? <input type="hidden" name="q" value={values.q} /> : null}
              <CatalogFilterFields options={options} values={values} mobile />
              <div className="sticky bottom-0 -mx-5 mt-7 grid grid-cols-2 gap-3 border-t border-line bg-bg p-5">
                <Link href={values.q ? `/catalog?q=${encodeURIComponent(values.q)}` : "/catalog"} className="ui-btn-secondary">
                  {ka.catalog.clear}
                </Link>
                <button type="submit" className="ui-btn-primary">{ka.catalog.apply}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
