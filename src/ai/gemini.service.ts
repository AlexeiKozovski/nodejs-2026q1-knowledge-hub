import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

@Injectable()
export class GeminiService {
  constructor(private readonly configService: ConfigService) {}

  async generateText(prompt: string): Promise<string> {
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

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      });
    } catch {
      throw new ServiceUnavailableException(
        'AI provider is currently unavailable',
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException('Failed to generate AI response');
    }

    const payload =
      (await response.json()) as GeminiGenerateContentResponse | null;
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      throw new ServiceUnavailableException(
        'AI provider returned empty content',
      );
    }

    return text;
  }
}
