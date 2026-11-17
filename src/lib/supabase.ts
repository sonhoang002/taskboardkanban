import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      "Missing Supabase configuration. Check your environment settings.",
    );
  }

  if (key.startsWith("sb_secret_")) {
    throw new Error("Use a Supabase publishable key for this app.");
  }

  client = createClient(url, key, {
    global: {
      fetch: (input, options) => {
        const timeout = AbortSignal.timeout(15000);
        const signal = options?.signal
          ? AbortSignal.any([options.signal, timeout])
          : timeout;

        return fetch(input, { ...options, signal });
      },
    },
  });

  return client;
}
