import Link from "next/link"
import { notFound } from "next/navigation"
import SiteHeader from "@/components/layout/SiteHeader"
import Avatar from "@/components/shared/Avatar"
import { createClient } from "@/lib/supabase/server"

const PAGE_SIZE = 24

export default async function SocialListPage({ username, page, mode }: { username: string; page: number; mode: "followers" | "following" }) {
  const supabase = await createClient()
  const { data: profile } = await supabase.from("profiles").select("id, username, full_name").eq("username", username).eq("is_suspended", false).maybeSingle()
  if (!profile) notFound()
  const from = (page - 1) * PAGE_SIZE
  const relation = mode === "followers" ? "follower:profiles!user_follows_follower_id_fkey(id,username,full_name,avatar_url,store_logo_url,seller_type,is_suspended)" : "following:profiles!user_follows_following_id_fkey(id,username,full_name,avatar_url,store_logo_url,seller_type,is_suspended)"
  const filter = mode === "followers" ? { column: "following_id", value: profile.id } : { column: "follower_id", value: profile.id }
  const { data, count } = await supabase.from("user_follows").select(relation, { count: "exact" }).eq(filter.column, filter.value).order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1)
  type Person = { id: string; username: string; full_name: string | null; avatar_url: string | null; store_logo_url: string | null; seller_type: string | null; is_suspended: boolean }
  const people = (data ?? []).map((row) => (row as unknown as Record<string, Person | Person[]>)[mode === "followers" ? "follower" : "following"]).flatMap((value) => Array.isArray(value) ? value : value ? [value] : []).filter((person) => !person.is_suspended)
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
  const label = mode === "followers" ? "გამომწერები" : "გამოწერები"
  return <main className="min-h-screen bg-bg text-text"><SiteHeader/><section className="ui-container py-10"><Link href={`/seller/${encodeURIComponent(username)}`} className="text-sm font-bold text-brand">← პროფილზე დაბრუნება</Link><h1 className="mt-4 text-3xl font-black">{profile.full_name || profile.username} · {label}</h1><div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{people.map((person) => { const avatar = person.seller_type === "store" ? person.store_logo_url || person.avatar_url : person.avatar_url; return <Link key={person.id} href={`/seller/${encodeURIComponent(person.username)}`} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4"><Avatar src={avatar} alt={person.username} fallbackText={person.full_name || person.username}/><div className="min-w-0"><p className="truncate font-black">{person.full_name || person.username}</p><p className="truncate text-sm text-text-soft">@{person.username}</p></div></Link> })}</div>{people.length === 0 ? <p className="mt-8 text-text-soft">სია ჯერ ცარიელია</p> : null}<nav aria-label="გვერდები" className="mt-8 flex gap-3">{page > 1 ? <Link className="ui-btn-secondary" href={`/seller/${encodeURIComponent(username)}/${mode}?page=${page - 1}`}>წინა</Link> : null}{page < pages ? <Link className="ui-btn-secondary" href={`/seller/${encodeURIComponent(username)}/${mode}?page=${page + 1}`}>შემდეგი</Link> : null}</nav></section></main>
}
