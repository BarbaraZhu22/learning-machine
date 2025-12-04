/**
 * Centralized language hints and prompts for LLM nodes
 * This ensures consistent language handling across all AI interactions
 */

import type { NodeContext } from './types';

/**
 * Get language context information
 */
export function getLanguageContext(context?: NodeContext): {
  userLanguage: string;
  learningLanguage: string;
  userLanguageName: string;
  learningLanguageName: string;
} {
  const userLanguage = context?.userLanguage || 'en';
  const learningLanguage = context?.learningLanguage || 'english';

  // Map language codes to full names
  const languageNames: Record<string, string> = {
    en: 'English',
    zh: 'Chinese',
    english: 'English',
    chinese: 'Chinese',
    cantonese: 'Cantonese',
    spanish: 'Spanish',
    portuguese: 'Portuguese',
    french: 'French',
    russian: 'Russian',
    japanese: 'Japanese',
    german: 'German',
    korean: 'Korean',
    italian: 'Italian',
    turkish: 'Turkish',
    polish: 'Polish',
    dutch: 'Dutch',
  };

  return {
    userLanguage,
    learningLanguage,
    userLanguageName: languageNames[userLanguage] || userLanguage,
    learningLanguageName: languageNames[learningLanguage] || learningLanguage,
  };
}

/**
 * Get system prompt language instruction
 * This is automatically prepended to all system prompts
 */
export function getSystemLanguageInstruction(context?: NodeContext): string {
  const { userLanguage, userLanguageName, learningLanguage, learningLanguageName } =
    getLanguageContext(context);

  return `IMPORTANT LANGUAGE RULES:
- You MUST respond in ${userLanguageName} (user's language: ${userLanguage})
- The learning language is ${learningLanguageName} (${learningLanguage})
- All your responses, explanations, and analysis must be in ${userLanguageName}
- Generated content for learning should be in ${learningLanguageName}`;
}

/**
 * Get user prompt language context
 * This is automatically prepended to user prompts
 */
export function getUserLanguageContext(context?: NodeContext): string {
  const { userLanguage, userLanguageName, learningLanguage, learningLanguageName } =
    getLanguageContext(context);

  return `Language Context:
- User Language: ${userLanguageName} (${userLanguage}) - Use this for all responses
- Learning Language: ${learningLanguageName} (${learningLanguage}) - Use this for generated learning content`;
}

/**
 * Get dialog generation format instructions
 */
export function getDialogFormatInstructions(context?: NodeContext): string {
  const { userLanguage, userLanguageName, learningLanguage, learningLanguageName } =
    getLanguageContext(context);

  return `CRITICAL FORMAT REQUIREMENTS:
Each dialog entry MUST have both fields:
- "use_text": Text in ${userLanguageName} (${userLanguage}) - what the user understands
- "learn_text": Text in ${learningLanguageName} (${learningLanguage}) - what the user is learning

Example format:
{
  "character": "CharacterName",
  "use_text": "text in ${userLanguageName}",
  "learn_text": "text in ${learningLanguageName}"
}`;
}

/**
 * Get validation instructions for dialog check
 */
export function getDialogValidationInstructions(context?: NodeContext): string {
  const { userLanguage, userLanguageName, learningLanguage, learningLanguageName } =
    getLanguageContext(context);

  return `Validation Requirements:
1. Each dialog entry must have both "use_text" and "learn_text"
2. "use_text" must be in ${userLanguageName} (${userLanguage})
3. "learn_text" must be in ${learningLanguageName} (${learningLanguage})
4. Dialog must be natural, relevant, and appropriate for language learning`;
}

/**
 * Get phonetic format instructions based on learning language
 */
export function getPhoneticFormatInstruction(context?: NodeContext): string {
  const learningLanguage = context?.learningLanguage || 'english';

  const phoneticFormats: Record<string, string> = {
    english: 'Use IPA (International Phonetic Alphabet) notation, e.g., "/hɛloʊ/"',
    japanese: 'Use Romaji (romanized form), e.g., "konnichiwa"',
    chinese: 'Use Pinyin, e.g., "dān cí"',
    cantonese: 'Use Jyutping, e.g., "daan1 ci4"',
    korean: 'Use Revised Romanization, e.g., "annyeonghaseyo"',
    spanish: 'Use IPA notation, e.g., "/hɔla/"',
    french: 'Use IPA notation, e.g., "/bɔnʒuʁ/"',
    german: 'Use IPA notation, e.g., "/gʊtən tɑk/"',
    portuguese: 'Use IPA notation, e.g., "/ɔla/"',
    italian: 'Use IPA notation, e.g., "/tʃao/"',
    russian: 'Use IPA notation, e.g., "/privet/"',
    turkish: 'Use IPA notation, e.g., "/mɛrhaba/"',
    polish: 'Use IPA notation, e.g., "/tʃɛst/"',
    dutch: 'Use IPA notation, e.g., "/hɑlo/"',
  };

  return phoneticFormats[learningLanguage] || 'Use standard phonetic notation appropriate for the language';
}

