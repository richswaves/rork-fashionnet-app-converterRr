import { NativeModules, Platform } from "react-native";
import ReactNativeVersion from "react-native/Libraries/Core/ReactNativeVersion";

const ensurePlatformConstants = () => {
  const nativeModules = NativeModules as NativeModules & {
    PlatformConstants?: Record<string, unknown> | null;
  };

  if (nativeModules.PlatformConstants) {
    return nativeModules.PlatformConstants;
  }

  const version = Platform.Version;
  const osVersion = typeof version === "string" ? version : `${version ?? "0"}`;

  const fallbackConstants = {
    forceTouchAvailable: false,
    hermes: global.HermesInternal != null,
    interfaceIdiom: Platform.OS === "ios" ? "phone" : "unknown",
    isTesting: false,
    osVersion,
    reactNativeVersion: ReactNativeVersion?.version ?? { major: 0, minor: 0, patch: 0 },
    systemName: Platform.OS,
  };

  nativeModules.PlatformConstants = fallbackConstants;
  return fallbackConstants;
};

export const platformConstants = ensurePlatformConstants();
