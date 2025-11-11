import { LearningLanguageCode } from '@/types';

export const learningLanguages: { code: LearningLanguageCode; label: string }[] = [
  { code: 'english', label: 'English' },
  { code: 'spanish', label: 'Español' },
  { code: 'french', label: 'Français' },
  { code: 'japanese', label: '日本語' },
  { code: 'chinese', label: '中文' },
];

export const defaultLearningLanguage: LearningLanguageCode = learningLanguages[0].code;

