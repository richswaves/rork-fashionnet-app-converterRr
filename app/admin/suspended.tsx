import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useProfile } from "@/contexts/ProfileContext";
import { sbSelect, sbUpdate } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import GrainTexture from "@/components/GrainTexture";
import { UserX, ArrowLeft } from "lucide-react-native";

interface SocialLinks {
  instagram?: string;
  youtube?: string;
  twitter?: string;
  tiktok?: string;
}

interface SuspendedUser {
  user_id: string;
  full_name?: string;
  username?: string;
  profile_picture?: string;
  profession?: string;
  location?: string;
  bio?: string;
  account_status?: string;
  created_at?: string;
  suspended_at?: string;
  email?: string;
  social_links?: SocialLinks | null;
}

export default function AdminSuspendedScreen() {
  const router = useRouter();
  const { currentUserId } = useProfile();
  const queryClient = useQueryClient();

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

  const suspendedUsersQuery = useQuery<SuspendedUser[]>({
    queryKey: ["admin", "suspended-users"],
    queryFn: async () => {
      console.log("[Admin] Fetching suspended users...");
      const rows = await sbSelect<SuspendedUser>("profiles", {
        select: "*",
        query: { account_status: "eq.suspended" },
        order: { column: "created_at", ascending: false },
      });
      console.log(`[Admin] Found ${rows.length} suspended users`);
      return rows;
    },
    enabled: !!isAdmin,
  });

  const unsuspendMutation = useMutation({
    mutationFn: async (userId: string) => {
      console.log(`[Admin] Unsuspending user ${userId}`);
      await sbUpdate("profiles", { account_status: "approved" }, { user_id: `eq.${userId}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "suspended-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users-by-status"] });
      Alert.alert("Success", "Account unsuspended");
    },
    onError: (error) => {
      console.error("[Admin] Unsuspend error:", error);
      Alert.alert("Error", "Failed to unsuspend account");
    },
  });

  const deletePermanentlyMutation = useMutation({
    mutationFn: async (userId: string) => {
      console.log(`[Admin] Permanently deleting user ${userId}`);
      await sbUpdate("profiles", { account_status: "rejected" }, { user_id: `eq.${userId}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "suspended-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users-by-status"] });
      Alert.alert("Success", "Account permanently deleted");
    },
    onError: (error) => {
      console.error("[Admin] Delete error:", error);
      Alert.alert("Error", "Failed to delete account");
    },
  });

  const handleUnsuspend = (userId: string, userName?: string) => {
    Alert.alert(
      "Unsuspend Account",
      `Unsuspend ${userName || "this user"}'s account? They will be able to access the app again.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Unsuspend", onPress: () => unsuspendMutation.mutate(userId), style: "default" },
      ]
    );
  };

  const handleDeletePermanently = (userId: string, userName?: string) => {
    Alert.alert(
      "Delete Account",
      `Permanently delete ${userName || "this user"}'s account? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", onPress: () => deletePermanentlyMutation.mutate(userId), style: "destructive" },
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

  const list = suspendedUsersQuery.data ?? [];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <GrainTexture />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Suspended Accounts</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.countRow}>
          <UserX size={16} color="#F59E0B" />
          <Text style={styles.countText}>{list.length} suspended accounts</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={suspendedUsersQuery.isLoading || suspendedUsersQuery.isRefetching}
            onRefresh={() => suspendedUsersQuery.refetch()}
            tintColor="#FFFFFF"
          />
        }
      >
        {suspendedUsersQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading suspended accounts...</Text>
          </View>
        ) : list.length > 0 ? (
          list.map((p) => {
            return (
              <View key={p.user_id} style={styles.accountCard}>
                <View style={styles.accountHeader}>
                  {p.profile_picture && (
                    <Image 
                      source={{ uri: p.profile_picture }}
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
                    {p.profession && (
                      <Text style={styles.userProfession}>{p.profession}</Text>
                    )}
                    {p.location && (
                      <Text style={styles.userLocation}>📍 {p.location}</Text>
                    )}
                    <Text style={styles.userDate}>
                      Joined: {p.created_at ? new Date(p.created_at).toLocaleDateString() : "Unknown"}
                    </Text>
                    {p.suspended_at && (
                      <View style={styles.suspendedBadge}>
                        <Text style={styles.suspendedBadgeText}>
                          Suspended: {new Date(p.suspended_at).toLocaleDateString()} at {new Date(p.suspended_at).toLocaleTimeString()}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {p.bio && (
                  <View style={styles.bioSection}>
                    <Text style={styles.bioLabel}>Bio</Text>
                    <Text style={styles.bioText}>{p.bio}</Text>
                  </View>
                )}

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.unsuspendButton]}
                    onPress={() => handleUnsuspend(p.user_id, p.full_name || p.username)}
                    disabled={unsuspendMutation.isPending || deletePermanentlyMutation.isPending}
                  >
                    <Text style={styles.unsuspendButtonText}>Unsuspend</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDeletePermanently(p.user_id, p.full_name || p.username)}
                    disabled={unsuspendMutation.isPending || deletePermanentlyMutation.isPending}
                  >
                    <Text style={styles.deleteButtonText}>Delete Permanently</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <UserX size={48} color="#4B5563" />
            <Text style={styles.emptyText}>No suspended accounts</Text>
            <Text style={styles.emptySubtext}>Suspended accounts will appear here</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#1F2937", gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "700" as const },
  countRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  countText: { color: "#F59E0B", fontSize: 14, fontWeight: "600" as const },
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
  accountCard: { 
    backgroundColor: "rgba(15, 15, 15, 0.85)", 
    borderColor: "#F59E0B", 
    borderWidth: 2, 
    borderRadius: 16, 
    padding: 16, 
    gap: 16,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  accountHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  profilePicture: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#1F2937" },
  userInfo: { flex: 1, gap: 4 },
  userName: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" as const },
  userProfession: { color: "#D1D5DB", fontSize: 14, fontWeight: "500" as const, textTransform: "capitalize" as const },
  userLocation: { color: "#9CA3AF", fontSize: 13, fontWeight: "500" as const },
  userDate: { color: "#6B7280", fontSize: 12, fontWeight: "400" as const, marginTop: 4 },
  suspendedBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  suspendedBadgeText: {
    color: "#F59E0B",
    fontSize: 12,
    fontWeight: "600" as const,
  },
  bioSection: { gap: 4 },
  bioLabel: { color: "#E5E7EB", fontSize: 14, fontWeight: "600" as const },
  bioText: { color: "#9CA3AF", fontSize: 14, lineHeight: 20 },
  actionButtons: { flexDirection: "row", gap: 12, marginTop: 4 },
  actionButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  unsuspendButton: { backgroundColor: "#10B981" },
  unsuspendButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" as const },
  deleteButton: { backgroundColor: "#DC2626" },
  deleteButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" as const },
});
