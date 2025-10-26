import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useProfile } from "@/contexts/ProfileContext";
import { sbSelect, getSupabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import GrainTexture from "@/components/GrainTexture";
import { ChevronLeft, Shield, UserCog } from "lucide-react-native";

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

interface UserRole {
  user_id: string;
  role: string;
}

export default function AdminAccessScreen() {
  const router = useRouter();
  const { currentUserId } = useProfile();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

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

  const adminUsersQuery = useQuery<AdminUser[]>({
    queryKey: ["admin", "all-users"],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase) return [];
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      
      const statuses = ["pending", "approved", "rejected"];
      const allUsers: AdminUser[] = [];
      
      for (const status of statuses) {
        const response = await fetch(
          `https://mnqgmpvkdmgmyoqhgswc.supabase.co/functions/v1/get-pending-users?status=${status}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            allUsers.push(...data);
          }
        }
      }
      
      return allUsers;
    },
    enabled: !!isAdmin,
  });

  const userRolesQuery = useQuery<UserRole[]>({
    queryKey: ["admin", "user-roles"],
    queryFn: async () => {
      const rows = await sbSelect<UserRole>("user_roles", {
        select: "user_id,role",
      });
      return rows || [];
    },
    enabled: !!isAdmin,
  });

  const assignAdminMutation = trpc.admin.assignAdminRole.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "user-roles"] });
      Alert.alert("Success", "Admin role assigned successfully");
    },
    onError: (error) => {
      console.error("[Admin] Assign admin error:", error);
      Alert.alert("Error", "Failed to assign admin role");
    },
  });

  const handleMakeAdmin = (userId: string, userName?: string) => {
    Alert.alert(
      "Grant Admin Access",
      `Grant admin access to ${userName || "this user"}? This will give them full administrative privileges.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Grant Access", 
          onPress: () => assignAdminMutation.mutate({ userId }), 
          style: "default" 
        },
      ]
    );
  };

  const isUserAdmin = (userId: string) => {
    return userRolesQuery.data?.some(role => role.user_id === userId && role.role === "admin") ?? false;
  };

  const filteredUsers = React.useMemo(() => {
    const users = adminUsersQuery.data || [];
    if (!searchQuery.trim()) return users;
    
    const query = searchQuery.toLowerCase();
    return users.filter(user => 
      user.full_name?.toLowerCase().includes(query) ||
      user.username?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.user_id?.toLowerCase().includes(query)
    );
  }, [adminUsersQuery.data, searchQuery]);

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
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Shield size={28} color="#8B5CF6" />
            <Text style={styles.headerTitle}>Admin Access</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        
        <Text style={styles.headerSubtitle}>Manage user administrative privileges</Text>
        
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email, or user ID..."
            placeholderTextColor="#6B7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{adminUsersQuery.data?.length ?? 0}</Text>
            <Text style={styles.statLabel}>Total Users</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: "#8B5CF6" }]}>
              {userRolesQuery.data?.filter(r => r.role === "admin").length ?? 0}
            </Text>
            <Text style={styles.statLabel}>Admins</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={adminUsersQuery.isLoading || adminUsersQuery.isRefetching}
            onRefresh={() => {
              adminUsersQuery.refetch();
              userRolesQuery.refetch();
            }}
            tintColor="#FFFFFF"
          />
        }
      >
        {adminUsersQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading users...</Text>
          </View>
        ) : filteredUsers.length > 0 ? (
          filteredUsers.map((user) => {
            const isAdmin = isUserAdmin(user.user_id);
            return (
              <View key={user.user_id} style={styles.userCard}>
                <View style={styles.userHeader}>
                  <View style={styles.userInfo}>
                    <View style={styles.userNameRow}>
                      <Text style={styles.userName}>{user.full_name || user.username || "User"}</Text>
                      {isAdmin && (
                        <View style={styles.adminBadge}>
                          <Shield size={14} color="#8B5CF6" />
                          <Text style={styles.adminBadgeText}>ADMIN</Text>
                        </View>
                      )}
                    </View>
                    
                    {user.username && (
                      <Text style={styles.userUsername}>@{user.username}</Text>
                    )}
                    
                    <Text style={styles.userMeta}>
                      {user.profession || "No role"} • {user.location || "No location"}
                    </Text>
                    
                    {user.email && (
                      <Text style={styles.userEmail}>{user.email}</Text>
                    )}
                    
                    <View style={styles.statusRow}>
                      <View style={[
                        styles.statusBadge,
                        user.account_status === "approved" && styles.statusApproved,
                        user.account_status === "pending" && styles.statusPending,
                        user.account_status === "rejected" && styles.statusRejected,
                      ]}>
                        <Text style={styles.statusText}>
                          {user.account_status?.toUpperCase() || "UNKNOWN"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.userIdSection}>
                  <Text style={styles.userIdLabel}>User ID</Text>
                  <Text style={styles.userIdText}>{user.user_id}</Text>
                </View>

                {!isAdmin && (
                  <TouchableOpacity
                    style={[styles.grantButton, assignAdminMutation.isPending && styles.grantButtonDisabled]}
                    onPress={() => handleMakeAdmin(user.user_id, user.full_name || user.username)}
                    disabled={assignAdminMutation.isPending}
                  >
                    <UserCog size={18} color="#FFFFFF" />
                    <Text style={styles.grantButtonText}>Grant Admin Access</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? "No users found matching your search" : "No users available"}
            </Text>
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
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: { 
    color: "#FFFFFF", 
    fontSize: 24, 
    fontWeight: "700" as const,
  },
  headerSubtitle: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "500" as const,
  },
  searchContainer: {
    marginTop: 4,
  },
  searchInput: {
    backgroundColor: "#15151A",
    borderWidth: 1,
    borderColor: "#2A2A33",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: "#FFFFFF",
    fontSize: 15,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#15151A",
    borderWidth: 1,
    borderColor: "#2A2A33",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  statNumber: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700" as const,
  },
  statLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600" as const,
    marginTop: 2,
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, gap: 16 },
  content: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  errorText: { color: "#EF4444", fontSize: 18, fontWeight: "600" as const, marginBottom: 20 },
  backButton: { backgroundColor: "#FFFFFF", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  backButtonText: { color: "#000000", fontSize: 16, fontWeight: "600" as const },
  loadingContainer: { padding: 40, alignItems: "center" },
  loadingText: { color: "#9CA3AF", fontSize: 16 },
  emptyContainer: { padding: 40, alignItems: "center" },
  emptyText: { color: "#9CA3AF", fontSize: 16, textAlign: "center" },
  userCard: { 
    backgroundColor: "rgba(15, 15, 15, 0.85)", 
    borderColor: "#2A2A33", 
    borderWidth: 1, 
    borderRadius: 16, 
    padding: 16, 
    gap: 16 
  },
  userHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  userInfo: { flex: 1, gap: 6 },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userName: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" as const },
  userUsername: { color: "#9CA3AF", fontSize: 14, fontWeight: "500" as const },
  userMeta: { color: "#9CA3AF", fontSize: 14, fontWeight: "500" as const },
  userEmail: { color: "#6B7280", fontSize: 13, fontWeight: "400" as const },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  adminBadgeText: {
    color: "#8B5CF6",
    fontSize: 11,
    fontWeight: "800" as const,
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusApproved: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  statusPending: {
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  statusRejected: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800" as const,
    letterSpacing: 0.5,
  },
  userIdSection: {
    backgroundColor: "#15151A",
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  userIdLabel: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  userIdText: {
    color: "#9CA3AF",
    fontSize: 12,
    fontFamily: "monospace" as const,
  },
  grantButton: {
    backgroundColor: "#8B5CF6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  grantButtonDisabled: {
    opacity: 0.5,
  },
  grantButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700" as const,
  },
});
