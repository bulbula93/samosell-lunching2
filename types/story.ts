export type StoryMediaType = "image" | "video"

export type StoryOwner = {
  id: string
  username: string
  fullName: string | null
  avatarUrl: string | null
  storyCount: number
  unseenCount: number
  latestStoryAt: string
}

export type StoryLinkedListing = {
  id: string
  slug: string
  title: string
  price: number
  currency: string
  coverImageUrl: string | null
  status: string
}

export type StoryItem = {
  id: string
  ownerId: string
  mediaPath: string
  mediaUrl: string
  mediaType: StoryMediaType
  caption: string | null
  createdAt: string
  expiresAt: string
  durationMs: number | null
  linkedListing: StoryLinkedListing | null
  viewed: boolean
}

export type StoryComposerListing = {
  id: string
  title: string
  slug: string
  price: number
  currency: string
  coverImageUrl: string | null
}

export type StoryRailData = {
  owners: StoryOwner[]
  currentUserId: string | null
  currentUsername: string | null
  composerListings: StoryComposerListing[]
  ownStats: { views: number; replies: number; listingClicks: number } | null
}
