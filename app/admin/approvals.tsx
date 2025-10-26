import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Pressable } from "react-native";
import { Shield } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useProfile } from "@/contexts/ProfileContext";
import { sbSelect, sbUpdate, getSupabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import GrainTexture from "@/components/GrainTexture";

interface AdminUser {
  user_id: string;
  full_name?: string;
  username?: string;
  profile_picture?: string;
  profession?: string;
  location?: string;
  bio?: string;
  account_status?: string;
  created_at?: string;
  email?: string;
}

interface OnboardingResponse {
  id: string;
  user_id: string;
  role?: string;
  question?: string;
  answer?: string[];
  created_at?: string;
}

type StatusTab = "pending" | "approved" | "rejected";

export default function AdminApprovalsScreen() {
  const router = useRouter();
  const { currentUserId } = useProfile();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<StatusTab>("pending");

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

  const onboardingResponsesQuery = useQuery<OnboardingResponse[]>({
    queryKey: ["admin", "onboarding-responses"],
    queryFn: async () => {
      const rows = await sbSelect<OnboardingResponse>("onboarding_responses", {
        select: "*",
        order: { column: "created_at", ascending: false },
      });
      return rows;
    },
    enabled: !!isAdmin,
  });

  const usersQuery = useQuery<{ pending: AdminUser[]; approved: AdminUser[]; rejected: AdminUser[]}>({
    queryKey: ["admin", "users-by-status"],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase) return { pending: [], approved: [], rejected: [] };
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const base = "https://mnqgmpvkdmgmyoqhgswc.supabase.co/functions/v1/get-pending-users";

      const buildReq = (status: StatusTab) =>
        fetch(`${base}?status=${status}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }).then(async (r) => {
          if (!r.ok) {
            const t = await r.text();
            throw new Error(t || `Failed to load ${status}`);
          }
          return (await r.json()) as AdminUser[];
        });

      const [pending, approved, rejected] = await Promise.all([
        buildReq("pending"),
        buildReq("approved"),
        buildReq("rejected"),
      ]);
      return { pending, approved, rejected };
    },
    enabled: !!isAdmin,
  });

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      await sbUpdate("profiles", { account_status: "approved" }, { user_id: `eq.${userId}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users-by-status"] });
      Alert.alert("Success", "User application approved");
    },
    onError: (error) => {
      console.error("[Admin] Approval error:", error);
      Alert.alert("Error", "Failed to approve application");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      await sbUpdate("profiles", { account_status: "rejected" }, { user_id: `eq.${userId}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users-by-status"] });
      Alert.alert("Success", "User application rejected");
    },
    onError: (error) => {
      console.error("[Admin] Rejection error:", error);
      Alert.alert("Error", "Failed to reject application");
    },
  });

  const assignAdminMutation = trpc.admin.assignAdminRole.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users-by-status"] });
      Alert.alert("Success", "Admin role assigned successfully");
    },
    onError: (error) => {
      console.error("[Admin] Assign admin error:", error);
      Alert.alert("Error", "Failed to assign admin role");
    },
  });

  const handleApprove = (userId: string, userName?: string) => {
    Alert.alert(
      "Approve Application",
      `Approve ${userName || "this user"}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Approve", onPress: () => approveMutation.mutate(userId), style: "default" },
      ]
    );
  };

  const handleReject = (userId: string, userName?: string) => {
    Alert.alert(
      "Reject Application",
      `Reject ${userName || "this user"}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reject", onPress: () => rejectMutation.mutate(userId), style: "destructive" },
      ]
    );
  };

  const handleMakeAdmin = (userId: string, userName?: string) => {
    Alert.alert(
      "Make Admin",
      `Grant admin access to ${userName || "this user"}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Make Admin", onPress: () => assignAdminMutation.mutate({ userId }), style: "default" },
      ]
    );
  };

  const getResponsesForUser = (userId: string) => onboardingResponsesQuery.data?.filter((r) => r.user_id === userId) || [];

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <GrainTexture />
        <View style={styles.content}>
          <Text style={styles.errorText}>Access denied. Admin only.</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const list = (usersQuery.data?.[activeTab] ?? []) as AdminUser[];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <GrainTexture />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Application Approvals</Text>
          <TouchableOpacity 
            style={styles.adminAccessBtn}
            onPress={() => router.push("/admin/access")}
          >
            <Shield size={16} color="#8B5CF6" />
            <Text style={styles.adminAccessText}>Admin Access</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.tabsRow}>
          {(["pending", "approved", "rejected"] as StatusTab[]).map((t) => (
            <Pressable key={t} onPress={() => setActiveTab(t)} style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}>
              <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
                {t.toUpperCase()} ({usersQuery.data?.[t]?.length ?? 0})
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={usersQuery.isLoading || usersQuery.isRefetching}
            onRefresh={() => {
              usersQuery.refetch();
              onboardingResponsesQuery.refetch();
            }}
            tintColor="#FFFFFF"
          />
        }
      >
        {usersQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading applications...</Text>
          </View>
        ) : list.length > 0 ? (
          list.map((p) => {
            const responses = getResponsesForUser(p.user_id);
            return (
              <View key={p.user_id} style={styles.applicationCard}>
                <View style={styles.applicationHeader}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{p.full_name || p.username || "User"}</Text>
                    <Text style={styles.userMeta}>
                      {p.profession || "No role"} • {p.location || "No location"}
                    </Text>
                    <Text style={styles.userDate}>
                      Applied: {p.created_at ? new Date(p.created_at).toLocaleDateString() : "Unknown"}
                    </Text>
                    {!!p.email && (
                      <Text style={styles.userEmail}>{p.email}</Text>
                    )}
                  </View>
                </View>

                {p.bio && (
                  <View style={styles.bioSection}>
                    <Text style={styles.bioLabel}>Bio</Text>
                    <Text style={styles.bioText}>{p.bio}</Text>
                  </View>
                )}

                {responses.length > 0 && (
                  <View style={styles.responsesSection}>
                    <Text style={styles.responsesLabel}>Onboarding Responses</Text>
                    {responses.map((r) => (
                      <View key={r.id} style={styles.responseItem}>
                        <Text style={styles.responseQuestion}>{r.question}</Text>
                        <Text style={styles.responseAnswer}>
                          {Array.isArray(r.answer) ? r.answer.join(", ") : String(r.answer)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.actionButtons}>
                  {activeTab === "pending" && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={() => handleApprove(p.user_id, p.full_name || p.username)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                      >
                        <Text style={styles.approveButtonText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleReject(p.user_id, p.full_name || p.username)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                      >
                        <Text style={styles.rejectButtonText}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity
                    style={[styles.actionButton, styles.adminButton]}
                    onPress={() => handleMakeAdmin(p.user_id, p.full_name || p.username)}
                    disabled={assignAdminMutation.isPending}
                  >
                    <Text style={styles.adminButtonText}>Make Admin</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No {activeTab} applications</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#1F2937" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  headerTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "700" as const },
  adminAccessBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  adminAccessText: {
    color: "#8B5CF6",
    fontSize: 13,
    fontWeight: "700" as const,
  },
  tabsRow: { flexDirection: "row", gap: 8 as const },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#15151A", borderWidth: 1, borderColor: "#2A2A33" },
  tabBtnActive: { backgroundColor: "#1F2937", borderColor: "#374151" },
  tabText: { color: "#9CA3AF", fontSize: 12, fontWeight: "800" as const, letterSpacing: 0.5 },
  tabTextActive: { color: "#E5E7EB" },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, gap: 16 },
  content: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  errorText: { color: "#EF4444", fontSize: 18, fontWeight: "600" as const, marginBottom: 20 },
  backButton: { backgroundColor: "#FFFFFF", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  backButtonText: { color: "#000000", fontSize: 16, fontWeight: "600" as const },
  loadingContainer: { padding: 40, alignItems: "center" },
  loadingText: { color: "#9CA3AF", fontSize: 16 },
  emptyContainer: { padding: 40, alignItems: "center" },
  emptyText: { color: "#9CA3AF", fontSize: 16 },
  applicationCard: { backgroundColor: "rgba(15, 15, 15, 0.85)", borderColor: "#404040", borderWidth: 1, borderRadius: 16, padding: 16, gap: 16 },
  applicationHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  userInfo: { flex: 1, gap: 4 },
  userName: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" as const },
  userMeta: { color: "#9CA3AF", fontSize: 14, fontWeight: "500" as const },
  userDate: { color: "#6B7280", fontSize: 12, fontWeight: "400" as const },
  userEmail: { color: "#9CA3AF", fontSize: 12, marginTop: 2 },
  bioSection: { gap: 4 },
  bioLabel: { color: "#E5E7EB", fontSize: 14, fontWeight: "600" as const },
  bioText: { color: "#9CA3AF", fontSize: 14, lineHeight: 20 },
  responsesSection: { gap: 8 },
  responsesLabel: { color: "#E5E7EB", fontSize: 14, fontWeight: "600" as const, marginBottom: 4 },
  responseItem: { gap: 2 },
  responseQuestion: { color: "#D1D5DB", fontSize: 13, fontWeight: "500" as const },
  responseAnswer: { color: "#9CA3AF", fontSize: 13, lineHeight: 18 },
  actionButtons: { flexDirection: "row", gap: 12, marginTop: 4, flexWrap: "wrap" as const },
  actionButton: { flex: 1, minWidth: 100, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  approveButton: { backgroundColor: "#10B981" },
  approveButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" as const },
  rejectButton: { backgroundColor: "#EF4444" },
  rejectButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" as const },
  adminButton: { backgroundColor: "#8B5CF6" },
  adminButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" as const },
});
