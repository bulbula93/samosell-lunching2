import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { QaStatus } from "@/app/admin/ai/qa-status"
import type { QaSnapshot } from "@/lib/ai-ops/qa-reader"
const data: QaSnapshot = {
  jobs: [], activity: [], approvals: [], totals: {jobs:0,activity:0,pending:0}, environmentStopped:true,
  control:{stopped:false,worker_enabled:true,scheduler_enabled:true,updated_at:"2026-10-17T10:00:00Z",last_tick_at:null,last_tick_status:null},
}
describe("database worker stop authority", () => {
  it("never reports a DB worker stopped merely because the legacy Vercel flag is true", () => {
    render(<QaStatus result={{ok:true,data}} />)
    expect(screen.getByRole("heading",{name:"Kill Switch: გაჩერება გამორთულია"})).toBeInTheDocument()
    expect(screen.getByText("QA Worker: დაშვებულია",{exact:true})).toBeInTheDocument()
  })
  it("shows stopped workers for a DB stop and a fail-closed unknown state", () => {
    const {unmount}=render(<QaStatus result={{ok:true,data:{...data,control:{...data.control,stopped:true}}}} />)
    expect(screen.getByText("აგენტები: არააქტიური")).toBeInTheDocument();unmount()
    render(<QaStatus result={{ok:false,code:"connection_failed"}} />)
    expect(screen.getByRole("heading",{name:"Kill Switch: Stopped / შეჩერებულია"})).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("ბაზის სტატუსი უცნობია")
  })
})
