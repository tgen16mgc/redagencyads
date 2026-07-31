export type SupabaseConfig = {
  configured: boolean;
  googleEnabled: boolean;
  publishableKey: string;
  url: string;
};

export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || "";

  return {
    configured: Boolean(url && publishableKey),
    googleEnabled: process.env.NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED?.trim().toLowerCase() === "true",
    publishableKey,
    url,
  };
}

export function requireSupabaseConfig() {
  const config = getSupabaseConfig();
  if (!config.configured) {
    throw new Error("Supabase authentication is not configured on this deployment.");
  }
  return config;
}

export function getSiteUrl(requestUrl?: string) {
  const requestOrigin = requestUrl ? new URL(requestUrl).origin : "";
  if (requestOrigin && /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin)) {
    return requestOrigin;
  }

  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return new URL(configured).origin;
  if (requestOrigin) return requestOrigin;

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "")}`;
  return "http://localhost:3000";
}
