import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config, assertSupabaseConfigured } from "./config";

let cached: SupabaseClient | null = null;

/**
 * Service-role Supabase client. Bypasses RLS, so it is server-only and must
 * never be exposed to the browser. All DB + Storage access goes through here.
 */
export function getServiceClient(): SupabaseClient {
  assertSupabaseConfigured();
  if (!cached) {
    cached = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
