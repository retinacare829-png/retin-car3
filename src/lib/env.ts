import { z } from "zod";

const publicEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  VITE_SUPABASE_ANON_KEY: z.string().min(20).optional().or(z.literal("")),
  VITE_APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
});

const parsedEnv = publicEnvSchema.parse(import.meta.env);

export const publicEnv = {
  supabaseUrl: parsedEnv.VITE_SUPABASE_URL || null,
  supabaseAnonKey: parsedEnv.VITE_SUPABASE_ANON_KEY || null,
  appEnv: parsedEnv.VITE_APP_ENV,
};

export const isSupabaseConfigured = Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
