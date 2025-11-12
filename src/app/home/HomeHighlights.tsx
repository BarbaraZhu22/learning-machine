"use client";

import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import styles from "./HomeHighlights.module.css";

type HighlightSection = {
  titleKey: string;
  href: string;
  ctaKey: string;
};

interface HomeHighlightsProps {
  sections: HighlightSection[];
}

export default function HomeHighlights({ sections }: HomeHighlightsProps) {
  const { t } = useTranslation();

  return (
    <section className={styles.container}>
      {sections.map((section) => (
        <div key={section.href} className={`${styles.card} app-card`}>
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-primary-700 dark:text-primary-200">
              {t(section.titleKey)}
            </h2>
          </div>
          <Link
            href={section.href}
            className="mt-6 inline-flex items-center justify-center rounded-full border border-transparent bg-gradient-to-r from-primary-500 via-accent-400 to-primary-700 px-4 py-2 text-sm font-semibold text-[color:var(--text-inverse)] shadow-md shadow-primary-200/40 transition hover:scale-[1.02] hover:shadow-primary-200/60"
          >
            {t(section.ctaKey)}
          </Link>
        </div>
      ))}
    </section>
  );
}

