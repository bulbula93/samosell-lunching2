/**
 * No-persistence simulation for Preview/QA when no database backend is configured.
 * Runs the real orchestrator, Policy Gateway, Quality agent and dry-run worker against an
 * in-memory store with fixture listings. Nothing is written anywhere and nothing is published.
 */
import { approveAndSchedule, runPlanningCycle } from "./orchestrator"
import { resolveSocialRuntime } from "./runtime"
import { MemorySocialStore } from "./store"
import { runPublishTick } from "./worker"
import type { CandidateListing } from "./types"

const FIXTURE_IMAGE = "https://samosell.ge/brand/samosell-hero-clothing-studio.jpg"
export const SIMULATION_LISTINGS: CandidateListing[] = [
  { id: "sim-1", slug: "sim-zara-jacket", title: "Zara-ს ქურთუკი, M ზომა", brand: "Zara", priceGel: 45, city: "თბილისი", category: "ქურთუკები", imageUrl: FIXTURE_IMAGE, isGift: false },
  { id: "sim-2", slug: "sim-nike-sneakers", title: "Nike სპორტული ფეხსაცმელი, 42", brand: "Nike", priceGel: 80, city: "ბათუმი", category: "ფეხსაცმელი", imageUrl: FIXTURE_IMAGE, isGift: false },
  { id: "sim-3", slug: "sim-kids-set", title: "ბავშვის ტანსაცმლის ნაკრები", brand: null, priceGel: 0, city: "ქუთაისი", category: "ბავშვები", imageUrl: FIXTURE_IMAGE, isGift: true },
  { id: "sim-4", slug: "sim-mango-dress", title: "Mango-ს კაბა, S", brand: "Mango", priceGel: 35, city: "თბილისი", category: "კაბები", imageUrl: FIXTURE_IMAGE, isGift: false },
  { id: "sim-5", slug: "sim-hm-shirt", title: "H&M პერანგი, L", brand: "H&M", priceGel: 20, city: "რუსთავი", category: "პერანგები", imageUrl: "https://samosell.ge/brand/listing-photo.webp", isGift: false },
  { id: "sim-6", slug: "sim-levis-jeans", title: "Levi's ჯინსი 501", brand: "Levi's", priceGel: 60, city: "თბილისი", category: "ჯინსები", imageUrl: FIXTURE_IMAGE, isGift: false },
]

export async function runSimulation(now = new Date()) {
  let current = now
  const store = new MemorySocialStore(() => current, { killSwitch: false })
  const runtime = resolveSocialRuntime({ VERCEL_ENV: "preview" })
  const ctx = { store, runtime, now: () => current }
  const plan = await runPlanningCycle(ctx, { listings: SIMULATION_LISTINGS })
  const first = plan.posts.find(p => p.status === "ready_for_review")
  if (first) {
    await approveAndSchedule(ctx, first.id, first.version, "00000000-0000-4000-8000-000000000001")
    // Advance the simulated clock past the slot so the dry-run worker processes the job.
    current = new Date(Date.parse(first.scheduledFor) + 60_000)
  }
  const tick = await runPublishTick({ store, runtime, now: () => current.getTime() })
  return {
    plan,
    tick,
    posts: await store.listPosts("0000", "9999", 50),
    jobs: await store.listJobs(20),
    audit: await store.listAudit(60),
    control: await store.getControl(),
  }
}
