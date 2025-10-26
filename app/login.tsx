import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import GrainTexture from "@/components/GrainTexture";

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
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [isSendingReset, setIsSendingReset] = useState<boolean>(false);

  useFocusEffect(
    React.useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
      };
    }, [])
  );

  useEffect(() => {
    if (showLoginForm || !isFocused) return;

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
  }, [displayedText, isDeleting, wordIndex, showLoginForm, isFocused]);

  const handleAppleLogin = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      Alert.alert("Error", "Supabase is not configured.");
      return;
    }
    setIsLoading(true);
    try {
      if (Platform.OS === 'web') {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: {
            redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
          },
        });
        if (error) throw error;
      } else {
        const redirectTo = Linking.createURL("/");
        console.log('Apple Redirect URL:', redirectTo);
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: {
            redirectTo,
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        if (!data?.url) throw new Error('No OAuth URL returned');
        console.log('Opening Apple OAuth URL:', data.url);
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, { showInRecents: true });
        console.log('Apple OAuth result:', result);
        if (result.type === 'success') {
          const url = result.url || '';
          const parsed = Linking.parse(url);
          const qp = parsed.queryParams as Record<string, string | undefined> | undefined;
          const hash = url.includes('#') ? url.split('#')[1] : undefined;
          const hashParams = (() => {
            if (!hash) return {} as Record<string, string>;
            return Object.fromEntries(hash.split('&').map(p => {
              const [k, v] = p.split('=');
              return [decodeURIComponent(k ?? ''), decodeURIComponent(v ?? '')];
            }));
          })();
          const code = (qp?.code as string | undefined) ?? (hashParams['code'] as string | undefined);
          const accessToken = (qp?.access_token as string | undefined) ?? (hashParams['access_token'] as string | undefined);
          const refreshToken = (qp?.refresh_token as string | undefined) ?? (hashParams['refresh_token'] as string | undefined);

          try {
            if (code) {
              console.log('Exchanging Apple code for session');
              const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
              if (exchangeError) throw exchangeError;
            } else if (accessToken) {
              console.log('Setting Apple session from tokens');
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
              });
              if (sessionError) throw sessionError;
            } else {
              throw new Error('Missing auth code and access token in redirect URL');
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              router.replace('/' as any);
            } else {
              throw new Error('No user after Apple sign-in');
            }
          } catch (e) {
            console.error('Post-Apple OAuth session handling failed', e);
            Alert.alert('Sign-in error', 'We could not complete Apple sign-in. Please try again.');
          }
        } else if (result.type === 'cancel') {
          console.log('User cancelled Apple OAuth');
        }
      }
    } catch (error: any) {
      console.error('Apple login error:', error);
      const msg = typeof error?.message === 'string' ? error.message : 'We could not start Apple sign-in.';
      Alert.alert('Apple Sign-in Failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      Alert.alert("Error", "Supabase is not configured.");
      return;
    }
    setIsLoading(true);
    try {
      if (Platform.OS === 'web') {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        });
        if (error) throw error;
      } else {
        const redirectTo = Linking.createURL("/");
        console.log('Redirect URL:', redirectTo);
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        if (!data?.url) {
          throw new Error("No OAuth URL returned");
        }
        console.log('Opening OAuth URL:', data.url);
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo,
          { showInRecents: true }
        );
        console.log('OAuth result:', result);
        if (result.type === 'success') {
          const url = result.url || '';
          const parsed = Linking.parse(url);
          const qp = parsed.queryParams as Record<string, string | undefined> | undefined;
          const hash = url.includes('#') ? url.split('#')[1] : undefined;
          const hashParams = (() => {
            if (!hash) return {} as Record<string, string>;
            return Object.fromEntries(hash.split('&').map(p => {
              const [k, v] = p.split('=');
              return [decodeURIComponent(k ?? ''), decodeURIComponent(v ?? '')];
            }));
          })();

          const code = (qp?.code as string | undefined) ?? (hashParams['code'] as string | undefined);
          const accessToken = (qp?.access_token as string | undefined) ?? (hashParams['access_token'] as string | undefined);
          const refreshToken = (qp?.refresh_token as string | undefined) ?? (hashParams['refresh_token'] as string | undefined);

          try {
            if (code) {
              console.log('Exchanging code for session');
              const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
              if (exchangeError) throw exchangeError;
            } else if (accessToken) {
              console.log('Setting session from tokens');
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
              });
              if (sessionError) throw sessionError;
            } else {
              throw new Error('Missing auth code and access token in redirect URL');
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              router.replace("/" as any);
            } else {
              throw new Error('No user after sign-in');
            }
          } catch (e) {
            console.error('Post-OAuth session handling failed', e);
            Alert.alert('Sign-in error', 'We could not complete sign-in. Please try again.');
          }
        } else if (result.type === 'cancel') {
          console.log('User cancelled OAuth');
        }
      }
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
        <GrainTexture />
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

            <TouchableOpacity
              testID="forgot-password"
              style={styles.forgotButton}
              onPress={async () => {
                const supabase = getSupabase();
                if (!supabase) {
                  Alert.alert("Error", "Supabase is not configured.");
                  return;
                }
                const trimmedEmail = email.trim().toLowerCase();
                if (!trimmedEmail) {
                  Alert.alert("Enter email", "Please enter your account email above first.");
                  return;
                }
                try {
                  setIsSendingReset(true);
                  const webRedirect = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;
                  const isWeb = Platform.OS === 'web';
                  const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, isWeb ? { redirectTo: webRedirect } : undefined);
                  if (error) throw error;
                  Alert.alert("Check your email", "We sent a password reset link. Open it on this device to continue.");
                } catch (e: any) {
                  const msg = typeof e?.message === "string" ? e.message : "Failed to send reset email";
                  Alert.alert("Error", msg);
                } finally {
                  setIsSendingReset(false);
                }
              }}
              disabled={isSendingReset}
            >
              {isSendingReset ? (
                <ActivityIndicator color="#9CA3AF" />
              ) : (
                <Text style={styles.forgotButtonText}>Forgot password?</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <GrainTexture />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {displayedText}<Text style={styles.cursor}>|</Text>
          </Text>
        </View>

        <View style={styles.buttonContainer}>
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
  signUpButton: {
    backgroundColor: "rgba(40, 40, 40, 0.85)",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#404040",
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
    borderColor: "#404040",
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
    backgroundColor: "rgba(20, 20, 20, 0.85)",
    borderColor: "#404040",
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
  forgotButton: {
    alignSelf: "center",
    paddingVertical: 12,
  },
  forgotButtonText: {
    color: "#9CA3AF",
    fontSize: 15,
    fontWeight: "600" as const,
    textDecorationLine: "underline" as const,
  },
});
