import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/types";

export function createSupabaseBrowserClient() {
  const { publishableKey, url } = requireSupabaseConfig();
  return createBrowserClient<Database>(url, publishableKey);
}
