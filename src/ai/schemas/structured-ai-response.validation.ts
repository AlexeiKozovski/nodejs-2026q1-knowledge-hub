import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { AnalyzeSeverityDto } from '../dto/analyze-article.dto';
import { GeminiJsonAnalyzeDto } from '../dto/gemini-json-analyze.dto';
import { GeminiJsonTranslateDto } from '../dto/gemini-json-translate.dto';

export function safeParseTranslate(value: unknown): {
  translatedText: string;
  detectedLanguage: string;
} | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const inst = plainToInstance(GeminiJsonTranslateDto, value, {
    exposeDefaultValues: true,
    enableImplicitConversion: false,
  });
  const errors = validateSync(inst);
  if (errors.length > 0) {
    return null;
  }
  return {
    translatedText: inst.translatedText.trim(),
    detectedLanguage: inst.detectedLanguage.trim().toLowerCase(),
  };
}

export function safeParseAnalyzeOrFallback(value: unknown): {
  analysis: string;
  suggestions: string[];
  severity: AnalyzeSeverityDto;
  schemaValid: boolean;
} {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    const fallback = looseAnalyzeFallback(value);
    return { ...fallback, schemaValid: false };
  }
  const inst = plainToInstance(GeminiJsonAnalyzeDto, value, {
    exposeDefaultValues: true,
    enableImplicitConversion: false,
  });
  const errors = validateSync(inst);
  if (errors.length === 0) {
    return {
      analysis: inst.analysis.trim(),
      suggestions: inst.suggestions.map((s) => s.trim()).filter(Boolean),
      severity: inst.severity,
      schemaValid: true,
    };
  }
  const fallback = looseAnalyzeFallback(value);
  return { ...fallback, schemaValid: false };
}

function looseAnalyzeFallback(value: unknown): {
  analysis: string;
  suggestions: string[];
  severity: AnalyzeSeverityDto;
} {
  if (!value || typeof value !== 'object') {
    return {
      analysis:
        'Unable to parse structured analysis from the AI response (schema mismatch).',
      suggestions: [],
      severity: 'warning',
    };
  }
  const o = value as Record<string, unknown>;
  const analysis = typeof o.analysis === 'string' ? o.analysis.trim() : '';
  let suggestions: string[] = [];
  if (Array.isArray(o.suggestions)) {
    suggestions = o.suggestions
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const raw = o.severity;
  const severity: AnalyzeSeverityDto =
    raw === 'info' || raw === 'warning' || raw === 'error' ? raw : 'warning';
  return {
    analysis:
      analysis ||
      'No structured analysis text was extracted from this response.',
    suggestions,
    severity,
  };
}
