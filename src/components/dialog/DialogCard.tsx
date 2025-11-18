"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import type { DialogRecord } from "@/types";

interface DialogCardProps {
  dialog: DialogRecord;
  onClick: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}

export const DialogCard = ({
  dialog,
  onClick,
  onDelete,
  onRename,
}: DialogCardProps) => {
  const { t, language } = useTranslation();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(dialog.name || "");
  const [showActions, setShowActions] = useState(true);
  const prevDialogNameRef = useRef(dialog.name);

  const characters = dialog.dialogContent?.characters || [];
  const dialogEntries = dialog.dialogContent?.dialog || [];
  const preview = dialogEntries
    .slice(0, 2)
    .map((entry) => entry.learn_text)
    .join(" ");

  const dateOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  const locale = language === "zh" ? "zh-CN" : "en-US";
  const formattedDate = new Date(dialog.createdAt).toLocaleDateString(
    locale,
    dateOptions
  );

  // Sync renameValue with dialog.name changes (only when not actively renaming)
  // Use ref to track previous value and update asynchronously to avoid cascading renders
  useEffect(() => {
    if (!isRenaming && prevDialogNameRef.current !== dialog.name) {
      const newName = dialog.name || "";
      prevDialogNameRef.current = dialog.name;
      // Schedule state update in next tick to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        setRenameValue((prev) => {
          // Only update if different to avoid unnecessary re-renders
          return prev !== newName ? newName : prev;
        });
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    prevDialogNameRef.current = dialog.name;
  }, [dialog.name, isRenaming]);

  const handleRename = () => {
    const trimmed = renameValue.trim();
    // Allow empty name (removes custom name)
    onRename(trimmed);
    setIsRenaming(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(t("delete") + "?")) {
      onDelete();
    }
  };

  const displayName = dialog.name
    ? `${dialog.name} - ${characters.join(" & ")}`
    : characters.join(" & ");

  return (
    <div
      className="relative group flex flex-col items-center justify-center rounded-lg border border-surface-200/50 bg-[color:var(--glass-base)] p-6 shadow-lg shadow-primary-100/40 transition-all hover:scale-101 hover:shadow-xl hover:shadow-primary-200/50 dark:border-surface-700 dark:bg-surface-900 dark:hover:shadow-primary-800/50"
      onMouseEnter={() => !isRenaming && setShowActions(true)}
      onMouseLeave={() => !isRenaming && setShowActions(false)}
    >
      {/* Action buttons */}
      {showActions && !isRenaming && (
        <div className="absolute top-2 right-2 flex gap-2 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRenameValue(dialog.name || "");
              setIsRenaming(true);
              setShowActions(false);
            }}
            title={t("rename")}
            className="flex items-center justify-center rounded-md bg-surface-100 w-7 h-7 text-sm text-surface-700 transition hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-200 dark:hover:bg-surface-700"
          >
            ✎
          </button>
          <button
            onClick={handleDelete}
            title={t("delete")}
            className="flex items-center justify-center rounded-md bg-red-100 w-7 h-7 text-sm text-red-700 transition hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
          >
            ✕
          </button>
        </div>
      )}

      {/* Rename input */}
      {isRenaming ? (
        <div className="w-full space-y-3">
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleRename();
              } else if (e.key === "Escape") {
                setRenameValue(dialog.name || "");
                setIsRenaming(false);
              }
            }}
            placeholder={t("dialogName")}
            className="w-full rounded-md border border-primary-300 bg-surface-50 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:border-surface-600 dark:bg-surface-800 dark:focus:border-primary-400"
            autoFocus
          />
          <div className="text-xs text-muted-foreground text-center">
            {characters.join(" & ")}
          </div>
          <div className="text-xs text-muted-foreground text-center">
            {formattedDate}
          </div>
          <div className="text-sm text-muted-foreground line-clamp-2 overflow-hidden text-ellipsis min-h-[2.5rem] text-center">
            {preview || t("noPreview")}
          </div>
          <div className="rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 inline-block mx-auto">
            {dialogEntries.length} {t("messages")}
          </div>
        </div>
      ) : (
        <button onClick={onClick} className="w-full text-center">
          <div className="mb-2 text-sm font-semibold text-primary-700 dark:text-primary-200 line-clamp-1">
            {displayName}
          </div>
          <div className="mb-3 text-xs text-muted-foreground">
            {formattedDate}
          </div>
          <div className="mb-3 text-sm text-muted-foreground line-clamp-2 overflow-hidden text-ellipsis min-h-[2.5rem]">
            {preview || t("noPreview")}
          </div>
          <div className="rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 inline-block">
            {dialogEntries.length} {t("messages")}
          </div>
        </button>
      )}
    </div>
  );
};
