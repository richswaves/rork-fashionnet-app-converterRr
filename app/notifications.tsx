import React, { useState, useMemo, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { X, UserPlus, FileCheck, Clock } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { sbSelect } from "@/integrations/supabase/client";
import { useProfile } from "@/contexts/ProfileContext";
import { useNotifications } from "@/contexts/NotificationContext";

interface ProfileRow {
  user_id: string;
  full_name?: string;
  profile_picture?: string;
  username?: string;
}

interface FollowNotification {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
  profiles?: ProfileRow;
}

interface ApplicationNotification {
  id: string;
  opportunity_id: string;
  applicant_id: string;
  created_at: string;
  opportunities?: {
    id: string;
    title?: string;
    user_id?: string;
  };
  profiles?: ProfileRow;
}

type NotificationItem =
  | { type: "follow"; data: FollowNotification }
  | { type: "application"; data: ApplicationNotification };

function formatRelativeTime(iso?: string) {
  if (!iso) return "";
  try {
    const posted = new Date(iso).getTime();
    if (Number.isNaN(posted)) return "";
    const now = Date.now();
    const diffMs = Math.max(0, now - posted);
    const sec = Math.floor(diffMs / 1000);
    if (sec < 5) return "Just now";
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    const week = Math.floor(day / 7);
    if (week < 4) return `${week}w ago`;
    const date = new Date(iso);
    const m = date.getMonth() + 1;
    const d = date.getDate();
    return `${m}/${d}`;
  } catch {
    return "";
  }
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUserId, getDisplayForProfile } = useProfile();
  const { markAsViewed } = useNotifications();
  const [filter, setFilter] = useState<"all" | "follows" | "applications">("all");

  useEffect(() => {
    markAsViewed("user");
  }, [markAsViewed]);

  const { data: follows, isLoading: followsLoading } = useQuery<FollowNotification[]>({
    queryKey: ["notifications-follows", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [];
      const rows = await sbSelect<{ id: string; follower_id: string; following_id: string; created_at: string }>("follows", {
        select: "*",
        query: { following_id: `eq.${currentUserId}` },
        order: { column: "created_at", ascending: false },
        limit: 100,
      });
      
      const profileIds = rows.map(r => r.follower_id).filter(Boolean);
      if (profileIds.length === 0) return [];
      
      const profiles = await sbSelect<ProfileRow>("profiles", {
        select: "*",
        query: { user_id: `in.(${profileIds.join(",")})` },
      });
      
      const profileMap = new Map(profiles.map(p => [p.user_id, p]));
      
      return rows.map(row => ({
        ...row,
        profiles: profileMap.get(row.follower_id),
      }));
    },
    enabled: !!currentUserId,
  });

  const { data: applications, isLoading: applicationsLoading } = useQuery<ApplicationNotification[]>({
    queryKey: ["notifications-applications", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [];
      const myOpps = await sbSelect<{ id: string }>("opportunities", {
        select: "id",
        query: { user_id: `eq.${currentUserId}` },
        limit: 200,
      });
      const oppIds = myOpps.map((o) => o.id);
      if (oppIds.length === 0) return [];
      const idList = `in.(${oppIds.join(",")})`;
      const apps = await sbSelect<{ id: string; opportunity_id: string; applicant_id: string; created_at: string }>("applications", {
        select: "*",
        query: { opportunity_id: idList },
        order: { column: "created_at", ascending: false },
        limit: 100,
      });
      
      const applicantIds = apps.map(a => a.applicant_id).filter(Boolean);
      
      if (applicantIds.length === 0) return [];
      
      const profiles = await sbSelect<ProfileRow>("profiles", {
        select: "*",
        query: { user_id: `in.(${applicantIds.join(",")})` },
      });
      
      const opportunities = await sbSelect<{ id: string; title?: string; user_id?: string }>("opportunities", {
        select: "id,title,user_id",
        query: { id: idList },
      });
      
      const profileMap = new Map(profiles.map(p => [p.user_id, p]));
      const oppMap = new Map(opportunities.map(o => [o.id, o]));
      
      return apps.map(app => ({
        ...app,
        profiles: profileMap.get(app.applicant_id),
        opportunities: oppMap.get(app.opportunity_id),
      }));
    },
    enabled: !!currentUserId,
  });

  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];
    if (filter === "all" || filter === "follows") {
      (follows ?? []).forEach((f) => items.push({ type: "follow", data: f }));
    }
    if (filter === "all" || filter === "applications") {
      (applications ?? []).forEach((a) => items.push({ type: "application", data: a }));
    }
    items.sort((a, b) => {
      const timeA = new Date(
        a.type === "follow" ? a.data.created_at : a.data.created_at
      ).getTime();
      const timeB = new Date(
        b.type === "follow" ? b.data.created_at : b.data.created_at
      ).getTime();
      return timeB - timeA;
    });
    return items;
  }, [follows, applications, filter]);

  const isLoading = followsLoading || applicationsLoading;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Pressable
          onPress={() => router.back()}
          style={styles.closeBtn}
          testID="notifications-close"
        >
          <X color="#E5E7EB" size={24} />
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterBtn, filter === "all" && styles.filterBtnActive]}
          onPress={() => setFilter("all")}
          testID="filter-all"
        >
          <Text style={[styles.filterText, filter === "all" && styles.filterTextActive]}>
            All
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterBtn, filter === "follows" && styles.filterBtnActive]}
          onPress={() => setFilter("follows")}
          testID="filter-follows"
        >
          <Text style={[styles.filterText, filter === "follows" && styles.filterTextActive]}>
            Follows
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterBtn, filter === "applications" && styles.filterBtnActive]}
          onPress={() => setFilter("applications")}
          testID="filter-applications"
        >
          <Text style={[styles.filterText, filter === "applications" && styles.filterTextActive]}>
            Applications
          </Text>
        </Pressable>
      </View>

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#E5E7EB" size="large" />
        </View>
      )}

      {!isLoading && notifications.length === 0 && (
        <View style={styles.emptyContainer}>
          <Clock color="#6B7280" size={48} />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>
            When someone follows you or applies to your opportunities, you&apos;ll see it here
          </Text>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item, index) => {
          if (item.type === "follow") {
            return `follow-${item.data.id}`;
          } else {
            return `app-${item.data.id}`;
          }
        }}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          if (item.type === "follow") {
            const display = getDisplayForProfile(item.data.profiles);
            return (
              <Pressable
                style={styles.notifCard}
                onPress={() => {
                  const uid = item.data.profiles?.user_id;
                  if (uid) {
                    router.push({ pathname: "/profile/[userId]", params: { userId: uid } });
                  }
                }}
                testID={`notif-follow-${item.data.id}`}
              >
                <View style={[styles.iconCircle, styles.iconCircleFollow]}>
                  <UserPlus color="#3B82F6" size={20} />
                </View>
                <Image source={{ uri: display.avatarUrl }} style={styles.notifAvatar} />
                <View style={styles.notifContent}>
                  <Text style={styles.notifText}>
                    <Text style={styles.notifTextBold}>{display.displayName}</Text>
                    {" started following you"}
                  </Text>
                  <Text style={styles.notifTime}>{formatRelativeTime(item.data.created_at)}</Text>
                </View>
              </Pressable>
            );
          } else {
            const display = getDisplayForProfile(item.data.profiles);
            const oppTitle = item.data.opportunities?.title ?? "your opportunity";
            return (
              <Pressable
                style={styles.notifCard}
                onPress={() => {
                  const uid = item.data.profiles?.user_id;
                  if (uid) {
                    router.push({ pathname: "/profile/[userId]", params: { userId: uid } });
                  }
                }}
                testID={`notif-app-${item.data.id}`}
              >
                <View style={[styles.iconCircle, styles.iconCircleApp]}>
                  <FileCheck color="#10B981" size={20} />
                </View>
                <Image source={{ uri: display.avatarUrl }} style={styles.notifAvatar} />
                <View style={styles.notifContent}>
                  <Text style={styles.notifText}>
                    <Text style={styles.notifTextBold}>{display.displayName}</Text>
                    {" applied to "}
                    <Text style={styles.notifTextBold}>{oppTitle}</Text>
                  </Text>
                  <Text style={styles.notifTime}>{formatRelativeTime(item.data.created_at)}</Text>
                </View>
              </Pressable>
            );
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B0F",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#23232B",
  },
  headerTitle: {
    color: "#E5E7EB",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 999,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8 as const,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#23232B",
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#14141C",
    borderWidth: 1,
    borderColor: "#23232B",
  },
  filterBtnActive: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  filterText: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: "#E5E7EB",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  notifCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12 as const,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#121218",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#23232B",
    marginBottom: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleFollow: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
  },
  iconCircleApp: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  notifAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#23232B",
  },
  notifContent: {
    flex: 1,
  },
  notifText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  notifTextBold: {
    fontWeight: "800",
  },
  notifTime: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
});
