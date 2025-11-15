"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { TypingMessageBox } from "@/components/common/TypingMessageBox";
import { useTranslation } from "@/hooks/useTranslation";
import type { FlowState } from "@/lib/lm-ai/types";
import type { DialogRecord } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import {
  configureUtteranceFromVoiceSuggestion,
  applySSMLToUtterance,
  type SSMLConfig,
} from "@/lib/lm-ai/ssml-config";

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
  const learningLanguage = useAppStore((state) => state.learningLanguage);
  const aiConfig = useAppStore((state) => state.aiConfig);

  // Audio state
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioData, setAudioData] = useState<
    Array<{ sentenceIndex: number; audioUrl: string; character?: string }>
  >([]);
  const [currentlyReadingIndex, setCurrentlyReadingIndex] = useState<
    number | null
  >(null);
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const audioRefs = useRef<Map<number, HTMLAudioElement>>(new Map());
  const playQueueRef = useRef<number[]>([]);

  const dialogData = useMemo(() => {
    if (dialogRecord) {
      return dialogRecord.dialogContent;
    }
    if (flowState) {
      return extractDialogGenerationOutput(flowState);
    }
    return null;
  }, [flowState, dialogRecord]);

  // Get SSML config and voice suggestions (legacy)
  const ssmlConfig = useMemo(() => {
    if (dialogRecord?.ssmlConfig) {
      return dialogRecord.ssmlConfig;
    }
    // Try to extract from flowState
    if (flowState) {
      const audioStep = flowState.steps.find(
        (s) => s.nodeId === "dialog-audio"
      );
      const audioOutput = audioStep?.result?.output;
      if (audioOutput && typeof audioOutput === "object") {
        // Check if it's SSML config format
        const hasSSMLStructure = Object.values(audioOutput).some(
          (value) =>
            typeof value === "object" &&
            value !== null &&
            ("voice" in value || "prosody" in value || "emphasis" in value)
        );
        if (hasSSMLStructure) {
          return audioOutput as DialogRecord["ssmlConfig"];
        }
      }
    }
    return undefined;
  }, [dialogRecord, flowState]);

  // Legacy voice suggestions (for backward compatibility)
  const voiceSuggestions = useMemo(() => {
    if (dialogRecord?.voiceSuggestions) {
      return dialogRecord.voiceSuggestions;
    }
    // Try to extract from flowState (legacy format)
    if (flowState) {
      const audioStep = flowState.steps.find(
        (s) => s.nodeId === "dialog-audio"
      );
      const audioOutput = audioStep?.result?.output;
      if (audioOutput && typeof audioOutput === "object") {
        // Check if it's legacy format (simple strings)
        const isLegacyFormat = Object.values(audioOutput).every(
          (value) => typeof value === "string"
        );
        if (isLegacyFormat) {
          return audioOutput as DialogRecord["voiceSuggestions"];
        }
      }
    }
    return undefined;
  }, [dialogRecord, flowState]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      // Stop all audio
      audioRefs.current.forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
      audioRefs.current.clear();
      playQueueRef.current = [];
      // Cancel browser TTS
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Generate audio
  const handleGenerateAudio = async (): Promise<
    Array<{ sentenceIndex: number; audioUrl: string; character?: string }>
    | null
  > => {
    if (!dialogData || isGeneratingAudio) return null;

    setIsGeneratingAudio(true);
    try {
      const response = await fetch("/api/audio/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dialogContent: dialogData,
          voiceSuggestions,
          learningLanguage,
          ssmlConfig: dialogRecord?.ssmlConfig, // Pass existing SSML config if available
          aiProvider: aiConfig?.provider, // Pass user's AI config provider
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to generate audio");
      }

      const result = await response.json();
      setAudioData(result.audioData);

      // If SSML config was generated, save it to the dialog record
      if (result.ssmlConfig && dialogRecord) {
        try {
          const { indexedDbClient } = await import("@/lib/indexedDb");
          const updated: DialogRecord = {
            ...dialogRecord,
            ssmlConfig: result.ssmlConfig,
            updatedAt: new Date().toISOString(),
          };
          await indexedDbClient.saveDialog(updated);
        } catch (error) {
          console.error("Failed to save SSML config:", error);
        }
      }

      return result.audioData;
    } catch (error) {
      console.error("Failed to generate audio:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to generate audio. Please try again."
      );
      return null;
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Play all audio sequentially
  const handlePlayAll = async () => {
    let audioToPlay = audioData;

    if (audioToPlay.length === 0) {
      // Generate audio first if not generated
      const generated = await handleGenerateAudio();
      if (!generated || generated.length === 0) {
        return;
      }
      audioToPlay = generated;
    }

    playAllAudio(audioToPlay);
  };

  const playAllAudio = (
    audioToPlay: Array<{ sentenceIndex: number; audioUrl: string }>
  ) => {
    if (audioToPlay.length === 0) return;

    setIsPlayingAll(true);
    setCurrentlyReadingIndex(0);

    // Check if using browser TTS
    const isBrowserTTS = audioToPlay[0]?.audioUrl?.startsWith("browser-tts:");

    if (isBrowserTTS) {
      // Browser TTS: play sequentially with SSML config
      let currentIndex = 0;
      const playNext = async () => {
        if (currentIndex >= dialogData!.dialog.length) {
          setIsPlayingAll(false);
          setCurrentlyReadingIndex(null);
          return;
        }

        const entry = dialogData!.dialog[currentIndex];
        setCurrentlyReadingIndex(currentIndex);

        try {
          await playBrowserTTS(
            entry.learn_text,
            learningLanguage,
            entry.character,
            currentIndex
          );
          currentIndex++;
          playNext();
        } catch (error) {
          console.error("Failed to play browser TTS:", error);
          currentIndex++;
          playNext();
        }
      };

      playNext();
    } else {
      // Server-side TTS: play audio files
      // Group audio by sentence index
      const audioBySentence = new Map<number, string[]>();
      audioToPlay.forEach((item) => {
        if (!audioBySentence.has(item.sentenceIndex)) {
          audioBySentence.set(item.sentenceIndex, []);
        }
        audioBySentence.get(item.sentenceIndex)!.push(item.audioUrl);
      });

      // Play audio sequentially
      let currentSentenceIndex = 0;
      const playNext = () => {
        if (currentSentenceIndex >= dialogData!.dialog.length) {
          setIsPlayingAll(false);
          setCurrentlyReadingIndex(null);
          return;
        }

        const audioUrls = audioBySentence.get(currentSentenceIndex) || [];
        if (audioUrls.length === 0) {
          currentSentenceIndex++;
          playNext();
          return;
        }

        setCurrentlyReadingIndex(currentSentenceIndex);
        let urlIndex = 0;

        const playUrl = () => {
          if (urlIndex >= audioUrls.length) {
            currentSentenceIndex++;
            playNext();
            return;
          }

          const audio = new Audio(audioUrls[urlIndex]);
          audioRefs.current.set(currentSentenceIndex, audio);

          audio.onended = () => {
            urlIndex++;
            playUrl();
          };

          audio.onerror = () => {
            urlIndex++;
            playUrl();
          };

          audio.play().catch((error) => {
            console.error("Failed to play audio:", error);
            urlIndex++;
            playUrl();
          });
        };

        playUrl();
      };

      playNext();
    }
  };

  // Play browser TTS for a text with SSML configuration
  const playBrowserTTS = (
    text: string,
    language?: string,
    characterName?: string,
    sentenceIndex?: number
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        reject(new Error("Browser Speech Synthesis not supported"));
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);

      // Get available voices
      const voices = window.speechSynthesis.getVoices();

      // Use SSML config if available (new format with per-sentence config)
      if (characterName && ssmlConfig?.characters?.[characterName]) {
        const characterConfig = ssmlConfig.characters[characterName];
        const sentenceConfig = sentenceIndex !== undefined 
          ? ssmlConfig.sentences?.find(s => s.index === sentenceIndex && s.character === characterName)
          : undefined;

        // Build SSML config from character base + sentence-specific prosody
        const config: SSMLConfig = {
          voice: {
            ...characterConfig.voice,
            language,
          },
          prosody: sentenceConfig?.prosody,
          emphasis: sentenceConfig?.emphasis,
          break: sentenceConfig?.break
            ? {
                ...sentenceConfig.break,
                time:
                  typeof sentenceConfig.break.time === 'number'
                    ? sentenceConfig.break.time
                    : sentenceConfig.break.time,
              }
            : undefined,
        };
        applySSMLToUtterance(utterance, config, voices);

        // Apply break time after sentence
        if (sentenceConfig?.break?.time) {
          utterance.onend = () => {
            setTimeout(() => resolve(), sentenceConfig.break!.time!);
          };
        } else {
          utterance.onend = () => resolve();
        }
      } else {
        // Fallback to parsing voice suggestion (legacy)
        const voiceSuggestion = characterName
          ? voiceSuggestions?.[characterName]
          : undefined;
        configureUtteranceFromVoiceSuggestion(
          utterance,
          voiceSuggestion,
          language,
          voices
        );
        utterance.onend = () => resolve();
      }

      utterance.onerror = (error) => reject(error);

      window.speechSynthesis.speak(utterance);
    });
  };

  // Play single sentence
  const handlePlaySentence = async (index: number) => {
    const sentenceAudios = audioData.filter(
      (item) => item.sentenceIndex === index
    );
    if (sentenceAudios.length === 0) return;

    // Stop current audio if playing
    audioRefs.current.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setCurrentlyReadingIndex(index);
    setIsPlayingAll(false);

    // Check if using browser TTS
    const isBrowserTTS =
      sentenceAudios[0]?.audioUrl?.startsWith("browser-tts:");

    if (isBrowserTTS) {
      // Extract text from browser-tts marker
      const text = sentenceAudios[0].audioUrl.replace("browser-tts:", "");
      const entry = dialogData!.dialog[index];
      const characterName = entry.character;

      try {
        await playBrowserTTS(text, learningLanguage, characterName, index);
        setCurrentlyReadingIndex(null);
      } catch (error) {
        console.error("Failed to play browser TTS:", error);
        setCurrentlyReadingIndex(null);
      }
    } else {
      // Play all audio chunks for this sentence
      let urlIndex = 0;
      const playUrl = () => {
        if (urlIndex >= sentenceAudios.length) {
          setCurrentlyReadingIndex(null);
          return;
        }

        const audio = new Audio(sentenceAudios[urlIndex].audioUrl);
        audioRefs.current.set(index, audio);

        audio.onended = () => {
          urlIndex++;
          playUrl();
        };

        audio.onerror = () => {
          urlIndex++;
          playUrl();
        };

        audio.play().catch((error) => {
          console.error("Failed to play audio:", error);
          setCurrentlyReadingIndex(null);
        });
      };

      playUrl();
    }
  };

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
  const hasAudio = audioData.length > 0;

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
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayAll}
              disabled={isGeneratingAudio || isPlayingAll}
              className="rounded-md px-3 py-1.5 sm:px-4 sm:py-2 text-sm font-medium text-primary-600 dark:text-primary-400 transition hover:bg-primary-100 dark:hover:bg-primary-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isGeneratingAudio ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>{t("generating") || "Generating..."}</span>
                </>
              ) : isPlayingAll ? (
                <>
                  <span>⏸</span>
                  <span>{t("playing") || "Playing..."}</span>
                </>
              ) : (
                <>
                  <span>🔊</span>
                  <span>{t("readAll") || "Read All"}</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="rounded-md px-3 py-1.5 sm:px-4 sm:py-2 text-sm font-medium text-muted-foreground transition hover:bg-surface-100 dark:hover:bg-surface-800"
            >
              {t("close")}
            </button>
          </div>
        </div>
      )}
      {!isFullPage && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-primary-700 dark:text-primary-200">
            {t("dialog")}
          </h3>
          <button
            onClick={handlePlayAll}
            disabled={isGeneratingAudio || isPlayingAll}
            className="rounded-md px-3 py-1.5 sm:px-4 sm:py-2 text-sm font-medium text-primary-600 dark:text-primary-400 transition hover:bg-primary-100 dark:hover:bg-primary-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {isGeneratingAudio ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>{t("generating") || "Generating..."}</span>
              </>
            ) : isPlayingAll ? (
              <>
                <span>⏸</span>
                <span>{t("playing") || "Playing..."}</span>
              </>
            ) : (
              <>
                <span>🔊</span>
                <span>{t("readAll") || "Read All"}</span>
              </>
            )}
          </button>
        </div>
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
                className={`max-w-[85%] sm:max-w-[80%] rounded-lg px-3 py-2 sm:px-4 sm:py-3 transition-colors ${
                  currentlyReadingIndex === index
                    ? "ring-2 ring-primary-500 bg-primary-200 dark:bg-primary-800/50"
                    : isLeft
                    ? "bg-primary-100 dark:bg-primary-900/30"
                    : "bg-surface-200 dark:bg-surface-700"
                }`}
              >
                <div
                  className={`mb-1 text-xs font-semibold text-muted-foreground flex items-center gap-2 ${
                    isLeft ? "justify-start" : "justify-end"
                  }`}
                >
                  <span>{entry.character}</span>
                  {hasAudio && (
                    <button
                      onClick={() => handlePlaySentence(index)}
                      disabled={currentlyReadingIndex === index && isPlayingAll}
                      className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-50 transition-colors"
                      title={t("playSentence") || "Play this sentence"}
                    >
                      {currentlyReadingIndex === index ? "⏸" : "▶"}
                    </button>
                  )}
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
