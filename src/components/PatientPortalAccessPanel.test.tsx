import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PatientPortalAccount } from "../domain/patientPortal";
import { PatientPortalAccessPanel } from "./PatientPortalAccessPanel";

const account: PatientPortalAccount = {
  id: "8e824437-0565-4025-91ef-1ff4abe31b22",
  organizationId: "10000000-0000-4000-8000-000000000001",
  patientId: "20000000-0000-4000-8000-000000000001",
  userId: "90000000-0000-4000-8000-000000000005",
  status: "active",
  createdBy: "90000000-0000-4000-8000-000000000002",
  revokedBy: null,
  createdAt: "2026-10-08T00:00:00.000Z",
  updatedAt: "2026-10-08T00:00:00.000Z",
  revokedAt: null,
};

describe("PatientPortalAccessPanel", () => {
  it("requires an Auth UUID and does not accept email authorization", () => {
    const onLink = vi.fn().mockResolvedValue(undefined);
    render(<PatientPortalAccessPanel account={null} disabled={false} loading={false} onLink={onLink} onRevoke={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("UUID de usuario Auth"), { target: { value: "patient@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Vincular cuenta" }));

    expect(screen.getByRole("alert")).toHaveTextContent("No se aceptan correos electrónicos");
    expect(onLink).not.toHaveBeenCalled();
  });

  it("shows the linked UUID and lets an admin revoke it", () => {
    const onRevoke = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    render(<PatientPortalAccessPanel account={account} disabled={false} loading={false} onLink={vi.fn()} onRevoke={onRevoke} />);

    expect(screen.getByText(account.userId)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revocar acceso" }));
    expect(onRevoke).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
