import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { NoteRecord, VocabularyEntry, DialogRecord } from '@/types';
import { defaultLearningLanguage } from '@/data/learningLanguages';

interface LearningMachineDB extends DBSchema {
  notes: {
    key: string;
    value: NoteRecord;
  };
  vocabulary: {
    key: string;
    value: VocabularyEntry;
  };
  dialogs: {
    key: string;
    value: DialogRecord;
  };
}

const DB_NAME = 'learning-machine';
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<LearningMachineDB>> | null = null;

const getDb = () => {
  if (!dbPromise) {
    dbPromise = openDB<LearningMachineDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains('notes')) {
          db.createObjectStore('notes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('vocabulary')) {
          db.createObjectStore('vocabulary', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('dialogs')) {
          db.createObjectStore('dialogs', { keyPath: 'id' });
        }

        if (oldVersion < 2) {
          const noteStore = transaction.objectStore('notes');
          const vocabStore = transaction.objectStore('vocabulary');

          noteStore.getAll().onsuccess = (event) => {
            const result = (event.target as IDBRequest<NoteRecord[]>).result;
            result.forEach((note) => {
              if (!note.learningLanguage) {
                noteStore.put({ ...note, learningLanguage: defaultLearningLanguage });
              }
            });
          };

          vocabStore.getAll().onsuccess = (event) => {
            const result = (event.target as IDBRequest<VocabularyEntry[]>).result;
            result.forEach((entry) => {
              if (!entry.learningLanguage) {
                vocabStore.put({ ...entry, learningLanguage: defaultLearningLanguage });
              }
            });
          };
        }
      },
    });
  }
  return dbPromise;
};

export const indexedDbClient = {
  async getAllNotes(): Promise<NoteRecord[]> {
    const db = await getDb();
    const notes = await db.getAll('notes');
    return notes.map((note) => ({
      ...note,
      learningLanguage: note.learningLanguage ?? defaultLearningLanguage,
    }));
  },

  async saveNote(note: NoteRecord): Promise<void> {
    const db = await getDb();
    await db.put('notes', note);
  },

  async deleteNote(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('notes', id);
  },

  async getAllVocabulary(): Promise<VocabularyEntry[]> {
    const db = await getDb();
    const vocabulary = await db.getAll('vocabulary');
    return vocabulary.map((entry) => ({
      ...entry,
      learningLanguage: entry.learningLanguage ?? defaultLearningLanguage,
    }));
  },

  async saveVocabulary(entry: VocabularyEntry): Promise<void> {
    const db = await getDb();
    await db.put('vocabulary', entry);
  },

  async deleteVocabulary(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('vocabulary', id);
  },

  async getAllDialogs(): Promise<DialogRecord[]> {
    const db = await getDb();
    const dialogs = await db.getAll('dialogs');
    return dialogs.map((dialog) => ({
      ...dialog,
      learningLanguage: dialog.learningLanguage ?? defaultLearningLanguage,
    }));
  },

  async saveDialog(dialog: DialogRecord): Promise<void> {
    const db = await getDb();
    await db.put('dialogs', dialog);
  },

  async deleteDialog(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('dialogs', id);
  },
};

