import { getGoogleConnectorAccessToken } from "@/lib/google-connector-auth";
import { resolveServerConnectorAccessToken } from "@/lib/server-connector-auth";
import { SessionAuthError } from "@/lib/session";

function googleAdsWriteConfig(
  accessToken: string,
  env: Record<string, string | undefined> = process.env,
) {
  if (
    !env.GOOGLE_ADS_CUSTOMER_ID ||
    !env.GOOGLE_ADS_DEVELOPER_TOKEN
  )
    throw new Error(
      "GOOGLE_ADS_CUSTOMER_ID and GOOGLE_ADS_DEVELOPER_TOKEN are required for Google Ads writes.",
    );
  return {
    accessToken,
    customerId: env.GOOGLE_ADS_CUSTOMER_ID,
    developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN,
    loginCustomerId: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    apiVersion: env.GOOGLE_ADS_API_VERSION,
  };
}

export async function getGoogleAdsWriteContext(request: Request) {
  let accessToken: string;
  try {
    accessToken = await getGoogleConnectorAccessToken(request);
  } catch (error) {
    throw new SessionAuthError(
      error instanceof Error
        ? `Google connector session required: ${error.message}`
        : "Google connector session required.",
    );
  }
  return googleAdsWriteConfig(accessToken);
}

export async function getGoogleAdsServerWriteContext(input?: {
  env?: Record<string, string | undefined>;
  fetchFn?: typeof fetch;
}) {
  const env = input?.env || process.env;
  const accessToken = await resolveServerConnectorAccessToken({
    platform: "google_ads",
    env,
    fetchFn: input?.fetchFn,
  });
  if (!accessToken)
    throw new Error(
      "GOOGLE_ADS_ACCESS_TOKEN is required for scheduled Google Ads writes.",
    );
  return googleAdsWriteConfig(accessToken, env);
}
