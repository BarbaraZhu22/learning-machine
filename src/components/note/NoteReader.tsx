'use client';

import { useTranslation } from "@/hooks/useTranslation";

type EditableNote = {
  id: string;
  title: string;
  content: string;
};

type NoteReaderProps = {
  note: EditableNote | null;
  onChange: (note: EditableNote) => void;
  onSave: (note: EditableNote) => void | Promise<void>;
  onCancel?: () => void;
};

export const NoteReader = ({ note, onChange, onSave, onCancel }: NoteReaderProps) => {
  const { t } = useTranslation();

  if (!note) {
    return (
      <div className="rounded-lg border border-dashed border-surface-300 bg-surface-50 p-6 text-sm text-muted-foreground dark:border-surface-700 dark:bg-surface-950">
        Select a note to read or edit.
      </div>
    );
  }

  const handleSave = () => {
    onSave(note);
  };

  return (
    <div className="space-y-4 rounded-lg border border-transparent bg-white/90 p-4 shadow-lg shadow-primary-100/40 backdrop-blur dark:border-surface-700 dark:bg-surface-900">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="note-title">
          Title
        </label>
        <input
          id="note-title"
          className="rounded-md border border-primary-200 bg-white/90 px-3 py-2 text-sm shadow-inner transition focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:border-surface-600 dark:bg-surface-800"
          value={note.title}
          onChange={(event) => onChange({ ...note, title: event.target.value })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="note-content">
          Markdown
        </label>
        <textarea
          id="note-content"
          className="min-h-[240px] rounded-md border border-primary-200 bg-white/90 px-3 py-2 text-sm font-mono shadow-inner transition focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:border-surface-600 dark:bg-surface-800"
          value={note.content}
          onChange={(event) => onChange({ ...note, content: event.target.value })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-full bg-gradient-to-r from-primary-400 to-accent-200 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-105"
          onClick={handleSave}
        >
          {t("save")}
        </button>
        {onCancel ? (
          <button
            className="rounded-md border border-primary-100 px-4 py-2 text-sm font-semibold transition hover:bg-primary-50/80 dark:border-surface-600 dark:hover:bg-surface-800"
            onClick={onCancel}
          >
            {t("cancel")}
          </button>
        ) : null}
      </div>
    </div>
  );
};

