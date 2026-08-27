import {
  getChangedScreeningFields,
  getQualitySuggestion,
  imageQualityReviewSchema,
  retinalImageMetadataSchema,
  screeningFormSchema,
  type ImageQualityReview,
  type ImageQualityReviewInput,
  type PatientTimelineEvent,
  type RetinalImage,
  type RetinalImageLaterality,
  type Screening,
  type ScreeningDetail,
  type ScreeningFormData,
} from "../domain/screening";
import type { Database, TypedSupabaseClient } from "../lib/supabase";

const RETINAL_IMAGE_BUCKET = "retinal-images-private";

type AuditAction = Database["public"]["Enums"]["audit_action"];
type JsonObject = { [key: string]: string | number | boolean | null };
type ScreeningRow = Database["public"]["Tables"]["screenings"]["Row"];
type RetinalImageRow = Database["public"]["Tables"]["retinal_images"]["Row"];
type ImageQualityReviewRow = Database["public"]["Tables"]["image_quality_reviews"]["Row"];
type TimelineEventRow = Database["public"]["Tables"]["patient_timeline_events"]["Row"];

export interface ScreeningMutationContext {
  organizationId: string;
  actorUserId: string;
}

export interface ScreeningListOptions {
  organizationId: string;
  patientId?: string;
  includeClosed?: boolean;
}

export interface ImageUploadInput {
  screeningId: string;
  patientId: string;
  laterality: RetinalImageLaterality;
  file: File;
}

export class ScreeningService {
  constructor(private readonly client: TypedSupabaseClient) {}

