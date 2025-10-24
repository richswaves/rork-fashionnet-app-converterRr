import React from "react";
import { Redirect, useRootNavigationState } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useProfile } from "@/contexts/ProfileContext";

export default function Index() {
  const { session, isLoading } = useProfile();
  const rootState = useRootNavigationState();

  const notReady = !rootState?.key || isLoading;
  if (notReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  if (session) {
    return <Redirect href="/(tabs)/opportunities" />;
  }
  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B0F",
    alignItems: "center",
    justifyContent: "center",
  },
});
