import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const push = vi.hoisted(() => ({
  env: { supported: true, permission: "default" as NotificationPermission, ios: false, standalone: false },
  vapid: "BPUBLICKEY",
  subscribed: false,
  enable: vi.fn(async (): Promise<"enabled" | "denied" | "dismissed" | "failed"> => "enabled"),
}))

vi.mock("@/lib/push-client", () => ({
  readPushEnvironment: () => push.env,
  fetchPushConfig: async () => ({ vapidPublicKey: push.vapid }),
  hasBrowserPushSubscription: async () => push.subscribed,
  enablePushSubscription: push.enable,
}))
vi.mock("@/lib/share/story-image", async (orig) => {
  const real = await orig<typeof import("@/lib/share/story-image")>()
  return { ...real, createInstagramStoryFile: vi.fn(async () => new File(["x"], "s.png", { type: "image/png" })) }
})

import ShareAfterPublishDialog from "@/components/listings/ShareAfterPublishDialog"
import { PUSH_PROMPT_KEY, resolvePushOptIn } from "@/components/listings/PushOptInStep"

const props = { listingId: "22222222-2222-4222-8222-222222222222", listingUrl: "https://samosell.ge/listing/x", title: "კაბა", priceText: "45 ₾", imageUrl: null }

async function openAndFinishSharing() {
  render(<ShareAfterPublishDialog {...props} />)
  await act(async () => { vi.advanceTimersByTime(700) })
  await act(async () => { await Promise.resolve() })
  fireEvent.click(screen.getByRole("button", { name: "მოგვიანებით" }))
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  push.env = { supported: true, permission: "default", ios: false, standalone: false }
  push.vapid = "BPUBLICKEY"
  push.subscribed = false
  push.enable.mockClear()
  push.enable.mockResolvedValue("enabled")
})
afterEach(() => { vi.useRealTimers() })

describe("push opt-in after publish", () => {
  it("shows the notifications step after the share step and enables push", async () => {
    await openAndFinishSharing()
    expect(screen.getByRole("dialog", { name: "გაიგე მაშინვე, როცა მყიდველი მოგწერს" })).toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /შეტყობინებების ჩართვა/ })) })
    expect(push.enable).toHaveBeenCalledWith("BPUBLICKEY")
    expect(screen.getByRole("dialog", { name: "შეტყობინებები ჩართულია" })).toBeInTheDocument()
    expect(localStorage.getItem(PUSH_PROMPT_KEY)).toBe("1")
    fireEvent.click(screen.getByRole("button", { name: "კარგი" }))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("“not now” closes it and it is never offered again on this browser", async () => {
    await openAndFinishSharing()
    fireEvent.click(screen.getByRole("button", { name: "ახლა არა" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(localStorage.getItem(PUSH_PROMPT_KEY)).toBe("1")
    expect(push.enable).not.toHaveBeenCalled()
    await expect(resolvePushOptIn()).resolves.toBeNull()
  })

  it("explains how to unblock when the browser denies permission", async () => {
    push.enable.mockResolvedValue("denied")
    await openAndFinishSharing()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /შეტყობინებების ჩართვა/ })) })
    expect(screen.getByText(/ბრაუზერმა შეტყობინებები დაბლოკა/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /შეტყობინებების ჩართვა/ })).toBeNull()
  })

  it("shows Home Screen steps in iPhone Safari instead of asking for permission", async () => {
    push.env = { supported: false, permission: "default", ios: true, standalone: false }
    await openAndFinishSharing()
    expect(screen.getByRole("dialog", { name: "iPhone-ზე შეტყობინებებისთვის" })).toBeInTheDocument()
    expect(screen.getByText("Add to Home Screen", { exact: false })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "გასაგებია" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(push.enable).not.toHaveBeenCalled()
  })

  it.each([
    ["already subscribed", () => { push.subscribed = true }],
    ["permission blocked", () => { push.env = { ...push.env, permission: "denied" } }],
    ["permission already granted", () => { push.env = { ...push.env, permission: "granted" } }],
    ["push unsupported", () => { push.env = { ...push.env, supported: false } }],
    ["push not configured / signed out", () => { push.vapid = "" }],
    ["already asked on this browser", () => { localStorage.setItem(PUSH_PROMPT_KEY, "1") }],
  ])("skips the step when %s", async (_label, arrange) => {
    arrange()
    await openAndFinishSharing()
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
