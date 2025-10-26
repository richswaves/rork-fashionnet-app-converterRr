import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useProfile } from "@/contexts/ProfileContext";
import GrainTexture from "@/components/GrainTexture";
import { getSupabase, sbSelect } from "@/integrations/supabase/client";

export default function PendingApproval() {
  const router = useRouter();
  const { logout, session, profile } = useProfile();
  const checkingRef = useRef<boolean>(false);

  const userEmail = useMemo(() => {
    return session?.user?.email || "your email";
  }, [session]);

  useEffect(() => {
    if (profile?.account_status === "approved") {
      try {
        router.replace("/(tabs)/opportunities" as any);
      } catch (e) {
        console.log("PendingApproval immediate redirect error", e);
      }
    }
  }, [profile?.account_status, router]);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabase();

    const checkStatus = async () => {
      if (checkingRef.current) return;
      checkingRef.current = true;
      try {
        const uid: string | undefined = session?.user?.id;
        if (!uid) return;
        const rows = await sbSelect<{ account_status?: string }>("profiles", {
          select: "account_status",
          query: { user_id: `eq.${uid}` },
          limit: 1,
        });
        const status = rows[0]?.account_status;
        if (isMounted && status === "approved") {
          router.replace("/(tabs)/opportunities" as any);
        }
      } catch (e) {
        console.log("PendingApproval status poll failed", e);
      } finally {
        checkingRef.current = false;
      }
    };

    const interval = setInterval(checkStatus, 8000);
    checkStatus();

    const channel = supabase?.channel(`profiles-status:${session?.user?.id ?? "anon"}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: session?.user?.id ? `user_id=eq.${session.user.id}` : undefined },
        (payload: any) => {
          const next = (payload?.new as { account_status?: string } | undefined)?.account_status;
          if (next === "approved") {
            try {
              router.replace("/(tabs)/opportunities" as any);
            } catch (e) {
              console.log("Realtime redirect error", e);
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (channel && supabase) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [router, session?.user?.id]);

  const handleSignOut = async () => {
    await logout();
    router.replace("/login" as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <GrainTexture />
      <View style={styles.content}>
        <View style={styles.statusSection}>
          <Text style={styles.statusLabel}>Application status:</Text>
          <Text style={styles.statusTitle}>{profile?.account_status === "approved" ? "Approved" : "In review"}</Text>
          
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, profile?.account_status === "approved" ? styles.progressBarDone : null]} />
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            Complete your application to join the BRXND community.
          </Text>
          
          <Text style={[styles.infoText, { marginTop: 32 }]}>
            Our team typically reviews applications within{" "}
            <Text style={styles.infoTextBold}>1-2 hours.</Text>
          </Text>
          
          <Text style={[styles.infoText, { marginTop: 16 }]}>
            We&apos;ll send you an email at{" "}
            <Text style={styles.infoTextBold}>{userEmail}</Text> once approved.
          </Text>
        </View>

        <View style={styles.buttonSection}>
          <TouchableOpacity 
            onPress={handleSignOut} 
            style={styles.signOutBtn} 
            testID="pending-sign-out"
          >
            <Text style={styles.signOutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#000000" 
  },
  content: { 
    flex: 1, 
    paddingHorizontal: 24, 
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: "space-between"
  },
  statusSection: {
    gap: 12
  },
  statusLabel: {
    color: "#9CA3AF",
    fontSize: 16,
    fontWeight: "500" as const,
    letterSpacing: 0.3
  },
  statusTitle: {
    color: "#FFFFFF",
    fontSize: 48,
    fontWeight: "700" as const,
    lineHeight: 56,
    marginTop: 8
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: "#1F2937",
    borderRadius: 3,
    overflow: "hidden" as const,
    marginTop: 20
  },
  progressBar: {
    height: "100%",
    width: "35%",
    backgroundColor: "#D1D5DB",
    borderRadius: 3
  },
  progressBarDone: {
    width: "100%",
    backgroundColor: "#4CB963",
  },
  infoSection: {
    flex: 1,
    justifyContent: "flex-start",
    marginTop: 40
  },
  infoText: {
    color: "#9CA3AF",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const
  },
  infoTextBold: {
    color: "#FFFFFF",
    fontWeight: "600" as const
  },
  buttonSection: {
    width: "100%"
  },
  signOutBtn: {
    backgroundColor: "#E5E7EB",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center"
  },
  signOutBtnText: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "600" as const
  }
});
