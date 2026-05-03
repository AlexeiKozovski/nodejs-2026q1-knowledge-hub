import { Injectable } from '@nestjs/common';

export interface AiUsageSnapshot {
  totalRequests: number;
  requestsByEndpoint: Record<string, number>;
  approximateTotalTokens?: number;
}

@Injectable()
export class AiUsageService {
  totalRequests = 0;

  readonly requestsByEndpoint: Record<string, number> = {};

  /** Best-effort total from Gemini usageMetadata.totalTokenCount when present */
  approximateTotalTokens = 0;

  record(endpoint: string, tokens?: number): void {
    this.totalRequests += 1;
    this.requestsByEndpoint[endpoint] =
      (this.requestsByEndpoint[endpoint] ?? 0) + 1;
    if (tokens !== undefined && Number.isFinite(tokens)) {
      this.approximateTotalTokens += tokens;
    }
  }

  snapshot(): AiUsageSnapshot {
    return {
      totalRequests: this.totalRequests,
      requestsByEndpoint: { ...this.requestsByEndpoint },
      approximateTotalTokens: this.approximateTotalTokens,
    };
  }
}
