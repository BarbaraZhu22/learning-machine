"use client";

import { useMemo } from "react";
import { TypingMessageBox } from "@/components/common/TypingMessageBox";
import { useTranslation } from "@/hooks/useTranslation";
import type { FlowState } from "@/lib/lm-ai/types";
import type { DialogRecord } from "@/types";

interface DialogDisplayProps {
  flowState?: FlowState;
  dialogRecord?: DialogRecord;
  onClose?: () => void;
}

interface DialogEntry {
  character: string;
  use_text: string;
  learn_text: string;
}

interface DialogData {
  characters: string[];
  dialog: DialogEntry[];
}

/**
 * Extract dialog generation output from flow state
 */
function extractDialogGenerationOutput(
  flowState: FlowState
): DialogData | null {
  // Find the dialog-generation step
  const dialogGenStep = flowState.steps.find(
    (s) => s.nodeId === "dialog-generation"
  );

  if (!dialogGenStep?.result?.output) {
    return null;
  }

  const output = dialogGenStep.result.output as DialogData;

  // Validate structure
  if (
    !output ||
    typeof output !== "object" ||
    !Array.isArray(output.characters) ||
    !Array.isArray(output.dialog)
  ) {
    return null;
  }

  return output;
}

export const DialogDisplay = ({
  flowState,
  dialogRecord,
  onClose,
}: DialogDisplayProps) => {
  const { t } = useTranslation();
  const dialogData = useMemo(() => {
    if (dialogRecord) {
      return dialogRecord.dialogContent;
    }
    if (flowState) {
      return extractDialogGenerationOutput(flowState);
    }
    return null;
  }, [flowState, dialogRecord]);

  if (!dialogData) {
    return (
      <div className="rounded-lg border border-surface-200/50 bg-[color:var(--glass-base)] p-4 shadow-lg shadow-primary-100/40 backdrop-blur dark:border-surface-700 dark:bg-surface-900">
        <p className="text-sm text-muted-foreground">{t("noDialogs")}</p>
      </div>
    );
  }

  const { characters, dialog } = dialogData;

  // Determine which side each character appears on
  const characterPositions = useMemo(() => {
    const positions: Record<string, "left" | "right"> = {};
    if (characters.length >= 1) {
      positions[characters[0]] = "left";
    }
    if (characters.length >= 2) {
      positions[characters[1]] = "right";
    }
    return positions;
  }, [characters]);

  const isFullPage = !!onClose;

  return (
    <div
      className={`${
        isFullPage
          ? "fixed inset-0 z-50 flex flex-col bg-[color:var(--glass-base)] backdrop-blur dark:bg-surface-950"
          : "space-y-4 rounded-lg border border-surface-200/50 bg-[color:var(--glass-base)] p-6 shadow-lg shadow-primary-100/40 backdrop-blur dark:border-surface-700 dark:bg-surface-900"
      }`}
    >
      {isFullPage && (
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-200/50 bg-[color:var(--glass-base)] px-4 py-3 sm:px-6 sm:py-4 backdrop-blur dark:border-surface-700">
          <h3 className="text-lg sm:text-xl font-semibold text-primary-700 dark:text-primary-200">
            {t("dialog")}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 sm:px-4 sm:py-2 text-sm font-medium text-muted-foreground transition hover:bg-surface-100 dark:hover:bg-surface-800"
          >
            {t("close")}
          </button>
        </div>
      )}
      {!isFullPage && (
        <h3 className="text-lg font-semibold text-primary-700 dark:text-primary-200">
          {t("dialog")}
        </h3>
      )}
      <div
        className={`space-y-4 ${
          isFullPage ? "flex-1 overflow-y-auto p-4 sm:p-6" : ""
        }`}
      >
        {dialog.map((entry, index) => {
          const position = characterPositions[entry.character] || "left";
          const isLeft = position === "left";

          return (
            <div
              key={index}
              className={`flex ${isLeft ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[80%] rounded-lg px-3 py-2 sm:px-4 sm:py-3 ${
                  isLeft
                    ? "bg-primary-100 dark:bg-primary-900/30"
                    : "bg-surface-200 dark:bg-surface-700"
                }`}
              >
                <div
                  className={`mb-1 text-xs font-semibold text-muted-foreground flex ${
                    isLeft ? "justify-start" : "justify-end"
                  }`}
                >
                  {entry.character}
                </div>
                <div className="space-y-1">
                  <div className="text-sm break-words">
                    <span className="font-medium text-primary-600 dark:text-primary-400"></span>
                    <TypingMessageBox
                      text={entry.learn_text}
                      messageId={`dialog-${index}-learn`}
                      speed={15}
                      showCursor={false}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground break-words">
                    <TypingMessageBox
                      text={entry.use_text}
                      messageId={`dialog-${index}-use`}
                      speed={15}
                      showCursor={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
