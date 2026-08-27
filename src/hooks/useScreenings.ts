import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { can } from "../domain/permissions";
import type {
  ImageQualityReviewInput,
  PatientTimelineEvent,
  RetinalImage,
  RetinalImageLaterality,
  Screening,
  ScreeningDetail,
  ScreeningFormData,
} from "../domain/screening";
import type { Role } from "../domain/roles";
import { supabase } from "../lib/supabase";
import { ScreeningService } from "../services/screeningService";

export interface UseScreeningsResult {
  screenings: ScreeningDetail[];
  timeline: PatientTimelineEvent[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  canReadScreenings: boolean;
  canCreateScreenings: boolean;
  canUpdateScreenings: boolean;
  canUploadImages: boolean;
  canDeleteImages: boolean;
  canRecordQuality: boolean;
  canDownloadImages: boolean;
  reload: () => Promise<void>;
  createScreening: (data: ScreeningFormData) => Promise<void>;
  updateScreening: (screening: Screening, data: ScreeningFormData) => Promise<void>;
  deleteScreening: (screening: Screening) => Promise<void>;
  uploadOrReplaceImage: (
    screening: Screening,
    laterality: RetinalImageLaterality,
    file: File,
  ) => Promise<void>;
  deleteImage: (image: RetinalImage) => Promise<void>;
  recordQualityReview: (image: RetinalImage, input: ImageQualityReviewInput) => Promise<void>;
  createSignedImageUrl: (image: RetinalImage) => Promise<string>;
}

export function useScreenings(
  organizationId: string | null,
  role: Role | null,
  user: User | null,
  patientId: string | null,
): UseScreeningsResult {
  const service = useMemo(() => (supabase ? new ScreeningService(supabase) : null), []);
  const [screenings, setScreenings] = useState<ScreeningDetail[]>([]);
  const [timeline, setTimeline] = useState<PatientTimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canReadScreenings = role ? can(role, "screenings:read") : false;
  const canCreateScreenings = role ? can(role, "screenings:create") : false;
  const canUpdateScreenings = role ? can(role, "screenings:update") || can(role, "screenings:review") : false;
  const canUploadImages = role ? can(role, "images:upload") : false;
  const canDeleteImages = role ? can(role, "images:delete") : false;
  const canRecordQuality = role ? can(role, "quality:record") : false;
  const canDownloadImages = role ? can(role, "images:download") : false;

  const reload = useCallback(async () => {
    if (!service || !organizationId || !patientId || !canReadScreenings) {
      setScreenings([]);
      setTimeline([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [nextScreenings, nextTimeline] = await Promise.all([
        service.listScreeningDetails({ organizationId, patientId, includeClosed: true }),
        service.listPatientTimeline({ organizationId, actorUserId: user?.id ?? "" }, patientId),
      ]);
      setScreenings(nextScreenings);
      setTimeline(nextTimeline);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los screenings.");
    } finally {
      setLoading(false);
    }
  }, [canReadScreenings, organizationId, patientId, service, user?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function mutate(operation: () => Promise<void>) {
    if (!service || !organizationId || !user) {
      throw new Error("No hay contexto de organizacion activo.");
    }

    setSaving(true);
    setError(null);
    try {
      await operation();
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el cambio.");
      throw caught;
    } finally {
      setSaving(false);
    }
  }

  return {
    screenings,
    timeline,
    loading,
    saving,
    error,
    canReadScreenings,
    canCreateScreenings,
    canUpdateScreenings,
    canUploadImages,
    canDeleteImages,
    canRecordQuality,
    canDownloadImages,
    reload,
    createScreening: async (data) =>
      mutate(async () => {
        if (!canCreateScreenings) {
          throw new Error("Su rol no permite crear screenings.");
        }
        await service?.createScreening({ organizationId: organizationId ?? "", actorUserId: user?.id ?? "" }, data);
      }),
    updateScreening: async (screening, data) =>
      mutate(async () => {
        if (!canUpdateScreenings) {
          throw new Error("Su rol no permite actualizar screenings.");
        }
        await service?.updateScreening(
          { organizationId: organizationId ?? "", actorUserId: user?.id ?? "" },
          screening,
          data,
        );
      }),
    deleteScreening: async (screening) =>
      mutate(async () => {
        if (!canDeleteImages) {
          throw new Error("Su rol no permite archivar screenings.");
        }
        await service?.deleteScreening({ organizationId: organizationId ?? "", actorUserId: user?.id ?? "" }, screening);
      }),
    uploadOrReplaceImage: async (screening, laterality, file) =>
      mutate(async () => {
        if (!canUploadImages) {
          throw new Error("Su rol no permite cargar imagenes.");
        }
        await service?.uploadOrReplaceImage(
          { organizationId: organizationId ?? "", actorUserId: user?.id ?? "" },
          { screeningId: screening.id, patientId: screening.patientId, laterality, file },
        );
      }),
    deleteImage: async (image) =>
      mutate(async () => {
        if (!canDeleteImages) {
          throw new Error("Su rol no permite eliminar imagenes.");
        }
        await service?.deleteImage({ organizationId: organizationId ?? "", actorUserId: user?.id ?? "" }, image);
      }),
    recordQualityReview: async (image, input) =>
      mutate(async () => {
        if (!canRecordQuality) {
          throw new Error("Su rol no permite registrar calidad.");
        }
        await service?.recordQualityReview(
          { organizationId: organizationId ?? "", actorUserId: user?.id ?? "" },
          image,
          input,
        );
      }),
    createSignedImageUrl: async (image) => {
      if (!service || !canDownloadImages) {
        throw new Error("Su rol no permite visualizar esta imagen.");
      }
      return service.createSignedImageUrl(image.storagePath);
    },
  };
}
