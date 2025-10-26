import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useProfile } from "@/contexts/ProfileContext";
import GrainTexture from "@/components/GrainTexture";
import { sbInsert, sbSelect } from "@/integrations/supabase/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Ban, AlertTriangle } from "lucide-react-native";

interface Appeal {
  id: string;
  user_id: string;
  reason: string;
  status: "pending" | "reviewing" | "approved" | "rejected";
  admin_notes?: string | null;
  created_at: string;
}

export default function AccountSuspended() {
  const router = useRouter();
  const { logout, profile } = useProfile();
  const [appealText, setAppealText] = useState<string>("");
  const [showAppealForm, setShowAppealForm] = useState<boolean>(false);

  const appealsQuery = useQuery<Appeal[]>({
    queryKey: ["appeals", profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      const rows = await sbSelect<Appeal>("appeals", {
        select: "*",
        query: { user_id: `eq.${profile.user_id}` },
        order: { column: "created_at", ascending: false },
      });
      return rows;
    },
    enabled: !!profile?.user_id,
  });

  const submitAppealMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!profile?.user_id) throw new Error("No user ID");
      console.log("[Appeal] Submitting appeal for user:", profile.user_id);
      await sbInsert("appeals", {
        user_id: profile.user_id,
        reason,
        status: "pending",
      });
    },
    onSuccess: () => {
      console.log("[Appeal] Successfully submitted appeal");
      setAppealText("");
      setShowAppealForm(false);
      appealsQuery.refetch();
    },
    onError: (error) => {
      console.error("[Appeal] Error submitting appeal:", error);
    },
  });

  const handleSignOut = async () => {
    await logout();
    router.replace("/login" as any);
  };

  const handleSubmitAppeal = () => {
    if (!appealText.trim()) return;
    submitAppealMutation.mutate(appealText.trim());
  };

  const latestAppeal = appealsQuery.data?.[0];
  const hasActiveAppeal = latestAppeal && (latestAppeal.status === "pending" || latestAppeal.status === "reviewing");

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <GrainTexture />
      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconContainer}>
            <Ban size={80} color="#EF4444" strokeWidth={1.5} />
          </View>

          <View style={styles.headerSection}>
            <Text style={styles.title}>Account Suspended</Text>
            <Text style={styles.subtitle}>
              Your account has been suspended due to a violation of our community guidelines.
            </Text>
            {profile?.suspended_at && (
              <Text style={styles.suspendedDate}>
                Suspended on {new Date(profile.suspended_at).toLocaleDateString()} at {new Date(profile.suspended_at).toLocaleTimeString()}
              </Text>
            )}
          </View>

          {hasActiveAppeal && latestAppeal ? (
            <View style={styles.appealStatusCard}>
              <View style={styles.appealStatusHeader}>
                <AlertTriangle size={20} color="#F59E0B" />
                <Text style={styles.appealStatusTitle}>
                  {latestAppeal.status === "pending" ? "Appeal Pending" : "Appeal Under Review"}
                </Text>
              </View>
              <Text style={styles.appealStatusText}>
                Your appeal is currently {latestAppeal.status === "pending" ? "waiting to be reviewed" : "being reviewed"} by our team. We&apos;ll update you soon.
              </Text>
              <View style={styles.appealReasonSection}>
                <Text style={styles.appealReasonLabel}>Your appeal:</Text>
                <Text style={styles.appealReasonText}>{latestAppeal.reason}</Text>
              </View>
              <Text style={styles.appealDate}>
                Submitted {new Date(latestAppeal.created_at).toLocaleDateString()}
              </Text>
            </View>
          ) : latestAppeal?.status === "rejected" ? (
            <View style={styles.rejectedAppealCard}>
              <View style={styles.rejectedHeader}>
                <Ban size={20} color="#EF4444" />
                <Text style={styles.rejectedTitle}>Appeal Rejected</Text>
              </View>
              <Text style={styles.rejectedText}>
                Your previous appeal was reviewed and rejected.
              </Text>
              {latestAppeal.admin_notes && (
                <View style={styles.adminNotesSection}>
                  <Text style={styles.adminNotesLabel}>Admin response:</Text>
                  <Text style={styles.adminNotesText}>{latestAppeal.admin_notes}</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.reappealButton}
                onPress={() => setShowAppealForm(true)}
              >
                <Text style={styles.reappealButtonText}>Submit New Appeal</Text>
              </TouchableOpacity>
            </View>
          ) : latestAppeal?.status === "approved" ? (
            <View style={styles.approvedAppealCard}>
              <Text style={styles.approvedText}>
                Your appeal was approved! Please refresh or sign out and back in.
              </Text>
            </View>
          ) : (
            <>
              {!showAppealForm ? (
                <TouchableOpacity
                  style={styles.appealButton}
                  onPress={() => setShowAppealForm(true)}
                >
                  <Text style={styles.appealButtonText}>Appeal Suspension</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.appealForm}>
                  <Text style={styles.appealFormTitle}>Submit an Appeal</Text>
                  <Text style={styles.appealFormSubtitle}>
                    Explain why you believe your suspension should be reconsidered.
                  </Text>
                  <TextInput
                    style={styles.appealInput}
                    placeholder="Describe your situation..."
                    placeholderTextColor="#6B7280"
                    value={appealText}
                    onChangeText={setAppealText}
                    multiline
                    numberOfLines={8}
                    textAlignVertical="top"
                  />
                  <View style={styles.appealFormButtons}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setShowAppealForm(false);
                        setAppealText("");
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        (!appealText.trim() || submitAppealMutation.isPending) && styles.submitButtonDisabled
                      ]}
                      onPress={handleSubmitAppeal}
                      disabled={!appealText.trim() || submitAppealMutation.isPending}
                    >
                      <Text style={styles.submitButtonText}>
                        {submitAppealMutation.isPending ? "Submitting..." : "Submit Appeal"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}

          <View style={styles.infoSection}>
            <Text style={styles.infoText}>
              If you believe this is a mistake, please submit an appeal above. Our team will review your case and respond within 24-48 hours.
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleSignOut}
            style={styles.signOutBtn}
            testID="suspended-sign-out"
          >
            <Text style={styles.signOutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000"
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    gap: 24,
  },
  iconContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  headerSection: {
    gap: 12,
    alignItems: "center",
  },
  title: {
    color: "#EF4444",
    fontSize: 32,
    fontWeight: "800" as const,
    textAlign: "center",
  },
  subtitle: {
    color: "#D1D5DB",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  suspendedDate: {
    color: "#9CA3AF",
    fontSize: 14,
    marginTop: 8,
  },
  appealStatusCard: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderColor: "#F59E0B",
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  appealStatusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  appealStatusTitle: {
    color: "#F59E0B",
    fontSize: 18,
    fontWeight: "700" as const,
  },
  appealStatusText: {
    color: "#FCD34D",
    fontSize: 15,
    lineHeight: 22,
  },
  appealReasonSection: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    padding: 12,
    borderRadius: 10,
    gap: 6,
    marginTop: 4,
  },
  appealReasonLabel: {
    color: "#D1D5DB",
    fontSize: 13,
    fontWeight: "600" as const,
  },
  appealReasonText: {
    color: "#E5E7EB",
    fontSize: 14,
    lineHeight: 20,
  },
  appealDate: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 4,
  },
  rejectedAppealCard: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "#EF4444",
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  rejectedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rejectedTitle: {
    color: "#EF4444",
    fontSize: 18,
    fontWeight: "700" as const,
  },
  rejectedText: {
    color: "#FCA5A5",
    fontSize: 15,
    lineHeight: 22,
  },
  adminNotesSection: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    padding: 12,
    borderRadius: 10,
    gap: 6,
    marginTop: 4,
  },
  adminNotesLabel: {
    color: "#D1D5DB",
    fontSize: 13,
    fontWeight: "600" as const,
  },
  adminNotesText: {
    color: "#E5E7EB",
    fontSize: 14,
    lineHeight: 20,
  },
  reappealButton: {
    backgroundColor: "#374151",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  reappealButtonText: {
    color: "#E5E7EB",
    fontSize: 16,
    fontWeight: "700" as const,
  },
  approvedAppealCard: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderColor: "#10B981",
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
  },
  approvedText: {
    color: "#6EE7B7",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  appealButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  appealButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700" as const,
  },
  appealForm: {
    backgroundColor: "rgba(31, 41, 55, 0.5)",
    borderRadius: 16,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: "#374151",
  },
  appealFormTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700" as const,
  },
  appealFormSubtitle: {
    color: "#9CA3AF",
    fontSize: 14,
    lineHeight: 20,
  },
  appealInput: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    color: "#FFFFFF",
    fontSize: 16,
    minHeight: 150,
    borderWidth: 1,
    borderColor: "#374151",
  },
  appealFormButtons: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#374151",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#D1D5DB",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  submitButton: {
    flex: 1,
    backgroundColor: "#3B82F6",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: "#1F2937",
    opacity: 0.5,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700" as const,
  },
  infoSection: {
    paddingHorizontal: 8,
  },
  infoText: {
    color: "#9CA3AF",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  signOutBtn: {
    backgroundColor: "#E5E7EB",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 16,
  },
  signOutBtnText: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "600" as const,
  },
});
