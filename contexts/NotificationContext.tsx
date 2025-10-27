import createContextHook from "@nkzw/create-context-hook";
import { useQuery } from "@tanstack/react-query";
import { sbSelect } from "@/integrations/supabase/client";
import { useEffect, useState, useMemo, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useProfile } from "./ProfileContext";

export const [NotificationProvider, useNotifications] = createContextHook(() => {
  const { currentUserId } = useProfile();
  const [lastViewedAt, setLastViewedAt] = useState<string | null>(null);

  useEffect(() => {
    const loadLastViewed = async () => {
      try {
        if (!currentUserId) return;
        const stored = await AsyncStorage.getItem(`notifications_last_viewed_${currentUserId}`);
        if (stored) {
          setLastViewedAt(stored);
        }
      } catch (e) {
        console.error("[Notifications] Failed to load last viewed time:", e);
      }
    };
    loadLastViewed();
  }, [currentUserId]);

  const { data: isAdmin } = useQuery<boolean>({
    queryKey: ["is-admin", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return false;
      const rows = await sbSelect<{ user_id: string; role: string }>("user_roles", {
        select: "user_id,role",
        query: { user_id: `eq.${currentUserId}`, role: "eq.admin" },
        limit: 1,
      });
      return (rows?.length ?? 0) > 0;
    },
    enabled: !!currentUserId,
  });

  const { data: notificationCount = 0, refetch: refetchUser } = useQuery<number>({
    queryKey: ["notification-count", currentUserId, lastViewedAt],
    queryFn: async () => {
      if (!currentUserId) return 0;
      
      const cutoffDate = lastViewedAt || new Date(0).toISOString();
      
      const follows = await sbSelect<{ id: string; created_at: string }>("follows", {
        select: "id,created_at",
        query: { following_id: `eq.${currentUserId}` },
        limit: 100,
      });
      
      const recentFollows = follows.filter(f => (f.created_at || "") > cutoffDate);
      
      const myOpps = await sbSelect<{ id: string }>("opportunities", {
        select: "id",
        query: { user_id: `eq.${currentUserId}` },
        limit: 200,
      });
      
      const oppIds = myOpps.map((o) => o.id);
      let appsCount = 0;
      
      if (oppIds.length > 0) {
        const idList = `in.(${oppIds.join(",")})`;
        const apps = await sbSelect<{ id: string; created_at: string }>("applications", {
          select: "id,created_at",
          query: { opportunity_id: idList },
          limit: 100,
        });
        const recentApps = apps.filter(a => (a.created_at || "") > cutoffDate);
        appsCount = recentApps.length;
      }
      
      const applicantNotifications = await sbSelect<{ id: string; read: boolean }>("applicant_notifications", {
        select: "id,read",
        query: { applicant_id: `eq.${currentUserId}`, read: "eq.false" },
        limit: 100,
      });
      
      const unreadApplicantNotifs = applicantNotifications.length;
      
      return recentFollows.length + appsCount + unreadApplicantNotifs;
    },
    enabled: !!currentUserId,
    refetchInterval: 30000,
  });

  const { data: adminNotificationCount = 0, refetch: refetchAdmin } = useQuery<number>({
    queryKey: ["admin-notification-count", lastViewedAt],
    queryFn: async () => {
      const cutoffDate = lastViewedAt || new Date(0).toISOString();
      
      const pendingProfiles = await sbSelect<{ user_id: string; created_at: string }>("profiles", {
        select: "user_id,created_at",
        query: { account_status: "eq.pending" },
        limit: 100,
      });
      
      const recentPending = pendingProfiles.filter(p => (p.created_at || "") > cutoffDate);
      return recentPending.length;
    },
    enabled: !!isAdmin,
    refetchInterval: 30000,
  });

  const markAsViewed = useCallback(async (type: "user" | "admin") => {
    const now = new Date().toISOString();
    setLastViewedAt(now);
    
    try {
      if (currentUserId) {
        await AsyncStorage.setItem(`notifications_last_viewed_${currentUserId}`, now);
      }
    } catch (e) {
      console.error("[Notifications] Failed to save last viewed time:", e);
    }

    setTimeout(() => {
      if (type === "user") {
        refetchUser();
      } else {
        refetchAdmin();
      }
    }, 100);
  }, [currentUserId, refetchUser, refetchAdmin]);

  const refetchAll = useCallback(() => {
    refetchUser();
    if (isAdmin) {
      refetchAdmin();
    }
  }, [refetchUser, refetchAdmin, isAdmin]);

  return useMemo(
    () => ({
      notificationCount,
      adminNotificationCount,
      isAdmin: isAdmin ?? false,
      markAsViewed,
      refetchAll,
    }),
    [notificationCount, adminNotificationCount, isAdmin, markAsViewed, refetchAll]
  );
});
