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
    <header className="border-b border-transparent bg-gradient-to-r from-primary-50 via-accent-50 to-surface-100 shadow-sm dark:border-surface-800 dark:bg-surface-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-semibold text-primary-700 transition hover:text-primary-600 dark:text-primary-300">
            {t('appTitle')}
          </Link>
          <nav className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground md:mt-0 md:gap-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full bg-white/60 px-3 py-1 font-medium text-primary-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white/90 dark:bg-surface-800 dark:text-primary-200 dark:hover:bg-surface-700"
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-full bg-white/70 px-3 py-2 shadow-sm backdrop-blur-sm dark:bg-surface-800/70">
          <ColorThemeSwitcher />
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
};

