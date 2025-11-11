'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { aiHints } from '@/data/aiPrompts';
import { DialogScenario } from '@/types';
import { selectLearningLanguage, useAppStore } from '@/store/useAppStore';
import { learningLanguages } from '@/data/learningLanguages';

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const buildDialog = (scenario: DialogScenario) => {
  const { situation, characterA, characterB, notes } = scenario;
  const prompts = [
    `${characterA}: Let's talk about ${situation.toLowerCase()}.`,
    `${characterB}: Sure! What are you thinking about?`,
    `${characterA}: I believe we should focus on the key vocabulary we noted earlier.`,
    `${characterB}: Great idea. Let's also practice a formal response just in case.`,
    `${characterA}: Thanks! ${notes ? notes : 'I will write this down in the note later.'}`,
  ];
  return prompts.join('\n');
};

export const DialogSimulator = () => {
  const { t } = useTranslation();
  const addNote = useAppStore((state) => state.addNote);
  const learningLanguage = useAppStore(selectLearningLanguage);
  const learningLanguageLabel =
    learningLanguages.find((item) => item.code === learningLanguage)?.label ?? learningLanguage;
  const [situation, setSituation] = useState('');
  const [characterA, setCharacterA] = useState('');
  const [characterB, setCharacterB] = useState('');
  const [notes, setNotes] = useState('');
  const [dialog, setDialog] = useState('');
  const [history, setHistory] = useState<DialogScenario[]>([]);

  const isReady = useMemo(
    () => Boolean(situation.trim() && characterA.trim() && characterB.trim()),
    [situation, characterA, characterB],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isReady) return;
    const scenario: DialogScenario = {
      id: createId(),
      situation: situation.trim(),
      characterA: characterA.trim(),
      characterB: characterB.trim(),
      notes: notes.trim(),
      transcript: '',
      createdAt: new Date().toISOString(),
    };
    const transcript = buildDialog(scenario);
    const nextScenario = { ...scenario, transcript };
    setDialog(transcript);
    setHistory((current) => [nextScenario, ...current].slice(0, 10));
  };

  const handleSaveNote = async () => {
    if (!dialog.trim()) return;
    await addNote({
      title: `Dialog: ${situation}`,
      content: `## ${characterA} & ${characterB}\n\n${dialog}`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-surface-200 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-950">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{t('simulateDialog')}</h3>
            <p className="text-sm text-muted-foreground">{aiHints.dialogSimulation}</p>
          </div>
          <div className="text-xs text-muted-foreground">
            {t('learningLanguage')}: <span className="font-semibold">{learningLanguageLabel}</span>
          </div>
        </div>
      </div>

      <form className="space-y-4 rounded-lg border border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-900" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{t('dialogScenario')}</label>
            <input
              className="rounded-md border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-800"
              placeholder="Dinner with friends"
              value={situation}
              onChange={(event) => setSituation(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{t('notesLabel')}</label>
            <input
              className="rounded-md border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-800"
              placeholder="Goals or reminders"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{t('characterA')}</label>
            <input
              className="rounded-md border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-800"
              placeholder="Character A"
              value={characterA}
              onChange={(event) => setCharacterA(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{t('characterB')}</label>
            <input
              className="rounded-md border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-800"
              placeholder="Character B"
              value={characterB}
              onChange={(event) => setCharacterB(event.target.value)}
            />
          </div>
        </div>
        <button
          type="submit"
          className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-300"
          disabled={!isReady}
        >
          {t('generate')}
        </button>
      </form>

      {dialog ? (
        <div className="space-y-4 rounded-lg border border-surface-200 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-950">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-semibold">Transcript</h4>
            <button className="text-sm text-primary-500 hover:underline" onClick={handleSaveNote}>
              Save to notes
            </button>
          </div>
          <pre className="whitespace-pre-wrap rounded-md border border-surface-200 bg-white p-4 text-sm dark:border-surface-700 dark:bg-surface-900">
            {dialog}
          </pre>
        </div>
      ) : null}

      {history.length ? (
        <div className="space-y-3 rounded-lg border border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-900">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">History</h4>
          <ul className="space-y-2 text-sm">
            {history.map((item) => (
              <li key={item.id} className="rounded-md border border-surface-200 bg-surface-50 p-3 dark:border-surface-700 dark:bg-surface-950">
                <div className="font-semibold">{item.situation}</div>
                <div className="text-xs text-muted-foreground">
                  {item.characterA} & {item.characterB} · {new Date(item.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

