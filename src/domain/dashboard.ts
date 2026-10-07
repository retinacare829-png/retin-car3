export interface DashboardMonth { key: string; label: string; total: number; }
export interface DashboardStatus { status: string; label: string; total: number; }
export interface DashboardActivity { id: string; title: string; occurredAt: string; }
export interface DashboardAgendaItem { id: string; title: string; detail: string; occurredAt: string; priority: "normal" | "high"; }
export interface DashboardAppointment { id: string; date: string; title: string; detail: string; status: string; }

export interface DashboardData {
  totals: { patients: number; screenings: number; pending: number; reviewed: number; followUps: number };
  today: { pendingScreenings: number; scheduledFollowUps: number; pendingReviews: number; newPatients: number };
  screeningsByMonth: DashboardMonth[];
  statusDistribution: DashboardStatus[];
  recentActivity: DashboardActivity[];
  agenda: DashboardAgendaItem[];
  appointments: DashboardAppointment[];
}

export const emptyDashboardData: DashboardData = {
  totals: { patients: 0, screenings: 0, pending: 0, reviewed: 0, followUps: 0 },
  today: { pendingScreenings: 0, scheduledFollowUps: 0, pendingReviews: 0, newPatients: 0 },
  screeningsByMonth: [], statusDistribution: [], recentActivity: [], agenda: [], appointments: [],
};
