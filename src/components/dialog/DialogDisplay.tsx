"use client";

import { useMemo } from "react";
import { TypingMessageBox } from "@/components/common/TypingMessageBox";
import type { FlowState } from "@/lib/lm-ai/types";

interface DialogDisplayProps {
  flowState: FlowState;
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

export const DialogDisplay = ({ flowState }: DialogDisplayProps) => {
  const dialogData = useMemo(
    () => extractDialogGenerationOutput(flowState),
    [flowState]
  );

  if (!dialogData) {
    return (
      <div className="rounded-lg border border-surface-200/50 bg-[color:var(--glass-base)] p-4 shadow-lg shadow-primary-100/40 backdrop-blur dark:border-surface-700 dark:bg-surface-900">
        <p className="text-sm text-muted-foreground">
          No dialog data available
        </p>
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

  return (
    <div className="space-y-4 rounded-lg border border-surface-200/50 bg-[color:var(--glass-base)] p-6 shadow-lg shadow-primary-100/40 backdrop-blur dark:border-surface-700 dark:bg-surface-900">
      <h3 className="text-lg font-semibold text-primary-700 dark:text-primary-200">
        Dialog
      </h3>
      <div className="space-y-4">
        {dialog.map((entry, index) => {
          const position = characterPositions[entry.character] || "left";
          const isLeft = position === "left";

          return (
            <div
              key={index}
              className={`flex ${isLeft ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  isLeft
                    ? "bg-primary-100 dark:bg-primary-900/30"
                    : "bg-surface-200 dark:bg-surface-700"
                }`}
              >
                <div className="mb-1 text-xs font-semibold text-muted-foreground">
                  {entry.character}
                </div>
                <div className="space-y-1">
                  <div className="text-sm">
                    <span className="font-medium text-primary-600 dark:text-primary-400">
                      Learn:{" "}
                    </span>
                    <TypingMessageBox
                      text={entry.learn_text}
                      messageId={`dialog-${index}-learn`}
                      speed={15}
                      showCursor={false}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Use: </span>
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

