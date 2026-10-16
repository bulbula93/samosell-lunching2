"use client"

import StoriesRail from "@/components/stories/StoriesRail"
import { useHomePersonalization } from "@/components/home/HomePersonalizationProvider"

// Keep the slot's dimensions stable when personalization resolves after hydration.
// Only display a rail when there are stories or an authenticated composer.
export default function HomeStoriesSlot() {
  const personalization = useHomePersonalization()
  const rail = personalization?.storyRail
  const showRail = Boolean(rail && (rail.currentUserId || rail.owners.length > 0))
  return (
    <div className="min-h-[208px] sm:min-h-[236px]" data-home-stories-slot>
      {showRail && rail ? <StoriesRail data={rail} /> : null}
    </div>
  )
}
