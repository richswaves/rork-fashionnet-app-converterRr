import React from "react";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0B0F" }}>
      <Redirect href="/opportunities" />
    </SafeAreaView>
  );
}
