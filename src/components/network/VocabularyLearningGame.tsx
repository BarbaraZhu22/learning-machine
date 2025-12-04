"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "@/hooks/useTranslation";

interface VocabularyLearningGameProps {
  word: string;
  meaning?: string;
  phonetic?: string;
  onComplete: (passed: boolean) => void;
  onClose: () => void;
}

type Round = 1 | 2 | 3;

// Color palette for rainbow effect
const COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
];

export function VocabularyLearningGame({
  word,
  meaning,
  phonetic,
  onComplete,
  onClose,
}: VocabularyLearningGameProps) {
  const { t, language } = useTranslation();
  const [currentRound, setCurrentRound] = useState<Round>(1);
  const [input, setInput] = useState("");
  const [showScrollAnimation, setShowScrollAnimation] = useState(false);
  const [showPopAnimation, setShowPopAnimation] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate hint for current round
  const getHint = (round: Round): string => {
    if (round === 1) {
      return word;
    } else if (round === 2) {
      const hintLength = Math.ceil(word.length * 0.5);
      return word.slice(0, hintLength) + "_".repeat(word.length - hintLength);
    } else {
      return "";
    }
  };

  const hint = getHint(currentRound);
  const placeholder = currentRound === 1 ? hint : "";

  useEffect(() => {
    if (inputRef.current && !showScrollAnimation && !showPopAnimation) {
      inputRef.current.focus();
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showScrollAnimation && !showPopAnimation) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [currentRound, showScrollAnimation, showPopAnimation, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedInput = input.trim().toLowerCase();
    const normalizedWord = word.toLowerCase();
    const correct = normalizedInput === normalizedWord;

    if (correct) {
      setShowScrollAnimation(true);

      if (currentRound < 3) {
        setTimeout(() => {
          setShowScrollAnimation(false);
          setCurrentRound((prev) => (prev + 1) as Round);
          setInput("");
        }, 2000);
      } else {
        setTimeout(() => {
          setShowScrollAnimation(false);
          onComplete(true);
        }, 2000);
      }
    } else {
      setShowPopAnimation(true);
      setTimeout(() => {
        onComplete(false);
      }, 800);
    }
  };

  const handleSkip = () => {
    onComplete(false);
  };

  // Generate multiple word instances for rainbow effect
  const wordInstances = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    color: COLORS[i % COLORS.length],
    delay: i * 0.1, // Stagger animation
    top: 10 + (i % 5) * 18, // Distribute vertically across screen
    duration: 2 + (i % 3) * 0.3, // Vary animation speed
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-hidden"
      onClick={(e) => {
        if (
          e.target === e.currentTarget &&
          !showScrollAnimation &&
          !showPopAnimation
        ) {
          onClose();
        }
      }}
    >
      {/* Dialog - always visible, but content hidden during animations */}
      <div
        className={`mx-4 w-full max-w-md rounded-lg border border-surface-200/50 bg-[color:var(--glass-base)] p-6 shadow-lg shadow-primary-100/40 backdrop-blur dark:border-surface-700 dark:bg-surface-900 my-auto relative transition-opacity ${
          showScrollAnimation || showPopAnimation ? "opacity-30" : "opacity-100"
        }`}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-surface-400 hover:text-surface-600 dark:text-surface-500 dark:hover:text-surface-300 transition-colors z-10"
          aria-label={t("close")}
        >
          ✕
        </button>
        <h3 className="mb-4 text-lg font-semibold text-primary-700 dark:text-primary-200 pr-8">
          {`Round ${currentRound} / 3`}
        </h3>

        {/* Word display for round 1 */}
        {currentRound === 1 && (
          <div className="mb-4 text-center">
            <div className="text-2xl font-bold text-primary-700 dark:text-primary-300">
              {word}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t("typeTheWordAbove")}
            </div>
          </div>
        )}

        {/* Hint display for round 2 */}
        {currentRound === 2 && hint && (
          <div className="mb-4 text-sm text-muted-foreground text-center">
            <div className="font-medium">{t("hint")}:</div>
            <div className="font-mono text-lg">{hint}</div>
          </div>
        )}

        {/* Meaning display - always shown */}
        {meaning && (
          <div className="mb-4 text-sm text-muted-foreground text-center">
            <div>{meaning}</div>
          </div>
        )}

        {/* Phonetic display */}
        {phonetic && (
          <div className="mb-4 text-xs text-muted-foreground text-center">
            <div>{phonetic}</div>
          </div>
        )}

        {/* Progress indicator */}
        <div className="mb-4 flex gap-2">
          {[1, 2, 3].map((round) => (
            <div
              key={round}
              className={`flex-1 h-2 rounded ${
                round < currentRound
                  ? "bg-green-500"
                  : round === currentRound
                  ? "bg-primary-500"
                  : "bg-surface-200 dark:bg-surface-700"
              }`}
            />
          ))}
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-md border border-surface-300 bg-surface-50 px-4 py-2 text-sm dark:border-surface-600 dark:bg-surface-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={showScrollAnimation || showPopAnimation}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleSkip}
              className="rounded-md border border-surface-300 bg-surface-50 px-4 py-2 text-sm font-medium text-surface-700 transition hover:bg-surface-100 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-200 dark:hover:bg-surface-700"
              disabled={showScrollAnimation || showPopAnimation}
            >
              {t("skip")}
            </button>
            <button
              type="submit"
              disabled={
                !input.trim() || showScrollAnimation || showPopAnimation
              }
              className="rounded-md bg-gradient-to-r from-primary-500 to-primary-700 px-4 py-2 text-sm font-semibold text-[color:var(--text-inverse)] shadow-md transition hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("submit")}
            </button>
          </div>
        </form>
      </div>

      {/* Scrolling word animation on success - multiple colorful words */}
      {showScrollAnimation && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {wordInstances.map((instance) => (
            <div
              key={instance.id}
              className="absolute text-5xl font-bold whitespace-nowrap"
              style={{
                top: `${instance.top}%`,
                left: "-100%",
                color: instance.color,
                animation: `scrollWord ${instance.duration}s linear ${instance.delay}s`,
                textShadow: `0 0 2px ${instance.color}, 0 0 4px ${instance.color}, 0 0 6px ${instance.color}`,
              }}
            >
              {word}
            </div>
          ))}
        </div>
      )}

      {/* Explosion animation on failure */}
      {showPopAnimation && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
          <div
            className="text-6xl font-bold text-red-500 word-pop-animation"
            style={{
              textShadow: "0 0 2px #ef4444, 0 0 4px #ef4444, 0 0 6px #ef4444",
            }}
          >
            {word}
          </div>
        </div>
      )}
    </div>
  );
}
