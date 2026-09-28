"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import AdBanner from "@/components/ads/AdBanner"
import AdPlaceholder from "@/components/ads/AdPlaceholder"
import type { AdPlacementKey, AdRecord } from "@/lib/ads"

const ROTATION_MS = 6000

export default function AdCarousel({ ads, pagePath, fallbackPlacement }: { ads: AdRecord[]; pagePath: string; fallbackPlacement: AdPlacementKey }) {
  const ordered = useMemo(() => [...ads].sort((a,b) => a.id.localeCompare(b.id)), [ads])
  const [index, setIndex] = useState(0)
  const touchX = useRef<number | null>(null)
  const move = useCallback((step:number) => {
    if (!ordered.length) return
    setIndex(current => (current + step + ordered.length) % ordered.length)
  }, [ordered.length])
  useEffect(() => {
    if (ordered.length <= 1) return
    const timer = window.setInterval(() => move(1), ROTATION_MS)
    return () => window.clearInterval(timer)
  }, [move, ordered.length])
  if (!ordered.length) return <AdPlaceholder placementKey={fallbackPlacement} />
  const first=ordered[index % ordered.length]
  const second=ordered[(index+1) % ordered.length]
  return <div className="relative" onTouchStart={e=>{touchX.current=e.touches[0]?.clientX??null}} onTouchEnd={e=>{if(touchX.current===null)return; const d=e.changedTouches[0].clientX-touchX.current; if(Math.abs(d)>40)move(d<0?1:-1); touchX.current=null}}>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
      <div key={first.id}><AdBanner ad={first} pagePath={pagePath}/></div>
      {ordered.length>1 ? <div key={second.id} className="hidden md:block"><AdBanner ad={second} pagePath={pagePath}/></div> : <div className="hidden md:block"><AdPlaceholder placementKey={fallbackPlacement}/></div>}
    </div>
    {ordered.length>1 ? <div className="mt-4 flex items-center justify-center gap-3">
      <button type="button" aria-label="წინა რეკლამა" onClick={()=>move(-1)} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-xl shadow-sm">‹</button>
      <span className="text-xs font-semibold text-text-soft">{index+1} / {ordered.length}</span>
      <button type="button" aria-label="შემდეგი რეკლამა" onClick={()=>move(1)} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-xl shadow-sm">›</button>
    </div>:null}
  </div>
}
