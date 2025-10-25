import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  Image,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { getSupabase } from "@/integrations/supabase/client";
import { useProfile } from "@/contexts/ProfileContext";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";

const words = ["create", "community", "collab"];

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useProfile();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [displayedText, setDisplayedText] = useState<string>("");
  const [wordIndex, setWordIndex] = useState<number>(0);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showLoginForm, setShowLoginForm] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  useEffect(() => {
    const currentWord = words[wordIndex];
    const typingSpeed = isDeleting ? 40 : 75;
    const pauseBeforeDelete = 2000;
    const pauseBeforeType = 500;

    const timer = setTimeout(
      () => {
        if (!isDeleting && displayedText === currentWord) {
          setTimeout(() => setIsDeleting(true), pauseBeforeDelete);
        } else if (isDeleting && displayedText === "") {
          setIsDeleting(false);
          setWordIndex((prev) => (prev + 1) % words.length);
        } else if (isDeleting) {
          setDisplayedText(currentWord.substring(0, displayedText.length - 1));
        } else {
          setDisplayedText(currentWord.substring(0, displayedText.length + 1));
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        }
      },
      !isDeleting && displayedText === currentWord
        ? pauseBeforeDelete
        : isDeleting && displayedText === ""
        ? pauseBeforeType
        : typingSpeed
    );

    return () => clearTimeout(timer);
  }, [displayedText, isDeleting, wordIndex]);

  const handleAppleLogin = async () => {
    Alert.alert("Coming Soon", "Apple sign-in will be available soon.");
  };

  const handleGoogleLogin = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      Alert.alert("Error", "Supabase is not configured.");
      return;
    }
    setIsLoading(true);
    try {
      WebBrowser.maybeCompleteAuthSession?.();
      const redirectTo = Platform.select<string | undefined>({
        web: typeof window !== "undefined" ? window.location.origin : undefined,
        default: Linking.createURL("/") ?? undefined,
      });
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("Google login error:", error);
      const msg = typeof error?.message === "string" ? error.message : "We couldn't start Google sign-in.";
      Alert.alert("Google Sign-in Failed", msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = () => {
    try {
      router.push("/signup" as any);
    } catch (e) {
      console.log("Nav error", e);
    }
  };

  const handleLogin = () => {
    setShowLoginForm(true);
  };

  const handleLoginSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    if (trimmedPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    try {
      await login(trimmedEmail, trimmedPassword);
      router.replace("/" as any);
    } catch (error: any) {
      console.error("Login error:", error);
      const msg = typeof error?.message === "string" ? error.message : "Failed to log in";
      Alert.alert("Login Failed", msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToMain = () => {
    setShowLoginForm(false);
    setEmail("");
    setPassword("");
  };

  if (showLoginForm) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ gap: 24 }}>
              <TouchableOpacity onPress={handleBackToMain} style={styles.backButton}>
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>

              <Text style={styles.formTitle}>Log in to your account</Text>

              <View style={{ gap: 16 }}>
                <TextInput
                  testID="login-email"
                  placeholder="Email"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                  style={styles.input}
                />
                <TextInput
                  testID="login-password"
                  placeholder="Password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  style={styles.input}
                  onSubmitEditing={handleLoginSubmit}
                  returnKeyType="go"
                />
              </View>
            </View>

            <TouchableOpacity
              testID="login-submit"
              style={[styles.submitButton, { opacity: isLoading ? 0.6 : 1 }]}
              onPress={handleLoginSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.submitButtonText}>Log in</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {displayedText}<Text style={styles.cursor}>|</Text>
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.appleButton}
            onPress={handleAppleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <>
                <Text style={styles.appleIcon}></Text>
                <Text style={styles.appleButtonText}>Continue with Apple</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Image
                  source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" }}
                  style={styles.googleIcon}
                />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signUpButton}
            onPress={handleSignUp}
            disabled={isLoading}
          >
            <Text style={styles.signUpButtonText}>Sign up</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.loginButtonText}>Log in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 120,
  },
  title: {
    fontSize: 48,
    fontWeight: "700" as const,
    color: "#FFFFFF",
    lineHeight: 56,
    textAlign: "center" as const,
  },
  cursor: {
    color: "#FFFFFF",
    fontSize: 48,
  },
  buttonContainer: {
    width: "100%",
    gap: 12,
  },
  appleButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  appleIcon: {
    fontSize: 20,
    color: "#000000",
  },
  appleButtonText: {
    fontSize: 17,
    fontWeight: "600" as const,
    color: "#000000",
  },
  googleButton: {
    backgroundColor: "#2A2A2A",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  googleButtonText: {
    fontSize: 17,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
  signUpButton: {
    backgroundColor: "#2A2A2A",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  signUpButtonText: {
    fontSize: 17,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
  loginButton: {
    backgroundColor: "transparent",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  loginButtonText: {
    fontSize: 17,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
  formContent: {
    flex: 1,
    padding: 20,
    gap: 24,
    justifyContent: "space-between",
  },
  backButton: {
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  formTitle: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "700" as const,
  },
  input: {
    backgroundColor: "#1A1A1A",
    borderColor: "#2A2A2A",
    borderWidth: 1,
    color: "#FFFFFF",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 16,
  },
  submitButtonText: {
    color: "#000000",
    fontSize: 17,
    fontWeight: "600" as const,
  },
});
