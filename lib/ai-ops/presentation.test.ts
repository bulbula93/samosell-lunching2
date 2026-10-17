import { describe, expect, it } from "vitest";
import { activityOutcome, approvalRisk, formatQaTime } from "./presentation";
describe("QA metadata display", () => {
  it("treats unknown actions conservatively and shows stored event outcomes", () => {
    expect(approvalRisk("refund_payment")).toBe("high");
    expect(approvalRisk("unknown")).toBe("high");
    expect(approvalRisk("__proto__")).toBe("high");
    expect(approvalRisk("hide_listing")).toBe("medium");
    expect(activityOutcome("failed")).toBe("შეცდომა");
    expect(activityOutcome("__proto__")).toBe("შედეგი უცნობია");
    expect(formatQaTime("invalid")).toBe("—");
  });
});
