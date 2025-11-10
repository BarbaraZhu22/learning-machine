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
    <div className="space-y-4 rounded-lg border border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-900">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="note-title">
          Title
        </label>
        <input
          id="note-title"
          className="rounded-md border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-800"
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
          className="min-h-[240px] rounded-md border border-surface-300 bg-white px-3 py-2 text-sm font-mono dark:border-surface-600 dark:bg-surface-800"
          value={note.content}
          onChange={(event) => onChange({ ...note, content: event.target.value })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600"
          onClick={handleSave}
        >
          {t("save")}
        </button>
        {onCancel ? (
          <button
            className="rounded-md border border-surface-300 px-4 py-2 text-sm font-semibold transition hover:bg-surface-100 dark:border-surface-600 dark:hover:bg-surface-800"
            onClick={onCancel}
          >
            {t("cancel")}
          </button>
        ) : null}
      </div>
    </div>
  );
};

