"use client"

import { useEffect, useState } from "react"

/** One deadline timer; also recheck when a sleeping tab becomes visible. */
export function useExpiryClock(deadlines: (string | null | undefined)[]) {
  const key = deadlines.filter(Boolean).sort().join("|")
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const update = () => {
      if (timer) clearTimeout(timer)
      const time = Date.now()
      setNow(time)
      const next = key.split("|").map(Date.parse).filter((end) => end > time).sort((a, b) => a - b)[0]
      if (next) timer = setTimeout(update, Math.min(next - time, 2_147_483_647))
    }
    update()
    document.addEventListener("visibilitychange", update)
    return () => { if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", update) }
  }, [key])
  return now
}
