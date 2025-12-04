export type ThemeMode = "light" | "dark" | "system";

export type LanguageCode = "en" | "zh";

export type LearningLanguageCode =
  | "english"
  | "spanish"
  | "french"
  | "japanese"
  | "chinese"
  | "cantonese"
  | "german"
  | "portuguese"
  | "italian"
  | "russian"
  | "korean"
  | "turkish"
  | "dutch"
  | "polish";

export type ColorThemeKey = "blue" | "purple" | "green" | "grey";

export type RelationType =
  | "similar"
  | "synonym"
  | "antonym"
  | "root"
  | "homophone"
  | "topic";

export interface TemplateSection {
  id: string;
  title: string;
  description: string;
  tags: string[];
}

export interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];
  sections: TemplateSection[];
}

export interface NoteRecord {
  id: string;
  title: string;
  content: string;
  templateId?: string;
  learningLanguage: LearningLanguageCode;
  createdAt: string;
  updatedAt: string;
}

export interface VocabularyRelation {
  id: string;
  type: RelationType;
  targetId: string;
}

export interface VocabularyEntry {
  id: string;
  word: string;
  learningLanguage: LearningLanguageCode;
  phonetic?: string;
  meaning?: string;
  notes?: string;
  relations: VocabularyRelation[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LinkNode {
  id: string;
  word: string;
  position: { x: number; y: number };
  relationCounts: Record<RelationType, number>;
}

export interface LinkEdge {
  id: string;
  source: string;
  target: string;
  type: RelationType;
}

export interface DialogScenario {
  id: string;
  situation: string;
  characterA: string;
  characterB: string;
  notes: string;
  transcript: string;
  createdAt: string;
}

export interface DialogRecord {
  id: string; // Format: diagxxx-sessionxxx
  sessionId?: string;
  name?: string; // Optional custom name for the dialog
  dialogContent: {
    characters: string[];
    dialog: Array<{
      character: string;
      use_text: string;
      learn_text: string;
    }>;
  };
  voiceSuggestions?: Record<string, string>; // character -> voice description (natural language)
  // Cached audio data (base64 encoded MP3) - only stored if total size < 300KB
  cachedAudio?: {
    audioBase64: string; // Base64 encoded merged MP3 audio
    sentenceAudioBuffers?: Array<{
      sentenceIndex: number;
      audioBase64: string; // Base64 encoded audio for this sentence
      character?: string;
    }>;
  };
  learningLanguage: LearningLanguageCode;
  createdAt: string;
  updatedAt: string;
}

export type LLMProvider = "deepseek" | "openai" | "anthropic" | "custom";

export interface AIConfig {
  provider: LLMProvider;
  apiKey: string;
  apiUrl?: string;
  model?: string;
}
