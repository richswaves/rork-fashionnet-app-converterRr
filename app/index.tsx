import React from "react";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Redirect href="/network" />
    </SafeAreaView>
  );
}
