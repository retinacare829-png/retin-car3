import type { Session, User } from "@supabase/supabase-js";
import type { TypedSupabaseClient } from "../lib/supabase";

export interface AuthState {
  session: Session | null;
  user: User | null;
}

export class AuthService {
  constructor(private readonly client: TypedSupabaseClient) {}

  async getState(): Promise<AuthState> {
    const { data, error } = await this.client.auth.getSession();
    if (error) {
      throw error;
    }

    return {
      session: data.session,
      user: data.session?.user ?? null,
    };
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
  }

  async resetPassword(email: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email);
    if (error) {
      throw error;
    }
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw error;
    }
  }
}
