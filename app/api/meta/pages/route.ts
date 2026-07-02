import { NextResponse } from "next/server";
import { getPages } from "@/lib/meta-pages";
import { requireToken } from "@/lib/session";

export async function GET() {
  try {
    const token = await requireToken();
    const pages = await getPages(token);
    return NextResponse.json({ pages });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load Pages." },
      { status: 401 },
    );
  }
}
