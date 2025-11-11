'use client';

import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import { learningLanguages } from "@/data/learningLanguages";
import { selectLearningLanguage, useAppStore } from "@/store/useAppStore";

const sections = [
  { titleKey: "notes", href: "/note", cta: "Open Notes" },
  { titleKey: "simulateDialog", href: "/dialog", cta: "Start Dialog" },
  { titleKey: "superExtension", href: "/extension", cta: "Open Extension" },
];

export default function Home() {
  const { t } = useTranslation();
  const learningLanguage = useAppStore(selectLearningLanguage);
  const setLearningLanguage = useAppStore((state) => state.setLearningLanguage);

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-transparent bg-gradient-to-br from-primary-50 via-surface-50 to-accent-50 p-10 shadow-lg shadow-primary-50/60 dark:border-surface-700 dark:bg-surface-950">
        <div className="max-w-2xl space-y-5">
          <h1 className="text-4xl font-bold leading-tight text-primary-800 dark:text-primary-200">
            {t("appTitle")}
          </h1>
          <p className="text-base text-primary-700/80 dark:text-primary-100/80">
            Quick launch your study tools.
          </p>
        </div>

        <div className="mt-10 max-w-md rounded-2xl border border-white/40 bg-white/80 p-4 shadow-lg backdrop-blur dark:border-surface-700 dark:bg-surface-900">
          <label className="flex flex-col gap-2 text-sm font-medium text-primary-800 dark:text-primary-100">
            <span>{t("learningLanguage")}</span>
            <span className="text-xs font-normal text-muted-foreground">{t("chooseLearningLanguage")}</span>
            <select
              className="rounded-md border border-primary-200 bg-surface-50 px-3 py-2 text-sm text-primary-800 shadow-inner transition focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:border-surface-600 dark:bg-surface-800 dark:text-primary-100"
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
            className="flex h-full flex-col justify-between rounded-2xl border border-transparent bg-white/90 p-6 shadow-lg shadow-primary-100/60 transition hover:-translate-y-1 hover:shadow-xl dark:border-surface-700 dark:bg-surface-900"
          >
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-primary-700 dark:text-primary-200">{t(section.titleKey)}</h2>
            </div>
            <Link
              href={section.href}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-primary-400 to-accent-200 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-105"
            >
              {section.cta}
            </Link>
          </div>
        ))}
      </section>
    </div>
  );
}
