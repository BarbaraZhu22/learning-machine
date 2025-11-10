'use client';

import { FormEvent, useMemo, useState } from 'react';
import { NoteRecord, NoteTemplate } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';

type MergeNotesProps = {
  templates: NoteTemplate[];
  notes: NoteRecord[];
  onMerge: (note: { title: string; content: string; templateId?: string }) => void | Promise<void>;
};

export const MergeNotes = ({ templates, notes, onMerge }: MergeNotesProps) => {
  const { t } = useTranslation();
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? '');
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');

  const filteredNotes = useMemo(
    () => notes.filter((note) => !templateId || note.templateId === templateId),
    [notes, templateId],
  );

  const toggleNote = (id: string) => {
    setSelectedNoteIds((ids) => (ids.includes(id) ? ids.filter((currentId) => currentId !== id) : [...ids, id]));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedNoteIds.length || !title.trim()) {
      return;
    }
    const selectedNotes = selectedNoteIds
      .map((id) => notes.find((note) => note.id === id))
      .filter((note): note is NoteRecord => Boolean(note))
      .map((note) => `## ${note.title}\n\n${note.content}`);

    const mergedContent = `# ${title.trim()}\n\n${selectedNotes.join('\n\n---\n\n')}`;

    await onMerge({ title: title.trim(), content: mergedContent, templateId: templateId || undefined });
    setSelectedNoteIds([]);
    setTitle('');
  };

  return (
    <form className="space-y-4 rounded-lg border border-surface-200 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-950" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">{t('merge')}</h3>
        <p className="text-sm text-muted-foreground">
          {filteredNotes.length ? `${filteredNotes.length} candidate notes.` : 'No notes available for this template.'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">{t('selectTemplate')}</label>
          <select
            className="rounded-md border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-900"
            value={templateId}
            onChange={(event) => {
              setTemplateId(event.target.value);
              setSelectedNoteIds([]);
            }}
          >
            <option value="">{t('defaultTemplate')}</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">{t('noteGenerator')}</label>
          <input
            className="rounded-md border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-900"
            placeholder="Merged note title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('history')}</div>
        <div className="space-y-2">
          {filteredNotes.map((note) => (
            <label
              key={note.id}
              className="flex cursor-pointer items-center justify-between rounded-md border border-surface-200 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
            >
              <div>
                <div className="font-medium">{note.title}</div>
                <div className="text-xs text-muted-foreground">{new Date(note.updatedAt).toLocaleString()}</div>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={selectedNoteIds.includes(note.id)}
                onChange={() => toggleNote(note.id)}
              />
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-300"
        disabled={!selectedNoteIds.length || !title.trim()}
      >
        {t('mergeSelected')}
      </button>
    </form>
  );
};

