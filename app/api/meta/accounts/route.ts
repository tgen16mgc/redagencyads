import { NextResponse } from "next/server";
import { getAccounts } from "@/lib/meta";
import { requireToken } from "@/lib/session";

export async function GET() {
  try {
    const token = await requireToken();
    const accounts = await getAccounts(token);
    return NextResponse.json({ accounts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load accounts." },
      { status: 401 },
    );
  }
}
