'use client';

import { useEffect, useMemo, useState } from 'react';
import { RelationType, VocabularyEntry, VocabularyRelation } from '@/types';
import { useAppStore, selectVocabulary, selectLearningLanguage } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { learningLanguages } from '@/data/learningLanguages';

const RELATION_LABELS: Record<RelationType, string> = {
  similar: 'Similar',
  synonym: 'Synonym',
  antonym: 'Antonym',
  root: 'Root',
  homophone: 'Homophone',
};

type Position = { x: number; y: number };
type PositionMap = Record<string, Position>;

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const ensureRelation = (relations: VocabularyRelation[], relation: VocabularyRelation) => {
  if (relations.some((item) => item.targetId === relation.targetId && item.type === relation.type)) {
    return relations;
  }
  if (relations.length >= 20) {
    return relations;
  }
  return [...relations, relation];
};

const removeRelation = (relations: VocabularyRelation[], targetId: string, type: RelationType) =>
  relations.filter((relation) => !(relation.targetId === targetId && relation.type === type));

const computePositions = (entries: VocabularyEntry[]): PositionMap => {
  const total = Math.max(entries.length, 1);
  const centerX = CANVAS_WIDTH / 2;
  const centerY = CANVAS_HEIGHT / 2;
  const radius = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) / 2 - 60;

  return entries.reduce<PositionMap>((map, entry, index) => {
    const angle = (index / total) * Math.PI * 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    map[entry.id] = { x, y };
    return map;
  }, {});
};

