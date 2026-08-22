import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, publicEnv } from "./env";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
          medical_record_code: string;
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
          internal_identifier: string;
          medical_record_code: string;
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
          medical_record_code?: string;
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
      audit_logs: {
        Row: {
          id: string;
          organization_id: string;
          actor_user_id: string | null;
          action: "patient.created" | "patient.updated" | "patient.archived" | "patient.restored";
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
          action: "patient.created" | "patient.updated" | "patient.archived" | "patient.restored";
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
          action?: "patient.created" | "patient.updated" | "patient.archived" | "patient.restored";
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
          event_type: "patient.created" | "patient.updated" | "patient.archived" | "patient.restored";
          title: string;
          actor_user_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          patient_id: string;
          event_type: "patient.created" | "patient.updated" | "patient.archived" | "patient.restored";
          title: string;
          actor_user_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          patient_id?: string;
          event_type?: "patient.created" | "patient.updated" | "patient.archived" | "patient.restored";
          title?: string;
          actor_user_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      organization_role: "clinic_admin" | "technical_staff" | "authorized_professional";
      organization_member_status: "active" | "invited" | "suspended";
      patient_sex: "female" | "male" | "other" | "unknown";
      diabetes_type: "type_1" | "type_2" | "gestational" | "other" | "unknown";
      audit_action: "patient.created" | "patient.updated" | "patient.archived" | "patient.restored";
      patient_timeline_event_type: "patient.created" | "patient.updated" | "patient.archived" | "patient.restored";
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
