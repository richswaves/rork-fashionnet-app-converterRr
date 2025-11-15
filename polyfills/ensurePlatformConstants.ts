import { NativeModules, Platform, TurboModuleRegistry } from "react-native";
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

  const hasTurboModuleRegistry = typeof TurboModuleRegistry !== "undefined" && TurboModuleRegistry !== null;

  const turboRegistry = hasTurboModuleRegistry
    ? (TurboModuleRegistry as unknown as {
        get?: (name: string) => unknown;
        getEnforcing?: (name: string) => unknown;
      })
    : undefined;

  const originalGet = turboRegistry?.get ? turboRegistry.get.bind(TurboModuleRegistry) : undefined;
  const originalGetEnforcing = turboRegistry?.getEnforcing
    ? turboRegistry.getEnforcing.bind(TurboModuleRegistry)
    : undefined;

  if (turboRegistry && originalGet) {
    turboRegistry.get = (name: string) => {
      if (name === "PlatformConstants") {
        console.log("Using fallback PlatformConstants TurboModule");
        return nativeModules.PlatformConstants;
      }
      return originalGet(name);
    };
  }

  if (turboRegistry && originalGetEnforcing) {
    turboRegistry.getEnforcing = (name: string) => {
      if (name === "PlatformConstants") {
        console.log("Using enforcing fallback PlatformConstants TurboModule");
        return nativeModules.PlatformConstants;
      }
      return originalGetEnforcing(name);
    };
  }

  return fallbackConstants;
};

export const platformConstants = ensurePlatformConstants();
