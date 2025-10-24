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

export type ResolvedProfile = {
  user_id?: string;
  displayName: string;
  username: string;
  avatarUrl: string;
};

function initialsAvatar(name: string | undefined): string {
  const safe = (name ?? "Member").trim() || "Member";
  const bg = "1f2937";
  const color = "e5e7eb";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(safe)}&background=${bg}&color=${color}&size=256&bold=true`;
}

function resolveFromSession(profile: Profile | null, session: any): ResolvedProfile {
  const md = session?.user?.user_metadata ?? session?.user?.app_metadata ?? {};
  const email: string | undefined = session?.user?.email ?? undefined;
  const avatarFromGoogle: string | undefined = md["avatar_url"] ?? md["picture"] ?? undefined;
  const fullNameFromAuth: string | undefined = md["full_name"] ?? md["name"] ?? undefined;
  const usernameFromEmail: string | undefined = email ? email.split("@")[0] : undefined;

  const displayName = (profile?.full_name ?? fullNameFromAuth ?? profile?.username ?? usernameFromEmail ?? "Member") as string;
  const username = (profile?.username ?? usernameFromEmail ?? (fullNameFromAuth ? fullNameFromAuth.replace(/\s+/g, "").toLowerCase() : undefined) ?? "member") as string;
  const avatarUrl = (profile?.profile_picture ?? avatarFromGoogle ?? initialsAvatar(profile?.full_name ?? fullNameFromAuth ?? username)) as string;

  return { user_id: profile?.user_id ?? session?.user?.id, displayName, username, avatarUrl };
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

  const resolved = useMemo<ResolvedProfile>(() => resolveFromSession(profileQuery.data ?? null, session), [profileQuery.data, session]);

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      if (!currentUserId) throw new Error("No user ID");

      const safeProfession = (updates.profession ?? profileQuery.data?.profession ?? "other") as string;
      const safeUsername = (updates.username ?? profileQuery.data?.username ?? resolved.username ?? "user") as string;
      const safeFullName = (updates.full_name ?? profileQuery.data?.full_name ?? resolved.displayName ?? safeUsername) as string;
      const safeLocation = (updates.location ?? profileQuery.data?.location ?? "") as string;

      const payload: Partial<Profile> = {
        user_id: currentUserId,
        full_name: safeFullName,
        username: safeUsername,
        profession: safeProfession,
        location: safeLocation,
        ...(updates.profile_picture !== undefined ? { profile_picture: updates.profile_picture } : {}),
        ...(updates.bio !== undefined ? { bio: updates.bio } : {}),
        ...(updates.professions !== undefined ? { professions: updates.professions } : {}),
        ...(updates.account_status !== undefined ? { account_status: updates.account_status } : {}),
      };

      await sbUpsert("profiles", payload, "user_id");
      return payload;
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

  const getDisplayForProfile = useCallback((p?: { user_id?: string; full_name?: string; username?: string; profile_picture?: string } | null) => {
    if (!p) return resolved;
    if (p.user_id && session?.user?.id && p.user_id === session.user.id) return resolved;

    const isGeneric = (val?: string) => {
      const v = (val ?? "").trim();
      return v.length === 0 || v.toLowerCase() === "member" || /^user[_-]/i.test(v);
    };

    const baseName = !isGeneric(p.full_name) ? p.full_name : undefined;
    const derivedUsername = p.username || (baseName ? baseName.replace(/\s+/g, "").toLowerCase() : undefined) || "user";
    const derivedDisplay = baseName || p.username || derivedUsername;
    const derivedAvatar = p.profile_picture || initialsAvatar(derivedDisplay || derivedUsername || "User");

    const displayName = String(derivedDisplay || "User");
    const username = String(derivedUsername || "user");
    const avatarUrl = String(derivedAvatar);

    return { user_id: p.user_id, displayName, username, avatarUrl } as ResolvedProfile;
  }, [resolved, session?.user?.id]);

  return useMemo(() => ({
    currentUserId,
    session,
    profile: profileQuery.data ?? null,
    resolvedProfile: resolved,
    getDisplayForProfile,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
    updateProfile: updateProfileMutation.mutate,
    updateProfileAsync: updateProfileMutation.mutateAsync,
    isUpdating: updateProfileMutation.isPending,
    login,
    logout,
  }), [currentUserId, session, profileQuery.data, resolved, getDisplayForProfile, profileQuery.isLoading, profileQuery.error, updateProfileMutation.mutate, updateProfileMutation.mutateAsync, updateProfileMutation.isPending, login, logout]);
});
