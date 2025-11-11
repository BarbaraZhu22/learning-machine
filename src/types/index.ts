export type ThemeMode = 'light' | 'dark' | 'system';

export type LanguageCode = 'en' | 'zh';

export type LearningLanguageCode = 'english' | 'spanish' | 'french' | 'japanese' | 'chinese';

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

