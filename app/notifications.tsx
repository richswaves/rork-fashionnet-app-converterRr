import React, { useState, useMemo, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { X, UserPlus, FileCheck, Clock, Check, XCircle } from "lucide-react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sbSelect, sbUpdate, sbInsert } from "@/integrations/supabase/client";
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
  status?: string;
  note?: string;
  opportunities?: {
    id: string;
    title?: string;
    user_id?: string;
  };
  profiles?: ProfileRow;
}

interface ApplicantNotification {
  id: string;
  applicant_id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  related_id?: string;
}

interface MyApplication {
  id: string;
  opportunity_id: string;
  status?: string;
  created_at: string;
  opportunities?: {
    id: string;
    title?: string;
  };
}

type NotificationItem =
  | { type: "follow"; data: FollowNotification }
  | { type: "application"; data: ApplicationNotification }
  | { type: "applicant"; data: ApplicantNotification }
  | { type: "myApplication"; data: MyApplication };

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
  const queryClient = useQueryClient();
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
      const apps = await sbSelect<{ id: string; opportunity_id: string; applicant_id: string; created_at: string; status?: string; note?: string }>("applications", {
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
    refetchInterval: 30000,
  });

  const { data: applicantNotifications, isLoading: applicantNotificationsLoading } = useQuery<ApplicantNotification[]>({
    queryKey: ["applicant-notifications", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [];
      const notifications = await sbSelect<ApplicantNotification>("applicant_notifications", {
        select: "*",
        query: { applicant_id: `eq.${currentUserId}` },
        order: { column: "created_at", ascending: false },
        limit: 100,
      });
      
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      if (unreadIds.length > 0) {
        await sbUpdate(
          "applicant_notifications", 
          { read: true }, 
          { id: `in.(${unreadIds.join(",")})` }
        );
      }
      
      return notifications;
    },
    enabled: !!currentUserId,
    refetchInterval: 30000,
  });

  const { data: myApplications, isLoading: myApplicationsLoading } = useQuery<MyApplication[]>({
    queryKey: ["my-applications", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [];
      console.log('[MyApplications] Fetching applications for user:', currentUserId);
      const apps = await sbSelect<{ id: string; opportunity_id: string; status?: string; created_at: string }>("applications", {
        select: "*",
        query: { applicant_id: `eq.${currentUserId}` },
        order: { column: "created_at", ascending: false },
        limit: 100,
      });
      console.log('[MyApplications] Found applications:', apps.length);

      if (apps.length === 0) return [];

      const oppIds = apps.map(a => a.opportunity_id);
      const opportunities = await sbSelect<{ id: string; title?: string }>("opportunities", {
        select: "id,title",
        query: { id: `in.(${oppIds.join(",")})` },
      });
      console.log('[MyApplications] Found opportunities:', opportunities.length);

      const oppMap = new Map(opportunities.map(o => [o.id, o]));

      const result = apps.map(app => ({
        ...app,
        opportunities: oppMap.get(app.opportunity_id),
      }));
      console.log('[MyApplications] Final applications with opportunities:', result);
      return result;
    },
    enabled: !!currentUserId,
    refetchInterval: 30000,
  });

  const approveApplicationMutation = useMutation({
    mutationFn: async ({ applicationId, applicantId, opportunityTitle }: { applicationId: string; applicantId: string; opportunityTitle: string }) => {
      await sbUpdate("applications", { status: "approved" }, { id: `eq.${applicationId}` });
      
      await sbInsert("applicant_notifications", {
        applicant_id: applicantId,
        type: "application_approved",
        title: "Application Approved",
        message: `Your application to "${opportunityTitle}" has been approved!`,
        related_id: applicationId,
      }, "return=minimal");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-applications", currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["applicant-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
      Alert.alert("Success", "Application approved");
    },
    onError: (error) => {
      console.error("[Notifications] Full approval error:", JSON.stringify(error, null, 2));
      Alert.alert("Error", `Failed to approve: ${error.message}`);
    },
  });

  const rejectApplicationMutation = useMutation({
    mutationFn: async ({ applicationId, applicantId, opportunityTitle }: { applicationId: string; applicantId: string; opportunityTitle: string }) => {
      await sbUpdate("applications", { status: "rejected" }, { id: `eq.${applicationId}` });
      
      await sbInsert("applicant_notifications", {
        applicant_id: applicantId,
        type: "application_rejected",
        title: "Application Denied",
        message: `Your application to "${opportunityTitle}" has been denied.`,
        related_id: applicationId,
      }, "return=minimal");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-applications", currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["applicant-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
      Alert.alert("Success", "Application rejected");
    },
    onError: (error) => {
      console.error("[Notifications] Full rejection error:", JSON.stringify(error, null, 2));
      Alert.alert("Error", `Failed to reject: ${error.message}`);
    },
  });

  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];
    if (filter === "all" || filter === "follows") {
      (follows ?? []).forEach((f) => items.push({ type: "follow", data: f }));
    }
    if (filter === "all" || filter === "applications") {
      (applications ?? []).forEach((a) => items.push({ type: "application", data: a }));
      (applicantNotifications ?? []).forEach((n) => items.push({ type: "applicant", data: n }));
      (myApplications ?? []).forEach((app) => items.push({ type: "myApplication", data: app }));
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
  }, [follows, applications, applicantNotifications, myApplications, filter]);

  const isLoading = followsLoading || applicationsLoading || applicantNotificationsLoading || myApplicationsLoading;

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
            {filter === "follows" 
              ? "When someone follows you, you'll see it here"
              : filter === "applications"
              ? "When someone applies to your opportunities or you receive application updates, you'll see it here"
              : "When someone follows you or applies to your opportunities, you'll see it here"}
          </Text>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item, index) => {
          if (item.type === "follow") {
            return `follow-${item.data.id}`;
          } else if (item.type === "application") {
            return `app-${item.data.id}`;
          } else if (item.type === "applicant") {
            return `applicant-${item.data.id}`;
          } else {
            return `myapp-${item.data.id}`;
          }
        }}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          if (item.type === "myApplication") {
            const oppTitle = item.data.opportunities?.title ?? "Untitled Opportunity";
            const status = item.data.status || "pending";
            const isApproved = status === "approved";
            const isRejected = status === "rejected";
            const isPending = !isApproved && !isRejected;
            
            return (
              <View style={styles.myAppCard} testID={`notif-myapp-${item.data.id}`}>
                <View style={[
                  styles.iconCircle,
                  isApproved ? styles.iconCircleApproved : isRejected ? styles.iconCircleRejected : styles.iconCirclePending
                ]}>
                  {isApproved ? (
                    <Check color="#10B981" size={20} />
                  ) : isRejected ? (
                    <XCircle color="#EF4444" size={20} />
                  ) : (
                    <Clock color="#F59E0B" size={20} />
                  )}
                </View>
                <View style={styles.notifContent}>
                  <Text style={styles.myAppTitle}>
                    {oppTitle}
                  </Text>
                  <Text style={styles.myAppSubtitle}>
                    You applied to this opportunity
                  </Text>
                  <Text style={[
                    styles.myAppStatus,
                    isApproved && styles.myAppStatusApproved,
                    isRejected && styles.myAppStatusRejected,
                    isPending && styles.myAppStatusPending,
                  ]}>
                    {isApproved ? "✓ Approved" : isRejected ? "✗ Denied" : "⏳ Pending Review"}
                  </Text>
                  <Text style={styles.notifTime}>{formatRelativeTime(item.data.created_at)}</Text>
                </View>
              </View>
            );
          } else if (item.type === "applicant") {
            return (
              <Pressable 
                style={styles.applicantNotifCard} 
                testID={`notif-applicant-${item.data.id}`}
                onPress={() => {
                  if (item.data.related_id) {
                    console.log('[Notifications] Application notification tapped:', item.data.related_id);
                  }
                }}
              >
                <View style={[styles.iconCircle, (item.data.type === "application_approved" || item.data.type === "profile_approved") ? styles.iconCircleApproved : styles.iconCircleRejected]}>
                  {(item.data.type === "application_approved" || item.data.type === "profile_approved") ? (
                    <Check color="#10B981" size={20} />
                  ) : (
                    <XCircle color="#EF4444" size={20} />
                  )}
                </View>
                <View style={styles.notifContent}>
                  <Text style={styles.applicantNotifTitle}>{item.data.title}</Text>
                  <Text style={styles.applicantNotifMessage}>{item.data.message}</Text>
                  <Text style={styles.notifTime}>{formatRelativeTime(item.data.created_at)}</Text>
                </View>
              </Pressable>
            );
          } else if (item.type === "follow") {
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
            const status = item.data.status;
            const isPending = !status || status === "pending";
            const note = item.data.note;
            
            return (
              <View style={styles.appNotifCard} testID={`notif-app-${item.data.id}`}>
                <Pressable
                  style={styles.appNotifHeader}
                  onPress={() => {
                    const uid = item.data.profiles?.user_id;
                    if (uid) {
                      router.push({ pathname: "/profile/[userId]", params: { userId: uid } });
                    }
                  }}
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
                
                {note && (
                  <View style={styles.noteContainer}>
                    <Text style={styles.noteLabel}>Note:</Text>
                    <Text style={styles.noteText}>{note}</Text>
                  </View>
                )}
                
                {isPending && (
  <View style={styles.appActionButtons}>
    <Pressable
      style={[styles.appActionBtn, styles.appApproveBtn]}
      onPress={() => {
        const approveFn = () => approveApplicationMutation.mutate({ 
          applicationId: item.data.id,
          applicantId: item.data.applicant_id,
          opportunityTitle: oppTitle,
        });

        if (Platform.OS === 'web') {
          if (window.confirm(`Approve ${display.displayName}'s application to ${oppTitle}?`)) {
            approveFn();
          }
        } else {
          Alert.alert(
            "Approve Application",
            `Approve ${display.displayName}'s application to ${oppTitle}?`,
            [
              { text: "Cancel", style: "cancel" },
              { text: "Approve", onPress: approveFn },
            ]
          );
        }
      }}
      testID={`approve-app-${item.data.id}`}
    >
      <Check color="#FFFFFF" size={16} />
      <Text style={styles.appActionBtnText}>Approve</Text>
    </Pressable>
    
    <Pressable
      style={[styles.appActionBtn, styles.appRejectBtn]}
      onPress={() => {
        const rejectFn = () => rejectApplicationMutation.mutate({ 
          applicationId: item.data.id,
          applicantId: item.data.applicant_id,
          opportunityTitle: oppTitle,
        });

        if (Platform.OS === 'web') {
          if (window.confirm(`Reject ${display.displayName}'s application to ${oppTitle}?`)) {
            rejectFn();
          }
        } else {
          Alert.alert(
            "Reject Application",
            `Reject ${display.displayName}'s application to ${oppTitle}?`,
            [
              { text: "Cancel", style: "cancel" },
              { text: "Reject", onPress: rejectFn, style: "destructive" },
            ]
          );
        }
      }}
      testID={`reject-app-${item.data.id}`}
    >
      <XCircle color="#FFFFFF" size={16} />
      <Text style={styles.appActionBtnText}>Deny</Text>
    </Pressable>
  </View>
)}
                {!isPending && (
                  <View style={styles.appStatusBadge}>
                    <Text style={[
                      styles.appStatusText,
                      status === "approved" && styles.appStatusApproved,
                      status === "rejected" && styles.appStatusRejected,
                    ]}>
                      {status === "approved" ? "✓ Approved" : status === "rejected" ? "✗ Rejected" : "Pending"}
                    </Text>
                  </View>
                )}
              </View>
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
  appNotifCard: {
    flexDirection: "column",
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
  appNotifHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12 as const,
  },
  noteContainer: {
    backgroundColor: "#1A1A22",
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#10B981",
  },
  noteLabel: {
    color: "#10B981",
    fontSize: 11,
    fontWeight: "800" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  noteText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "500" as const,
    lineHeight: 20,
  },
  appActionButtons: {
    flexDirection: "row",
    gap: 8 as const,
  },
  appActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6 as const,
    paddingVertical: 10,
    borderRadius: 8,
  },
  appApproveBtn: {
    backgroundColor: "#10B981",
  },
  appRejectBtn: {
    backgroundColor: "#EF4444",
  },
  appActionBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  appStatusBadge: {
    alignItems: "center",
  },
  appStatusText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
  },
  appStatusApproved: {
    color: "#10B981",
  },
  appStatusRejected: {
    color: "#EF4444",
  },
  applicantNotifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12 as const,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "#121218",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#23232B",
    marginBottom: 10,
  },
  iconCircleApproved: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  iconCircleRejected: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  applicantNotifTitle: {
    color: "#E5E7EB",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  applicantNotifMessage: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    marginBottom: 4,
  },
  myAppCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12 as const,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "#121218",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#23232B",
    marginBottom: 10,
  },
  iconCirclePending: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  myAppTitle: {
    color: "#E5E7EB",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 2,
    lineHeight: 20,
  },
  myAppSubtitle: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 6,
  },
  myAppStatus: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  myAppStatusApproved: {
    color: "#10B981",
  },
  myAppStatusRejected: {
    color: "#EF4444",
  },
  myAppStatusPending: {
    color: "#F59E0B",
  },
});
