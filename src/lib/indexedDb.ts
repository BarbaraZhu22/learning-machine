import { openDB, DBSchema, IDBPDatabase } from "idb";
import { NoteRecord, DialogRecord } from "@/types";
import { defaultLearningLanguage } from "@/data/learningLanguages";

export interface VocabularyGraph {
  learningLanguage: string;
  nodes: Array<{
    word: string;
    meaning?: string;
    phonetic?: string;
    tags?: string[];
    notes?: string;
  }>;
  links: Array<{
    start: string;
    end: string;
    relationship: string;
  }>;
  learnedNodes?: string[]; // Array of learned word text values
}

interface LearningMachineDB extends DBSchema {
  notes: {
    key: string;
    value: NoteRecord;
  };
  vocabulary: {
    key: string; // learning language code
    value: VocabularyGraph;
  };
  dialogs: {
    key: string;
    value: DialogRecord;
  };
}

const DB_NAME = "learning-machine";
const DB_VERSION = 6;

let dbPromise: Promise<IDBPDatabase<LearningMachineDB>> | null = null;

const getDb = () => {
  if (!dbPromise) {
    dbPromise = openDB<LearningMachineDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains("notes")) {
          db.createObjectStore("notes", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("vocabulary")) {
          db.createObjectStore("vocabulary", { keyPath: "learningLanguage" });
        } else if (oldVersion < 6) {
          // Migrate vocabulary store from old structure to new VocabularyGraph structure
          db.deleteObjectStore("vocabulary");
          db.createObjectStore("vocabulary", { keyPath: "learningLanguage" });
        }
        if (!db.objectStoreNames.contains("dialogs")) {
          db.createObjectStore("dialogs", { keyPath: "id" });
        }

        if (oldVersion < 2) {
          const noteStore = transaction.objectStore("notes");
          noteStore.getAll().onsuccess = (event) => {
            const result = (event.target as IDBRequest<NoteRecord[]>).result;
            result.forEach((note) => {
              if (!note.learningLanguage) {
                noteStore.put({
                  ...note,
                  learningLanguage: defaultLearningLanguage,
                });
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
    const notes = await db.getAll("notes");
    return notes.map((note) => ({
      ...note,
      learningLanguage: note.learningLanguage ?? defaultLearningLanguage,
    }));
  },

  async saveNote(note: NoteRecord): Promise<void> {
    const db = await getDb();
    await db.put("notes", note);
  },

  async deleteNote(id: string): Promise<void> {
    const db = await getDb();
    await db.delete("notes", id);
  },

  async getAllDialogs(): Promise<DialogRecord[]> {
    const db = await getDb();
    const dialogs = await db.getAll("dialogs");
    return dialogs.map((dialog) => ({
      ...dialog,
      learningLanguage: dialog.learningLanguage ?? defaultLearningLanguage,
    }));
  },

  async saveDialog(dialog: DialogRecord): Promise<void> {
    const db = await getDb();
    await db.put("dialogs", dialog);
  },

  async deleteDialog(id: string): Promise<void> {
    const db = await getDb();
    await db.delete("dialogs", id);
  },

  async getVocabulary(
    learningLanguage: string
  ): Promise<VocabularyGraph | null> {
    const db = await getDb();
    return (await db.get("vocabulary", learningLanguage)) || null;
  },

  async saveVocabulary(graph: VocabularyGraph): Promise<void> {
    const db = await getDb();
    await db.put("vocabulary", graph);
  },
};
