export function buildTranslateArticlePrompt(
  title: string,
  content: string,
  targetLanguage: string,
  sourceLanguage?: string,
): string {
  const sourceHint = sourceLanguage
    ? `The source language is explicitly given as: ${sourceLanguage}. Still detect/confirm the actual language of the article text and return it as detectedLanguage (ISO 639-1 or BCP-47, lowercase).`
    : `Detect the source language of the article text. Return it as detectedLanguage (ISO 639-1 or BCP-47 tag, lowercase).`;

  return [
    'You translate knowledge-base articles accurately, preserving meaning and technical terms.',
    'Respond with a single JSON object ONLY, no markdown fences, no commentary.',
    'JSON shape: {"translatedText":"...","detectedLanguage":"..."}',
    'translatedText: full translated body (plain string, use \\n for newlines).',
    `Translate the full article body into "${targetLanguage}" using natural phrasing for readers of that language.`,
    sourceHint,
    '',
    `Article title:\n${title}`,
    '',
    'Article content:',
    content,
  ].join('\n');
}
