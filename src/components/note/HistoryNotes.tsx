'use client';

import { NoteRecord } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';

type HistoryNotesProps = {
  notes: NoteRecord[];
  onSelect: (note: NoteRecord) => void;
  onDelete: (id: string) => void | Promise<void>;
};

export const HistoryNotes = ({ notes, onSelect, onDelete }: HistoryNotesProps) => {
  const { t } = useTranslation();

  if (!notes.length) {
    return (
      <div className="rounded-lg border border-dashed border-surface-300 bg-surface-50 p-6 text-sm text-muted-foreground dark:border-surface-700 dark:bg-surface-950">
        No notes saved yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('history')}</h4>
      <div className="grid gap-2">
        {notes.map((note) => (
          <div
            key={note.id}
            className="flex items-center justify-between rounded-md border border-surface-200 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
          >
            <div>
              <button className="font-medium hover:underline" onClick={() => onSelect(note)}>
                {note.title}
              </button>
              <div className="text-xs text-muted-foreground">
                {new Date(note.updatedAt).toLocaleString()} {note.templateId ? `· ${note.templateId}` : ''}
              </div>
            </div>
            <button
              className="text-xs text-destructive-500 hover:underline"
              onClick={() => onDelete(note.id)}
            >
              {t('delete')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

