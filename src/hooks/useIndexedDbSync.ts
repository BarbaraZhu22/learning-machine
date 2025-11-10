'use client';

import { useEffect } from 'react';
import { indexedDbClient } from '@/lib/indexedDb';
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
          setNotes(notes);
          setVocabulary(vocabulary);
        }
      } catch (error) {
        console.error('Failed to load IndexedDB data', error);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [setNotes, setVocabulary]);
};

