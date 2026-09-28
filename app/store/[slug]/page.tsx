import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function StoreRedirectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("username, seller_type, is_suspended")
    .eq("store_slug", slug.toLowerCase())
    .eq("seller_type", "store")
    .maybeSingle()

  if (error || !profile || profile.is_suspended || !profile.username) notFound()
  redirect(`/seller/${encodeURIComponent(profile.username)}`)
}
