import type { Finding } from '../core/types.js';

/**
 * Build a prompt tailored to the finding's analyzer type.
 * The LLM is asked for a concise fix suggestion (1-3 lines max).
 */
export function buildPrompt(finding: Finding, codeSnippet: string): string {
  const strategy = PROMPT_STRATEGIES[finding.analyzer] ?? PROMPT_STRATEGIES['default'];
  return strategy(finding, codeSnippet);
}

type PromptBuilder = (finding: Finding, codeSnippet: string) => string;

const aiSmellsPrompt: PromptBuilder = (finding, codeSnippet) => {
  return [
    'You are a code quality expert identifying AI-generated code smells.',
    `An AI code smell was detected: "${finding.message}" (rule: ${finding.ruleId}).`,
    '',
    'Code:',
    '```',
    codeSnippet,
    '```',
    '',
    'Suggest a concise improvement (1-3 lines of code max) that removes this AI-generated code smell.',
    'Respond ONLY with the improved code, no explanation.',
  ].join('\n');
};

const PROMPT_STRATEGIES: Record<string, PromptBuilder> = {
  'ai-smells': aiSmellsPrompt,

  security(finding, codeSnippet) {
    return [
      'You are a security expert reviewing code.',
      `A security issue was found: "${finding.message}" (rule: ${finding.ruleId}).`,
      '',
      'Code:',
      '```',
      codeSnippet,
      '```',
      '',
      'Suggest a concise fix (1-3 lines of code max) that resolves this security issue.',
      'Respond ONLY with the fix, no explanation.',
    ].join('\n');
  },

  conventions(finding, codeSnippet) {
    return [
      'You are a code style expert enforcing project conventions.',
      `A convention violation was found: "${finding.message}" (rule: ${finding.ruleId}).`,
      '',
      'Code:',
      '```',
      codeSnippet,
      '```',
      '',
      'Suggest a concise fix (1-3 lines of code max) that corrects this naming or style convention violation.',
      'Respond ONLY with the corrected code, no explanation.',
    ].join('\n');
  },

  architecture(finding, codeSnippet) {
    return [
      'You are a software architect reviewing layer dependencies.',
      `An architecture violation was found: "${finding.message}" (rule: ${finding.ruleId}).`,
      '',
      'Code:',
      '```',
      codeSnippet,
      '```',
      '',
      'Suggest a concise fix (1-3 lines of code max) that resolves this layer dependency violation.',
      'Respond ONLY with the fix, no explanation.',
    ].join('\n');
  },

  default(finding, codeSnippet) {
    return [
      'You are a code review expert.',
      `An issue was found: "${finding.message}" (rule: ${finding.ruleId}, analyzer: ${finding.analyzer}).`,
      '',
      'Code:',
      '```',
      codeSnippet,
      '```',
      '',
      'Suggest a concise fix (1-3 lines of code max) that resolves this issue.',
      'Respond ONLY with the fix, no explanation.',
    ].join('\n');
  },
};
