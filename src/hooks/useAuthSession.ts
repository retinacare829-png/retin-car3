import { useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { AuthService } from "../services/authService";

export interface UseAuthSessionResult {
  clientConfigured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuthSession(): UseAuthSessionResult {
  const service = useMemo(() => (supabase ? new AuthService(supabase) : null), []);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(service));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!service || !supabase) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    service
      .getState()
      .then((state) => {
        if (!mounted) {
          return;
        }
        setSession(state.session);
        setUser(state.user);
      })
      .catch((caught: unknown) => {
        if (mounted) {
          setError(caught instanceof Error ? caught.message : "No se pudo leer la sesion.");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [service]);

  return {
    clientConfigured: Boolean(service),
    loading,
    session,
    user,
    error,
    signIn: async (email, password) => {
      if (!service) {
        throw new Error("Supabase no esta configurado.");
      }
      await service.signIn(email, password);
    },
    resetPassword: async (email) => {
      if (!service) {
        throw new Error("Supabase no esta configurado.");
      }
      await service.resetPassword(email);
    },
    signOut: async () => {
      if (!service) {
        return;
      }
      await service.signOut();
    },
  };
}