  async listScreeningDetails(options: ScreeningListOptions): Promise<ScreeningDetail[]> {
    let query = this.client
      .from("screenings")
      .select("*")
      .eq("organization_id", options.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (options.patientId) {
      query = query.eq("patient_id", options.patientId);
    }

    if (!options.includeClosed) {
      query = query.neq("status", "CERRADO");
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const screenings = (data ?? []).map(mapScreeningRow);
    if (screenings.length === 0) {
      return [];
    }

    const screeningIds = screenings.map((screening) => screening.id);
    const [{ data: imageRows, error: imageError }, { data: reviewRows, error: reviewError }] = await Promise.all([
      this.client
        .from("retinal_images")
        .select("*")
        .eq("organization_id", options.organizationId)
        .in("screening_id", screeningIds)
        .order("created_at", { ascending: false }),
      this.client
        .from("image_quality_reviews")
        .select("*")
        .eq("organization_id", options.organizationId)
        .in("screening_id", screeningIds)
        .order("created_at", { ascending: false }),
    ]);

    if (imageError) {
      throw imageError;
    }

    if (reviewError) {
      throw reviewError;
    }

    const images = (imageRows ?? []).map(mapRetinalImageRow);
    const reviews = (reviewRows ?? []).map(mapImageQualityReviewRow);

    return screenings.map((screening) => ({
      ...screening,
      images: images.filter((image) => image.screeningId === screening.id && image.status === "ACTIVA" && !image.deletedAt),
      qualityReviews: reviews.filter((review) => review.screeningId === screening.id),
    }));
  }

  async listPatientTimeline(context: ScreeningMutationContext, patientId: string): Promise<PatientTimelineEvent[]> {
    const { data, error } = await this.client
      .from("patient_timeline_events")
      .select("*")
      .eq("organization_id", context.organizationId)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []).map(mapTimelineEventRow);
  }

  async createScreening(context: ScreeningMutationContext, formData: ScreeningFormData): Promise<Screening> {
    const data = screeningFormSchema.parse(formData);
    const { data: inserted, error } = await this.client
      .from("screenings")
      .insert({
        organization_id: context.organizationId,
        patient_id: data.patientId,
        status: data.status,
        general_observations: data.generalObservations,
        assigned_reviewer_id: data.assignedReviewerId,
        created_by: context.actorUserId,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const screening = mapScreeningRow(inserted);
    await this.recordChange(context, screening.patientId, "screening.created", "screening", screening.id, ["created"], {
      status: screening.status,
    });
    return screening;
  }

  async updateScreening(
    context: ScreeningMutationContext,
    screening: Screening,
    formData: ScreeningFormData,
  ): Promise<Screening> {
    const data = screeningFormSchema.parse(formData);
    const changedFields = getChangedScreeningFields(screening, data);

    const { data: updated, error } = await this.client
      .from("screenings")
      .update({
        patient_id: data.patientId,
        status: data.status,
        general_observations: data.generalObservations,
        assigned_reviewer_id: data.assignedReviewerId,
        updated_by: context.actorUserId,
        closed_at: data.status === "CERRADO" ? new Date().toISOString() : screening.closedAt,
        closed_by: data.status === "CERRADO" ? context.actorUserId : screening.closedBy,
      })
      .eq("id", screening.id)
      .eq("organization_id", context.organizationId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const mapped = mapScreeningRow(updated);
    if (changedFields.length > 0) {
      await this.recordChange(
        context,
        mapped.patientId,
        mapped.status === "CERRADO" ? "screening.closed" : "screening.updated",
        "screening",
        mapped.id,
        changedFields,
        { changed_fields_count: changedFields.length, status: mapped.status },
      );
    }

    return mapped;
  }

  async deleteScreening(context: ScreeningMutationContext, screening: Screening): Promise<void> {
    const { error } = await this.client
      .from("screenings")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: context.actorUserId,
        updated_by: context.actorUserId,
      })
      .eq("id", screening.id)
      .eq("organization_id", context.organizationId);

    if (error) {
      throw error;
    }

    await this.recordChange(context, screening.patientId, "screening.deleted", "screening", screening.id, ["deletedAt"], {
      status: screening.status,
    });
  }

  async uploadOrReplaceImage(context: ScreeningMutationContext, input: ImageUploadInput): Promise<RetinalImage> {
    const hashSha256 = await hashFileSha256(input.file);
    const storagePath = buildStoragePath(context.organizationId, input.patientId, input.screeningId, input.laterality, input.file.name);
    const metadata = retinalImageMetadataSchema.parse({
      screeningId: input.screeningId,
      patientId: input.patientId,
      laterality: input.laterality,
      originalFileName: input.file.name,
      storagePath,
      mimeType: input.file.type || "application/octet-stream",
      sizeBytes: input.file.size,
      hashSha256,
    });

    const { error: uploadError } = await this.client.storage
      .from(RETINAL_IMAGE_BUCKET)
      .upload(storagePath, input.file, {
        cacheControl: "3600",
        contentType: metadata.mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const existing = await this.getActiveImage(context.organizationId, input.screeningId, input.laterality);
    const { data: inserted, error } = await this.client
      .from("retinal_images")
      .insert({
        organization_id: context.organizationId,
        patient_id: metadata.patientId,
        screening_id: metadata.screeningId,
        laterality: metadata.laterality,
        uploaded_by: context.actorUserId,
        original_file_name: metadata.originalFileName,
        storage_path: metadata.storagePath,
        mime_type: metadata.mimeType,
        size_bytes: metadata.sizeBytes,
        hash_sha256: metadata.hashSha256 ?? null,
        status: "ACTIVA",
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const image = mapRetinalImageRow(inserted);
    if (existing) {
      await this.markImageReplaced(context, existing, image.id);
    }

    await this.recordChange(
      context,
      input.patientId,
      existing ? "retinal_image.replaced" : "retinal_image.uploaded",
      "retinal_image",
      image.id,
      existing ? ["storagePath", "status"] : ["created"],
      { laterality: input.laterality, size_bytes: input.file.size },
    );

    return image;
  }

  async deleteImage(context: ScreeningMutationContext, image: RetinalImage): Promise<void> {
    const { error } = await this.client
      .from("retinal_images")
      .update({
        status: "ELIMINADA",
        deleted_at: new Date().toISOString(),
        deleted_by: context.actorUserId,
      })
      .eq("id", image.id)
      .eq("organization_id", context.organizationId);

    if (error) {
      throw error;
    }

    await this.recordChange(context, image.patientId, "retinal_image.deleted", "retinal_image", image.id, ["status"], {
      laterality: image.laterality,
    });
  }

  async recordQualityReview(
    context: ScreeningMutationContext,
    image: RetinalImage,
    input: ImageQualityReviewInput,
  ): Promise<ImageQualityReview> {
    const data = imageQualityReviewSchema.parse(input);
    const suggestion = getQualitySuggestion(data.qualityStatus);
    const { data: saved, error } = await this.client
      .from("image_quality_reviews")
      .upsert(
        {
          organization_id: context.organizationId,
          patient_id: image.patientId,
          screening_id: image.screeningId,
          retinal_image_id: data.retinalImageId,
          reviewer_user_id: context.actorUserId,
          quality_status: data.qualityStatus,
          reasons: data.reasons,
          other_reason: data.otherReason,
          suggestion,
        },
        { onConflict: "retinal_image_id" },
      )
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const review = mapImageQualityReviewRow(saved);
    await this.recordChange(
      context,
      image.patientId,
      "image_quality_review.recorded",
      "image_quality_review",
      review.id,
      ["qualityStatus", "reasons"],
      { laterality: image.laterality, quality_status: review.qualityStatus },
    );
    return review;
  }

  async createSignedImageUrl(storagePath: string, expiresInSeconds = 300): Promise<string> {
    const { data, error } = await this.client.storage
      .from(RETINAL_IMAGE_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) {
      throw error;
    }

    return data.signedUrl;
  }

  private async getActiveImage(
    organizationId: string,
    screeningId: string,
    laterality: RetinalImageLaterality,
  ): Promise<RetinalImage | null> {
    const { data, error } = await this.client
      .from("retinal_images")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("screening_id", screeningId)
      .eq("laterality", laterality)
      .eq("status", "ACTIVA")
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapRetinalImageRow(data) : null;
  }

  private async markImageReplaced(
    context: ScreeningMutationContext,
    previousImage: RetinalImage,
    replacementImageId: string,
  ): Promise<void> {
    const { error } = await this.client
      .from("retinal_images")
      .update({
        status: "REEMPLAZADA",
        replaced_by_image_id: replacementImageId,
        deleted_at: new Date().toISOString(),
        deleted_by: context.actorUserId,
      })
      .eq("id", previousImage.id)
      .eq("organization_id", context.organizationId);

    if (error) {
      throw error;
    }
  }

  private async recordChange(
    context: ScreeningMutationContext,
    patientId: string,
    action: AuditAction,
    entityType: string,
    entityId: string,
    changedFields: string[],
    metadata: JsonObject,
  ): Promise<void> {
    const timelineTitle = timelineTitleByAction[action] ?? "Evento de screening";
    const [{ error: auditError }, { error: timelineError }] = await Promise.all([
      this.client.from("audit_logs").insert({
        organization_id: context.organizationId,
        actor_user_id: context.actorUserId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        changed_fields: changedFields,
        metadata,
      }),
      this.client.from("patient_timeline_events").insert({
        organization_id: context.organizationId,
        patient_id: patientId,
        event_type: action,
        title: timelineTitle,
        actor_user_id: context.actorUserId,
        metadata,
      }),
    ]);

    if (auditError) {
      throw auditError;
    }

    if (timelineError) {
      throw timelineError;
    }
  }
}

const timelineTitleByAction: Record<AuditAction, string> = {
  "patient.created": "Paciente registrado",
  "patient.updated": "Ficha actualizada",
  "patient.archived": "Ficha archivada",
  "patient.restored": "Ficha restaurada",
  "screening.created": "Screening creado",
  "screening.updated": "Screening actualizado",
  "screening.closed": "Screening cerrado",
  "screening.deleted": "Screening archivado",
  "retinal_image.uploaded": "Imagen cargada",
  "retinal_image.replaced": "Imagen reemplazada",
  "retinal_image.deleted": "Imagen eliminada",
  "image_quality_review.recorded": "Calidad registrada",
};

function mapScreeningRow(row: ScreeningRow): Screening {
  return {
    id: row.id,
    organizationId: row.organization_id,
    patientId: row.patient_id,
    status: row.status,
    generalObservations: row.general_observations,
    assignedReviewerId: row.assigned_reviewer_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRetinalImageRow(row: RetinalImageRow): RetinalImage {
  return {
    id: row.id,
    organizationId: row.organization_id,
    patientId: row.patient_id,
    screeningId: row.screening_id,
    laterality: row.laterality,
    capturedAt: row.captured_at,
    uploadedBy: row.uploaded_by,
    originalFileName: row.original_file_name,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    hashSha256: row.hash_sha256,
    status: row.status,
    replacedByImageId: row.replaced_by_image_id,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapImageQualityReviewRow(row: ImageQualityReviewRow): ImageQualityReview {
  return {
    id: row.id,
    organizationId: row.organization_id,
    patientId: row.patient_id,
    screeningId: row.screening_id,
    retinalImageId: row.retinal_image_id,
    reviewerUserId: row.reviewer_user_id,
    qualityStatus: row.quality_status,
    reasons: row.reasons,
    otherReason: row.other_reason,
    suggestion: row.suggestion,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTimelineEventRow(row: TimelineEventRow): PatientTimelineEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    patientId: row.patient_id,
    eventType: row.event_type,
    title: row.title,
    actorUserId: row.actor_user_id,
    metadata: typeof row.metadata === "object" && row.metadata !== null && !Array.isArray(row.metadata) ? row.metadata : {},
    createdAt: row.created_at,
  };
}

async function hashFileSha256(file: File): Promise<string | null> {
  if (!globalThis.crypto?.subtle) {
    return null;
  }

  const buffer = await file.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function buildStoragePath(
  organizationId: string,
  patientId: string,
  screeningId: string,
  laterality: RetinalImageLaterality,
  originalFileName: string,
): string {
  const extension = originalFileName.split(".").pop()?.toLocaleLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `${organizationId}/${patientId}/${screeningId}/${laterality}/${Date.now()}.${extension}`;
}
