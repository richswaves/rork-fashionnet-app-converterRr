import React, { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useProfile } from "@/contexts/ProfileContext";

export default function Index() {
  const { session, isLoading, profile } = useProfile();
  const router = useRouter();
  const didNavigate = useRef<boolean>(false);

  useEffect(() => {
    if (isLoading || didNavigate.current) return;
    const target = (() => {
      if (!session) return "/login";
      if (profile && profile.account_status === "approved") {
        return "/(tabs)/network";
      }
      if (profile && profile.account_status && profile.account_status !== "approved") {
        return "/onboarding/pending-approval";
      }
      if (profile && profile.is_profile_updated === false) {
        return "/onboarding/profile-setup";
      }
      return "/(tabs)/network";
    })();
    const id = setTimeout(() => {
      try {
        router.replace(target as any);
        didNavigate.current = true;
      } catch (e) {
        console.log("Deferred navigation error", e);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [isLoading, session, profile, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#8B5CF6" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B0F",
    alignItems: "center",
    justifyContent: "center",
  },
});
