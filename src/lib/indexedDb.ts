import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { NoteRecord, VocabularyEntry } from '@/types';

interface LearningMachineDB extends DBSchema {
  notes: {
    key: string;
    value: NoteRecord;
  };
  vocabulary: {
    key: string;
    value: VocabularyEntry;
  };
}

const DB_NAME = 'learning-machine';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<LearningMachineDB>> | null = null;

const getDb = () => {
  if (!dbPromise) {
    dbPromise = openDB<LearningMachineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('notes')) {
          db.createObjectStore('notes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('vocabulary')) {
          db.createObjectStore('vocabulary', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

export const indexedDbClient = {
  async getAllNotes(): Promise<NoteRecord[]> {
    const db = await getDb();
    return db.getAll('notes');
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
    return db.getAll('vocabulary');
  },

  async saveVocabulary(entry: VocabularyEntry): Promise<void> {
    const db = await getDb();
    await db.put('vocabulary', entry);
  },

  async deleteVocabulary(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('vocabulary', id);
  },
};

