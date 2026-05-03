import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, test } from 'vitest';
import { GeminiJsonAnalyzeDto } from '../../ai/dto/gemini-json-analyze.dto';
import { GeminiJsonTranslateDto } from '../../ai/dto/gemini-json-translate.dto';
import {
  safeParseAnalyzeOrFallback,
  safeParseTranslate,
} from '../../ai/schemas/structured-ai-response.validation';

describe('Structured AI JSON (class-validator)', () => {
  test('GeminiJsonTranslateDto accepts valid payloads', () => {
    const inst = plainToInstance(GeminiJsonTranslateDto, {
      translatedText: 'hello',
      detectedLanguage: 'en',
    });
    expect(validateSync(inst)).toHaveLength(0);
  });

  test('GeminiJsonTranslateDto rejects missing fields', () => {
    const inst = plainToInstance(GeminiJsonTranslateDto, {
      translatedText: 'x',
    });
    expect(validateSync(inst).length).toBeGreaterThan(0);
  });

  test('safeParseTranslate normalizes', () => {
    expect(
      safeParseTranslate({
        translatedText: '  hi  ',
        detectedLanguage: ' EN ',
      }),
    ).toEqual({ translatedText: 'hi', detectedLanguage: 'en' });
  });

  test('GeminiJsonAnalyzeDto rejects bad severity', () => {
    const inst = plainToInstance(GeminiJsonAnalyzeDto, {
      analysis: 'ok',
      suggestions: [],
      severity: 'critical',
    });
    expect(validateSync(inst).length).toBeGreaterThan(0);
  });

  test('safeParseAnalyzeOrFallback uses tolerant parse when schema fails', () => {
    const loose = safeParseAnalyzeOrFallback({
      analysis: 'x',
      suggestions: ['a'],
      severity: 'oops',
    });
    expect(loose.schemaValid).toBe(false);
    expect(loose.suggestions).toEqual(['a']);
    expect(loose.severity).toBe('warning');
  });
});
