import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
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

const RAW_SUPABASE_URL = resolveEnv("EXPO_PUBLIC_SUPABASE_URL");
const RAW_SUPABASE_ANON_KEY = resolveEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY");

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

const SUPABASE_URL = normalizeUrl(RAW_SUPABASE_URL);
const SUPABASE_ANON_KEY = (RAW_SUPABASE_ANON_KEY ?? "").trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("Supabase env missing or invalid. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your project values.");
}

export type RestHeaders = {
  apikey: string;
  Authorization: string;
  "Content-Type": string;
  Prefer?: string;
};

export const supabaseRestHeaders: RestHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

function assertConfigured() {
  if (!SUPABASE_URL) {
    throw new Error("Supabase URL is not configured");
  }
  if (!SUPABASE_ANON_KEY) {
    throw new Error("Supabase anon key is not configured");
  }
}

export async function sbSelect<T = unknown>(
  table: string,
  opts: { select?: string; query?: Record<string, string>; limit?: number; order?: { column: string; ascending?: boolean } } = {}
): Promise<T[]> {
  assertConfigured();
  const { select = "*", query = {}, limit, order } = opts;
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set("select", select);
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  if (typeof limit === "number") url.searchParams.set("limit", String(limit));
  if (order?.column) url.searchParams.set("order", `${order.column}.${order.ascending === false ? "desc" : "asc"}`);

  const res = await fetch(url.toString(), { headers: supabaseRestHeaders });
  if (!res.ok) {
    const text = await res.text();
    console.error("Supabase select error", res.status, text);
    throw new Error(`Supabase error ${res.status}`);
  }
  return (await res.json()) as T[];
}

export async function sbInsert<T = unknown>(table: string, rows: T | T[], prefer: "return=representation" | "return=minimal" = "return=representation") {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...supabaseRestHeaders, Prefer: prefer },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Supabase insert error", res.status, text);
    throw new Error(`Supabase error ${res.status}`);
  }
  return prefer === "return=representation" ? res.json() : null;
}

export async function sbUpsert<T = unknown>(table: string, rows: T | T[], onConflict?: string) {
  assertConfigured();
  const headers: RestHeaders = { ...supabaseRestHeaders, Prefer: "resolution=merge-duplicates,return=representation" };
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  if (onConflict) url.searchParams.set("on_conflict", onConflict);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers,
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Supabase upsert error", res.status, text);
    throw new Error(`Supabase error ${res.status}`);
  }
  return res.json();
}

export async function sbDelete(table: string, match: Record<string, string | number>) {
  assertConfigured();
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(match).forEach(([k, v]) => url.searchParams.set(k, `eq.${v}`));
  const res = await fetch(url.toString(), { method: "DELETE", headers: supabaseRestHeaders });
  if (!res.ok) {
    const text = await res.text();
    console.error("Supabase delete error", res.status, text);
    throw new Error(`Supabase error ${res.status}`);
  }
  return true;
}

export const supabaseConfig = { url: SUPABASE_URL ?? "", anonKey: SUPABASE_ANON_KEY, platform: Platform.OS } as const;

export const supabase = createClient(
  SUPABASE_URL ?? "",
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
