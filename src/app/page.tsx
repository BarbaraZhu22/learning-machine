'use client';

import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import { learningLanguages } from "@/data/learningLanguages";
import { selectLearningLanguage, useAppStore } from "@/store/useAppStore";

const sections = [
  {
    titleKey: "notes",
    description:
      "Generate, edit, and merge structured study notes. Templates keep vocabulary organized and dialogs fresh.",
    href: "/note",
    cta: "Open Notes",
  },
  {
    titleKey: "simulateDialog",
    description:
      "Prototype everyday or formal conversations. Quickly stage characters and export transcripts into notes.",
    href: "/dialog",
    cta: "Start a dialog",
  },
  {
    titleKey: "superExtension",
    description:
      "Map vocabulary into a living network. Track relations, counts, and play memory games with each session.",
    href: "/extension",
    cta: "Explore network",
  },
];

export default function Home() {
  const { t } = useTranslation();
  const learningLanguage = useAppStore(selectLearningLanguage);
  const setLearningLanguage = useAppStore((state) => state.setLearningLanguage);

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-surface-200 bg-surface-50 p-10 shadow-sm dark:border-surface-700 dark:bg-surface-950">
        <div className="max-w-2xl space-y-4">
          <span className="inline-flex items-center rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-700 dark:bg-primary-900 dark:text-primary-100">
            {t("appTitle")}
          </span>
          <h1 className="text-4xl font-bold leading-tight">
            Build a durable language routine with notes, dialogs, and vocabulary networks.
          </h1>
          <p className="text-lg text-muted-foreground">
            Capture study notes, simulate conversations, and grow word families without relying on AI. Everything stays in IndexedDB and local storage for instant recall.
          </p>
        </div>

        <div className="mt-8 max-w-md rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-700 dark:bg-surface-900">
          <label className="flex flex-col gap-2 text-sm font-medium">
            <span>{t("learningLanguage")}</span>
            <span className="text-xs font-normal text-muted-foreground">{t("chooseLearningLanguage")}</span>
            <select
              className="rounded-md border border-surface-300 bg-surface-50 px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-800"
              value={learningLanguage}
              onChange={(event) => setLearningLanguage(event.target.value as typeof learningLanguage)}
            >
              {learningLanguages.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {sections.map((section) => (
          <div
            key={section.href}
            className="flex h-full flex-col justify-between rounded-2xl border border-surface-200 bg-white p-6 shadow-sm transition hover:border-primary-300 hover:shadow-md dark:border-surface-700 dark:bg-surface-900"
          >
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">{t(section.titleKey)}</h2>
              <p className="text-sm text-muted-foreground">{section.description}</p>
            </div>
            <Link
              href={section.href}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600"
            >
              {section.cta}
            </Link>
          </div>
        ))}
      </section>
    </div>
  );
}