export const LinkNetwork = () => {
  const { t } = useTranslation();
  const allVocabulary = useAppStore(selectVocabulary);
  const learningLanguage = useAppStore(selectLearningLanguage);
  const addVocabulary = useAppStore((state) => state.addVocabulary);
  const updateVocabulary = useAppStore((state) => state.updateVocabulary);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [relationType, setRelationType] = useState<RelationType>('similar');
  const [targetId, setTargetId] = useState<string>('new');
  const [newWord, setNewWord] = useState('');
  const [newMeaning, setNewMeaning] = useState('');

  useEffect(() => {
    setSelectedId(null);
    setTargetId('new');
    setNewWord('');
    setNewMeaning('');
  }, [learningLanguage]);

  const learningLanguageLabel =
    learningLanguages.find((item) => item.code === learningLanguage)?.label ?? learningLanguage;

  const vocabulary = useMemo(
    () => allVocabulary.filter((entry) => entry.learningLanguage === learningLanguage),
    [allVocabulary, learningLanguage],
  );

  const positions = useMemo(() => computePositions(vocabulary), [vocabulary]);
  const edges = useMemo(
    () =>
      vocabulary.flatMap((entry) =>
        entry.relations.map((relation) => ({
          id: `${entry.id}->${relation.targetId}-${relation.type}`,
          from: entry.id,
          to: relation.targetId,
          type: relation.type,
        })),
      ),
    [vocabulary],
  );

  const selectedEntry = selectedId ? vocabulary.find((entry) => entry.id === selectedId) ?? null : null;

  const handleAddRelation = async () => {
    if (!selectedEntry) return;
    if (selectedEntry.relations.length >= 20) {
      alert('Maximum relations reached for this node.');
      return;
    }

    const relation: VocabularyRelation = { id: createId(), type: relationType, targetId: '' };
    let targetEntry: VocabularyEntry | null = null;

    if (targetId === 'new') {
      if (!newWord.trim()) {
        alert('Enter a word for the new node.');
        return;
      }
      targetEntry = await addVocabulary({
        word: newWord.trim(),
        meaning: newMeaning.trim(),
        relations: [{ id: createId(), type: relationType, targetId: selectedEntry.id }],
      });
      relation.targetId = targetEntry.id;
      setNewWord('');
      setNewMeaning('');
    } else {
      targetEntry = vocabulary.find((entry) => entry.id === targetId) ?? null;
      if (!targetEntry) {
        return;
      }
      if (targetEntry.relations.length >= 20) {
        alert('Target node reached the relation limit.');
        return;
      }
      relation.targetId = targetEntry.id;
      const updatedTargetRelations = ensureRelation(targetEntry.relations, {
        id: createId(),
        type: relationType,
        targetId: selectedEntry.id,
      });
      await updateVocabulary(targetEntry.id, { relations: updatedTargetRelations });
    }

    const updatedRelations = ensureRelation(selectedEntry.relations, relation);
    await updateVocabulary(selectedEntry.id, { relations: updatedRelations });
    setTargetId('new');
  };

  const handleRemoveRelation = async (target: VocabularyRelation) => {
    if (!selectedEntry) return;
    const updated = removeRelation(selectedEntry.relations, target.targetId, target.type);
    await updateVocabulary(selectedEntry.id, { relations: updated });
    const counterpart = vocabulary.find((entry) => entry.id === target.targetId);
    if (counterpart) {
      const counterpartUpdated = removeRelation(counterpart.relations, selectedEntry.id, target.type);
      await updateVocabulary(counterpart.id, { relations: counterpartUpdated });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="rounded-lg border border-surface-200/50 bg-[color:var(--glass-base)] p-4 shadow-lg shadow-primary-100/40 backdrop-blur dark:border-surface-700 dark:bg-surface-900">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-primary-700 dark:text-primary-200">{t('linkNetwork')}</h3>
            <p className="text-sm text-primary-700/80 dark:text-primary-100/80">{t('selectNode')}</p>
          </div>
          <div className="text-xs text-primary-700/80 dark:text-primary-100/80">
            {t('learningLanguage')}: <span className="font-semibold">{learningLanguageLabel}</span>
          </div>
        </div>

        <div className="relative aspect-[4/3] min-h-72 w-full overflow-hidden rounded-md border border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-950 lg:min-h-[24rem]">
          <svg viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} className="h-full w-full">
            {edges.map((edge) => {
              const from = positions[edge.from];
              const to = positions[edge.to];
              if (!from || !to) return null;
              return (
                <g key={edge.id}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke="var(--edge-color, var(--muted-foreground))"
                    strokeWidth={1.5}
                    strokeDasharray={edge.type === 'antonym' ? '6 4' : undefined}
                  />
                </g>
              );
            })}

            {vocabulary.map((entry) => {
              const position = positions[entry.id];
              if (!position) return null;
              const isSelected = selectedId === entry.id;
              return (
                <g
                  key={entry.id}
                  transform={`translate(${position.x}, ${position.y})`}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(entry.id)}
                >
                  <circle
                    r={isSelected ? 28 : 22}
                    fill={isSelected ? 'var(--primary-500)' : 'var(--surface-200)'}
                    stroke="var(--surface-900)"
                    strokeWidth={isSelected ? 3 : 1.5}
                  />
                  <text
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    fill={isSelected ? 'var(--text-inverse)' : 'var(--text-primary)'}
                    fontSize={isSelected ? '0.75rem' : '0.6875rem'}
                  >
                    {entry.word}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-surface-200/50 bg-[color:var(--glass-base)] p-4 text-sm shadow-lg shadow-primary-100/40 backdrop-blur dark:border-surface-700 dark:bg-surface-950">
        <h4 className="text-base font-semibold">{t('vocabularyGame')}</h4>

        {selectedEntry ? (
          <div className="space-y-4">
            <div>
              <div className="text-lg font-semibold">{selectedEntry.word}</div>
              <div className="text-xs text-muted-foreground">{selectedEntry.meaning}</div>
              <div className="mt-2 text-xs text-muted-foreground">
                {selectedEntry.relations.length} / 20 connections
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('relationType')}</div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(RELATION_LABELS) as RelationType[]).map((type) => (
                  <button
                    key={type}
                    className={`rounded-full px-3 py-1 text-xs font-semibold shadow-sm transition ${
                      relationType === type
                        ? 'bg-gradient-to-r from-primary-400 to-accent-200 text-[color:var(--text-inverse)] shadow-primary-200/60'
                        : 'bg-[color:var(--glass-base)] text-primary-700 hover:bg-[color:var(--glass-accent)] dark:bg-surface-800 dark:text-surface-200'
                    }`}
                    onClick={() => setRelationType(type)}
                  >
                    {RELATION_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Connect to
              </label>
              <select
                className="w-full rounded-md border border-surface-300 bg-surface-50 px-2 py-1 text-sm dark:border-surface-600 dark:bg-surface-900"
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
              >
                <option value="new">+ New word</option>
                {vocabulary
                  .filter((entry) => entry.id !== selectedEntry.id)
                  .map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.word}
                    </option>
                  ))}
              </select>

              {targetId === 'new' ? (
                <div className="space-y-2">
                  <input
                    className="w-full rounded-md border border-surface-300 bg-surface-50 px-2 py-1 text-sm dark:border-surface-600 dark:bg-surface-900"
                    placeholder="New word"
                    value={newWord}
                    onChange={(event) => setNewWord(event.target.value)}
                  />
                  <input
                    className="w-full rounded-md border border-surface-300 bg-surface-50 px-2 py-1 text-sm dark:border-surface-600 dark:bg-surface-900"
                    placeholder="Meaning (optional)"
                    value={newMeaning}
                    onChange={(event) => setNewMeaning(event.target.value)}
                  />
                </div>
              ) : null}
            </div>

            <button
              className="w-full rounded-full bg-gradient-to-r from-primary-400 to-accent-200 px-3 py-2 text-sm font-semibold text-[color:var(--text-inverse)] shadow-md transition hover:brightness-105"
              onClick={handleAddRelation}
            >
              Add relation
            </button>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Connections</div>
              {selectedEntry.relations.length ? (
                <ul className="space-y-2">
                  {selectedEntry.relations.map((relation) => {
                    const target = vocabulary.find((entry) => entry.id === relation.targetId);
                    return (
                      <li
                        key={relation.id}
                    className="flex items-center justify-between rounded-md border border-surface-200/40 bg-[color:var(--glass-base)] px-3 py-2 shadow-sm shadow-primary-100/40 dark:border-surface-700 dark:bg-surface-900"
                      >
                        <div>
                          <div className="font-medium">{target?.word ?? relation.targetId}</div>
                          <div className="text-xs text-muted-foreground">{RELATION_LABELS[relation.type]}</div>
                        </div>
                        <button
                          className="text-xs text-destructive-500 hover:underline"
                          onClick={() => handleRemoveRelation(relation)}
                        >
                          {t('delete')}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="rounded-md border border-dashed border-surface-200 p-3 text-xs text-muted-foreground dark:border-surface-700">
                  No connections yet.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-surface-300 p-4 text-xs text-muted-foreground dark:border-surface-700">
            {t('selectNode')}
          </div>
        )}

        <div className="rounded-md border border-surface-200 bg-surface-50 p-3 text-xs dark:border-surface-700 dark:bg-surface-900">
          <div className="font-semibold">{t('rememberPrompt')}</div>
          <p>Record the links after each session to reinforce memory of word families.</p>
        </div>
      </div>
    </div>
  );
};

