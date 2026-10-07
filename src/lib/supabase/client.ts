"use client";
import { createClient } from "@supabase/supabase-js";

// Anon client for browser use: read-only (via RLS select policies) plus
// Realtime subscriptions. Never used for writes — those go through the
// Next.js API routes with the service role key.
let browserClient: ReturnType<typeof createClient> | null = null;

export function getBrowserSupabase() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars."
    );
  }

  browserClient = createClient(url, anonKey);
  return browserClient;
}
