import { refreshOAuthToken } from "@/lib/connector-adapters";
import { connectorOAuthConfig } from "@/lib/connectors";
import { connectorTokenNeedsRefresh, encryptConnectorToken, type ConnectorTokenPayload } from "@/lib/connector-oauth";

export type ConnectorSessionResult = {
  accessToken: string;
  refreshed: boolean;
  encryptedValue?: string;
  expiresAt?: string;
};

export async function ensureConnectorSession(input: {
  provider: "google" | "linkedin";
  session: ConnectorTokenPayload;
  origin: string;
  env?: Record<string, string | undefined>;
  fetchFn?: typeof fetch;
  now?: number;
}): Promise<ConnectorSessionResult> {
  if (input.session.provider !== input.provider) throw new Error(`${input.provider} OAuth session provider mismatch.`);
  if (!connectorTokenNeedsRefresh(input.session, input.now)) return { accessToken: input.session.accessToken, refreshed: false, expiresAt: input.session.expiresAt };
  if (!input.session.refreshToken) throw new Error(`${input.provider} OAuth session expired; reconnect the connector.`);
  const redirectUri = `${input.origin}/api/connectors/oauth/callback?provider=${encodeURIComponent(input.provider)}`;
  const config = connectorOAuthConfig(input.provider, redirectUri, input.env);
  if (!config) throw new Error(`${input.provider} OAuth is not configured for token refresh.`);
  const refreshed = await refreshOAuthToken(config, input.session.refreshToken, input.fetchFn);
  return {
    accessToken: refreshed.accessToken,
    refreshed: true,
    expiresAt: refreshed.expiresAt,
    encryptedValue: encryptConnectorToken({
      provider: input.provider,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken || input.session.refreshToken,
      expiresAt: refreshed.expiresAt,
    }),
  };
}
