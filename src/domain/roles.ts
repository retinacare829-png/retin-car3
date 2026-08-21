export const roles = ["clinic_admin", "technical_staff", "authorized_professional"] as const;

export type Role = (typeof roles)[number];

export const roleLabels: Record<Role, string> = {
  clinic_admin: "Administrador de clinica",
  technical_staff: "Personal tecnico",
  authorized_professional: "Profesional autorizado",
};
