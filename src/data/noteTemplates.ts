import { NoteTemplate } from '@/types';

export const defaultNoteTemplates: NoteTemplate[] = [
  {
    id: 'daily-mix',
    name: 'Daily Mix',
    description: 'Balanced template covering sorted vocabulary, conjugations, and daily dialog practice.',
    tags: ['daily', 'vocabulary', 'dialog'],
    sections: [
      {
        id: 'vocabulary-sort',
        title: 'Vocabulary Sort',
        description: 'Group today’s vocabulary by theme or difficulty. Highlight usage frequency.',
        tags: ['vocabulary', 'sort'],
      },
      {
        id: 'vocabulary-conjugations',
        title: 'Vocabulary Conjugations',
        description: 'List verbs with their key conjugations and short example sentences.',
        tags: ['vocabulary', 'conjugations'],
      },
      {
        id: 'dialog-daily',
        title: 'Daily Dialog',
        description: 'Create a short conversation using today’s vocabulary in an everyday context.',
        tags: ['dialog', 'daily'],
      },
    ],
  },
  {
    id: 'formal-register',
    name: 'Formal Register',
    description: 'Focus on formal usage and professional conversation practice.',
    tags: ['formal', 'dialog'],
    sections: [
      {
        id: 'formal-synonyms',
        title: 'Formal Synonyms',
        description: 'Map casual vocabulary to formal equivalents and note nuance differences.',
        tags: ['vocabulary', 'synonym'],
      },
      {
        id: 'formal-dialog',
        title: 'Formal Dialog',
        description: 'Compose a dialogue suitable for professional or academic settings.',
        tags: ['dialog', 'formal'],
      },
      {
        id: 'follow-up-prompts',
        title: 'Follow-up Prompts',
        description: 'List potential follow-up questions or responses for expanding the dialog.',
        tags: ['dialog', 'prompt'],
      },
    ],
  },
  {
    id: 'creative-story',
    name: 'Creative Story',
    description: 'Story-driven template to boost narrative skills using target vocabulary.',
    tags: ['story', 'creative'],
    sections: [
      {
        id: 'setting',
        title: 'Setting & Characters',
        description: 'Describe the setting and introduce characters using new vocabulary.',
        tags: ['story', 'context'],
      },
      {
        id: 'conflict',
        title: 'Conflict',
        description: 'Outline the main conflict or challenge, including emotion-rich vocabulary.',
        tags: ['story', 'emotion'],
      },
      {
        id: 'resolution-dialog',
        title: 'Resolution Dialog',
        description: 'Write a dialog that resolves the conflict, reinforcing vocabulary usage.',
        tags: ['dialog', 'story'],
      },
    ],
  },
];

