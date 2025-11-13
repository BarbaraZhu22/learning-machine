'use client';

import { useEffect } from 'react';
import { indexedDbClient } from '@/lib/indexedDb';
import { defaultLearningLanguage } from '@/data/learningLanguages';
import { useAppStore } from '@/store/useAppStore';

export const useIndexedDbSync = () => {
  const setNotes = useAppStore((state) => state.setNotes);
  const setVocabulary = useAppStore((state) => state.setVocabulary);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [notes, vocabulary] = await Promise.all([
          indexedDbClient.getAllNotes(),
          indexedDbClient.getAllVocabulary(),
        ]);
        if (!cancelled) {
          setNotes(
            notes.map((note) => ({
              ...note,
              learningLanguage: note.learningLanguage ?? defaultLearningLanguage,
            })),
          );
          setVocabulary(
            vocabulary.map((entry) => ({
              ...entry,
              learningLanguage: entry.learningLanguage ?? defaultLearningLanguage,
            })),
          );
        }
      } catch (error) {
        // Silently handle IndexedDB load errors
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [setNotes, setVocabulary]);
};

