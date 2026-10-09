"use client"

import { useState } from "react"

export default function ReviewScorePicker({ initialScore = 0 }: { initialScore?: number }) {
  const [selected, setSelected] = useState(initialScore)

  return (
    <div role="radiogroup" aria-label="შეფასება 1-დან 5 ვარსკვლავამდე" className="mt-3 flex flex-wrap gap-1.5">
      {[1, 2, 3, 4, 5].map((score) => (
        <label
          key={score}
          className="relative inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-[#eee2d4] bg-white transition hover:border-[#f6ae57] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#075a53] has-[:focus-visible]:ring-offset-2"
        >
          <input
            type="radio"
            name="score"
            value={score}
            checked={selected === score}
            required
            onChange={() => setSelected(score)}
            className="sr-only"
          />
          <span aria-hidden="true" className={`text-2xl leading-none ${score <= selected ? "text-[#e78c19]" : "text-[#d5d8d5]"}`}>★</span>
          <span className="sr-only">{score} ვარსკვლავი</span>
        </label>
      ))}
    </div>
  )
}
