import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import StoryComposer from "@/components/stories/StoryComposer"

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), publish: vi.fn(), abort: vi.fn(), upload: vi.fn() }))
vi.mock("@/app/stories/actions", () => ({ prepareStoryUploadAction: mocks.prepare, publishStoryAction: mocks.publish, abortStoryUploadAction: mocks.abort }))
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: mocks.upload }) } }) }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 100, height: 80, close: vi.fn() }))
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn().mockReturnValue("blob:preview"), revokeObjectURL: vi.fn() }))
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["webp"], { type: "image/webp" })))
  mocks.prepare.mockResolvedValue({ ok: true, storyId: "story", path: "owner/story/media.webp", token: "signed-token" })
  mocks.upload.mockResolvedValue({ error: null })
  mocks.publish.mockResolvedValue({ ok: true })
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

function compose() {
  const onClose = vi.fn()
  const { container } = render(<StoryComposer listings={[]} onClose={onClose} />)
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["jpg"], "photo.jpg", { type: "image/jpeg" })] } })
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Story caption" } })
  fireEvent.click(screen.getByRole("button", { name: "გამოქვეყნება" }))
  return onClose
}

describe("Story composer publishing boundary", () => {
  it.each(["prepare", "upload", "publish"] as const)("prevents dismissal during %s and closes after success", async (stage) => {
    let release!: (value: unknown) => void
    mocks[stage].mockImplementationOnce(() => new Promise(resolve => { release=resolve }))
    const onClose = compose()
    await waitFor(() => expect(mocks[stage]).toHaveBeenCalled())
    const close=screen.getByRole("button",{name:"დახურვა"})
    expect(close).toBeDisabled()
    fireEvent.click(close)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    release(stage === "prepare" ? {ok:true,storyId:"story",path:"owner/story/media.webp",token:"signed-token"} : stage === "upload" ? {error:null} : {ok:true})
    await waitFor(()=>expect(onClose).toHaveBeenCalledOnce())
  })
  it("prepares first, uploads only with the returned signature, then publishes the same plan", async () => {
    const onClose = compose()
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(mocks.prepare).toHaveBeenCalledWith({ mimeType: "image/webp", size: 4 })
    expect(mocks.upload).toHaveBeenCalledWith("owner/story/media.webp", "signed-token", expect.any(File), { contentType: "image/webp", cacheControl: "0" })
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({ storyId: "story", path: "owner/story/media.webp", caption: "Story caption", mediaType: "image" }))
    expect(mocks.prepare.mock.invocationCallOrder[0]).toBeLessThan(mocks.upload.mock.invocationCallOrder[0])
    expect(mocks.upload.mock.invocationCallOrder[0]).toBeLessThan(mocks.publish.mock.invocationCallOrder[0])
  })

  it.each(["prepare", "publish"] as const)("keeps the modal usable when %s rejects, and permits retry", async (stage) => {
    mocks[stage].mockRejectedValueOnce(new Error("Action unavailable"))
    const onClose = compose()
    expect(await screen.findByRole("alert")).toHaveTextContent("Action unavailable")
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    if (stage === "prepare") expect(mocks.upload).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole("button", { name: "გამოქვეყნება" })).toBeEnabled())
    fireEvent.click(screen.getByRole("button", { name: "გამოქვეყნება" }))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it("aborts the authorized plan on upload failure without publishing", async () => {
    mocks.upload.mockResolvedValue({ error: { message: "upload failed" } })
    const onClose = compose()
    expect(await screen.findByRole("alert")).toBeInTheDocument()
    expect(mocks.abort).toHaveBeenCalledWith("story", "owner/story/media.webp")
    expect(mocks.publish).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
