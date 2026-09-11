import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import AdminReportsPage from "@/app/admin/reports/page"

const mocks = vi.hoisted(() => ({ requireAdminUser: vi.fn() }))
vi.mock("@/lib/auth", () => ({ requireAdminUser: mocks.requireAdminUser }))
vi.mock("@/app/moderation/actions", () => ({ reviewStoryReportAction: vi.fn() }))
vi.mock("@/components/moderation/AdminReviewCard", () => ({ default: ({item}: {item:{id:string}}) => <div>listing:{item.id}</div> }))
vi.mock("@/components/moderation/AdminUserReviewCard", () => ({ default: ({item}: {item:{id:string}}) => <div>user:{item.id}</div> }))

const tables: Record<string, Array<Record<string, unknown>>> = {
  admin_listing_reports: [{ id:"listing1", reason:"spam", status:"open", created_at:"2026-09-09", seller_id:"seller" }],
  admin_user_reports: [{ id:"user1", reason:"scam", status:"open", created_at:"2026-09-09", reported_user_id:"seller" }],
  admin_story_reports: [
    { id:"story1", story_id:"s1", story_owner_id:"seller", reason:"spam", status:"open", created_at:"2026-09-09", media_path:"a.jpg", media_type:"image", owner_username:"normal-story" },
    { id:"story2", story_id:"s2", story_owner_id:"seller", reason:"nudity", status:"reviewing", created_at:"2026-09-09", media_path:"b.jpg", media_type:"image", owner_username:"high-story" },
  ],
}

beforeEach(() => {
  mocks.requireAdminUser.mockResolvedValue({ supabase: {
    from(table: string) {
      let rows = tables[table] ?? []
      const query = {
        select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
        limit(n: number) { rows=rows.slice(0,n); return query },
        eq(key: string, value: unknown) { rows=rows.filter(row=>row[key]===value); return query },
        in(key: string, values: unknown[]) { rows=rows.filter(row=>values.includes(row[key])); return query },
        then(resolve: (value: unknown)=>void) { resolve({data:rows,error:null,count:rows.length}) },
      }
      return query
    },
    storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }) }) },
  } })
})

describe("one moderation queue including Story reports", () => {
  it("finds high-priority Stories beyond sixty newer normal reports", async () => {
    const original = tables.admin_story_reports
    tables.admin_story_reports = [...Array.from({length:65}, (_,i)=>({...original[0],id:`normal${i}`})),original[1]]
    try {
      render(await AdminReportsPage({searchParams:Promise.resolve({kind:"story",status:"all",priority:"high"})}))
      expect(screen.getByText("@high-story")).toBeInTheDocument()
    } finally { tables.admin_story_reports=original }
  })
  for (const kind of ["listing", "user"]) it(`excludes Stories in ${kind}-only queue`, async () => {
    render(await AdminReportsPage({searchParams:Promise.resolve({kind,status:"all"})}))
    expect(screen.queryByText(/@normal-story|@high-story/)).not.toBeInTheDocument()
    expect(screen.getByText(`${kind}:${kind}1`)).toBeInTheDocument()
    expect(screen.queryByText("ამ ფილტრში რეპორტები არ მოიძებნა.")).not.toBeInTheDocument()
  })
  it("shows only Stories for story, preserving status filtering and empty states", async () => {
    const {unmount}=render(await AdminReportsPage({searchParams:Promise.resolve({kind:"story",status:"open"})}))
    expect(screen.getByText("@normal-story")).toBeInTheDocument()
    expect(screen.queryByText("@high-story")).not.toBeInTheDocument()
    expect(screen.queryByText(/listing:|user:/)).not.toBeInTheDocument()
    expect(screen.queryByText("ამ ფილტრში რეპორტები არ მოიძებნა.")).not.toBeInTheDocument()
    unmount()
    render(await AdminReportsPage({searchParams:Promise.resolve({kind:"story",status:"resolved"})}))
    expect(screen.getByText("ამ ფილტრში რეპორტები არ მოიძებნა.")).toBeInTheDocument()
  })
  it("applies high priority to Story cards in the same queue", async () => {
    render(await AdminReportsPage({searchParams:Promise.resolve({kind:"all",status:"all",priority:"high"})}))
    expect(screen.getByText("@high-story")).toBeInTheDocument()
    expect(screen.getByText("user:user1")).toBeInTheDocument()
    expect(screen.queryByText("@normal-story")).not.toBeInTheDocument()
    expect(screen.queryByText("listing:listing1")).not.toBeInTheDocument()
  })
  it("all contains all three kinds", async () => {
    render(await AdminReportsPage({searchParams:Promise.resolve({kind:"all",status:"all"})}))
    expect(screen.getByText("listing:listing1")).toBeInTheDocument()
    expect(screen.getByText("user:user1")).toBeInTheDocument()
    expect(screen.getByText("@normal-story")).toBeInTheDocument()
    expect(screen.getByText("@high-story")).toBeInTheDocument()
  })
})
