import type { AIProvider } from "./types";
import { DeepSeekProvider } from "./providers/deepseek";

export * from "./types";
export * from "./document-extraction";
export * from "./column-mapping";
export * from "./structure";

let cached: AIProvider | null = null;

/**
 * Konfiqurasiya olunmuş AI provayderini qaytarır.
 * Hazırda DeepSeek; gələcəkdə OpenAI və s. buraya əlavə oluna bilər.
 */
export function getAIProvider(): AIProvider {
  if (!cached) cached = new DeepSeekProvider();
  return cached;
}

/** Test/konfiqurasiya dəyişikliyi üçün keşi sıfırlayır. */
export function resetAIProvider(): void {
  cached = null;
}
