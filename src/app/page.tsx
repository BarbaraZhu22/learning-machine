"use client";

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
      <section className="app-card app-card-mask p-10">
        <div className="max-w-2xl space-y-5">
          <h1 className="bg-gradient-to-r from-surface-700 via-accent-500 to-primary-700 bg-clip-text text-4xl font-bold leading-tight text-transparent dark:from-primary-200 dark:via-accent-200 dark:to-primary-400">
            {t("appTitle")}
          </h1>
          <p className="text-base text-primary-700/90 dark:text-primary-100/80">
            Quick launch your study tools.
          </p>
        </div>

        <div className="mt-10 max-w-md rounded-2xl border border-accent-200/60 bg-[color:var(--glass-base)] p-4 shadow-md shadow-accent-100/30 backdrop-blur dark:border-accent-200/40 dark:bg-surface-900/80">
          <label className="flex flex-col gap-2 text-sm font-medium text-primary-800 dark:text-primary-100">
            <span>{t("learningLanguage")}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {t("chooseLearningLanguage")}
            </span>
            <select
              className="rounded-md border border-primary-200 bg-surface-50 px-3 py-2 text-sm text-primary-800 shadow-inner transition focus:border-accent-200 focus:ring-2 focus:ring-accent-200/50 dark:border-surface-600 dark:bg-surface-800 dark:text-primary-100"
              value={learningLanguage}
              onChange={(event) =>
                setLearningLanguage(event.target.value as typeof learningLanguage)
              }
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
            className="app-card flex h-full flex-col justify-between transition hover:-translate-y-1"
          >
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-primary-700 dark:text-primary-200">
                {t(section.titleKey)}
              </h2>
            </div>
            <Link
              href={section.href}
              className="mt-6 inline-flex items-center justify-center rounded-full border border-transparent bg-gradient-to-r from-primary-500 via-accent-400 to-primary-700 px-4 py-2 text-sm font-semibold text-[color:var(--text-inverse)] shadow-md shadow-primary-200/40 transition hover:scale-[1.02] hover:shadow-primary-200/60"
            >
              {section.cta}
            </Link>
          </div>
        ))}
      </section>
    </div>
  );
}
