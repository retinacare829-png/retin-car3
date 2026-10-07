import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, publicEnv } from "./env";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type AuditAction =
  | "patient.created"
  | "patient.updated"
  | "patient.archived"
  | "patient.restored"
  | "screening.created"
  | "screening.updated"
  | "screening.closed"
  | "screening.deleted"
  | "retinal_image.uploaded"
  | "retinal_image.replaced"
  | "retinal_image.deleted"
  | "image_quality_review.recorded"
  | "professional_review.created"
  | "professional_review.updated"
  | "follow_up.created"
  | "follow_up.updated"
  | "referral.created"
  | "referral.updated";
type PatientTimelineEventType = AuditAction;
type ScreeningStatus =
  | "BORRADOR"
  | "CAPTURA_PENDIENTE"
  | "IMAGENES_COMPLETAS"
  | "PENDIENTE_REVISION"
  | "REVISADO"
  | "SEGUIMIENTO_REQUERIDO"
  | "CERRADO";
type RetinalImageLaterality = "OD" | "OI";
type RetinalImageStatus = "ACTIVA" | "REEMPLAZADA" | "ELIMINADA";
type ImageQualityStatus = "PENDIENTE" | "ADECUADA" | "INADECUADA";
type ImageQualityReason = "DESENFOQUE" | "REFLEJO" | "MALA_ILUMINACION" | "CAMPO_INCOMPLETO" | "MOVIMIENTO" | "OTRO";
type ProfessionalReviewStatus = "PENDIENTE_REVISION" | "EN_REVISION" | "REVISION_COMPLETADA" | "REQUIERE_RECAPTURA" | "SEGUIMIENTO_REQUERIDO" | "CERRADO";
type FollowUpType = "CONTROL_PROGRAMADO" | "REPETIR_ESTUDIO" | "REFERIR_OFTALMOLOGIA";
type FollowUpStatus = "SIN_SEGUIMIENTO" | "CONTROL_PROGRAMADO" | "REPETIR_ESTUDIO" | "REFERIR_OFTALMOLOGIA" | "SEGUIMIENTO_COMPLETADO" | "CANCELADO";
type ReferralStatus = "BORRADOR" | "SOLICITADA" | "EN_PROCESO" | "COMPLETADA" | "CANCELADA";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          legal_name: string | null;
          tax_identifier: string | null;
          country_code: string;
          timezone: string;
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          legal_name?: string | null;
          tax_identifier?: string | null;
          country_code?: string;
          timezone?: string;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          legal_name?: string | null;
          tax_identifier?: string | null;
          country_code?: string;
          timezone?: string;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          professional_license: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          professional_license?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          professional_license?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: "clinic_admin" | "technical_staff" | "authorized_professional";
          status: "active" | "invited" | "suspended";
          invited_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role: "clinic_admin" | "technical_staff" | "authorized_professional";
          status?: "active" | "invited" | "suspended";
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: "clinic_admin" | "technical_staff" | "authorized_professional";
          status?: "active" | "invited" | "suspended";
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      patients: {
        Row: {
          id: string;
          organization_id: string;
          internal_identifier: string;
          medical_record_code: string | null;
          first_names: string;
          last_names: string;
          date_of_birth: string;
          sex: "female" | "male" | "other" | "unknown";
          phone: string | null;
          diabetes_diagnosis_date: string | null;
          diabetes_type: "type_1" | "type_2" | "gestational" | "other" | "unknown";
          notes: string | null;
          created_by: string | null;
          updated_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          internal_identifier?: string;
          medical_record_code?: string | null;
          first_names: string;
          last_names: string;
          date_of_birth: string;
          sex?: "female" | "male" | "other" | "unknown";
          phone?: string | null;
          diabetes_diagnosis_date?: string | null;
          diabetes_type?: "type_1" | "type_2" | "gestational" | "other" | "unknown";
          notes?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          internal_identifier?: string;
          medical_record_code?: string | null;
          first_names?: string;
          last_names?: string;
          date_of_birth?: string;
          sex?: "female" | "male" | "other" | "unknown";
          phone?: string | null;
          diabetes_diagnosis_date?: string | null;
          diabetes_type?: "type_1" | "type_2" | "gestational" | "other" | "unknown";
          notes?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      screenings: {
        Row: {
          id: string;
          organization_id: string;
          patient_id: string;
          medical_record_code: string;
          status: ScreeningStatus;
          general_observations: string | null;
          assigned_reviewer_id: string | null;
          created_by: string | null;
          updated_by: string | null;
          closed_at: string | null;
          closed_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          patient_id: string;
          medical_record_code?: string;
          status?: ScreeningStatus;
          general_observations?: string | null;
          assigned_reviewer_id?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          patient_id?: string;
          medical_record_code?: string;
          status?: ScreeningStatus;
          general_observations?: string | null;
          assigned_reviewer_id?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      retinal_images: {
        Row: {
          id: string;
          organization_id: string;
          patient_id: string;
          screening_id: string;
          laterality: RetinalImageLaterality;
          captured_at: string;
          uploaded_by: string | null;
          original_file_name: string;
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          hash_sha256: string | null;
          status: RetinalImageStatus;
          replaced_by_image_id: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          patient_id: string;
          screening_id: string;
          laterality: RetinalImageLaterality;
          captured_at?: string;
          uploaded_by?: string | null;
          original_file_name: string;
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          hash_sha256?: string | null;
          status?: RetinalImageStatus;
          replaced_by_image_id?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          patient_id?: string;
          screening_id?: string;
          laterality?: RetinalImageLaterality;
          captured_at?: string;
          uploaded_by?: string | null;
          original_file_name?: string;
          storage_path?: string;
          mime_type?: string;
          size_bytes?: number;
          hash_sha256?: string | null;
          status?: RetinalImageStatus;
          replaced_by_image_id?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      image_quality_reviews: {
        Row: {
          id: string;
          organization_id: string;
          patient_id: string;
          screening_id: string;
          retinal_image_id: string;
          reviewer_user_id: string | null;
          quality_status: ImageQualityStatus;
          reasons: ImageQualityReason[];
          other_reason: string | null;
          suggestion: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          patient_id: string;
          screening_id: string;
          retinal_image_id: string;
          reviewer_user_id?: string | null;
          quality_status?: ImageQualityStatus;
          reasons?: ImageQualityReason[];
          other_reason?: string | null;
          suggestion?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          patient_id?: string;
          screening_id?: string;
          retinal_image_id?: string;
          reviewer_user_id?: string | null;
          quality_status?: ImageQualityStatus;
          reasons?: ImageQualityReason[];
          other_reason?: string | null;
          suggestion?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      professional_reviews: {
        Row: {
          id: string; organization_id: string; patient_id: string; screening_id: string;
          reviewer_user_id: string; review_status: ProfessionalReviewStatus; reviewed_at: string | null;
          structured_observations: Json; notes: string | null; created_at: string; updated_at: string;
          deleted_at: string | null; deleted_by: string | null;
        };
        Insert: {
          id?: string; organization_id: string; patient_id: string; screening_id: string;
          reviewer_user_id: string; review_status?: ProfessionalReviewStatus; reviewed_at?: string | null;
          structured_observations?: Json; notes?: string | null; created_at?: string; updated_at?: string;
          deleted_at?: string | null; deleted_by?: string | null;
        };
        Update: {
          id?: string; organization_id?: string; patient_id?: string; screening_id?: string;
          reviewer_user_id?: string; review_status?: ProfessionalReviewStatus; reviewed_at?: string | null;
          structured_observations?: Json; notes?: string | null; created_at?: string; updated_at?: string;
          deleted_at?: string | null; deleted_by?: string | null;
        };
        Relationships: [];
      };
      follow_ups: {
        Row: {
          id: string; organization_id: string; patient_id: string; screening_id: string; created_by: string;
          assigned_to: string | null; follow_up_type: FollowUpType; follow_up_status: FollowUpStatus;
          due_date: string | null; completed_at: string | null; notes: string | null; created_at: string;
          updated_at: string; deleted_at: string | null; deleted_by: string | null;
        };
        Insert: {
          id?: string; organization_id: string; patient_id: string; screening_id: string; created_by: string;
          assigned_to?: string | null; follow_up_type: FollowUpType; follow_up_status?: FollowUpStatus;
          due_date?: string | null; completed_at?: string | null; notes?: string | null; created_at?: string;
          updated_at?: string; deleted_at?: string | null; deleted_by?: string | null;
        };
        Update: {
          id?: string; organization_id?: string; patient_id?: string; screening_id?: string; created_by?: string;
          assigned_to?: string | null; follow_up_type?: FollowUpType; follow_up_status?: FollowUpStatus;
          due_date?: string | null; completed_at?: string | null; notes?: string | null; created_at?: string;
          updated_at?: string; deleted_at?: string | null; deleted_by?: string | null;
        };
        Relationships: [];
      };
      referrals: {
        Row: {
          id: string; organization_id: string; patient_id: string; screening_id: string; created_by: string;
          referral_reason: string; referral_destination: string; referral_status: ReferralStatus;
          requested_date: string; completed_date: string | null; notes: string | null; created_at: string;
          updated_at: string; deleted_at: string | null; deleted_by: string | null;
        };
        Insert: {
          id?: string; organization_id: string; patient_id: string; screening_id: string; created_by: string;
          referral_reason: string; referral_destination: string; referral_status?: ReferralStatus;
          requested_date?: string; completed_date?: string | null; notes?: string | null; created_at?: string;
          updated_at?: string; deleted_at?: string | null; deleted_by?: string | null;
        };
        Update: {
          id?: string; organization_id?: string; patient_id?: string; screening_id?: string; created_by?: string;
          referral_reason?: string; referral_destination?: string; referral_status?: ReferralStatus;
          requested_date?: string; completed_date?: string | null; notes?: string | null; created_at?: string;
          updated_at?: string; deleted_at?: string | null; deleted_by?: string | null;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string;
          actor_user_id: string | null;
          action: AuditAction;
          entity_type: string;
          entity_id: string;
          changed_fields: string[];
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          actor_user_id?: string | null;
          action: AuditAction;
          entity_type: string;
          entity_id: string;
          changed_fields?: string[];
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          actor_user_id?: string | null;
          action?: AuditAction;
          entity_type?: string;
          entity_id?: string;
          changed_fields?: string[];
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      patient_timeline_events: {
        Row: {
          id: string;
          organization_id: string;
          patient_id: string;
          event_type: PatientTimelineEventType;
          title: string;
          actor_user_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          patient_id: string;
          event_type: PatientTimelineEventType;
          title: string;
          actor_user_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          patient_id?: string;
          event_type?: PatientTimelineEventType;
          title?: string;
          actor_user_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      register_retinal_image: {
        Args: {
          target_organization_id: string;
          target_patient_id: string;
          target_screening_id: string;
          target_laterality: RetinalImageLaterality;
          target_original_file_name: string;
          target_storage_path: string;
          target_mime_type: string;
          target_size_bytes: number;
          target_hash_sha256?: string | null;
        };
        Returns: string;
      };
      close_screening_workflow: {
        Args: {
          target_organization_id: string;
          target_patient_id: string;
          target_screening_id: string;
        };
        Returns: undefined;
      };
      create_patient: {
        Args: {
          target_organization_id: string;
          target_first_names: string;
          target_last_names: string;
          target_date_of_birth: string;
          target_sex: "female" | "male" | "other" | "unknown";
          target_phone?: string | null;
          target_diabetes_diagnosis_date?: string | null;
          target_diabetes_type?: "type_1" | "type_2" | "gestational" | "other" | "unknown";
          target_notes?: string | null;
        };
        Returns: Database["public"]["Tables"]["patients"]["Row"];
      };
      can_generate_professional_reports: {
        Args: {
          target_organization_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      organization_role: "clinic_admin" | "technical_staff" | "authorized_professional";
      organization_member_status: "active" | "invited" | "suspended";
      patient_sex: "female" | "male" | "other" | "unknown";
      diabetes_type: "type_1" | "type_2" | "gestational" | "other" | "unknown";
      audit_action: AuditAction;
      patient_timeline_event_type: PatientTimelineEventType;
      screening_status: ScreeningStatus;
      retinal_image_laterality: RetinalImageLaterality;
      retinal_image_status: RetinalImageStatus;
      image_quality_status: ImageQualityStatus;
      image_quality_reason: ImageQualityReason;
      professional_review_status: ProfessionalReviewStatus;
      follow_up_type: FollowUpType;
      follow_up_status: FollowUpStatus;
      referral_status: ReferralStatus;
    };
  };
}

export type TypedSupabaseClient = SupabaseClient<Database>;

export const supabase: TypedSupabaseClient | null = isSupabaseConfigured
  ? createClient<Database>(publicEnv.supabaseUrl ?? "", publicEnv.supabaseAnonKey ?? "", {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "retinacare-beta-auth",
      },
    })
  : null;
