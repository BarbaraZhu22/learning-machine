'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAppStore, selectVocabulary, selectLearningLanguage, selectLearningLanguageLabel } from '@/store/useAppStore';
import { VocabularyEntry } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';

type EditingState = {
  id: string;
  word: string;
  meaning: string;
  notes: string;
  tags: string;
} | null;

export const VocabularyDashboard = () => {
  const { t } = useTranslation();
  const allVocabulary = useAppStore(selectVocabulary);
  const learningLanguage = useAppStore(selectLearningLanguage);
  const addVocabulary = useAppStore((state) => state.addVocabulary);
  const updateVocabulary = useAppStore((state) => state.updateVocabulary);
  const removeVocabulary = useAppStore((state) => state.removeVocabulary);

  const [word, setWord] = useState('');
  const [meaning, setMeaning] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [editing, setEditing] = useState<EditingState>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    setEditing(null);
    setFilter('');
  }, [learningLanguage]);

  const learningLanguageLabel = useAppStore(selectLearningLanguageLabel);

  const vocabulary = useMemo(
    () => allVocabulary.filter((entry) => entry.learningLanguage === learningLanguage),
    [allVocabulary, learningLanguage],
  );

  const filteredVocabulary = useMemo(() => {
    if (!filter.trim()) return vocabulary;
    const keyword = filter.trim().toLowerCase();
    return vocabulary.filter(
      (entry) =>
        entry.word.toLowerCase().includes(keyword) ||
        (entry.meaning ?? '').toLowerCase().includes(keyword) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(keyword)),
    );
  }, [filter, vocabulary]);

  const handleAddVocabulary = async (event: FormEvent) => {
    event.preventDefault();
    if (!word.trim()) return;
    await addVocabulary({
      word: word.trim(),
      meaning: meaning.trim(),
      notes: notes.trim(),
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    setWord('');
    setMeaning('');
    setNotes('');
    setTags('');
  };

  const handleUpdateVocabulary = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    await updateVocabulary(editing.id, {
      word: editing.word.trim(),
      meaning: editing.meaning.trim(),
      notes: editing.notes.trim(),
      tags: editing.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    setEditing(null);
  };

  const startEditing = (entry: VocabularyEntry) => {
    setEditing({
      id: entry.id,
      word: entry.word,
      meaning: entry.meaning ?? '',
      notes: entry.notes ?? '',
      tags: entry.tags.join(', '),
    });
  };

  return (
    <div className="space-y-6">
      <form
        className="grid gap-4 rounded-lg border border-surface-200 bg-surface-50 p-4 md:grid-cols-2 dark:border-surface-700 dark:bg-surface-950"
        onSubmit={handleAddVocabulary}
      >
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">{t('addVocabulary')}</label>
          <input
            className="rounded-md border border-surface-300 bg-surface-50 px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-900"
            placeholder="Vocabulary"
            value={word}
            onChange={(event) => setWord(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Meaning</label>
          <input
            className="rounded-md border border-surface-300 bg-surface-50 px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-900"
            placeholder="Meaning"
            value={meaning}
            onChange={(event) => setMeaning(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">{t('notesLabel')}</label>
          <textarea
            className="rounded-md border border-surface-300 bg-surface-50 px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-900"
            placeholder="Usage notes"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">{t('tags')}</label>
          <input
            className="rounded-md border border-surface-300 bg-surface-50 px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-900"
            placeholder="comma,separated,tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
        </div>
        <button
          type="submit"
          className="md:col-span-2 rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-[color:var(--text-inverse)] transition hover:bg-primary-600"
        >
          {t('add')}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-surface-200/50 bg-[color:var(--glass-base)] p-4 shadow-lg shadow-primary-100/40 backdrop-blur dark:border-surface-700 dark:bg-surface-900">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('totalVocabulary')}</div>
          <div className="text-2xl font-bold">{vocabulary.length}</div>
          <div className="text-xs text-muted-foreground">
            {t('learningLanguage')}: <span className="font-semibold">{learningLanguageLabel}</span>
          </div>
        </div>
        <input
          className="max-w-xs flex-1 rounded-md border border-surface-300 bg-surface-50 px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-800"
          placeholder="Filter..."
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filteredVocabulary.map((entry) => (
          <div
            key={entry.id}
            className="rounded-lg border border-surface-200/50 bg-[color:var(--glass-base)] p-4 text-sm shadow-lg shadow-primary-100/40 transition hover:-translate-y-0.5 dark:border-surface-700 dark:bg-surface-900"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-lg font-semibold">{entry.word}</div>
                {entry.meaning ? <div className="text-xs text-muted-foreground">{entry.meaning}</div> : null}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{entry.relations.length} links</span>
                <button className="text-primary-500 hover:underline" onClick={() => startEditing(entry)}>
                  Edit
                </button>
                <button className="text-destructive-500 hover:underline" onClick={() => removeVocabulary(entry.id)}>
                  {t('delete')}
                </button>
              </div>
            </div>
            {entry.notes ? <p className="mt-2 text-xs text-muted-foreground">{entry.notes}</p> : null}
            {entry.tags.length ? (
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {entry.tags.map((tag) => (
                  <span key={tag} className="rounded-md bg-surface-200 px-2 py-1 dark:bg-surface-800">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}

        {!filteredVocabulary.length ? (
          <div className="rounded-lg border border-dashed border-surface-300 p-4 text-sm text-muted-foreground dark:border-surface-700">
            {t('vocabulary')} empty.
          </div>
        ) : null}
      </div>

      {editing ? (
        <form
          className="space-y-3 rounded-lg border border-primary-300 bg-primary-50 p-4 dark:border-primary-700 dark:bg-primary-950"
          onSubmit={handleUpdateVocabulary}
        >
          <div className="flex items-center justify-between">
            <h4 className="text-base font-semibold">Edit vocabulary</h4>
            <button className="text-sm text-primary-500 hover:underline" onClick={() => setEditing(null)} type="button">
              {t('cancel')}
            </button>
          </div>
          <input
            className="w-full rounded-md border border-surface-300 bg-surface-50 px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-900"
            value={editing.word}
            onChange={(event) => setEditing({ ...editing, word: event.target.value })}
          />
          <input
            className="w-full rounded-md border border-surface-300 bg-surface-50 px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-900"
            value={editing.meaning}
            onChange={(event) => setEditing({ ...editing, meaning: event.target.value })}
          />
          <textarea
            className="w-full rounded-md border border-surface-300 bg-surface-50 px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-900"
            rows={2}
            value={editing.notes}
            onChange={(event) => setEditing({ ...editing, notes: event.target.value })}
          />
          <input
            className="w-full rounded-md border border-surface-300 bg-surface-50 px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-900"
            value={editing.tags}
            onChange={(event) => setEditing({ ...editing, tags: event.target.value })}
          />
          <button
            type="submit"
            className="w-full rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-[color:var(--text-inverse)] transition hover:bg-primary-600"
          >
            {t('save')}
          </button>
        </form>
      ) : null}
    </div>
  );
};

