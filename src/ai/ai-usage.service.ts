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

  approximateTotalTokens = 0;

  record(endpoint: string, geminiTotalTokens?: number): void {
    this.totalRequests += 1;
    this.requestsByEndpoint[endpoint] =
      (this.requestsByEndpoint[endpoint] ?? 0) + 1;
    if (geminiTotalTokens !== undefined && Number.isFinite(geminiTotalTokens)) {
      this.approximateTotalTokens += geminiTotalTokens;
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
