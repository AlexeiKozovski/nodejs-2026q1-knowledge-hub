import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const MAX_ATTEMPTS = 3;

interface GeminiGenerateContentResponse {
  usageMetadata?: {
    totalTokenCount?: number;
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: { code?: number; message?: string; status?: string };
}

export interface GeminiTextResult {
  text: string;
  totalTokenCount?: number;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  constructor(private readonly configService: ConfigService) {}

  async generateText(
    prompt: string,
    options?: { maxOutputTokens?: number },
  ): Promise<GeminiTextResult> {
    return this.generateWithConfig(
      prompt,
      {
        maxOutputTokens: options?.maxOutputTokens,
      },
      'none',
    );
  }

  /** JSON object response; parsed and returned as object. */
  async generateJson(
    prompt: string,
  ): Promise<GeminiTextResult & { value: unknown }> {
    const r = await this.generateWithConfig(prompt, {}, 'application/json');
    let value: unknown;
    try {
      value = JSON.parse(r.text) as unknown;
    } catch {
      this.logger.warn('Gemini returned invalid JSON for structured prompt');
      throw new ServiceUnavailableException(
        'AI provider returned malformed structured data',
      );
    }
    return { ...r, value };
  }

  private async generateWithConfig(
    prompt: string,
    gen: { maxOutputTokens?: number },
    responseMimeType: 'none' | 'application/json',
  ): Promise<GeminiTextResult> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    const baseUrl =
      this.configService.get<string>('GEMINI_API_BASE_URL') ??
      'https://generativelanguage.googleapis.com';
    const model =
      this.configService.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';

    if (!apiKey) {
      throw new InternalServerErrorException(
        'Gemini API key is not configured',
      );
    }

    const endpoint = `${baseUrl}/v1beta/models/${model}:generateContent`;

    const timeoutMs = 120_000;

    const generationConfig: Record<string, unknown> = {
      temperature: 0.35,
      ...(gen.maxOutputTokens !== undefined
        ? { maxOutputTokens: gen.maxOutputTokens }
        : { maxOutputTokens: 8192 }),
    };
    if (responseMimeType === 'application/json') {
      generationConfig.responseMimeType = 'application/json';
    }

    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    };

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        const isAbort = err instanceof Error && err.name === 'AbortError';
        const retriable = attempt < MAX_ATTEMPTS - 1 && !isAbort;
        if (retriable) {
          await this.delay(Math.min(500 * 2 ** attempt, 4000));
          continue;
        }
        throw new ServiceUnavailableException(
          'AI provider is currently unavailable',
        );
      }

      const rawText = await response.text().catch(() => '');

      if (response.status === 401 || response.status === 403) {
        this.logger.error(
          `Gemini auth rejected (HTTP ${response.status}) — check API key`,
        );
        throw new InternalServerErrorException(
          'AI service configuration is invalid',
        );
      }

      if (response.ok) {
        let payload: GeminiGenerateContentResponse | null = null;
        try {
          payload = JSON.parse(rawText) as GeminiGenerateContentResponse;
        } catch {
          this.logger.warn('Gemini success body was not valid JSON');
          throw new ServiceUnavailableException(
            'AI provider returned malformed data',
          );
        }

        if (payload?.error) {
          this.logger.warn(
            `Gemini payload error field: ${JSON.stringify(payload.error).slice(0, 400)}`,
          );
        }

        const text =
          payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!text) {
          throw new ServiceUnavailableException(
            'AI provider returned empty content',
          );
        }

        return {
          text,
          totalTokenCount: payload?.usageMetadata?.totalTokenCount,
        };
      }

      const retriable =
        attempt < MAX_ATTEMPTS - 1 &&
        (response.status === 429 || response.status >= 500);

      this.logger.warn(
        `Gemini generateContent HTTP ${response.status}: ${rawText.slice(0, 1500)}`,
      );

      if (retriable) {
        const retryAfterMs =
          parseRetryAfterMs(response) ?? Math.min(1000 * 2 ** attempt, 8000);
        await this.delay(retryAfterMs);
        continue;
      }

      throw new ServiceUnavailableException('Failed to generate AI response');
    }

    throw new ServiceUnavailableException(
      'AI provider is currently unavailable',
    );
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

function parseRetryAfterMs(response: Response): number | undefined {
  const h = response.headers.get('retry-after');
  if (!h) {
    return undefined;
  }
  const sec = Number.parseInt(h, 10);
  if (Number.isFinite(sec)) {
    return sec * 1000;
  }
  return undefined;
}
