import { refreshOAuthToken } from "@/lib/connector-adapters";
import {
  connectorAccessTokenForPlatform,
  connectorOAuthConfig,
  connectorProviderForPlatform,
  type SyncConnectorPlatform,
} from "@/lib/connectors";

type ServerTokenCacheEntry = {
  accessToken: string;
  expiresAt: number;
  credentialKey: string;
  refreshToken: string;
};

const serverTokenCache = new Map<"google" | "linkedin", ServerTokenCacheEntry>();

function refreshTokenForProvider(
  provider: "google" | "linkedin",
  env: Record<string, string | undefined>,
) {
  return provider === "google"
    ? env.GOOGLE_REFRESH_TOKEN
    : env.LINKEDIN_REFRESH_TOKEN;
}

export async function resolveServerConnectorAccessToken(input: {
  platform: SyncConnectorPlatform;
  env?: Record<string, string | undefined>;
  fetchFn?: typeof fetch;
  now?: number;
}) {
  const env = input.env || process.env;
  const provider = connectorProviderForPlatform(input.platform);
  const refreshToken = refreshTokenForProvider(provider, env);
  if (!refreshToken)
    return connectorAccessTokenForPlatform(input.platform, env);

  const credentialKey = `${env[provider === "google" ? "GOOGLE_CLIENT_ID" : "LINKEDIN_CLIENT_ID"] || ""}:${refreshToken}`;
  const now = input.now || Date.now();
  const cached = serverTokenCache.get(provider);
  if (
    cached?.credentialKey === credentialKey &&
    cached.expiresAt - now > 60_000
  )
    return cached.accessToken;

  const config = connectorOAuthConfig(
    provider,
    "https://localhost.invalid/api/connectors/oauth/callback",
    env,
  );
  if (!config)
    throw new Error(
      `${provider} OAuth client credentials are required to refresh scheduled connector access.`,
    );
  const refreshed = await refreshOAuthToken(
    config,
    cached?.credentialKey === credentialKey
      ? cached.refreshToken
      : refreshToken,
    input.fetchFn,
  );
  const expiresAt = refreshed.expiresAt
    ? Date.parse(refreshed.expiresAt)
    : now + 5 * 60_000;
  serverTokenCache.set(provider, {
    accessToken: refreshed.accessToken,
    expiresAt,
    credentialKey,
    refreshToken: refreshed.refreshToken || refreshToken,
  });
  return refreshed.accessToken;
}

export function clearServerConnectorTokenCacheForTests() {
  serverTokenCache.clear();
}
