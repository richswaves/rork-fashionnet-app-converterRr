import createContextHook from "@nkzw/create-context-hook";
import { useQuery, useMutation } from "@tanstack/react-query";
import { sbSelect, sbUpsert } from "@/integrations/supabase/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

  useEffect(() => {
    AsyncStorage.getItem("current_user_id").then((id) => {
      if (id) setCurrentUserId(id);
    });
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
    enabled: !!currentUserId,
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

  const setUserId = useCallback(async (userId: string) => {
    await AsyncStorage.setItem("current_user_id", userId);
    setCurrentUserId(userId);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem("current_user_id");
    setCurrentUserId(undefined);
  }, []);

  return useMemo(() => ({
    currentUserId,
    profile: profileQuery.data ?? null,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
    updateProfile: updateProfileMutation.mutate,
    isUpdating: updateProfileMutation.isPending,
    setUserId,
    logout,
  }), [currentUserId, profileQuery.data, profileQuery.isLoading, profileQuery.error, updateProfileMutation.mutate, updateProfileMutation.isPending, setUserId, logout]);
});
