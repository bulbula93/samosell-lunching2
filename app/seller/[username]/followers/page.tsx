import type { Metadata } from "next"
import SocialListPage from "../SocialListPage"

export const metadata: Metadata = { title: "გამომწერები", robots: { index: false, follow: true } }
export default async function FollowersPage({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ page?: string }> }) {
  const { username } = await params; const query = await searchParams
  return <SocialListPage username={username} page={Math.max(1, Number.parseInt(query.page || "1", 10) || 1)} mode="followers" />
}
