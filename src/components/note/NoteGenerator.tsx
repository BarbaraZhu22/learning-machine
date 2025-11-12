'use client';

import { FormEvent, useMemo, useState } from 'react';
import { NoteTemplate } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';
import { aiHints } from '@/data/aiPrompts';

type NoteGeneratorProps = {
  templates: NoteTemplate[];
  onGenerate: (payload: { title: string; content: string; templateId?: string }) => void | Promise<void>;
};

const buildNote = (template: NoteTemplate | undefined, userInput: string) => {
  const safeInput = userInput.trim();
  const intro = safeInput ? `\n${safeInput}\n` : '';

  if (!template) {
    return intro || 'No template selected yet.';
  }

  const sections = template.sections.map((section, index) => {
    const hint = section.description ? `_${section.description}_\n` : '';
    const bullets = section.tags.length
      ? section.tags.map((tag) => `- ${tag}`).join('\n')
      : '- ';
    return `## ${index + 1}. ${section.title}\n${hint}${bullets}\n`;
  });

  return `${intro}${sections.join('\n')}`;
};

export const NoteGenerator = ({ templates, onGenerate }: NoteGeneratorProps) => {
  const { t } = useTranslation();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [userInput, setUserInput] = useState('');
  const [preview, setPreview] = useState('');

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId),
    [selectedTemplateId, templates],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const content = buildNote(selectedTemplate, userInput);
    setPreview(content);
    if (!title.trim()) {
      return;
    }
    await onGenerate({ title: title.trim(), content, templateId: selectedTemplate?.id });
    setTitle('');
    setUserInput('');
  };

  return (
    <div className="space-y-6 rounded-lg border border-surface-200/50 bg-[color:var(--glass-base)] p-4 shadow-lg shadow-primary-100/40 backdrop-blur dark:border-surface-700 dark:bg-surface-950">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-primary-700 dark:text-primary-200">{t('noteGenerator')}</h3>
        <p className="text-sm text-primary-700/80 dark:text-primary-100/80">{aiHints.noteGeneration}</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{t('selectTemplate')}</label>
            <select
              className="rounded-md border border-primary-200 bg-surface-50 px-3 py-2 text-sm shadow-inner transition focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:border-surface-600 dark:bg-surface-900"
              value={selectedTemplateId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Title</label>
            <input
              className="rounded-md border border-primary-200 bg-surface-50 px-3 py-2 text-sm shadow-inner transition focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:border-surface-600 dark:bg-surface-900"
              placeholder="My study note"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">{t('userInput')}</label>
          <textarea
            className="min-h-40 rounded-md border border-primary-200 bg-surface-50 px-3 py-2 text-sm shadow-inner transition focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:border-surface-600 dark:bg-surface-900"
            placeholder="Paste a short summary or raw vocabulary list..."
            value={userInput}
            onChange={(event) => setUserInput(event.target.value)}
          />
        </div>

        <button
          type="submit"
          className="rounded-full bg-gradient-to-r from-primary-400 to-accent-200 px-4 py-2 text-sm font-semibold text-[color:var(--text-inverse)] shadow-md transition hover:brightness-105"
        >
          {t('generate')}
        </button>
      </form>

      <div className="space-y-2">
        <div className="text-sm font-semibold text-muted-foreground">Preview</div>
        <pre className="max-h-72 overflow-auto rounded-md border border-primary-100 bg-surface-50 p-4 text-xs shadow-inner dark:border-surface-700 dark:bg-surface-900">
          {preview || buildNote(selectedTemplate, userInput)}
        </pre>
      </div>
    </div>
  );
};

