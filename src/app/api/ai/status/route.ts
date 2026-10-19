import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai";

export const runtime = "nodejs";

export async function GET() {
  const provider = getAIProvider();
  return NextResponse.json({ enabled: provider.isEnabled(), provider: provider.name });
}
