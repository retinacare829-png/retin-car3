import { professionalReviewStatusLabels, followUpStatusLabels, referralStatusLabels } from "../domain/clinicalWorkflow";
import { screeningStatusLabels } from "../domain/screening";
import type { ReportCandidate } from "../domain/report";
import type { Role } from "../domain/roles";
import type { ReportsAdapter, ReportsQuery, ReportsSnapshot, ScreeningReportRow } from "../hooks/useReports";
import type { TypedSupabaseClient } from "../lib/supabase";
import { ReportService } from "./reportService";

function todayKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function matchesStatus(candidate: ReportCandidate, status: ReportsQuery["filters"]["status"]) {
  switch (status) {
    case "pending": return ["BORRADOR", "CAPTURA_PENDIENTE", "IMAGENES_COMPLETAS"].includes(candidate.screeningStatus);
    case "in_review": return candidate.screeningStatus === "PENDIENTE_REVISION";
    case "completed": return ["REVISADO", "CERRADO"].includes(candidate.screeningStatus);
    case "follow_up": return candidate.screeningStatus === "SEGUIMIENTO_REQUERIDO";
    default: return true;
  }
}

export function createReportsAdapter(client: TypedSupabaseClient, role: Role, actorUserId: string): ReportsAdapter {
  const service = new ReportService(client);

  return {
    async getSnapshot({ organizationId, filters }): Promise<ReportsSnapshot> {
      const from = filters.from || "2000-01-01";
      const to = filters.to || todayKey();
      const [allCandidates, operational] = await Promise.all([
        service.listCandidates({ organizationId, createdFrom: filters.from || undefined, createdTo: filters.to || undefined }, role),
        service.getOperationalSummary({ organizationId, from, to }, role, actorUserId),
      ]);

      const search = filters.query.trim().toLocaleLowerCase("es-NI");
      const candidates = allCandidates.filter((candidate) =>
        matchesStatus(candidate, filters.status)
        && (!search || `${candidate.patientName} ${candidate.internalIdentifier}`.toLocaleLowerCase("es-NI").includes(search))
      );
      const screeningIds = candidates.map((candidate) => candidate.screeningId);
      const [imagesResult, reviewsResult, followUpsResult, referralsResult] = screeningIds.length
        ? await Promise.all([
          client.from("retinal_images").select("id, screening_id, laterality").eq("organization_id", organizationId).in("screening_id", screeningIds).eq("status", "ACTIVA").is("deleted_at", null),
          client.from("professional_reviews").select("screening_id, review_status, created_at").eq("organization_id", organizationId).in("screening_id", screeningIds).is("deleted_at", null).order("created_at", { ascending: false }),
          client.from("follow_ups").select("screening_id, follow_up_status, created_at").eq("organization_id", organizationId).in("screening_id", screeningIds).is("deleted_at", null).order("created_at", { ascending: false }),
          client.from("referrals").select("screening_id, referral_status, created_at").eq("organization_id", organizationId).in("screening_id", screeningIds).is("deleted_at", null).order("created_at", { ascending: false }),
        ])
        : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
      for (const result of [imagesResult, reviewsResult, followUpsResult, referralsResult]) {
        if (result.error) throw result.error;
      }

      const images = imagesResult.data ?? [];
      const imageIds = images.map((image) => image.id);
      const qualityResult = imageIds.length
        ? await client.from("image_quality_reviews").select("retinal_image_id, quality_status, created_at").eq("organization_id", organizationId).in("retinal_image_id", imageIds).order("created_at", { ascending: false })
        : { data: [], error: null };
      if (qualityResult.error) throw qualityResult.error;

      const qualityByImage = new Map<string, string>();
      for (const item of qualityResult.data ?? []) {
        if (!qualityByImage.has(item.retinal_image_id)) qualityByImage.set(item.retinal_image_id, item.quality_status);
      }

      const screeningRows: ScreeningReportRow[] = candidates.map((candidate) => {
        const screeningImages = images.filter((image) => image.screening_id === candidate.screeningId);
        const qualityStatuses = screeningImages.map((image) => qualityByImage.get(image.id));
        const qualityLabel = screeningImages.length === 0 ? "Sin imagen"
          : qualityStatuses.includes("INADECUADA") ? "Inadecuada"
          : qualityStatuses.every((status) => status === "ADECUADA") ? "Adecuada" : "Pendiente";
        const review = (reviewsResult.data ?? []).find((item) => item.screening_id === candidate.screeningId);
        const followUp = (followUpsResult.data ?? []).find((item) => item.screening_id === candidate.screeningId);
        const referral = (referralsResult.data ?? []).find((item) => item.screening_id === candidate.screeningId);
        return {
          id: candidate.screeningId,
          patientName: candidate.patientName,
          patientIdentifier: candidate.internalIdentifier,
          createdAt: candidate.createdAt,
          statusLabel: screeningStatusLabels[candidate.screeningStatus],
          qualityLabel,
          reviewLabel: review ? professionalReviewStatusLabels[review.review_status] : "Sin revisión",
          followUpLabel: followUp ? followUpStatusLabels[followUp.follow_up_status] : "Sin seguimiento",
          referenceLabel: referral ? referralStatusLabels[referral.referral_status] : "Sin referencia",
          odAvailable: screeningImages.some((image) => image.laterality === "OD"),
          oiAvailable: screeningImages.some((image) => image.laterality === "OI"),
        };
      });

      const patientMap = new Map<string, ReportsSnapshot["patientRows"][number]>();
      for (const candidate of candidates) {
        const current = patientMap.get(candidate.patientId);
        const followUps = (followUpsResult.data ?? []).filter((item) => item.screening_id === candidate.screeningId).length;
        if (current) {
          current.screenings += 1;
          current.followUps += followUps;
        } else {
          patientMap.set(candidate.patientId, {
            id: candidate.patientId,
            patientName: candidate.patientName,
            identifier: candidate.internalIdentifier,
            screenings: 1,
            lastActivityAt: candidate.createdAt,
            lastStatusLabel: screeningStatusLabels[candidate.screeningStatus],
            followUps,
          });
        }
      }

      const metric = (id: string, label: string, value: number) => ({ id, label, value, detail: "En el rango de fechas seleccionado" });
      return {
        generatedAt: operational.generatedAt,
        patientRows: [...patientMap.values()],
        screeningRows,
        operationMetrics: [
          metric("new-patients", "Pacientes nuevos", operational.totals.newPatients),
          metric("screenings", "Screenings", operational.totals.screenings),
          metric("completed", "Screenings revisados o cerrados", operational.totals.completedScreenings),
          metric("reviews", "Revisiones pendientes", operational.totals.pendingReviews),
          metric("follow-ups", "Seguimientos activos", operational.totals.activeFollowUps),
          metric("referrals", "Referencias activas", operational.totals.activeReferrals),
        ],
      };
    },
  };
}
