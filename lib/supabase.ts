import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export function getSupabasePublicClient() {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false }
  });
}

export function getSupabaseAdminClient() {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false }
  });
}
