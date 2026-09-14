// @vitest-environment node
import { readFileSync } from "node:fs"
import { expect,it } from "vitest"

it("pins the complete production URL before curl can attach the bearer secret",()=>{
  const workflow=readFileSync('.github/workflows/story-cleanup.yml','utf8')
  const guard=`[[ "$CLEANUP_URL" == 'https://samosell.ge/api/internal/story-cleanup' ]] || exit 1`
  expect(workflow).toContain(guard)
  expect(workflow.indexOf(guard)).toBeLessThan(workflow.indexOf('curl --proto'))
  expect(workflow).not.toContain('https://*/')
  expect(workflow).not.toMatch(/--location|curl\s+-L/)
  expect(workflow).toContain("github.ref == 'refs/heads/main'")
  expect(workflow).toContain("vars.STORY_CLEANUP_ENABLED == 'true'")
})
