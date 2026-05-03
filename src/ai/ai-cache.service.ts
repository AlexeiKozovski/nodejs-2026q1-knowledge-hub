import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

@Injectable()
export class AiCacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly configService: ConfigService) {}

  private ttlMs(): number {
    const sec = Number.parseInt(
      String(this.configService.get('AI_CACHE_TTL_SEC') ?? '300'),
      10,
    );
    return Math.max(0, Number.isFinite(sec) ? sec * 1000 : 300_000);
  }

  get<T>(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) {
      return undefined;
    }
    if (Date.now() >= hit.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value as T;
  }

  set<T>(key: string, value: T): void {
    const ttl = this.ttlMs();
    if (ttl <= 0) {
      return;
    }
    this.store.set(key, { expiresAt: Date.now() + ttl, value });
  }

  summarizeKey(parts: Record<string, string | undefined>): string {
    return JSON.stringify({ type: 'summarize', ...parts });
  }

  translateKey(parts: Record<string, string | undefined>): string {
    return JSON.stringify({ type: 'translate', ...parts });
  }
}
