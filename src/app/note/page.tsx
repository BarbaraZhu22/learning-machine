'use client';

import { useEffect, useMemo, useState } from 'react';
import { NoteTemplateManager } from '@/components/note/NoteTemplateManager';
import { NoteGenerator } from '@/components/note/NoteGenerator';
import { NoteReader } from '@/components/note/NoteReader';
import { HistoryNotes } from '@/components/note/HistoryNotes';
import { MergeNotes } from '@/components/note/MergeNotes';
import { useAppStore, selectNoteTemplates, selectNotes, selectLearningLanguage } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { learningLanguages } from '@/data/learningLanguages';

export default function NotePage() {
  const { t } = useTranslation();
  const templates = useAppStore(selectNoteTemplates);
  const allNotes = useAppStore(selectNotes);
  const learningLanguage = useAppStore(selectLearningLanguage);
  const addNote = useAppStore((state) => state.addNote);
  const updateNote = useAppStore((state) => state.updateNote);
  const removeNote = useAppStore((state) => state.removeNote);

  const [editorNote, setEditorNote] = useState<{ id: string; title: string; content: string } | null>(null);
  const learningLanguageLabel =
    learningLanguages.find((item) => item.code === learningLanguage)?.label ?? learningLanguage;

  const notes = useMemo(
    () => allNotes.filter((note) => note.learningLanguage === learningLanguage),
    [allNotes, learningLanguage],
  );

  useEffect(() => {
    setEditorNote(null);
  }, [learningLanguage]);

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-xl border border-transparent bg-gradient-to-r from-primary-50 via-surface-50 to-primary-50 p-6 shadow-lg shadow-primary-100/60 dark:border-surface-700 dark:bg-surface-900">
        <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
          <h1 className="text-3xl font-semibold text-primary-700 dark:text-primary-200">{t('notes')}</h1>
          <span className="text-sm text-primary-700/80 dark:text-primary-100/80">
            {t('learningLanguage')}: <strong className="font-semibold">{learningLanguageLabel}</strong>
          </span>
        </div>
        <NoteTemplateManager />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <NoteGenerator templates={templates} onGenerate={addNote} />

        <div className="space-y-6">
          <HistoryNotes
            notes={notes}
            onSelect={(note) => setEditorNote({ id: note.id, title: note.title, content: note.content })}
            onDelete={async (id) => {
              await removeNote(id);
              if (editorNote?.id === id) {
                setEditorNote(null);
              }
            }}
          />
          <MergeNotes templates={templates} notes={notes} onMerge={addNote} />
        </div>
      </section>

      <section className="rounded-xl border border-transparent bg-white/90 p-6 shadow-lg shadow-primary-100/60 backdrop-blur dark:border-surface-700 dark:bg-surface-900">
        <h2 className="text-2xl font-semibold text-primary-700 dark:text-primary-200">{t('noteReader')}</h2>
        <div className="mt-4">
          <NoteReader
            note={editorNote}
            onChange={(note) => setEditorNote(note)}
            onSave={async (note) => {
              await updateNote(note.id, { title: note.title, content: note.content });
            }}
            onCancel={() => setEditorNote(null)}
          />
        </div>
      </section>
    </div>
  );
}

