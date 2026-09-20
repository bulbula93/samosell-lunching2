"use client"

import StoriesRail from "@/components/stories/StoriesRail"
import { useHomePersonalization } from "@/components/home/HomePersonalizationProvider"

export default function HomeStoriesSlot() {
  const personalization = useHomePersonalization()
  if (!personalization?.storyRail) return null
  return <StoriesRail data={personalization.storyRail} />
}
