import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useProfile } from "@/contexts/ProfileContext";
import { sbSelect, sbUpdate } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import GrainTexture from "@/components/GrainTexture";
import { AlertTriangle, ArrowLeft, CheckCircle, XCircle } from "lucide-react-native";

interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  status: "pending" | "reviewing" | "resolved" | "dismissed";
  admin_notes?: string | null;
  created_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  reporter_profile?: {
    full_name?: string;
    username?: string;
    profile_picture?: string;
  };
  reported_profile?: {
    full_name?: string;
    username?: string;
    profile_picture?: string;
  };
}

type StatusTab = "pending" | "reviewing" | "resolved" | "dismissed";

export default function AdminReportsScreen() {
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

  const reportsQuery = useQuery<Report[]>({
    queryKey: ["admin", "reports"],
    queryFn: async () => {
      console.log("[Admin] Fetching reports...");
      const rows = await sbSelect<Report>("reports", {
        select: "*",
        order: { column: "created_at", ascending: false },
      });
      
      const enrichedRows: Report[] = await Promise.all(
        rows.map(async (report): Promise<Report> => {
          const [reporterProfile, reportedProfile] = await Promise.all([
            sbSelect<{ full_name?: string; username?: string; profile_picture?: string }>("profiles", {
              select: "full_name,username,profile_picture",
              query: { user_id: `eq.${report.reporter_id}` },
              limit: 1,
            }).then(r => r[0]),
            sbSelect<{ full_name?: string; username?: string; profile_picture?: string }>("profiles", {
              select: "full_name,username,profile_picture",
              query: { user_id: `eq.${report.reported_user_id}` },
              limit: 1,
            }).then(r => r[0]),
          ]);
          
          return {
            ...report,
            reporter_profile: reporterProfile,
            reported_profile: reportedProfile,
          };
        })
      );
      
      console.log(`[Admin] Found ${rows.length} reports`);
      return enrichedRows;
    },
    enabled: !!isAdmin,
  });

  const updateReportMutation = useMutation({
    mutationFn: async ({ reportId, status, adminNotes }: { reportId: string; status: string; adminNotes?: string }) => {
      console.log(`[Admin] Updating report ${reportId} to ${status}`);
      const updates: any = { status };
      if (status === "resolved" || status === "dismissed") {
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by = currentUserId;
      }
      if (adminNotes) {
        updates.admin_notes = adminNotes;
      }
      await sbUpdate("reports", updates, { id: `eq.${reportId}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
      Alert.alert("Success", "Report updated");
    },
    onError: (error) => {
      console.error("[Admin] Report update error:", error);
      Alert.alert("Error", "Failed to update report");
    },
  });

  const handleMarkAsReviewing = (reportId: string) => {
    updateReportMutation.mutate({ reportId, status: "reviewing" });
  };

  const handleResolve = (reportId: string) => {
    Alert.alert(
      "Resolve Report",
      "Mark this report as resolved?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Resolve", onPress: () => updateReportMutation.mutate({ reportId, status: "resolved" }) },
      ]
    );
  };

  const handleDismiss = (reportId: string) => {
    Alert.alert(
      "Dismiss Report",
      "Dismiss this report? It will be marked as not requiring action.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Dismiss", onPress: () => updateReportMutation.mutate({ reportId, status: "dismissed" }), style: "destructive" },
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

  const filteredReports = reportsQuery.data?.filter((r) => r.status === activeTab) ?? [];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <GrainTexture />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reports</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.tabsRow}>
          {(["pending", "reviewing", "resolved", "dismissed"] as StatusTab[]).map((t) => {
            const count = reportsQuery.data?.filter((r) => r.status === t)?.length ?? 0;
            return (
              <TouchableOpacity key={t} onPress={() => setActiveTab(t)} style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}>
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
            refreshing={reportsQuery.isLoading || reportsQuery.isRefetching}
            onRefresh={() => reportsQuery.refetch()}
            tintColor="#FFFFFF"
          />
        }
      >
        {reportsQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading reports...</Text>
          </View>
        ) : filteredReports.length > 0 ? (
          filteredReports.map((report) => {
            const reportedName = report.reported_profile?.full_name || report.reported_profile?.username || "Unknown User";
            const reporterName = report.reporter_profile?.full_name || report.reporter_profile?.username || "Unknown User";
            
            return (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <View style={styles.reportUsers}>
                    <View style={styles.userRow}>
                      {report.reporter_profile?.profile_picture && (
                        <Image
                          source={{ uri: report.reporter_profile.profile_picture }}
                          style={styles.avatarSmall}
                          resizeMode="cover"
                        />
                      )}
                      <View>
                        <Text style={styles.userLabel}>Reporter</Text>
                        <Text style={styles.userName}>{reporterName}</Text>
                      </View>
                    </View>
                    <Text style={styles.arrow}>→</Text>
                    <View style={styles.userRow}>
                      {report.reported_profile?.profile_picture && (
                        <Image
                          source={{ uri: report.reported_profile.profile_picture }}
                          style={styles.avatarSmall}
                          resizeMode="cover"
                        />
                      )}
                      <View>
                        <Text style={styles.userLabel}>Reported</Text>
                        <Text style={styles.userName}>{reportedName}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.timestamp}>
                    {new Date(report.created_at).toLocaleDateString()} at {new Date(report.created_at).toLocaleTimeString()}
                  </Text>
                </View>

                <View style={styles.reasonSection}>
                  <Text style={styles.reasonLabel}>Reason</Text>
                  <Text style={styles.reasonText}>{report.reason}</Text>
                </View>

                {report.admin_notes && (
                  <View style={styles.notesSection}>
                    <Text style={styles.notesLabel}>Admin Notes</Text>
                    <Text style={styles.notesText}>{report.admin_notes}</Text>
                  </View>
                )}

                {report.status === "pending" && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.reviewButton]}
                      onPress={() => handleMarkAsReviewing(report.id)}
                      disabled={updateReportMutation.isPending}
                    >
                      <AlertTriangle size={16} color="#F59E0B" />
                      <Text style={styles.reviewButtonText}>Mark Reviewing</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.resolveButton]}
                      onPress={() => handleResolve(report.id)}
                      disabled={updateReportMutation.isPending}
                    >
                      <CheckCircle size={16} color="#10B981" />
                      <Text style={styles.resolveButtonText}>Resolve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.dismissButton]}
                      onPress={() => handleDismiss(report.id)}
                      disabled={updateReportMutation.isPending}
                    >
                      <XCircle size={16} color="#EF4444" />
                      <Text style={styles.dismissButtonText}>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {report.status === "reviewing" && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.resolveButton]}
                      onPress={() => handleResolve(report.id)}
                      disabled={updateReportMutation.isPending}
                    >
                      <CheckCircle size={16} color="#10B981" />
                      <Text style={styles.resolveButtonText}>Resolve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.dismissButton]}
                      onPress={() => handleDismiss(report.id)}
                      disabled={updateReportMutation.isPending}
                    >
                      <XCircle size={16} color="#EF4444" />
                      <Text style={styles.dismissButtonText}>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <AlertTriangle size={48} color="#4B5563" />
            <Text style={styles.emptyText}>No {activeTab} reports</Text>
            <Text style={styles.emptySubtext}>Reports will appear here</Text>
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
  tabsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" as const },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#15151A", borderWidth: 1, borderColor: "#2A2A33" },
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
  reportCard: {
    backgroundColor: "rgba(15, 15, 15, 0.85)",
    borderColor: "#EF4444",
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  reportHeader: { gap: 8 },
  reportUsers: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  userRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  avatarSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1F2937" },
  userLabel: { color: "#6B7280", fontSize: 11, fontWeight: "600" as const, textTransform: "uppercase" as const },
  userName: { color: "#E5E7EB", fontSize: 14, fontWeight: "700" as const },
  arrow: { color: "#6B7280", fontSize: 20, paddingHorizontal: 8 },
  timestamp: { color: "#6B7280", fontSize: 12 },
  reasonSection: { gap: 4 },
  reasonLabel: { color: "#E5E7EB", fontSize: 13, fontWeight: "600" as const },
  reasonText: { color: "#D1D5DB", fontSize: 14, lineHeight: 20 },
  notesSection: { gap: 4, backgroundColor: "rgba(139, 92, 246, 0.1)", padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "rgba(139, 92, 246, 0.3)" },
  notesLabel: { color: "#C4B5FD", fontSize: 13, fontWeight: "600" as const },
  notesText: { color: "#E9D5FF", fontSize: 13, lineHeight: 18 },
  actionButtons: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" as const },
  actionButton: { flex: 1, minWidth: 90, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
  reviewButton: { backgroundColor: "rgba(245, 158, 11, 0.15)", borderWidth: 1, borderColor: "#F59E0B" },
  reviewButtonText: { color: "#F59E0B", fontSize: 13, fontWeight: "700" as const },
  resolveButton: { backgroundColor: "rgba(16, 185, 129, 0.15)", borderWidth: 1, borderColor: "#10B981" },
  resolveButtonText: { color: "#10B981", fontSize: 13, fontWeight: "700" as const },
  dismissButton: { backgroundColor: "rgba(239, 68, 68, 0.15)", borderWidth: 1, borderColor: "#EF4444" },
  dismissButtonText: { color: "#EF4444", fontSize: 13, fontWeight: "700" as const },
});
