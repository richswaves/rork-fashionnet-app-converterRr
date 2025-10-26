import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Image, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useProfile } from "@/contexts/ProfileContext";
import { sbSelect, sbUpdate } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import GrainTexture from "@/components/GrainTexture";
import { Scale, ArrowLeft, CheckCircle, XCircle, AlertTriangle } from "lucide-react-native";

interface Appeal {
  id: string;
  user_id: string;
  reason: string;
  status: "pending" | "reviewing" | "approved" | "rejected";
  admin_notes?: string | null;
  created_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  user_profile?: {
    full_name?: string;
    username?: string;
    profile_picture?: string;
    suspended_at?: string;
  };
}

type StatusTab = "pending" | "reviewing" | "approved" | "rejected";

export default function AdminAppealsScreen() {
  const router = useRouter();
  const { currentUserId } = useProfile();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<StatusTab>("pending");
  const [adminNotesInput, setAdminNotesInput] = useState<{ [key: string]: string }>({});

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

  const appealsQuery = useQuery<Appeal[]>({
    queryKey: ["admin", "appeals"],
    queryFn: async () => {
      console.log("[Admin] Fetching appeals...");
      const rows = await sbSelect<Appeal>("appeals", {
        select: "*",
        order: { column: "created_at", ascending: false },
      });

      const enrichedRows: Appeal[] = await Promise.all(
        rows.map(async (appeal): Promise<Appeal> => {
          const userProfile = await sbSelect<{
            full_name?: string;
            username?: string;
            profile_picture?: string;
            suspended_at?: string;
          }>("profiles", {
            select: "full_name,username,profile_picture,suspended_at",
            query: { user_id: `eq.${appeal.user_id}` },
            limit: 1,
          }).then((r) => r[0]);

          return {
            ...appeal,
            user_profile: userProfile,
          };
        })
      );

      console.log(`[Admin] Found ${rows.length} appeals`);
      return enrichedRows;
    },
    enabled: !!isAdmin,
  });

  const updateAppealMutation = useMutation({
    mutationFn: async ({
      appealId,
      status,
      adminNotes,
      unsuspend,
    }: {
      appealId: string;
      status: string;
      adminNotes?: string;
      unsuspend?: boolean;
    }) => {
      console.log(`[Admin] Updating appeal ${appealId} to ${status}`);
      const updates: any = { status };
      if (status === "approved" || status === "rejected") {
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by = currentUserId;
      }
      if (adminNotes) {
        updates.admin_notes = adminNotes;
      }
      await sbUpdate("appeals", updates, { id: `eq.${appealId}` });

      if (unsuspend) {
        const appeal = appealsQuery.data?.find((a) => a.id === appealId);
        if (appeal) {
          console.log(`[Admin] Unsuspending user ${appeal.user_id}`);
          await sbUpdate("profiles", { account_status: "approved" }, { user_id: `eq.${appeal.user_id}` });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "appeals"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "suspended-users"] });
      Alert.alert("Success", "Appeal updated");
    },
    onError: (error) => {
      console.error("[Admin] Appeal update error:", error);
      Alert.alert("Error", "Failed to update appeal");
    },
  });

  const handleMarkAsReviewing = (appealId: string) => {
    updateAppealMutation.mutate({ appealId, status: "reviewing" });
  };

  const handleApprove = (appealId: string, userName?: string) => {
    Alert.alert(
      "Approve Appeal",
      `Approve ${userName || "this user"}'s appeal and unsuspend their account?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve & Unsuspend",
          onPress: () => {
            const notes = adminNotesInput[appealId];
            updateAppealMutation.mutate({
              appealId,
              status: "approved",
              adminNotes: notes,
              unsuspend: true,
            });
            setAdminNotesInput((prev) => ({ ...prev, [appealId]: "" }));
          },
        },
      ]
    );
  };

  const handleReject = (appealId: string, userName?: string) => {
    Alert.alert(
      "Reject Appeal",
      `Reject ${userName || "this user"}'s appeal? Their account will remain suspended.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          onPress: () => {
            const notes = adminNotesInput[appealId];
            updateAppealMutation.mutate({
              appealId,
              status: "rejected",
              adminNotes: notes,
            });
            setAdminNotesInput((prev) => ({ ...prev, [appealId]: "" }));
          },
          style: "destructive",
        },
      ]
    );
  };

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

  const filteredAppeals = appealsQuery.data?.filter((a) => a.status === activeTab) ?? [];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <GrainTexture />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Appeals</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.tabsRow}>
          {(["pending", "reviewing", "approved", "rejected"] as StatusTab[]).map((t) => {
            const count = appealsQuery.data?.filter((a) => a.status === t)?.length ?? 0;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setActiveTab(t)}
                style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}
              >
                <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
                  {t.toUpperCase()} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={appealsQuery.isLoading || appealsQuery.isRefetching}
            onRefresh={() => appealsQuery.refetch()}
            tintColor="#FFFFFF"
          />
        }
      >
        {appealsQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading appeals...</Text>
          </View>
        ) : filteredAppeals.length > 0 ? (
          filteredAppeals.map((appeal) => {
            const userName = appeal.user_profile?.full_name || appeal.user_profile?.username || "Unknown User";

            return (
              <View key={appeal.id} style={styles.appealCard}>
                <View style={styles.appealHeader}>
                  {appeal.user_profile?.profile_picture && (
                    <Image
                      source={{ uri: appeal.user_profile.profile_picture }}
                      style={styles.avatar}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{userName}</Text>
                    {appeal.user_profile?.suspended_at && (
                      <Text style={styles.suspendedInfo}>
                        Suspended: {new Date(appeal.user_profile.suspended_at).toLocaleDateString()}
                      </Text>
                    )}
                    <Text style={styles.timestamp}>
                      Appeal: {new Date(appeal.created_at).toLocaleDateString()} at{" "}
                      {new Date(appeal.created_at).toLocaleTimeString()}
                    </Text>
                  </View>
                </View>

                <View style={styles.reasonSection}>
                  <Text style={styles.reasonLabel}>User&apos;s Appeal</Text>
                  <Text style={styles.reasonText}>{appeal.reason}</Text>
                </View>

                {appeal.admin_notes && (
                  <View style={styles.adminNotesSection}>
                    <Text style={styles.adminNotesLabel}>Admin Notes</Text>
                    <Text style={styles.adminNotesText}>{appeal.admin_notes}</Text>
                  </View>
                )}

                {(appeal.status === "pending" || appeal.status === "reviewing") && (
                  <>
                    <View style={styles.adminInputSection}>
                      <Text style={styles.adminInputLabel}>Add Admin Notes (optional)</Text>
                      <TextInput
                        style={styles.adminInput}
                        placeholder="Add notes for the user..."
                        placeholderTextColor="#6B7280"
                        value={adminNotesInput[appeal.id] || ""}
                        onChangeText={(text) =>
                          setAdminNotesInput((prev) => ({ ...prev, [appeal.id]: text }))
                        }
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                    </View>

                    <View style={styles.actionButtons}>
                      {appeal.status === "pending" && (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.reviewButton]}
                          onPress={() => handleMarkAsReviewing(appeal.id)}
                          disabled={updateAppealMutation.isPending}
                        >
                          <AlertTriangle size={16} color="#F59E0B" />
                          <Text style={styles.reviewButtonText}>Mark Reviewing</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={() => handleApprove(appeal.id, userName)}
                        disabled={updateAppealMutation.isPending}
                      >
                        <CheckCircle size={16} color="#10B981" />
                        <Text style={styles.approveButtonText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleReject(appeal.id, userName)}
                        disabled={updateAppealMutation.isPending}
                      >
                        <XCircle size={16} color="#EF4444" />
                        <Text style={styles.rejectButtonText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {appeal.resolved_at && (
                  <Text style={styles.resolvedInfo}>
                    Resolved: {new Date(appeal.resolved_at).toLocaleDateString()}
                  </Text>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <Scale size={48} color="#4B5563" />
            <Text style={styles.emptyText}>No {activeTab} appeals</Text>
            <Text style={styles.emptySubtext}>Appeals will appear here</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
    gap: 12,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "700" as const },
  tabsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" as const },
  tabBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#15151A",
    borderWidth: 1,
    borderColor: "#2A2A33",
  },
  tabBtnActive: { backgroundColor: "#1F2937", borderColor: "#374151" },
  tabText: { color: "#9CA3AF", fontSize: 11, fontWeight: "800" as const, letterSpacing: 0.5 },
  tabTextActive: { color: "#E5E7EB" },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, gap: 16 },
  content: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  errorText: { color: "#EF4444", fontSize: 18, fontWeight: "600" as const, marginBottom: 20 },
  backButton: { backgroundColor: "#FFFFFF", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  backButtonText: { color: "#000000", fontSize: 16, fontWeight: "600" as const },
  loadingContainer: { padding: 40, alignItems: "center" },
  loadingText: { color: "#9CA3AF", fontSize: 16 },
  emptyContainer: { padding: 60, alignItems: "center", gap: 12 },
  emptyText: { color: "#9CA3AF", fontSize: 18, fontWeight: "600" as const },
  emptySubtext: { color: "#6B7280", fontSize: 14 },
  appealCard: {
    backgroundColor: "rgba(15, 15, 15, 0.85)",
    borderColor: "#3B82F6",
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  appealHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#1F2937" },
  userInfo: { flex: 1, gap: 4 },
  userName: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" as const },
  suspendedInfo: { color: "#F59E0B", fontSize: 12, fontWeight: "600" as const },
  timestamp: { color: "#6B7280", fontSize: 12 },
  reasonSection: { gap: 4 },
  reasonLabel: { color: "#E5E7EB", fontSize: 13, fontWeight: "600" as const },
  reasonText: { color: "#D1D5DB", fontSize: 14, lineHeight: 20 },
  adminNotesSection: {
    gap: 4,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  adminNotesLabel: { color: "#C4B5FD", fontSize: 13, fontWeight: "600" as const },
  adminNotesText: { color: "#E9D5FF", fontSize: 13, lineHeight: 18 },
  adminInputSection: { gap: 6 },
  adminInputLabel: { color: "#9CA3AF", fontSize: 13, fontWeight: "600" as const },
  adminInput: {
    backgroundColor: "#1F2937",
    borderRadius: 10,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 14,
    minHeight: 80,
    borderWidth: 1,
    borderColor: "#374151",
  },
  actionButtons: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" as const },
  actionButton: {
    flex: 1,
    minWidth: 90,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  reviewButton: { backgroundColor: "rgba(245, 158, 11, 0.15)", borderWidth: 1, borderColor: "#F59E0B" },
  reviewButtonText: { color: "#F59E0B", fontSize: 13, fontWeight: "700" as const },
  approveButton: { backgroundColor: "rgba(16, 185, 129, 0.15)", borderWidth: 1, borderColor: "#10B981" },
  approveButtonText: { color: "#10B981", fontSize: 13, fontWeight: "700" as const },
  rejectButton: { backgroundColor: "rgba(239, 68, 68, 0.15)", borderWidth: 1, borderColor: "#EF4444" },
  rejectButtonText: { color: "#EF4444", fontSize: 13, fontWeight: "700" as const },
  resolvedInfo: { color: "#6B7280", fontSize: 12, marginTop: 8 },
});
