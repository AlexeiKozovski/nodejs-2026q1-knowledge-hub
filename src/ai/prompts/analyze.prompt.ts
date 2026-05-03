import { AnalyzeArticleTask } from '../dto/analyze-article.dto';

const TASK_INSTRUCTIONS: Record<AnalyzeArticleTask, string> = {
  [AnalyzeArticleTask.REVIEW]:
    'Perform an editorial review: clarity, structure, tone, and usefulness for readers.',
  [AnalyzeArticleTask.BUGS]:
    'Look for factual inconsistencies, contradictions, ambiguous statements, and risky claims relative to the stated content.',
  [AnalyzeArticleTask.OPTIMIZE]:
    'Suggest how to improve readability, headings, flow, and actionable takeaways without rewriting the whole article.',
  [AnalyzeArticleTask.EXPLAIN]:
    'Explain the core ideas in simpler terms and note any prerequisites a reader might need.',
};

export function buildAnalyzeArticlePrompt(
  title: string,
  content: string,
  task: AnalyzeArticleTask,
): string {
  const taskLine = TASK_INSTRUCTIONS[task];

  return [
    `You analyze knowledge-base articles. Task type: ${task}.`,
    taskLine,
    'Respond with a single JSON object ONLY, no markdown fences, no commentary.',
    'JSON shape: {"analysis":"<string>","suggestions":["<string>",...],"severity":"info"|"warning"|"error"}',
    'analysis: 1–3 short paragraphs of plain text.',
    'suggestions: concise bullet-style strings (0–8 items). Use [] if none.',
    'severity:',
    '  "info" — minor improvements or informational notes.',
    '  "warning" — meaningful issues that confuse readers or weak structure.',
    '  "error" — serious inaccuracies, contradictory claims, or content that appears broken/wrong.',
    '',
    `Article title:\n${title}`,
    '',
    'Article content:',
    content,
  ].join('\n');
}
