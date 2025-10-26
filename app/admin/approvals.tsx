import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useProfile } from "@/contexts/ProfileContext";
import { sbSelect, sbUpdate } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import GrainTexture from "@/components/GrainTexture";

interface PendingProfile {
  user_id: string;
  full_name?: string;
  username?: string;
  profile_picture?: string;
  profession?: string;
  location?: string;
  bio?: string;
  account_status?: string;
  created_at?: string;
}

interface OnboardingResponse {
  id: string;
  user_id: string;
  role?: string;
  question?: string;
  answer?: string[];
  created_at?: string;
}

export default function AdminApprovalsScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const queryClient = useQueryClient();

  const isAdmin = useMemo(() => {
    return profile?.account_status === "admin" || profile?.user_id === "admin";
  }, [profile]);

  const pendingProfilesQuery = useQuery<PendingProfile[]>({
    queryKey: ["admin", "pending-profiles"],
    queryFn: async () => {
      const rows = await sbSelect<PendingProfile>("profiles", {
        select: "*",
        query: { account_status: "eq.pending" },
        order: { column: "created_at", ascending: false },
      });
      return rows;
    },
    enabled: isAdmin,
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
    enabled: isAdmin,
  });

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      console.log("[Admin] Approving user:", userId);
      await sbUpdate("profiles", { account_status: "approved" }, { user_id: `eq.${userId}` });
      console.log("[Admin] User approved:", userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "pending-profiles"] });
      Alert.alert("Success", "User application approved");
    },
    onError: (error) => {
      console.error("[Admin] Approval error:", error);
      Alert.alert("Error", "Failed to approve application");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      console.log("[Admin] Rejecting user:", userId);
      await sbUpdate("profiles", { account_status: "rejected" }, { user_id: `eq.${userId}` });
      console.log("[Admin] User rejected:", userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "pending-profiles"] });
      Alert.alert("Success", "User application rejected");
    },
    onError: (error) => {
      console.error("[Admin] Rejection error:", error);
      Alert.alert("Error", "Failed to reject application");
    },
  });

  const handleApprove = (userId: string, userName?: string) => {
    Alert.alert(
      "Approve Application",
      `Approve ${userName || "this user"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: () => approveMutation.mutate(userId),
          style: "default",
        },
      ]
    );
  };

  const handleReject = (userId: string, userName?: string) => {
    Alert.alert(
      "Reject Application",
      `Reject ${userName || "this user"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          onPress: () => rejectMutation.mutate(userId),
          style: "destructive",
        },
      ]
    );
  };

  const getResponsesForUser = (userId: string) => {
    return onboardingResponsesQuery.data?.filter((r) => r.user_id === userId) || [];
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

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <GrainTexture />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Application Approvals</Text>
        <Text style={styles.headerSubtitle}>
          {pendingProfilesQuery.data?.length || 0} pending applications
        </Text>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={pendingProfilesQuery.isLoading || pendingProfilesQuery.isRefetching}
            onRefresh={() => {
              pendingProfilesQuery.refetch();
              onboardingResponsesQuery.refetch();
            }}
            tintColor="#FFFFFF"
          />
        }
      >
        {pendingProfilesQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading applications...</Text>
          </View>
        ) : pendingProfilesQuery.data && pendingProfilesQuery.data.length > 0 ? (
          pendingProfilesQuery.data.map((p) => {
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
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No pending applications</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700" as const,
    marginBottom: 4,
  },
  headerSubtitle: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "500" as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 18,
    fontWeight: "600" as const,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  backButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    color: "#9CA3AF",
    fontSize: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "#9CA3AF",
    fontSize: 16,
  },
  applicationCard: {
    backgroundColor: "rgba(15, 15, 15, 0.85)",
    borderColor: "#404040",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  applicationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700" as const,
  },
  userMeta: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "500" as const,
  },
  userDate: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "400" as const,
  },
  bioSection: {
    gap: 4,
  },
  bioLabel: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  bioText: {
    color: "#9CA3AF",
    fontSize: 14,
    lineHeight: 20,
  },
  responsesSection: {
    gap: 8,
  },
  responsesLabel: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600" as const,
    marginBottom: 4,
  },
  responseItem: {
    gap: 2,
  },
  responseQuestion: {
    color: "#D1D5DB",
    fontSize: 13,
    fontWeight: "500" as const,
  },
  responseAnswer: {
    color: "#9CA3AF",
    fontSize: 13,
    lineHeight: 18,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  approveButton: {
    backgroundColor: "#10B981",
  },
  approveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700" as const,
  },
  rejectButton: {
    backgroundColor: "#EF4444",
  },
  rejectButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700" as const,
  },
});
