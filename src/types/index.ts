export type ThemeMode = 'light' | 'dark' | 'system';

export type LanguageCode = 'en' | 'zh';

export type LearningLanguageCode = 
  | 'english' 
  | 'spanish' 
  | 'french' 
  | 'japanese' 
  | 'chinese'
  | 'german'
  | 'portuguese'
  | 'italian'
  | 'russian'
  | 'korean'
  | 'turkish'
  | 'dutch'
  | 'polish';

export type ColorThemeKey = 'blue' | 'purple' | 'green' | 'grey';

export type RelationType = 'similar' | 'synonym' | 'antonym' | 'root' | 'homophone';

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
  ssmlConfig?: {
    characters: Record<string, {
      voice?: {
        gender?: 'male' | 'female' | 'neutral';
        age?: 'child' | 'young' | 'adult' | 'elderly';
        accent?: string;
      };
    }>; // character -> base voice config (same voice for all sentences)
    sentences: Array<{
      index: number;
      character: string;
      prosody?: {
        rate?: number;
        pitch?: number;
        volume?: number;
      };
      emphasis?: 'strong' | 'moderate' | 'reduced';
      break?: {
        time?: number; // milliseconds
        strength?: 'none' | 'x-weak' | 'weak' | 'medium' | 'strong' | 'x-strong';
      };
    }>; // per-sentence prosody and break config
  };
  learningLanguage: LearningLanguageCode;
  createdAt: string;
  updatedAt: string;
}

export type LLMProvider = 'deepseek' | 'openai' | 'anthropic' | 'custom';

export interface AIConfig {
  provider: LLMProvider;
  apiKey: string;
  apiUrl?: string;
  model?: string;
}

