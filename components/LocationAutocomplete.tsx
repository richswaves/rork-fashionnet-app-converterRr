import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  FlatList,
  Pressable,
  Text,
  Platform,
  ActivityIndicator,
} from "react-native";

declare global {
  interface Window {
    mapkit?: any;
  }
}

interface LocationSuggestion {
  display: string;
  city?: string;
  state?: string;
}

interface LocationAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectLocation: (location: string) => void;
  placeholder?: string;
  style?: any;
  testID?: string;
}

export default function LocationAutocomplete({
  value,
  onChangeText,
  onSelectLocation,
  placeholder = "e.g. New York, NY",
  style,
  testID,
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mapkitReady, setMapkitReady] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchRef = useRef<any>(null);
  const initAttemptedRef = useRef(false);

  const initMapKit = useCallback(async () => {
    if (typeof window === "undefined") return;

    try {
      if (window.mapkit && window.mapkit.init) {
        console.log("[MapKit] Already loaded");
        window.mapkit.init({
          authorizationCallback: async (done: any) => {
            try {
              const response = await fetch(
                "https://mnqgmpvkdmgmyoqhgswc.supabase.co/functions/v1/mapkit-token",
                { method: "POST" }
              );
              const data = await response.json();
              if (data.token) {
                done(data.token);
              } else {
                console.error("[MapKit] No token received");
              }
            } catch (error) {
              console.error("[MapKit] Token fetch error:", error);
            }
          },
        });
        setMapkitReady(true);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js";
      script.crossOrigin = "anonymous";
      script.async = true;

      script.onload = () => {
        console.log("[MapKit] Script loaded");
        if (window.mapkit) {
          window.mapkit.init({
            authorizationCallback: async (done: any) => {
              try {
                const response = await fetch(
                  "https://mnqgmpvkdmgmyoqhgswc.supabase.co/functions/v1/mapkit-token",
                  { method: "POST" }
                );
                const data = await response.json();
                if (data.token) {
                  done(data.token);
                  setMapkitReady(true);
                } else {
                  console.error("[MapKit] No token in response");
                }
              } catch (error) {
                console.error("[MapKit] Token fetch failed:", error);
              }
            },
          });
        }
      };

      script.onerror = () => {
        console.error("[MapKit] Failed to load script");
      };

      document.head.appendChild(script);
    } catch (error) {
      console.error("[MapKit] Init error:", error);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" && !initAttemptedRef.current) {
      initAttemptedRef.current = true;
      initMapKit();
    }
  }, [initMapKit]);

  const searchLocations = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }

      setLoading(true);

      try {
        if (Platform.OS === "web" && window.mapkit && mapkitReady) {
          if (!searchRef.current) {
            searchRef.current = new window.mapkit.Search({
              getsUserLocation: false,
            });
          }

          const searchOptions = {
            query,
            language: "en-US",
            coordinate: new window.mapkit.Coordinate(40.7128, -74.006),
            region: new window.mapkit.CoordinateRegion(
              new window.mapkit.Coordinate(39.8283, -98.5795),
              new window.mapkit.CoordinateSpan(50, 50)
            ),
          };

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Search timeout")), 5000)
          );

          const searchPromise = new Promise((resolve, reject) => {
            searchRef.current.search(searchOptions, (error: any, data: any) => {
              if (error) {
                reject(error);
              } else {
                resolve(data);
              }
            });
          });

          const data: any = await Promise.race([searchPromise, timeoutPromise]);

          if (data && data.places && data.places.length > 0) {
            const matches: LocationSuggestion[] = data.places
              .filter((place: any) => place.locality || place.administrativeArea)
              .slice(0, 10)
              .map((place: any) => {
                const city = place.locality || place.name;
                const state = place.administrativeArea;
                return {
                  city,
                  state,
                  display: state ? `${city}, ${state}` : city,
                };
              });

            setSuggestions(matches);
            setShowDropdown(matches.length > 0);
          } else {
            setSuggestions([]);
            setShowDropdown(false);
          }
        } else {
          setSuggestions([]);
          setShowDropdown(false);
        }
      } catch (error) {
        console.error("[LocationAutocomplete] Search error:", error);
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setLoading(false);
      }
    },
    [mapkitReady]
  );

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      searchLocations(value);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value, searchLocations]);

  const handleSelectLocation = useCallback(
    (location: string) => {
      onSelectLocation(location);
      onChangeText(location);
      setShowDropdown(false);
      setSuggestions([]);
    },
    [onSelectLocation, onChangeText]
  );

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, style]}
          placeholder={placeholder}
          placeholderTextColor="#6B7280"
          value={value}
          onChangeText={onChangeText}
          testID={testID}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {loading && (
          <View style={styles.loadingIndicator}>
            <ActivityIndicator size="small" color="#9CA3AF" />
          </View>
        )}
      </View>

      {showDropdown && suggestions.length > 0 && (
        <View style={styles.dropdownMenu}>
          <FlatList
            data={suggestions}
            keyExtractor={(item, index) => `${item.display}-${index}`}
            renderItem={({ item }) => (
              <Pressable
                style={styles.dropdownItem}
                onPress={() => handleSelectLocation(item.display)}
                testID={`location-${item.display}`}
              >
                <Text style={styles.dropdownItemText} numberOfLines={1}>
                  {item.display}
                </Text>
              </Pressable>
            )}
            style={styles.dropdownScroll}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    zIndex: 1,
  },
  inputContainer: {
    position: "relative",
  },
  input: {
    backgroundColor: "#14141C",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#E5E7EB",
    fontSize: 14,
  },
  loadingIndicator: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownMenu: {
    left: 0,
    right: 0,
    backgroundColor: "#14141C",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    maxHeight: 250,
    zIndex: Platform.OS === "web" ? 9999 : 1000,
    elevation: 12,
    marginTop: 8,
    ...(Platform.OS === "web" && {
      boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
    }),
  },
  dropdownScroll: {
    maxHeight: 250,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownItemText: {
    color: "#E5E7EB",
    fontSize: 14,
  },
});
