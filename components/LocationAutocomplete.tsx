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

const US_CITIES = [
  { city: "Manhattan", state: "NY" },
  { city: "Brooklyn", state: "NY" },
  { city: "Los Angeles", state: "CA" },
  { city: "Chicago", state: "IL" },
  { city: "Houston", state: "TX" },
  { city: "Phoenix", state: "AZ" },
  { city: "Philadelphia", state: "PA" },
  { city: "San Antonio", state: "TX" },
  { city: "San Diego", state: "CA" },
  { city: "Dallas", state: "TX" },
  { city: "San Jose", state: "CA" },
  { city: "Austin", state: "TX" },
  { city: "San Francisco", state: "CA" },
  { city: "Boston", state: "MA" },
  { city: "Seattle", state: "WA" },
  { city: "Miami", state: "FL" },
  { city: "Atlanta", state: "GA" },
  { city: "Denver", state: "CO" },
  { city: "Portland", state: "OR" },
  { city: "Las Vegas", state: "NV" },
];

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
  const [suggestions, setSuggestions] = useState<
    Array<{ city: string; state: string; display: string }>
  >([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const searchLocations = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }

      setLoading(true);

      try {
        const searchLower = query.toLowerCase().trim();
        const matches = US_CITIES.filter((loc) => {
          const cityMatch = loc.city.toLowerCase().includes(searchLower);
          const stateMatch = loc.state.toLowerCase().includes(searchLower);
          const fullMatch = `${loc.city}, ${loc.state}`
            .toLowerCase()
            .includes(searchLower);
          return cityMatch || stateMatch || fullMatch;
        })
          .slice(0, 10)
          .map((loc) => ({
            city: loc.city,
            state: loc.state,
            display: `${loc.city}, ${loc.state}`,
          }));

        setSuggestions(matches);
        setShowDropdown(matches.length > 0);
      } catch (error) {
        console.error("[LocationAutocomplete] Search error:", error);
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setLoading(false);
      }
    },
    []
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
    borderRadius: 10,
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
