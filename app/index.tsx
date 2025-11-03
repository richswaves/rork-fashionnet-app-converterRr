import React, { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useProfile } from "@/contexts/ProfileContext";

export default function Index() {
  const { session, isLoading, profile } = useProfile();
  const router = useRouter();
  const didNavigate = useRef<boolean>(false);
  
  console.log('[Index] App starting...');

  useEffect(() => {
    if (isLoading || didNavigate.current) {
      console.log('[Index] Waiting... isLoading:', isLoading, 'didNavigate:', didNavigate.current);
      return;
    }
    
    console.log('[Index] Determining route...', { session: !!session, profile: profile });
    
    const target = (() => {
      if (!session) return "/login";
      if (profile && profile.account_status === "suspended") {
        return "/account-suspended";
      }
      if (profile && profile.account_status === "approved") {
        return "/(tabs)/opportunities";
      }
      if (profile && profile.account_status && profile.account_status !== "approved") {
        return "/onboarding/pending-approval";
      }
      if (profile && profile.is_profile_updated === false) {
        return "/onboarding/profile-setup";
      }
      return "/(tabs)/network";
    })();
    
    console.log('[Index] Navigating to:', target);
    
    const id = setTimeout(() => {
      if (didNavigate.current) return;
      try {
        didNavigate.current = true;
        router.replace(target as any);
      } catch (e) {
        console.error('[Index] Navigation error:', e);
        didNavigate.current = false;
      }
    }, 100);
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
