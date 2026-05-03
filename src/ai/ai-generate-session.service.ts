import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

const MAX_TURNS = 24;

const SESSION_TTL_MS = 60 * 60 * 1000;

const MAX_SESSIONS = 5_000;

export type GeminiChatRole = 'user' | 'model';

export interface GeminiContentPart {
  role: GeminiChatRole;
  text: string;
}

interface SessionState {
  updatedAt: number;
  turns: GeminiContentPart[];
}

@Injectable()
export class AiGenerateSessionService {
  private readonly sessions = new Map<string, SessionState>();

  /** Return existing UUID or mint a new v4 session id. */
  ensureSessionId(existing?: string | null): string {
    return existing ?? randomUUID();
  }

  /** Prior turns formatted for Gemini `contents`. */
  getPriorContents(sessionId: string): Array<{
    role: string;
    parts: Array<{ text: string }>;
  }> {
    const state = this.sessions.get(sessionId);
    if (!state?.turns.length) {
      return [];
    }
    return state.turns.map((t) => ({
      role: t.role,
      parts: [{ text: t.text }],
    }));
  }

  appendExchange(sessionId: string, userText: string, modelText: string): void {
    const now = Date.now();
    this.pruneIfNeeded(now);
    const cur = this.sessions.get(sessionId) ?? {
      updatedAt: now,
      turns: [],
    };
    cur.turns.push(
      { role: 'user', text: userText },
      { role: 'model', text: modelText },
    );
    while (cur.turns.length > MAX_TURNS) {
      cur.turns.shift();
    }
    cur.updatedAt = now;
    this.sessions.set(sessionId, cur);
  }

  clear(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private pruneIfNeeded(now: number): void {
    if (this.sessions.size < MAX_SESSIONS) {
      return;
    }
    for (const [id, state] of this.sessions) {
      if (now - state.updatedAt > SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
    if (this.sessions.size < MAX_SESSIONS) {
      return;
    }
    const ordered = [...this.sessions.entries()].sort(
      (a, b) => a[1].updatedAt - b[1].updatedAt,
    );
    const dropCount = ordered.length - Math.floor(MAX_SESSIONS * 0.9);
    for (let i = 0; i < dropCount; i += 1) {
      this.sessions.delete(ordered[i]![0]);
    }
  }
}
