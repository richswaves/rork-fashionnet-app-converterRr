import createContextHook from "@nkzw/create-context-hook";
import { useQuery, useMutation } from "@tanstack/react-query";
import { sbSelect, sbUpsert, getSupabase } from "@/integrations/supabase/client";
import { useEffect, useState, useMemo, useCallback } from "react";

interface Profile {
  user_id: string;
  full_name?: string;
  username?: string;
  profile_picture?: string;
  profession?: string;
  professions?: string[];
  location?: string;
  bio?: string;
  account_status?: string;
  created_at?: string;
}

export const [ProfileProvider, useProfile] = createContextHook(() => {
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      console.warn("Supabase is not configured; auth disabled.");
      setSession(null);
      setCurrentUserId(undefined);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        setCurrentUserId(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) {
        setCurrentUserId(session.user.id);
      } else {
        setCurrentUserId(undefined);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const profileQuery = useQuery<Profile | null>({
    queryKey: ["profile", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return null;
      const rows = await sbSelect<Profile>("profiles", {
        select: "*",
        query: { user_id: `eq.${currentUserId}` },
        limit: 1,
      });
      return rows[0] ?? null;
    },
    enabled: !!currentUserId && !!getSupabase(),
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      if (!currentUserId) throw new Error("No user ID");
      const updated = { ...updates, user_id: currentUserId };
      await sbUpsert("profiles", updated, "user_id");
      return updated;
    },
    onSuccess: () => {
      profileQuery.refetch();
    },
  });

  const login = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in app settings.");

    const cleanedEmail = String(email ?? "").trim().toLowerCase();
    const cleanedPassword = String(password ?? "").trim();
    console.log("Attempting login for", cleanedEmail);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanedEmail,
      password: cleanedPassword,
    });

    if (error) {
      const msg = typeof error.message === "string" ? error.message : "Login failed";
      if (msg.toLowerCase().includes("invalid login credentials")) {
        throw new Error("Invalid login credentials");
      }
      throw error;
    }

    return data;
  }, []);

  const logout = useCallback(async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setCurrentUserId(undefined);
    setSession(null);
  }, []);

  return useMemo(() => ({
    currentUserId,
    session,
    profile: profileQuery.data ?? null,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
    updateProfile: updateProfileMutation.mutate,
    isUpdating: updateProfileMutation.isPending,
    login,
    logout,
  }), [currentUserId, session, profileQuery.data, profileQuery.isLoading, profileQuery.error, updateProfileMutation.mutate, updateProfileMutation.isPending, login, logout]);
});
