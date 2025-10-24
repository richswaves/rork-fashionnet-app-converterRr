import { Platform } from "react-native";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

function resolveEnv(key: string): string | undefined {
  const fromProcess = typeof process !== "undefined" ? (process.env as Record<string, string | undefined>)[key] : undefined;
  const fromWindow = typeof window !== "undefined" ? (window as any)[key] ?? (window as any).__ENV__?.[key] : undefined;
  const fromGlobal = (globalThis as any)?.__ENV__?.[key] ?? (globalThis as any)?.ENV?.[key];
  const val = fromProcess ?? fromWindow ?? fromGlobal;
  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return val;
}

function normalizeUrl(url?: string): string | null {
  try {
    if (!url) return null;
    const trimmed = url.trim();
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProto);
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function getEnv(): { url: string | null; anonKey: string } {
  const rawUrl = resolveEnv("EXPO_PUBLIC_SUPABASE_URL");
  const rawKey = resolveEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  return {
    url: normalizeUrl(rawUrl),
    anonKey: (rawKey ?? "").trim(),
  };
}

export type RestHeaders = {
  apikey: string;
  Authorization: string;
  "Content-Type": string;
  Prefer?: string;
};

export async function getAuthHeaders(prefer?: RestHeaders["Prefer"]): Promise<RestHeaders> {
  const { anonKey } = getEnv();
  let authHeader = `Bearer ${anonKey}`;
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token && typeof token === "string" && token.length > 0) {
        authHeader = `Bearer ${token}`;
      }
    }
  } catch (e) {
    if (__DEV__) {
      console.warn("Falling back to anon key for REST calls", e);
    }
  }
  return {
    apikey: anonKey,
    Authorization: authHeader,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  } as RestHeaders;
}

function assertConfigured() {
  const { url, anonKey } = getEnv();
  if (!url) {
    throw new Error("Supabase URL is not configured");
  }
  if (!anonKey) {
    throw new Error("Supabase anon key is not configured");
  }
}

export async function sbSelect<T = unknown>(
  table: string,
  opts: { select?: string; query?: Record<string, string>; limit?: number; order?: { column: string; ascending?: boolean } } = {}
): Promise<T[]> {
  assertConfigured();
  const { url } = getEnv();
  const headers = await getAuthHeaders();
  const { select = "*", query = {}, limit, order } = opts;
  const composed = new URL(`${url}/rest/v1/${table}`);
  composed.searchParams.set("select", select);
  Object.entries(query).forEach(([k, v]) => composed.searchParams.set(k, v));
  if (typeof limit === "number") composed.searchParams.set("limit", String(limit));
  if (order?.column) composed.searchParams.set("order", `${order.column}.${order.ascending === false ? "desc" : "asc"}`);

  const res = await fetch(composed.toString(), { headers });
  if (!res.ok) {
    const text = await res.text();
    console.error("Supabase select error", res.status, text);
    const msg = text && text.length < 500 ? text : `Supabase error ${res.status}`;
    throw new Error(msg);
  }
  return (await res.json()) as T[];
}

export async function sbInsert<T = unknown>(table: string, rows: T | T[], prefer: "return=representation" | "return=minimal" = "return=representation") {
  assertConfigured();
  const { url } = getEnv();
  const headers = await getAuthHeaders(prefer);
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers,
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Supabase insert error", res.status, text);
    const msg = text && text.length < 500 ? text : `Supabase error ${res.status}`;
    throw new Error(msg);
  }
  return prefer === "return=representation" ? res.json() : null;
}

export async function sbUpsert<T = unknown>(table: string, rows: T | T[], onConflict?: string) {
  assertConfigured();
  const { url } = getEnv();
  const headers: RestHeaders = await getAuthHeaders("resolution=merge-duplicates,return=representation");
  const composed = new URL(`${url}/rest/v1/${table}`);
  if (onConflict) composed.searchParams.set("on_conflict", onConflict);
  const res = await fetch(composed.toString(), {
    method: "POST",
    headers,
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Supabase upsert error", res.status, text);
    const msg = text && text.length < 500 ? text : `Supabase error ${res.status}`;
    throw new Error(msg);
  }
  return res.json();
}

export async function sbDelete(table: string, match: Record<string, string | number>) {
  assertConfigured();
  const { url } = getEnv();
  const composed = new URL(`${url}/rest/v1/${table}`);
  Object.entries(match).forEach(([k, v]) => composed.searchParams.set(k, `eq.${v}`));
  const headers = await getAuthHeaders();
  const res = await fetch(composed.toString(), { method: "DELETE", headers });
  if (!res.ok) {
    const text = await res.text();
    console.error("Supabase delete error", res.status, text);
    const msg = text && text.length < 500 ? text : `Supabase error ${res.status}`;
    throw new Error(msg);
  }
  return true;
}

export function getSupabaseConfig() {
  const { url, anonKey } = getEnv();
  return { url: url ?? "", anonKey, platform: Platform.OS } as const;
}

let client: SupabaseClient | null = null;
let cachedUrl: string | null = null;
let cachedKey: string | null = null;

export function getSupabase(): SupabaseClient | null {
  const { url, anonKey } = getEnv();
  if (!url || !anonKey) {
    if (__DEV__) {
      console.warn("Supabase not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.");
    }
    return null;
  }
  if (!client || cachedUrl !== url || cachedKey !== anonKey) {
    client = createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    cachedUrl = url;
    cachedKey = anonKey;
  }
  return client;
}

export function setRuntimeSupabaseEnv(url: string, anonKey: string) {
  (globalThis as any).__ENV__ = {
    ...(globalThis as any).__ENV__,
    EXPO_PUBLIC_SUPABASE_URL: url,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  };
  cachedUrl = null;
  cachedKey = null;
  client = null;
}
