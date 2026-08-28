import { describe, expect, it } from "vitest";
import { can } from "./permissions";

describe("role permissions", () => {
  it("prevents technical staff from recording professional conclusions", () => {
    expect(can("technical_staff", "screenings:review")).toBe(false);
    expect(can("technical_staff", "workflow:review")).toBe(false);
    expect(can("technical_staff", "screenings:close")).toBe(false);
    expect(can("technical_staff", "reports:generate")).toBe(false);
    expect(can("technical_staff", "workflow:read")).toBe(true);
  });

  it("allows authorized professionals to review and generate reports", () => {
    expect(can("authorized_professional", "screenings:review")).toBe(true);
    expect(can("authorized_professional", "workflow:review")).toBe(true);
    expect(can("authorized_professional", "followups:write")).toBe(true);
    expect(can("authorized_professional", "referrals:write")).toBe(true);
    expect(can("authorized_professional", "screenings:close")).toBe(true);
    expect(can("authorized_professional", "reports:generate")).toBe(true);
  });
});
