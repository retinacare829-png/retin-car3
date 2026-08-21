import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, publicEnv } from "./env";

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
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      organization_role: "clinic_admin" | "technical_staff" | "authorized_professional";
      organization_member_status: "active" | "invited" | "suspended";
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
