"use client";

import { useTranslation } from "@/hooks/useTranslation";

interface CounterCardProps {
  count: number;
  label: string;
  onClick: () => void;
  className?: string;
  scale?: number; // Scale factor (default: 1.0), e.g., 0.35 for 35% size
}

export const CounterCard = ({
  count,
  label,
  onClick,
  className = "",
  scale = 1.0,
}: CounterCardProps) => {
  const { t } = useTranslation();

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center rounded-lg border border-surface-200/50 bg-[color:var(--glass-base)] shadow-lg shadow-primary-100/40 transition-all hover:shadow-xl hover:shadow-primary-200/50 dark:border-surface-700 dark:bg-surface-900 dark:hover:shadow-primary-800/50 ${className}`}
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "center",
        padding: `${1.2 * scale}rem ${2 * scale}rem`,
      }}
    >
      <div
        className="font-bold text-primary-600 dark:text-primary-400"
        style={{ fontSize: `${2.25 * scale}rem` }}
      >
        {count}
      </div>
      <div
        className="mt-2 font-medium text-muted-foreground"
        style={{ fontSize: `${1 * scale}rem` }}
      >
        {label}
      </div>
    </button>
  );
};

