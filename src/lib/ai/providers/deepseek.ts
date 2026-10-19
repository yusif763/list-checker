import { AIDisabledError, ExtractedIdentitySchema, type AIExtractedIdentity, type AIProvider } from "@/lib/ai/types";

const SYSTEM_PROMPT = `Sən Azərbaycan şəxsiyyət vəsiqələrindən məlumat çıxaran dəqiq köməkçisən.
Verilən mətndən yalnız AÇIQ-AŞKAR görünən sahələri çıxar. Heç bir məlumatı UYDURMA.
Tapılmayan və ya oxunmayan sahələr üçün null qaytar.
Tarixləri GG.AA.İİİİ formatında ver. Cins: MALE, FEMALE və ya UNKNOWN.
Yalnız aşağıdakı JSON sxemi ilə cavab ver:
{
  "firstName": string|null,
  "lastName": string|null,
  "patronymic": string|null,
  "dateOfBirth": string|null,
  "finCode": string|null,
  "gender": "MALE"|"FEMALE"|"UNKNOWN"|null,
  "documentNumber": string|null,
  "issueDate": string|null,
  "expiryDate": string|null,
  "issuingAuthority": string|null,
  "confidence": number (0..1),
  "requiresManualReview": boolean
}`;

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

  async extractIdentity(text: string): Promise<AIExtractedIdentity> {
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
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Şəxsiyyət vəsiqəsi mətni:\n\n${text.slice(0, 6000)}` },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`DeepSeek API xətası (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek boş cavab qaytardı.");

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("DeepSeek cavabı düzgün JSON deyil.");
    }

    // AI çıxışına HEÇ VAXT yoxlamadan güvənmə.
    return ExtractedIdentitySchema.parse(parsed);
  }
}
