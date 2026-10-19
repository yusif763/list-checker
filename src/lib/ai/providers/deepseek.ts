import { AIDisabledError, type AIProvider } from "@/lib/ai/types";

interface DeepSeekConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export class DeepSeekProvider implements AIProvider {
  readonly name = "deepseek";
  private config: DeepSeekConfig | null;

  constructor() {
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    const aiEnabled = (process.env.AI_ENABLED ?? "true").toLowerCase() !== "false";
    if (apiKey && aiEnabled) {
      this.config = {
        apiKey,
        baseUrl: (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, ""),
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      };
    } else {
      this.config = null;
    }
  }

  isEnabled(): boolean {
    return this.config !== null;
  }

  async chatJson(systemPrompt: string, userPrompt: string): Promise<unknown> {
    if (!this.config) throw new AIDisabledError();

    const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
        // DeepSeek json_object rejimi üçün prompt-da "json" sözü olmalıdır
        // (system prompt-larda təmin olunur).
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`DeepSeek API xətası (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek boş cavab qaytardı.");

    try {
      return JSON.parse(content);
    } catch {
      throw new Error("DeepSeek cavabı düzgün JSON deyil.");
    }
  }
}
