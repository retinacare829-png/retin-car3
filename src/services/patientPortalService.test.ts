import { describe, expect, it, vi } from "vitest";
import { createPatientPortalAdapter } from "./patientPortalService";

const response = {
  contractVersion: 1,
  profile: { patientId: "patient-1", organizationId: "org-1", organizationName: "Clínica", displayName: "María", firstNames: "María", lastNames: "Ejemplo", dateOfBirth: "1980-04-03", phone: null, email: "maria@example.test" },
  screenings: [],
  reports: [],
};

describe("patientPortalService", () => {
  it("invoca el contrato usando la sesión y nunca envía un patientId", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: response, error: null });
    const adapter = createPatientPortalAdapter({ rpc } as never);

    await expect(adapter.getSnapshot()).resolves.toEqual(response);
    expect(rpc).toHaveBeenCalledWith("get_patient_portal_snapshot", {});
    expect(JSON.stringify(rpc.mock.calls[0])).not.toContain("patientId");
  });

  it("propaga errores del backend", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error("Forbidden") });
    const adapter = createPatientPortalAdapter({ rpc } as never);

    await expect(adapter.getSnapshot()).rejects.toThrow("Forbidden");
  });
});
