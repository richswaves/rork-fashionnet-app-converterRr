// template
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { trpc, trpcClient } from "@/lib/trpc";
import { getSupabase, setRuntimeSupabaseEnv } from "@/integrations/supabase/client";

const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const envAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (envUrl && envAnon) {
  setRuntimeSupabaseEnv(envUrl, envAnon);
} else {
  // Fallback for Expo Go/mobile where process.env is not populated
  setRuntimeSupabaseEnv(
    "https://mnqgmpvkdmgmyoqhgswc.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWdtcHZrZG1nbXlvcWhnc3djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzMTM0NTksImV4cCI6MjA2Njg4OTQ1OX0.JeTVfB0c5MDmgSElxpkI9eVW6Ca7QLTNj3p-Vgq2VdE"
  );
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        contentStyle: { backgroundColor: "#0B0B0F" },
        headerStyle: { backgroundColor: "#0B0B0F" },
        headerTintColor: "#E5E7EB",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding/profile-setup" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding/pending-approval" options={{ headerShown: false }} />
      <Stack.Screen name="account-suspended" options={{ headerShown: false }} />
      <Stack.Screen name="admin/approvals" options={{ headerShown: false }} />
      <Stack.Screen name="create-opportunity" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();

    const supabase = getSupabase();
    if (!supabase) return;

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        console.log('User signed in via OAuth:', session.user.email);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ProfileProvider>
          <NotificationProvider>
            <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0B0B0F" }}>
              <RootLayoutNav />
            </GestureHandlerRootView>
          </NotificationProvider>
        </ProfileProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
