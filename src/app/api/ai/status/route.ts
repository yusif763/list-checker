import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai";

export const runtime = "nodejs";

export async function GET() {
  const provider = getAIProvider();

  // Diaqnostika: işləyən mühitin hansı açarı gördüyünü (təhlükəsiz) göstər.
  const raw = process.env.DEEPSEEK_API_KEY ?? "";
  const cleaned = raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^DEEPSEEK_API_KEY=/i, "")
    .replace(/\s+/g, "")
    .trim();

  return NextResponse.json({
    enabled: provider.isEnabled(),
    provider: provider.name,
    key: {
      configured: cleaned.length > 0,
      tail: cleaned ? cleaned.slice(-4) : null,
      length: cleaned.length,
      rawLength: raw.length,
      startsWithSk: cleaned.startsWith("sk-"),
    },
    aiEnabledEnv: process.env.AI_ENABLED ?? "(təyin olunmayıb)",
  });
}
