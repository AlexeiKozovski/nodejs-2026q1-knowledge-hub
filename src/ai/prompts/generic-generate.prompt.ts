export function buildGenericGeneratePrompt(
  prompt: string,
  systemInstruction?: string,
): string {
  const parts = [
    'You are a helpful assistant for Knowledge Hub administrators.',
    'Respond with plain text only unless the user explicitly asks for structured output.',
    'Do not include markdown code fences wrapping the entire answer unless formatting is explicitly requested.',
  ];

  if (systemInstruction?.trim()) {
    parts.push('', 'Additional instruction:', systemInstruction.trim());
  }

  parts.push('', 'User request:', prompt.trim());

  return parts.join('\n');
}
