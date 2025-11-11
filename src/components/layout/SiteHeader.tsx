'use client';

import Link from 'next/link';
import { ThemeSwitcher } from '@/components/layout/ThemeSwitcher';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { ColorThemeSwitcher } from '@/components/layout/ColorThemeSwitcher';
import { useTranslation } from '@/hooks/useTranslation';

const NAV_ITEMS = [
  { href: '/', labelKey: 'home' },
  { href: '/note', labelKey: 'notes' },
  { href: '/dialog', labelKey: 'simulateDialog' },
  { href: '/extension', labelKey: 'superExtension' },
];

export const SiteHeader = () => {
  const { t } = useTranslation();

  return (
    <header className="relative z-10 bg-surface-50/90 backdrop-blur-sm transition dark:bg-surface-900/85">
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent-200 to-transparent opacity-80" />
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-primary-500 via-accent-500 to-primary-700 bg-clip-text text-2xl font-semibold text-transparent transition hover:from-primary-400 hover:to-primary-600 dark:from-primary-200 dark:via-accent-200 dark:to-primary-400"
          >
            {t('appTitle')}
          </Link>
          <nav className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground md:mt-0 md:gap-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-transparent bg-white/75 px-3 py-1 font-medium text-primary-700 shadow-sm transition hover:-translate-y-0.5 hover:border-accent-200 hover:bg-white hover:text-primary-900 dark:bg-surface-800/70 dark:text-primary-200 dark:hover:border-accent-200/50 dark:hover:bg-surface-800"
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-full border border-primary-100/40 bg-white/70 px-3 py-2 shadow-sm backdrop-blur-sm dark:border-surface-700 dark:bg-surface-900/70">
          <ColorThemeSwitcher />
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
};

