import { LearningLanguageCode } from "@/types";

export const learningLanguages: {
  code: LearningLanguageCode;
  label: string;
}[] = [
  { code: "english", label: "English" },
  { code: "chinese", label: "中文" },
  { code: "cantonese", label: "粤语" },
  { code: "spanish", label: "Español" },
  { code: "portuguese", label: "Português" },
  { code: "french", label: "Français" },
  { code: "russian", label: "Русский" },
  { code: "japanese", label: "日本語" },
  { code: "german", label: "Deutsch" },
  { code: "korean", label: "한국어" },
  { code: "italian", label: "Italiano" },
  { code: "turkish", label: "Türkçe" },
  { code: "polish", label: "Polski" },
  { code: "dutch", label: "Nederlands" },
];

export const defaultLearningLanguage: LearningLanguageCode =
  learningLanguages[0].code;
