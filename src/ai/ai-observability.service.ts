import { Injectable } from '@nestjs/common';

interface LatencyAgg {
  count: number;
  totalMs: number;
}

@Injectable()
export class AiObservabilityService {
  private readonly bootedAt = Date.now();

  private readonly latencyByKey = new Map<string, LatencyAgg>();

  private summarizeCacheHits = 0;

  private summarizeCacheMisses = 0;

  private translateCacheHits = 0;

  private translateCacheMisses = 0;

  recordHandlerLatency(endpointKey: string, durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      return;
    }
    const cur = this.latencyByKey.get(endpointKey) ?? { count: 0, totalMs: 0 };
    cur.count += 1;
    cur.totalMs += durationMs;
    this.latencyByKey.set(endpointKey, cur);
  }

  recordCacheLookup(kind: 'summarize' | 'translate', hit: boolean): void {
    if (kind === 'summarize') {
      if (hit) {
        this.summarizeCacheHits += 1;
      } else {
        this.summarizeCacheMisses += 1;
      }
      return;
    }
    if (hit) {
      this.translateCacheHits += 1;
    } else {
      this.translateCacheMisses += 1;
    }
  }

  averageLatencyMsByEndpoint(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [key, { count, totalMs }] of this.latencyByKey) {
      out[key] = count > 0 ? Math.round((totalMs / count) * 100) / 100 : 0;
    }
    return out;
  }

  cacheStats(): {
    summarize: { hits: number; misses: number; hitRatio: number | null };
    translate: { hits: number; misses: number; hitRatio: number | null };
  } {
    return {
      summarize: ratioPair(this.summarizeCacheHits, this.summarizeCacheMisses),
      translate: ratioPair(this.translateCacheHits, this.translateCacheMisses),
    };
  }

  uptimeSec(): number {
    return Math.floor((Date.now() - this.bootedAt) / 1000);
  }
}

function ratioPair(
  hits: number,
  misses: number,
): { hits: number; misses: number; hitRatio: number | null } {
  const total = hits + misses;
  return {
    hits,
    misses,
    hitRatio: total > 0 ? Math.round((hits / total) * 10_000) / 10_000 : null,
  };
}
