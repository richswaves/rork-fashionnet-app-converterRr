import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Stack } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc } from "@/lib/trpc";

export default function GrantAdminScreen() {
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState("ec61e06e-025a-4708-aac7-09a12c5cf7fb");

  const assignAdminMutation = trpc.admin.assignAdminRole.useMutation({
    onSuccess: () => {
      Alert.alert("Success", "Admin role assigned successfully!");
    },
    onError: (error) => {
      Alert.alert("Error", error.message);
    },
  });

  const handleGrantAdmin = () => {
    if (!userId.trim()) {
      Alert.alert("Error", "Please enter a user ID");
      return;
    }

    assignAdminMutation.mutate({ userId: userId.trim() });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Grant Admin Access" }} />
      
      <View style={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.title}>Grant Admin Access</Text>
        <Text style={styles.subtitle}>Enter the user ID to grant admin privileges</Text>

        <TextInput
          style={styles.input}
          value={userId}
          onChangeText={setUserId}
          placeholder="User UUID"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[styles.button, assignAdminMutation.isPending && styles.buttonDisabled]}
          onPress={handleGrantAdmin}
          disabled={assignAdminMutation.isPending}
        >
          <Text style={styles.buttonText}>
            {assignAdminMutation.isPending ? "Granting Access..." : "Grant Admin Access"}
          </Text>
        </TouchableOpacity>

        {assignAdminMutation.isSuccess && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>✓ Admin role assigned successfully!</Text>
          </View>
        )}

        {assignAdminMutation.isError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Error: {assignAdminMutation.error.message}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
    color: "#000",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
    backgroundColor: "#f9f9f9",
  },
  button: {
    backgroundColor: "#000",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  successBox: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "#d4edda",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c3e6cb",
  },
  successText: {
    color: "#155724",
    fontSize: 16,
    fontWeight: "600",
  },
  errorBox: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "#f8d7da",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f5c6cb",
  },
  errorText: {
    color: "#721c24",
    fontSize: 14,
  },
});
