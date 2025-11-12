'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useAppStore, selectNoteTemplates } from '@/store/useAppStore';
import { NoteTemplate, TemplateSection } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';

type NoteTemplateManagerProps = {
  onTemplateSelect?: (template: NoteTemplate | null) => void;
};

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const createSection = (params: Pick<TemplateSection, 'title' | 'description' | 'tags'>): TemplateSection => ({
  id: createId(),
  ...params,
});

export const NoteTemplateManager = ({ onTemplateSelect }: NoteTemplateManagerProps) => {
  const { t } = useTranslation();
  const templates = useAppStore(selectNoteTemplates);
  const upsertTemplate = useAppStore((state) => state.upsertTemplate);
  const removeTemplate = useAppStore((state) => state.removeTemplate);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(templates[0]?.id ?? null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionDescription, setSectionDescription] = useState('');
  const [sectionTags, setSectionTags] = useState('');

  const handleSelectTemplate = (template: NoteTemplate) => {
    setSelectedTemplateId(template.id);
    onTemplateSelect?.(template);
  };

  const handleCreateTemplate = (event: FormEvent) => {
    event.preventDefault();
    if (!newTemplateName.trim()) {
      return;
    }
    const template: NoteTemplate = {
      id: createId(),
      name: newTemplateName.trim(),
      description: newTemplateDescription.trim(),
      tags: [],
      sections: [],
    };
    upsertTemplate(template);
    setNewTemplateName('');
    setNewTemplateDescription('');
    setSelectedTemplateId(template.id);
    onTemplateSelect?.(template);
  };

  const handleAddSection = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTemplate || !sectionTitle.trim()) {
      return;
    }
    const section = createSection({
      title: sectionTitle.trim(),
      description: sectionDescription.trim(),
      tags: sectionTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    const updatedTemplate: NoteTemplate = {
      ...selectedTemplate,
      sections: [...selectedTemplate.sections, section],
    };
    upsertTemplate(updatedTemplate);
    setSectionTitle('');
    setSectionDescription('');
    setSectionTags('');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_1fr]">
      <div className="space-y-4 rounded-lg border border-surface-300 bg-surface-100 p-4 dark:border-surface-700 dark:bg-surface-900">
        <h3 className="text-lg font-semibold">{t('noteTemplate')}</h3>
        <div className="space-y-2">
          {templates.map((template) => (
            <button
              key={template.id}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                template.id === selectedTemplateId
                  ? 'border-primary-400 bg-primary-100 text-primary-800 dark:border-primary-500 dark:bg-primary-900 dark:text-primary-100'
                  : 'border-transparent bg-transparent hover:border-primary-200 hover:bg-primary-50 dark:hover:border-primary-800 dark:hover:bg-primary-950'
              }`}
              onClick={() => handleSelectTemplate(template)}
            >
              <div className="font-medium">{template.name}</div>
              {template.description ? (
                <div className="text-xs text-muted-foreground">{template.description}</div>
              ) : null}
            </button>
          ))}
        </div>

        <form className="space-y-2 border-t border-dashed border-surface-300 pt-4 text-sm dark:border-surface-700" onSubmit={handleCreateTemplate}>
          <div className="font-semibold">{t('templateEditor')}</div>
          <input
            className="w-full rounded-md border border-surface-300 bg-white px-2 py-1 dark:border-surface-600 dark:bg-surface-800"
            placeholder="Template name"
            value={newTemplateName}
            onChange={(event) => setNewTemplateName(event.target.value)}
          />
          <textarea
            className="w-full rounded-md border border-surface-300 bg-white px-2 py-1 dark:border-surface-600 dark:bg-surface-800"
            placeholder="Template description"
            rows={2}
            value={newTemplateDescription}
            onChange={(event) => setNewTemplateDescription(event.target.value)}
          />
          <button
            type="submit"
            className="w-full rounded-md bg-primary-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-600"
          >
            {t('add')}
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-surface-300 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-950">
        {selectedTemplate ? (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-xl font-semibold">{selectedTemplate.name}</h4>
                {selectedTemplate.description ? (
                  <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
                ) : null}
                {selectedTemplate.tags.length ? (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {selectedTemplate.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-primary-100 px-2 py-1 font-medium text-primary-700 dark:bg-primary-900 dark:text-primary-100"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                className="rounded-md border border-destructive-500 px-3 py-2 text-sm font-medium text-destructive-600 transition hover:bg-destructive-50 dark:border-destructive-400 dark:text-destructive-300 dark:hover:bg-destructive-900"
                onClick={() => {
                  if (confirm('Remove template?')) {
                    removeTemplate(selectedTemplate.id);
                    setSelectedTemplateId(null);
                    onTemplateSelect?.(null);
                  }
                }}
              >
                {t('delete')}
              </button>
            </div>

            <div className="space-y-4">
              {selectedTemplate.sections.map((section) => (
                <div key={section.id} className="rounded-md border border-surface-200 bg-white p-3 text-sm dark:border-surface-700 dark:bg-surface-900">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{section.title}</div>
                      {section.description ? (
                        <p className="text-xs text-muted-foreground">{section.description}</p>
                      ) : null}
                    </div>
                    <button
                      className="text-xs text-destructive-500 hover:underline"
                      onClick={() => {
                        const updatedTemplate: NoteTemplate = {
                          ...selectedTemplate,
                          sections: selectedTemplate.sections.filter((item) => item.id !== section.id),
                        };
                        upsertTemplate(updatedTemplate);
                      }}
                    >
                      {t('delete')}
                    </button>
                  </div>
                  {section.tags.length ? (
                    <div className="mt-2 flex flex-wrap gap-2 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
                      {section.tags.map((tag) => (
                        <span key={tag} className="rounded-md bg-surface-200 px-2 py-1 dark:bg-surface-800">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <form className="space-y-3 rounded-md border border-dashed border-surface-300 p-3 text-sm dark:border-surface-700" onSubmit={handleAddSection}>
              <div className="font-semibold">{t('addSection')}</div>
              <input
                className="w-full rounded-md border border-surface-300 bg-white px-2 py-1 dark:border-surface-600 dark:bg-surface-800"
                placeholder={t('sectionTitle')}
                value={sectionTitle}
                onChange={(event) => setSectionTitle(event.target.value)}
              />
              <textarea
                className="w-full rounded-md border border-surface-300 bg-white px-2 py-1 dark:border-surface-600 dark:bg-surface-800"
                placeholder={t('sectionDescription')}
                rows={2}
                value={sectionDescription}
                onChange={(event) => setSectionDescription(event.target.value)}
              />
              <input
                className="w-full rounded-md border border-surface-300 bg-white px-2 py-1 dark:border-surface-600 dark:bg-surface-800"
                placeholder={`${t('tags')} (comma separated)`}
                value={sectionTags}
                onChange={(event) => setSectionTags(event.target.value)}
              />
              <button
                type="submit"
                className="w-full rounded-md bg-primary-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-600"
              >
                {t('addSection')}
              </button>
            </form>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">{t('selectTemplate')}</div>
        )}
      </div>
    </div>
  );
};

