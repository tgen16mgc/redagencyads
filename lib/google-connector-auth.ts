import { requireConnectorSessionAccessToken } from "@/lib/interactive-connector-auth";

export async function getGoogleConnectorAccessToken(request: Request) {
  return requireConnectorSessionAccessToken(request, "google");
}
