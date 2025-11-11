'use client';

import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import { defaultNoteTemplates } from '@/data/noteTemplates';
import { defaultLearningLanguage } from '@/data/learningLanguages';
import { colorThemeMap, defaultColorTheme } from '@/data/colorThemes';
import {
  LanguageCode,
  LearningLanguageCode,
  ColorThemeKey,
  NoteRecord,
  NoteTemplate,
  ThemeMode,
  VocabularyEntry,
  VocabularyRelation,
} from '@/types';
import { indexedDbClient } from '@/lib/indexedDb';

type NoteDraft = {
  title: string;
  content: string;
  templateId?: string;
};

type VocabularyDraft = {
  word: string;
  meaning?: string;
  notes?: string;
  tags?: string[];
  relations?: VocabularyRelation[];
};

interface AppState {
  theme: ThemeMode;
  language: LanguageCode;
  learningLanguage: LearningLanguageCode;
  colorTheme: ColorThemeKey;
  noteTemplates: NoteTemplate[];
  notes: NoteRecord[];
  vocabulary: VocabularyEntry[];
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: LanguageCode) => void;
  setLearningLanguage: (language: LearningLanguageCode) => void;
  setColorTheme: (theme: ColorThemeKey) => void;
  setNoteTemplates: (templates: NoteTemplate[]) => void;
  upsertTemplate: (template: NoteTemplate) => void;
  removeTemplate: (id: string) => void;
  setNotes: (notes: NoteRecord[]) => void;
  addNote: (draft: NoteDraft) => Promise<NoteRecord>;
  updateNote: (id: string, changes: Partial<NoteDraft>) => Promise<NoteRecord | null>;
  removeNote: (id: string) => Promise<void>;
  setVocabulary: (entries: VocabularyEntry[]) => void;
  addVocabulary: (draft: VocabularyDraft) => Promise<VocabularyEntry>;
  updateVocabulary: (id: string, changes: Partial<VocabularyDraft>) => Promise<VocabularyEntry | null>;
  removeVocabulary: (id: string) => Promise<void>;
}

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

const now = () => new Date().toISOString();

const settingsStorage = createJSONStorage(() => {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window.localStorage;
});

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        theme: 'system',
        language: 'en',
        learningLanguage: defaultLearningLanguage,
        colorTheme: defaultColorTheme,
        noteTemplates: defaultNoteTemplates,
        notes: [],
        vocabulary: [],

        setTheme: (theme) => set({ theme }),

        setLanguage: (language) => set({ language }),

        setLearningLanguage: (learningLanguage) => set({ learningLanguage }),

        setColorTheme: (colorTheme) => {
          if (colorThemeMap[colorTheme]) {
            set({ colorTheme });
          }
        },

        setNoteTemplates: (templates) => set({ noteTemplates: [...templates] }),

        upsertTemplate: (template) =>
          set((state) => {
            const index = state.noteTemplates.findIndex((item) => item.id === template.id);
            if (index === -1) {
              return { noteTemplates: [template, ...state.noteTemplates] };
            }
            const nextTemplates = [...state.noteTemplates];
            nextTemplates[index] = { ...template };
            return { noteTemplates: nextTemplates };
          }),

        removeTemplate: (id) =>
          set((state) => ({
            noteTemplates: state.noteTemplates.filter((template) => template.id !== id),
          })),

        setNotes: (notes) => set({ notes: [...notes] }),

        addNote: async (draft) => {
          const learningLanguage = get().learningLanguage;
          const note: NoteRecord = {
            id: createId(),
            title: draft.title,
            content: draft.content,
            templateId: draft.templateId,
            learningLanguage,
            createdAt: now(),
            updatedAt: now(),
          };
          set((state) => ({ notes: [note, ...state.notes] }));
          await indexedDbClient.saveNote(note);
          return note;
        },

        updateNote: async (id, changes) => {
          let updated: NoteRecord | null = null;
          set((state) => {
            const index = state.notes.findIndex((note) => note.id === id);
            if (index === -1) {
              return state;
            }
            const nextNotes = [...state.notes];
            updated = {
              ...nextNotes[index],
              ...changes,
              updatedAt: now(),
            };
            nextNotes[index] = updated;
            return { notes: nextNotes };
          });
          if (updated) {
            await indexedDbClient.saveNote(updated);
          }
          return updated;
        },

        removeNote: async (id) => {
          set((state) => ({
            notes: state.notes.filter((note) => note.id !== id),
          }));
          await indexedDbClient.deleteNote(id);
        },

        setVocabulary: (entries) => set({ vocabulary: [...entries] }),

        addVocabulary: async (draft) => {
          const learningLanguage = get().learningLanguage;
          const entry: VocabularyEntry = {
            id: createId(),
            word: draft.word,
            learningLanguage,
            meaning: draft.meaning,
            notes: draft.notes,
            tags: draft.tags ?? [],
            relations: draft.relations?.map((relation) => ({ ...relation })) ?? [],
            createdAt: now(),
            updatedAt: now(),
          };
          set((state) => ({ vocabulary: [entry, ...state.vocabulary] }));
          await indexedDbClient.saveVocabulary(entry);
          return entry;
        },

        updateVocabulary: async (id, changes) => {
          let updated: VocabularyEntry | null = null;
          set((state) => {
            const index = state.vocabulary.findIndex((entry) => entry.id === id);
            if (index === -1) {
              return state;
            }
            const nextVocabulary = [...state.vocabulary];
            updated = {
              ...nextVocabulary[index],
              ...changes,
              tags: changes.tags ? [...changes.tags] : nextVocabulary[index].tags,
              relations: changes.relations
                ? changes.relations.map((relation) => ({ ...relation }))
                : nextVocabulary[index].relations,
              updatedAt: now(),
            };
            nextVocabulary[index] = updated;
            return { vocabulary: nextVocabulary };
          });
          if (updated) {
            await indexedDbClient.saveVocabulary(updated);
          }
          return updated;
        },

        removeVocabulary: async (id) => {
          set((state) => ({
            vocabulary: state.vocabulary.filter((entry) => entry.id !== id),
          }));
          await indexedDbClient.deleteVocabulary(id);
        },
      }),
      {
        name: 'learning-machine-settings',
        storage: settingsStorage,
        partialize: (state) => ({
          theme: state.theme,
          language: state.language,
          learningLanguage: state.learningLanguage,
          colorTheme: state.colorTheme,
          noteTemplates: state.noteTemplates,
        }),
      },
    ),
  ),
);

export const selectTheme = (state: AppState) => state.theme;
export const selectLanguage = (state: AppState) => state.language;
export const selectLearningLanguage = (state: AppState) => state.learningLanguage;
export const selectColorTheme = (state: AppState) => state.colorTheme;
export const selectNoteTemplates = (state: AppState) => state.noteTemplates;
export const selectNotes = (state: AppState) => state.notes;
export const selectVocabulary = (state: AppState) => state.vocabulary;

