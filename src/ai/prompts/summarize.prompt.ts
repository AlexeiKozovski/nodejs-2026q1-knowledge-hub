import { SummaryMaxLength } from '../dto/summarize-article.dto';

const SUMMARY_LENGTH_INSTRUCTIONS: Record<SummaryMaxLength, string> = {
  [SummaryMaxLength.SHORT]: 'Provide a short summary in 2-3 concise sentences.',
  [SummaryMaxLength.MEDIUM]:
    'Provide a medium summary in 1 concise paragraph (4-6 sentences).',
  [SummaryMaxLength.DETAILED]:
    'Provide a detailed summary in 2 paragraphs (8-12 sentences total).',
};

export function buildSummarizeArticlePrompt(
  title: string,
  content: string,
  maxLength: SummaryMaxLength,
): string {
  return [
    'You are an assistant that summarizes knowledge-base articles.',
    SUMMARY_LENGTH_INSTRUCTIONS[maxLength],
    'Keep factual details and avoid adding information that is not present in the source.',
    'Respond with plain text only. Do not include markdown or bullet points.',
    '',
    `Article title: ${title}`,
    'Article content:',
    content,
  ].join('\n');
}
