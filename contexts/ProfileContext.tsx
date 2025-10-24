import createContextHook from "@nkzw/create-context-hook";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sbSelect, sbUpsert, getSupabase } from "@/integrations/supabase/client";
import { useEffect, useState, useMemo, useCallback } from "react";

interface ProfileCustomization {
  backgroundType?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundImageAdjustments?: { positionX?: number; positionY?: number };
  theme?: string;
  typographyColor?: string;
}

interface SocialLinks {
  instagram?: string;
  youtube?: string;
  twitter?: string;
  tiktok?: string;
}

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
  model_photos?: string[];
  portfolio_photos?: string[];
  profile_customization?: ProfileCustomization | null;
  social_links?: SocialLinks | null;
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
  const queryClient = useQueryClient();
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

      console.log("[ProfileContext] Starting profile update:", updates);
      const safeProfession = (updates.profession ?? profileQuery.data?.profession ?? "other") as string;
      const safeUsername = (updates.username ?? profileQuery.data?.username ?? resolved.username ?? "user") as string;
      const safeFullName = (updates.full_name ?? profileQuery.data?.full_name ?? resolved.displayName ?? safeUsername) as string;
      const safeLocation = (updates.location ?? profileQuery.data?.location ?? "") as string;
      const safeBio = (updates.bio ?? profileQuery.data?.bio ?? "") as string;

      const payload: Partial<Profile> = {
        user_id: currentUserId,
        full_name: safeFullName,
        username: safeUsername,
        profession: safeProfession,
        location: safeLocation,
        bio: safeBio,
        ...(updates.profile_picture !== undefined ? { profile_picture: updates.profile_picture } : {}),
        ...(updates.professions !== undefined ? { professions: updates.professions } : {}),
        ...(updates.account_status !== undefined ? { account_status: updates.account_status } : {}),
        ...(updates.model_photos !== undefined ? { model_photos: updates.model_photos } : {}),
        ...(updates.portfolio_photos !== undefined ? { portfolio_photos: updates.portfolio_photos } : {}),
        ...(updates as any).profile_customization !== undefined ? { profile_customization: (updates as any).profile_customization as ProfileCustomization | null } : {},
        ...(updates.social_links !== undefined ? { social_links: updates.social_links } : {}),
      };

      console.log("[ProfileContext] Upserting profile payload:", payload);
      const result = await sbUpsert("profiles", payload, "user_id");
      console.log("[ProfileContext] Upsert complete:", result);
      return payload;
    },
    onSuccess: (data) => {
      console.log("[ProfileContext] Profile update successful, invalidating queries");
      queryClient.invalidateQueries({ queryKey: ["profile", currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      profileQuery.refetch();
    },
    onError: (error) => {
      console.error("[ProfileContext] Profile update failed:", error);
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

    const hasUsername = p.username && p.username.trim().length > 0 && !p.username.startsWith("user_");
    const hasFullName = p.full_name && p.full_name.trim().length > 0;
    
    const derivedDisplay = hasFullName ? p.full_name : (hasUsername ? p.username : "User");
    const derivedUsername = hasUsername ? p.username : (hasFullName ? p.full_name!.replace(/\s+/g, "").toLowerCase() : p.user_id || "user");
    const derivedAvatar = p.profile_picture || initialsAvatar(derivedDisplay || "User");

    const displayName = String(derivedDisplay);
    const username = String(derivedUsername);
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
