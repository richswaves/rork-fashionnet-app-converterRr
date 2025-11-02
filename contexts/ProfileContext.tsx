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
  is_profile_updated?: boolean;
  created_at?: string;
  suspended_at?: string;
  model_photos?: string[];
  portfolio_photos?: string[];
  profile_customization?: ProfileCustomization | null;
  social_links?: SocialLinks | null;
  instagram_website?: string;
  tiktok_link?: string;
  twitter_link?: string;
  youtube_link?: string;
  phone_number?: string;
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
  const fullNameFromAuth: string | undefined = md["display_name"] ?? md["full_name"] ?? md["name"] ?? undefined;
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
    staleTime: 30000,
    gcTime: 300000,
  });

  const resolved = useMemo<ResolvedProfile>(() => resolveFromSession(profileQuery.data ?? null, session), [profileQuery.data, session]);

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      const userId = currentUserId ?? session?.user?.id ?? (updates as any)?.user_id;
      if (!userId) {
        console.error("[ProfileContext] No currentUserId available. Session:", session);
        throw new Error("No user ID - please ensure you are logged in");
      }

      console.log("[ProfileContext] Starting profile update:", updates);
      const safeProfession = (updates.profession ?? profileQuery.data?.profession ?? "other") as string;
      const safeUsername = (updates.username ?? profileQuery.data?.username ?? resolved.username ?? "user") as string;
      const safeFullName = (updates.full_name ?? profileQuery.data?.full_name ?? resolved.displayName ?? safeUsername) as string;
      const safeLocation = (updates.location ?? profileQuery.data?.location ?? "") as string;
      const safeBio = (updates.bio ?? profileQuery.data?.bio ?? "") as string;

      const payload: Partial<Profile> = {
        user_id: userId,
        full_name: safeFullName,
        username: safeUsername,
        profession: safeProfession,
        location: safeLocation,
        bio: safeBio,
        ...(updates.profile_picture !== undefined ? { profile_picture: updates.profile_picture } : {}),
        ...(updates.professions !== undefined ? { professions: updates.professions } : {}),
        ...(updates.account_status !== undefined ? { account_status: updates.account_status } : {}),
        ...(updates.is_profile_updated !== undefined ? { is_profile_updated: updates.is_profile_updated } : {}),
        ...(updates.model_photos !== undefined ? { model_photos: updates.model_photos } : {}),
        ...(updates.portfolio_photos !== undefined ? { portfolio_photos: updates.portfolio_photos } : {}),
        ...(updates as any).profile_customization !== undefined ? { profile_customization: (updates as any).profile_customization as ProfileCustomization | null } : {},
        ...(updates.social_links !== undefined ? { social_links: updates.social_links } : {}),
        ...(updates.instagram_website !== undefined ? { instagram_website: updates.instagram_website } : {}),
        ...(updates.tiktok_link !== undefined ? { tiktok_link: updates.tiktok_link } : {}),
        ...(updates.twitter_link !== undefined ? { twitter_link: updates.twitter_link } : {}),
        ...(updates.youtube_link !== undefined ? { youtube_link: updates.youtube_link } : {}),
        ...((updates as any).phone_number !== undefined ? { phone_number: (updates as any).phone_number } : {}),
        ...((updates as any).custom_links !== undefined ? { custom_links: (updates as any).custom_links } : {}),
      };

      console.log("[ProfileContext] Upserting profile payload:", payload);
      const result = await sbUpsert("profiles", payload, "user_id");
      console.log("[ProfileContext] Upsert complete:", result);
      return payload;
    },
    onSuccess: async (data) => {
      console.log("[ProfileContext] Profile update successful, invalidating queries");
      await queryClient.invalidateQueries({ queryKey: ["profile", currentUserId] });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["opportunities"] });
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
    
    console.log("[Login] Attempting login for:", cleanedEmail);
    console.log("[Login] Email length:", cleanedEmail.length, "Password length:", cleanedPassword.length);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanedEmail,
        password: cleanedPassword,
      });

      if (error) {
        console.error("[Login] Supabase auth error:", error);
        console.error("[Login] Error details:", JSON.stringify(error, null, 2));
        
        const msg = typeof error.message === "string" ? error.message : "Login failed";
        
        if (msg.toLowerCase().includes("invalid login credentials")) {
          throw new Error("Invalid email or password. Please check your credentials and try again.");
        }
        
        if (msg.toLowerCase().includes("email not confirmed")) {
          throw new Error("Please confirm your email address before logging in. Check your inbox for a confirmation link.");
        }
        
        throw new Error(msg);
      }

      console.log("[Login] Login successful for user:", data.user?.id);
      return data;
    } catch (error: any) {
      console.error("[Login] Error during login:", error);
      
      const errorMsg = error?.message || String(error);
      
      if (errorMsg.includes("Failed to write value") || 
          errorMsg.includes("out of space") || 
          errorMsg.includes("NSCocoaErrorDomain Code=640") ||
          errorMsg.includes("No space left on device")) {
        throw new Error("Your device is out of storage space. Please free up some space in your device settings and try again.");
      }
      
      throw error;
    }
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

  const mutateProfile = updateProfileMutation.mutate;
  const mutateProfileAsync = updateProfileMutation.mutateAsync;

  const updateProfile = useCallback((updates: Partial<Profile>) => {
    mutateProfile(updates);
  }, [mutateProfile]);

  const updateProfileAsync = useCallback(async (updates: Partial<Profile>) => {
    return mutateProfileAsync(updates);
  }, [mutateProfileAsync]);

  return useMemo(() => ({
    currentUserId,
    session,
    profile: profileQuery.data ?? null,
    resolvedProfile: resolved,
    getDisplayForProfile,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
    updateProfile,
    updateProfileAsync,
    isUpdating: updateProfileMutation.isPending,
    login,
    logout,
  }), [currentUserId, session, profileQuery.data, resolved, getDisplayForProfile, profileQuery.isLoading, profileQuery.error, updateProfile, updateProfileAsync, updateProfileMutation.isPending, login, logout]);
});
