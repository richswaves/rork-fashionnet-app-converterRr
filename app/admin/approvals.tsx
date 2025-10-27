import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Pressable, Image } from "react-native";
import { Shield, Instagram, Youtube } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useProfile } from "@/contexts/ProfileContext";
import { sbSelect, sbUpdate, sbInsert, getPublicUrl } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import GrainTexture from "@/components/GrainTexture";

interface SocialLinks {
  instagram?: string;
  youtube?: string;
  twitter?: string;
  tiktok?: string;
}

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
  social_links?: SocialLinks | null;
}

interface OnboardingResponse {
  id: string;
  user_id: string;
  role?: string;
  question?: string;
  answer?: string[];
  created_at?: string;
}

interface QuestionMapping {
  role: string;
  question_id: string;
  question_text: string;
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
      console.log("[Admin] Loaded onboarding responses:", rows.length);
      return rows;
    },
    enabled: !!isAdmin,
  });

  const questionMappingsQuery = useQuery<QuestionMapping[]>({
    queryKey: ["admin", "question-mappings"],
    queryFn: async () => {
      try {
        const rows = await sbSelect<QuestionMapping>("onboarding_question_mappings", {
          select: "role,question_id,question_text",
        });
        console.log("[Admin] Loaded question mappings:", rows.length);
        return rows;
      } catch (e) {
        console.log("[Admin] Question mappings table not found, using fallback:", e);
        return [];
      }
    },
    enabled: !!isAdmin,
  });

  const usersQuery = useQuery<{ pending: AdminUser[]; approved: AdminUser[]; rejected: AdminUser[]}>({
    queryKey: ["admin", "users-by-status"],
    queryFn: async () => {
      console.log("[Admin] Fetching users by status...");
      
      const fetchByStatus = async (status: StatusTab) => {
        const rows = await sbSelect<AdminUser>("profiles", {
          select: "*",
          query: { account_status: `eq.${status}` },
          order: { column: "created_at", ascending: false },
        });
        console.log(`[Admin] ${status} users:`, rows.length);
        rows.forEach((user) => {
          console.log(`[Admin] User ${user.user_id} social_links:`, user.social_links);
        });
        return rows;
      };

      const [pending, approved, rejected] = await Promise.all([
        fetchByStatus("pending"),
        fetchByStatus("approved"),
        fetchByStatus("rejected"),
      ]);
      return { pending, approved, rejected };
    },
    enabled: !!isAdmin,
  });

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      await sbUpdate("profiles", { account_status: "approved" }, { user_id: `eq.${userId}` });
      
      await sbInsert("applicant_notifications", {
        applicant_id: userId,
        type: "profile_approved",
        title: "Profile Approved",
        message: "Your profile has been approved! You can now access the platform.",
        related_id: null,
      });
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
      
      await sbInsert("applicant_notifications", {
        applicant_id: userId,
        type: "profile_rejected",
        title: "Profile Denied",
        message: "Your profile application has been denied. Please contact support if you have questions.",
        related_id: null,
      });
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

  const suspendAccountMutation = useMutation({
    mutationFn: async (userId: string) => {
      console.log(`[Admin] Suspending user ${userId}`);
      await sbUpdate("profiles", { account_status: "suspended" }, { user_id: `eq.${userId}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users-by-status"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "suspended-users"] });
      Alert.alert("Success", "Account suspended");
    },
    onError: (error) => {
      console.error("[Admin] Suspend error:", error);
      Alert.alert("Error", "Failed to suspend account");
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (userId: string) => {
      await sbUpdate("profiles", { account_status: "rejected" }, { user_id: `eq.${userId}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users-by-status"] });
      Alert.alert("Success", "Account deleted");
    },
    onError: (error) => {
      console.error("[Admin] Delete error:", error);
      Alert.alert("Error", "Failed to delete account");
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

  const handleSuspendAccount = (userId: string, userName?: string) => {
    Alert.alert(
      "Suspend Account",
      `Suspend ${userName || "this user"}'s account? They will not be able to access the app.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Suspend", onPress: () => suspendAccountMutation.mutate(userId), style: "destructive" },
      ]
    );
  };

  const handleDeleteAccount = (userId: string, userName?: string) => {
    Alert.alert(
      "Delete Account",
      `Permanently delete ${userName || "this user"}'s account? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", onPress: () => deleteAccountMutation.mutate(userId), style: "destructive" },
      ]
    );
  };

  const getResponsesForUser = (userId: string) => {
    const responses = onboardingResponsesQuery.data?.filter((r) => r.user_id === userId) || [];
    const mappings = questionMappingsQuery.data || [];
    
    return responses.map((r) => {
      const mapping = mappings.find((m) => m.role === r.role && m.question_id === r.question);
      return {
        ...r,
        questionText: mapping?.question_text || r.question || "Unknown question",
      };
    });
  };

  const getUserMetaData = (userId: string) => {
    const responses = onboardingResponsesQuery.data?.filter((r) => r.user_id === userId) || [];
    
    const roleResponse = responses.find((r) => r.role);
    const role = roleResponse?.role || "general";
    
    const dobResponse = responses.find((r) => r.question === "date_of_birth" && r.answer);
    const locationResponse = responses.find((r) => r.question === "location" && r.answer);
    
    let age: number | null = null;
    if (dobResponse?.answer) {
      const dobValue = Array.isArray(dobResponse.answer) ? dobResponse.answer[0] : dobResponse.answer;
      if (dobValue) {
        const birthDate = new Date(dobValue as string);
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
      }
    }
    
    const locationValue = locationResponse?.answer;
    const location = Array.isArray(locationValue) ? locationValue[0] : locationValue;
    
    return { role, age, location: location as string | undefined };
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
              questionMappingsQuery.refetch();
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
                  {p.profile_picture && (
                    <Image 
                      source={{ uri: p.profile_picture.startsWith('http') ? p.profile_picture : getPublicUrl('display', p.profile_picture) }}
                      style={styles.profilePicture}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>
                      {p.full_name && p.full_name.trim() && !p.full_name.startsWith("User_")
                          ? p.full_name
                          : p.username && !p.username.startsWith("User_") 
                            ? p.username
                            : "No display name set"}
                    </Text>
                    <Text style={styles.userMeta}>
                      {(() => {
                        const meta = getUserMetaData(p.user_id);
                        const parts: string[] = [];
                        if (meta.role) parts.push(meta.role);
                        if (meta.location) parts.push(meta.location);
                        if (meta.age !== null) parts.push(`Age ${meta.age}`);
                        return parts.join(" • ") || "Location not set";
                      })()}
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

                {p.social_links && (Object.keys(p.social_links).length > 0) && (
                  <View style={styles.socialLinksSection}>
                    <Text style={styles.socialLinksLabel}>Social Links</Text>
                    <View style={styles.socialLinksRow}>
                      {p.social_links.instagram && (
                        <TouchableOpacity 
                          style={styles.socialLinkBtn}
                          onPress={() => {
                            const url = p.social_links?.instagram?.startsWith('http') 
                              ? p.social_links.instagram 
                              : `https://instagram.com/${p.social_links?.instagram}`;
                            console.log('[Social] Opening Instagram:', url);
                          }}
                        >
                          <Instagram size={16} color="#C13584" />
                          <Text style={styles.socialLinkText} numberOfLines={1}>
                            {p.social_links.instagram}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {p.social_links.youtube && (
                        <TouchableOpacity 
                          style={styles.socialLinkBtn}
                          onPress={() => {
                            const url = p.social_links?.youtube?.startsWith('http') 
                              ? p.social_links.youtube 
                              : `https://youtube.com/${p.social_links?.youtube}`;
                            console.log('[Social] Opening YouTube:', url);
                          }}
                        >
                          <Youtube size={16} color="#FF0000" />
                          <Text style={styles.socialLinkText} numberOfLines={1}>
                            {p.social_links.youtube}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {p.social_links.twitter && (
                        <TouchableOpacity 
                          style={styles.socialLinkBtn}
                          onPress={() => {
                            const url = p.social_links?.twitter?.startsWith('http') 
                              ? p.social_links.twitter 
                              : `https://twitter.com/${p.social_links?.twitter}`;
                            console.log('[Social] Opening Twitter:', url);
                          }}
                        >
                          <Text style={styles.socialIcon}>𝕏</Text>
                          <Text style={styles.socialLinkText} numberOfLines={1}>
                            {p.social_links.twitter}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {p.social_links.tiktok && (
                        <TouchableOpacity 
                          style={styles.socialLinkBtn}
                          onPress={() => {
                            const url = p.social_links?.tiktok?.startsWith('http') 
                              ? p.social_links.tiktok 
                              : `https://tiktok.com/@${p.social_links?.tiktok}`;
                            console.log('[Social] Opening TikTok:', url);
                          }}
                        >
                          <Text style={styles.socialIcon}>♪</Text>
                          <Text style={styles.socialLinkText} numberOfLines={1}>
                            {p.social_links.tiktok}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                {responses.length > 0 && (
                  <View style={styles.responsesSection}>
                    <Text style={styles.responsesLabel}>Onboarding Responses ({responses.length})</Text>
                    {responses.map((r: any) => (
                      <View key={r.id} style={styles.responseItem}>
                        <Text style={styles.responseQuestion}>{r.questionText}</Text>
                        <Text style={styles.responseAnswer}>
                          {Array.isArray(r.answer) ? r.answer.join(", ") : String(r.answer || "No answer")}
                        </Text>
                        {r.role && (
                          <Text style={styles.responseRole}>Role: {r.role}</Text>
                        )}
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
                  {activeTab === "approved" && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.suspendButton]}
                        onPress={() => handleSuspendAccount(p.user_id, p.full_name || p.username)}
                        disabled={suspendAccountMutation.isPending || deleteAccountMutation.isPending}
                      >
                        <Text style={styles.suspendButtonText}>Suspend</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => handleDeleteAccount(p.user_id, p.full_name || p.username)}
                        disabled={suspendAccountMutation.isPending || deleteAccountMutation.isPending}
                      >
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </TouchableOpacity>
                    </>
                  )}
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
  applicationHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  profilePicture: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#1F2937" },
  userInfo: { flex: 1, gap: 6 },
  userName: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" as const },
  userUsername: { color: "#9CA3AF", fontSize: 14, fontWeight: "500" as const, marginTop: -2 },
  userMeta: { color: "#9CA3AF", fontSize: 14, fontWeight: "500" as const, marginTop: 2 },
  metaRow: { flexDirection: "row", gap: 16, marginTop: 4 },
  metaItem: { flexDirection: "row", gap: 4 },
  metaLabel: { color: "#6B7280", fontSize: 13, fontWeight: "600" as const },
  metaValue: { color: "#D1D5DB", fontSize: 13, fontWeight: "500" as const, textTransform: "capitalize" as const },
  userDate: { color: "#6B7280", fontSize: 12, fontWeight: "400" as const, marginTop: 2 },
  userEmail: { color: "#9CA3AF", fontSize: 12, marginTop: 2 },
  bioSection: { gap: 4 },
  bioLabel: { color: "#E5E7EB", fontSize: 14, fontWeight: "600" as const },
  bioText: { color: "#9CA3AF", fontSize: 14, lineHeight: 20 },
  responsesSection: { gap: 8 },
  responsesLabel: { color: "#E5E7EB", fontSize: 14, fontWeight: "600" as const, marginBottom: 4 },
  responseItem: { gap: 2 },
  responseQuestion: { color: "#D1D5DB", fontSize: 13, fontWeight: "500" as const },
  responseAnswer: { color: "#9CA3AF", fontSize: 13, lineHeight: 18 },
  responseRole: { color: "#6B7280", fontSize: 11, marginTop: 2, fontStyle: "italic" as const },
  actionButtons: { flexDirection: "row", gap: 12, marginTop: 4, flexWrap: "wrap" as const },
  actionButton: { flex: 1, minWidth: 100, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  approveButton: { backgroundColor: "#10B981" },
  approveButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" as const },
  rejectButton: { backgroundColor: "#EF4444" },
  rejectButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" as const },
  suspendButton: { backgroundColor: "#F59E0B" },
  suspendButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" as const },
  deleteButton: { backgroundColor: "#DC2626" },
  deleteButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" as const },
  socialLinksSection: { gap: 8, marginTop: 4 },
  socialLinksLabel: { color: "#E5E7EB", fontSize: 14, fontWeight: "600" as const, marginBottom: 4 },
  socialLinksRow: { flexDirection: "row", flexWrap: "wrap" as const, gap: 8 },
  socialLinkBtn: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 6, 
    backgroundColor: "rgba(20, 20, 20, 0.85)", 
    paddingVertical: 8, 
    paddingHorizontal: 12, 
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#404040",
    maxWidth: "48%",
  },
  socialLinkText: { color: "#D1D5DB", fontSize: 13, fontWeight: "500" as const, flex: 1 },
  socialIcon: { color: "#D1D5DB", fontSize: 16, fontWeight: "700" as const },
});
