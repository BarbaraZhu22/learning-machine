"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { TypingMessageBox } from "@/components/common/TypingMessageBox";
import { useTranslation } from "@/hooks/useTranslation";
import { useWebAudioPlayer } from "@/hooks/useWebAudioPlayer";
import type { FlowState } from "@/lib/lm-ai/types";
import type { DialogRecord } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import {
  checkAudioGenerationLimit,
  incrementAudioGenerationCount,
} from "@/components/dialog/audioGenerationLimits";

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

/**
 * Get playback speed based on learning language
 * Different languages may have different optimal speeds
 */
function getPlaybackSpeedForLanguage(
  language: string,
  isSlow: boolean
): number {
  // Base speeds by language
  const normalSpeeds: Record<string, number> = {
    chinese: 1.0,
    cantonese: 1.0,
    japanese: 1.0,
    korean: 1.0,
    english: 1.0,
    spanish: 1.0,
    french: 1.0,
    german: 1.0,
    portuguese: 1.0,
    italian: 1.0,
    russian: 0.95,
    turkish: 1.0,
    polish: 1.0,
    dutch: 1.0,
  };

  // Slow speeds (typically 0.75-0.7x of normal speed)
  const slowSpeeds: Record<string, number> = {
    chinese: 0.75,
    cantonese: 0.75,
    japanese: 0.75,
    korean: 0.75,
    english: 0.8,
    spanish: 0.8,
    french: 0.8,
    german: 0.8,
    portuguese: 0.8,
    italian: 0.8,
    russian: 0.75,
    turkish: 0.8,
    polish: 0.8,
    dutch: 0.8,
  };

  const speeds = isSlow ? slowSpeeds : normalSpeeds;
  return speeds[language] || (isSlow ? 0.8 : 1.0);
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
    Array<{
      sentenceIndex: number;
      audioBuffer: ArrayBuffer;
      character?: string;
      text?: string;
    }>
  >([]);
  const [currentlyReadingIndex, setCurrentlyReadingIndex] = useState<
    number | null
  >(null);
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [isSlowMode, setIsSlowMode] = useState(false); // Track slow/normal mode
  const audioBuffersRef = useRef<Map<number, AudioBuffer>>(new Map());
  const decodePromisesRef = useRef<Map<number, Promise<AudioBuffer>>>(
    new Map()
  );
  const dialogContainerRef = useRef<HTMLDivElement | null>(null);
  const sentenceRefsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  // Calculate current playback rate based on language and mode
  const playbackRate = useMemo(
    () => getPlaybackSpeedForLanguage(learningLanguage, isSlowMode),
    [learningLanguage, isSlowMode]
  );

  // Unified audio (single MP3)
  const [unifiedAudioUrl, setUnifiedAudioUrl] = useState<string | null>(null);
  const [unifiedAudioErrorText, setUnifiedAudioErrorText] = useState<
    string | null
  >(null);
  const [sentenceErrors, setSentenceErrors] = useState<
    Array<{
      sentenceIndex: number;
      character: string;
      text: string;
      error: string;
    }>
  >([]);
  const sentenceErrorsRef = useRef<
    Array<{
      sentenceIndex: number;
      character: string;
      text: string;
      error: string;
    }>
  >([]);
  const [showSentenceErrors, setShowSentenceErrors] = useState(true);
  const [unifiedAudioFileName, setUnifiedAudioFileName] =
    useState<string>("dialog.mp3");
  // Web Audio API: keep raw audio data
  const unifiedAudioArrayBufferRef = useRef<ArrayBuffer | null>(null);
  const allSentenceBuffersRef = useRef<Map<number, ArrayBuffer>>(new Map());

  // Web Audio Player hook
  const webAudioPlayer = useWebAudioPlayer({
    playbackRate,
    onPlayingStateChange: setIsPlayingAll,
    onCurrentIndexChange: setCurrentlyReadingIndex,
  });

  // Use the hook's audio context for decoding
  const getOrCreateAudioContextForDecoding =
    useCallback((): AudioContext | null => {
      return webAudioPlayer.getOrCreateAudioContext();
    }, [webAudioPlayer]);

  const dialogData = useMemo(() => {
    if (dialogRecord) {
      return dialogRecord.dialogContent;
    }
    if (flowState) {
      return extractDialogGenerationOutput(flowState);
    }
    return null;
  }, [flowState, dialogRecord]);

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

  // Load cached audio when dialogRecord is available
  useEffect(() => {
    if (dialogRecord?.cachedAudio && !isGeneratingAudio) {
      loadCachedAudio().catch(() => {
        // Ignore errors
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogRecord?.id]);

  // Reset slow mode when language changes
  useEffect(() => {
    setIsSlowMode(false);
    // Stop any playing audio when language changes
    webAudioPlayer.stopAll();
    setIsPlayingAll(false);
    setCurrentlyReadingIndex(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learningLanguage]); // Only depend on learningLanguage, not webAudioPlayer

  // Auto-scroll to current sentence during playback
  useEffect(() => {
    if (currentlyReadingIndex !== null && isPlayingAll) {
      const sentenceElement = sentenceRefsRef.current.get(
        currentlyReadingIndex
      );
      if (sentenceElement && dialogContainerRef.current) {
        // Scroll the sentence into view
        sentenceElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [currentlyReadingIndex, isPlayingAll]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      // Stop all Web Audio sources
      webAudioPlayer.stopAll();
      audioBuffersRef.current.clear();
      allSentenceBuffersRef.current.clear();

      // Don't close AudioContext on unmount - let it be garbage collected naturally
      // Closing it can cause issues if there are pending operations
      // The browser will handle cleanup when the context is no longer referenced
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on unmount, not when webAudioPlayer changes

  // Check if audio is complete (all sentences have audio)
  // If there are sentence errors, only check if all successful sentences have audio
  const isAudioComplete = (): boolean => {
    if (!dialogData) return false;
    const expectedCount = dialogData.dialog.length;
    const actualCount = allSentenceBuffersRef.current.size;
    const errorIndices = new Set(
      sentenceErrorsRef.current.map((err) => err.sentenceIndex)
    );

    // If we have errors, check if all non-error sentences have audio
    if (errorIndices.size > 0) {
      const expectedSuccessfulCount = expectedCount - errorIndices.size;
      // Check that we have audio for all non-error sentences
      for (let i = 0; i < expectedCount; i++) {
        if (!errorIndices.has(i) && !allSentenceBuffersRef.current.has(i)) {
          return false;
        }
      }
      return actualCount === expectedSuccessfulCount;
    }

    // No errors: check if we have audio for all sentence indices (0 to expectedCount - 1)
    for (let i = 0; i < expectedCount; i++) {
      if (!allSentenceBuffersRef.current.has(i)) {
        return false;
      }
    }

    return actualCount === expectedCount;
  };

  // Load cached audio if available
  const loadCachedAudio = async (): Promise<boolean> => {
    if (!dialogRecord?.cachedAudio) {
      return false;
    }

    try {
      const { audioBase64, sentenceAudioBuffers } = dialogRecord.cachedAudio;

      // Load merged audio
      if (audioBase64) {
        const binaryString = atob(audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const mergedBuffer = bytes.buffer;
        unifiedAudioArrayBufferRef.current = mergedBuffer;

        const blob = new Blob([mergedBuffer], { type: "audio/mpeg" });
        const blobUrl = URL.createObjectURL(blob);
        setUnifiedAudioUrl(blobUrl);
        setUnifiedAudioFileName(`dialog-${Date.now()}.mp3`);
      }

      // Load sentence audio buffers
      if (sentenceAudioBuffers && sentenceAudioBuffers.length > 0) {
        const ctx = getOrCreateAudioContextForDecoding();
        if (!ctx) return false;

        // Decode all sentence buffers
        const decodePromises = sentenceAudioBuffers.map(
          async (sentenceAudio) => {
            try {
              const binaryString = atob(sentenceAudio.audioBase64);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const arrayBuffer = bytes.buffer;
              allSentenceBuffersRef.current.set(
                sentenceAudio.sentenceIndex,
                arrayBuffer
              );

              const audioBuffer = await ctx.decodeAudioData(
                arrayBuffer.slice(0)
              );
              audioBuffersRef.current.set(
                sentenceAudio.sentenceIndex,
                audioBuffer
              );

              const sentenceText =
                dialogData?.dialog[sentenceAudio.sentenceIndex]?.learn_text ||
                dialogData?.dialog[sentenceAudio.sentenceIndex]?.use_text ||
                "";

              return {
                sentenceIndex: sentenceAudio.sentenceIndex,
                audioBuffer: arrayBuffer,
                character: sentenceAudio.character,
                text: sentenceText,
              };
            } catch {
              return null;
            }
          }
        );

        const decodedData = await Promise.all(decodePromises);
        const validData = decodedData.filter(
          (item): item is NonNullable<typeof item> => item !== null
        );

        setAudioData(validData);

        // Check if audio is complete after loading
        if (!isAudioComplete()) {
          return false; // Return false to trigger regeneration
        }

        return true;
      }

      // If we only have merged audio but no sentence buffers, check completeness
      if (
        audioBase64 &&
        (!sentenceAudioBuffers || sentenceAudioBuffers.length === 0)
      ) {
        // Can't verify completeness without sentence buffers, assume incomplete
        return false;
      }

      return audioBase64 !== undefined;
    } catch {
      return false;
    }
  };

  // Generate audio stream and update state sentence-by-sentence
  const handleGenerateAudio = async (): Promise<void> => {
    if (!dialogData || isGeneratingAudio) return;

    // Check for cached audio first
    if (dialogRecord) {
      const cachedLoaded = await loadCachedAudio();
      if (cachedLoaded) {
        return;
      }
    }

    // Check daily audio generation limit
    const limitCheck = checkAudioGenerationLimit();
    if (!limitCheck.canGenerate) {
      const limitMessage = t("audioGenerationLimitMessage");
      setUnifiedAudioErrorText(limitMessage);
      return;
    }

    setIsGeneratingAudio(true);

    // Cleanup previous audio sources
    webAudioPlayer.stopAll();
    audioBuffersRef.current.clear();
    allSentenceBuffersRef.current.clear();
    decodePromisesRef.current.clear();

    setAudioData([]); // Clear previous audio data
    setUnifiedAudioErrorText(null);
    setSentenceErrors([]); // Clear previous sentence errors
    sentenceErrorsRef.current = []; // Clear ref
    setShowSentenceErrors(true); // Reset error visibility
    setUnifiedAudioUrl(null);

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
          aiProvider: aiConfig?.provider,
        }),
      });

      if (!response.ok) {
        // Try to parse JSON error; fall back to text
        let message = "Failed to generate audio";
        try {
          const error = await response.json();
          message = error.message || message;
        } catch {
          try {
            message = await response.text();
          } catch {}
        }
        setUnifiedAudioErrorText(message);
        throw new Error(message);
      }

      const contentType = response.headers.get("content-type") || "";

      // Check if it's a stream (text/event-stream)
      if (
        contentType.includes("text/event-stream") ||
        contentType.includes("text/plain")
      ) {
        // Stream mode: read sentence-by-sentence
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        if (!reader) {
          throw new Error("Response body is not readable");
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete lines (JSON objects separated by newlines)
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const data = JSON.parse(line);

              if (data.type === "sentence") {
                if (data.success && data.audioBase64) {
                  // Convert base64 to ArrayBuffer for Web Audio API
                  try {
                    const binaryString = atob(data.audioBase64);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                      bytes[i] = binaryString.charCodeAt(i);
                    }
                    const arrayBuffer = bytes.buffer;

                    // Store buffer for merging later
                    allSentenceBuffersRef.current.set(
                      data.sentenceIndex,
                      arrayBuffer
                    );

                    // Decode audio for playback
                    const ctx = getOrCreateAudioContextForDecoding();
                    if (ctx) {
                      // Verify ArrayBuffer has data before decoding
                      if (arrayBuffer.byteLength === 0) {
                        return;
                      }

                      // Check if it looks like MP3 data (starts with MP3 header)
                      // Create decode promise and track it
                      const decodePromise = ctx
                        .decodeAudioData(arrayBuffer.slice(0))
                        .then((audioBuffer) => {
                          // Remove from tracking once decoded
                          decodePromisesRef.current.delete(data.sentenceIndex);
                          return audioBuffer;
                        });

                      // Track the promise
                      decodePromisesRef.current.set(
                        data.sentenceIndex,
                        decodePromise
                      );

                      decodePromise
                        .then((audioBuffer) => {
                          audioBuffersRef.current.set(
                            data.sentenceIndex,
                            audioBuffer
                          );

                          // Get text for this sentence
                          const sentenceText =
                            dialogData?.dialog[data.sentenceIndex]
                              ?.learn_text ||
                            dialogData?.dialog[data.sentenceIndex]?.use_text ||
                            "";

                          // Add audio data for this sentence
                          setAudioData((prev) => {
                            const filtered = prev.filter(
                              (item) =>
                                item.sentenceIndex !== data.sentenceIndex
                            );
                            const newData = [
                              ...filtered,
                              {
                                sentenceIndex: data.sentenceIndex,
                                audioBuffer: arrayBuffer,
                                character: data.character,
                                text: sentenceText,
                              },
                            ].sort((a, b) => a.sentenceIndex - b.sentenceIndex);

                            return newData;
                          });

                          // Remove from errors if it was previously in error state
                          setSentenceErrors((prev) => {
                            const filtered = prev.filter(
                              (err) => err.sentenceIndex !== data.sentenceIndex
                            );
                            sentenceErrorsRef.current = filtered;
                            return filtered;
                          });
                        })
                        .catch(() => {
                          // Ignore decode errors
                        });
                    }
                  } catch {
                    // Ignore processing errors
                  }
                } else if (!data.success && data.error) {
                  // Handle sentence-level error
                  const sentenceText =
                    dialogData?.dialog[data.sentenceIndex]?.learn_text ||
                    dialogData?.dialog[data.sentenceIndex]?.use_text ||
                    "";
                  setSentenceErrors((prev) => {
                    const filtered = prev.filter(
                      (err) => err.sentenceIndex !== data.sentenceIndex
                    );
                    const newErrors = [
                      ...filtered,
                      {
                        sentenceIndex: data.sentenceIndex,
                        character: data.character || "Unknown",
                        text: sentenceText,
                        error: data.error || "Unknown error",
                      },
                    ].sort((a, b) => a.sentenceIndex - b.sentenceIndex);
                    sentenceErrorsRef.current = newErrors;
                    return newErrors;
                  });
                }
              } else if (data.type === "complete") {
                // All sentences processed - merge into single MP3 for download
                mergeAudioBuffers();

                // Wait for all decode promises to complete before playing
                const expectedCount = dialogData?.dialog.length || 0;
                const allDecodePromises = Array.from(
                  decodePromisesRef.current.values()
                );

                Promise.all(allDecodePromises)
                  .then(() => {
                    // Wait a bit for state updates and stream processing to complete
                    // The complete message should arrive after all sentences, but we need
                    // to ensure all sentence processing (including setting allSentenceBuffersRef) is done
                    setTimeout(() => {
                      const readyCount = audioBuffersRef.current.size;
                      const bufferCount = allSentenceBuffersRef.current.size;
                      const hasSentenceErrors = sentenceErrorsRef.current.length > 0;
                      const audioComplete = isAudioComplete();
                      
                      // Double check: if we have all buffers but isAudioComplete returns false,
                      // it might be a timing issue, give it another moment
                      if (!hasSentenceErrors && !audioComplete && bufferCount >= expectedCount) {
                        // Wait a bit more and check again
                        setTimeout(() => {
                          const finalAudioComplete = isAudioComplete();
                          const finalBufferCount = allSentenceBuffersRef.current.size;
                          const finalHasSentenceErrors = sentenceErrorsRef.current.length > 0;
                          
                          if (!finalAudioComplete && finalBufferCount < expectedCount) {
                            setUnifiedAudioErrorText(
                              `Audio generation incomplete: ${finalBufferCount}/${expectedCount} sentences. Please try generating again.`
                            );
                          } else {
                            setUnifiedAudioErrorText(null);
                          }
                          
                          // Cache audio data if complete and no errors
                          if (finalAudioComplete && !finalHasSentenceErrors) {
                            // Increment generation count on successful completion
                            incrementAudioGenerationCount();
                            cacheAudioData().catch((error) => {
                              console.error("Failed to cache audio:", error);
                            });
                          }
                          
                          setIsGeneratingAudio(false);
                        }, 200);
                        return;
                      }
                      
                      // Only show incomplete error if there are no sentence errors
                      // If there are sentence errors, the user already sees specific error messages
                      if (!hasSentenceErrors && !audioComplete) {
                        setUnifiedAudioErrorText(
                          `Audio generation incomplete: ${bufferCount}/${expectedCount} sentences. Please try generating again.`
                        );
                        setIsGeneratingAudio(false);
                        return;
                      }
                      
                      // If audio is complete or we have sentence errors, clear incomplete error
                      if (audioComplete || hasSentenceErrors) {
                        setUnifiedAudioErrorText(null);
                      }
                      
                      // Cache audio data if complete and no errors
                      if (audioComplete && !hasSentenceErrors) {
                        // Increment generation count on successful completion
                        incrementAudioGenerationCount();
                        cacheAudioData().catch((error) => {
                          console.error("Failed to cache audio:", error);
                        });
                      }
                      
                      // Auto-play if audio is complete and we have enough sentences
                      if (
                        audioComplete &&
                        readyCount >= expectedCount &&
                        !isPlayingAll &&
                        readyCount > 0
                      ) {
                        handlePlayAll(playbackRate);
                      } else {
                        // Stop generating state
                        setIsGeneratingAudio(false);
                      }
                    }, 300);
                  })
                  .catch(() => {
                    setIsGeneratingAudio(false);
                  });
              } else if (data.type === "error") {
                // Overall error
                setUnifiedAudioErrorText(
                  data.error || "Unknown error occurred"
                );
              }
            } catch (parseError) {
              // Ignore parse errors
              console.error(parseError);
            }
          }
        }

        // Process any remaining buffer (same logic as above)
        if (buffer.trim()) {
          try {
            const data = JSON.parse(buffer);
            if (data.type === "sentence" && data.success && data.audioBase64) {
              // Same processing as above (convert base64 to ArrayBuffer)
              const binaryString = atob(data.audioBase64);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const arrayBuffer = bytes.buffer;
              allSentenceBuffersRef.current.set(
                data.sentenceIndex,
                arrayBuffer
              );

              const ctx = getOrCreateAudioContextForDecoding();
              if (ctx) {
                ctx
                  .decodeAudioData(arrayBuffer.slice(0))
                  .then((audioBuffer) => {
                    audioBuffersRef.current.set(
                      data.sentenceIndex,
                      audioBuffer
                    );
                    const sentenceText =
                      dialogData?.dialog[data.sentenceIndex]?.learn_text ||
                      dialogData?.dialog[data.sentenceIndex]?.use_text ||
                      "";
                    setAudioData((prev) => {
                      const filtered = prev.filter(
                        (item) => item.sentenceIndex !== data.sentenceIndex
                      );
                      return [
                        ...filtered,
                        {
                          sentenceIndex: data.sentenceIndex,
                          audioBuffer: arrayBuffer,
                          character: data.character,
                          text: sentenceText,
                        },
                      ].sort((a, b) => a.sentenceIndex - b.sentenceIndex);
                    });
                  })
                  .catch((decodeError) => {
                    // Ignore decode errors
                  });
              }
            }
          } catch (parseError) {
            // Ignore parse errors
          }
        }

        return;
      }

      // Backward compatibility: handle old response formats
      const contentType2 = response.headers.get("content-type") || "";
      if (contentType2.includes("audio/")) {
        const blob = await response.blob();
        const normalizedBlob =
          blob.type && blob.type.startsWith("audio/")
            ? blob
            : new Blob([blob], { type: "audio/mpeg" });

        try {
          const arrayBuffer = await normalizedBlob.arrayBuffer();
          unifiedAudioArrayBufferRef.current = arrayBuffer;

          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === "string") {
                resolve(reader.result);
              } else {
                reject(new Error("Failed to read audio blob as data URL"));
              }
            };
            reader.onerror = () =>
              reject(reader.error || new Error("FileReader error"));
            reader.readAsDataURL(normalizedBlob);
          });

          setUnifiedAudioUrl(dataUrl);
          setUnifiedAudioErrorText(null);
          setUnifiedAudioFileName(`dialog-${Date.now()}.mp3`);
          setAudioData([]);
        } catch {
          setUnifiedAudioUrl(null);
          setUnifiedAudioErrorText("Audio blob could not be played.");
        }
      } else {
        // Legacy JSON format
        const result = await response.json();
        if (result.audioUrl) {
          const url = String(result.audioUrl);
          setUnifiedAudioUrl(url);
          setAudioData([]);
          unifiedAudioArrayBufferRef.current = null;
        } else if (Array.isArray(result.audioData)) {
          setAudioData(result.audioData);
        }
      }
    } catch (error) {
      setUnifiedAudioErrorText(
        error instanceof Error
          ? error.message
          : "Failed to generate audio. Please try again."
      );
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Merge all sentence audio buffers into a single MP3 for download
  const mergeAudioBuffers = async () => {
    const buffers = Array.from(allSentenceBuffersRef.current.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, buffer]) => buffer);

    if (buffers.length === 0) {
      return;
    }

    try {
      // Simple concatenation of MP3 bytes (MP3 format supports simple concatenation)
      let totalLength = 0;
      buffers.forEach((buffer) => {
        totalLength += buffer.byteLength;
      });

      const merged = new Uint8Array(totalLength);
      let offset = 0;
      buffers.forEach((buffer) => {
        merged.set(new Uint8Array(buffer), offset);
        offset += buffer.byteLength;
      });

      const mergedBuffer = merged.buffer;
      unifiedAudioArrayBufferRef.current = mergedBuffer;

      // Create Blob URL for download
      const blob = new Blob([mergedBuffer], { type: "audio/mpeg" });
      const blobUrl = URL.createObjectURL(blob);
      setUnifiedAudioUrl(blobUrl);
      setUnifiedAudioFileName(`dialog-${Date.now()}.mp3`);
    } catch (error) {
      // Failed to merge audio buffers
    }
  };

  // Cache audio data to IndexedDB
  const cacheAudioData = async () => {
    if (!dialogRecord || !isAudioComplete()) {
      return;
    }

    try {
      const { indexedDbClient } = await import("@/lib/indexedDb");
      const mergedBuffer = unifiedAudioArrayBufferRef.current;

      if (!mergedBuffer) {
        // If no merged buffer, create it from sentence buffers
        const buffers = Array.from(allSentenceBuffersRef.current.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([, buffer]) => buffer);

        if (buffers.length === 0) {
          return;
        }

        let totalLength = 0;
        buffers.forEach((buffer) => {
          totalLength += buffer.byteLength;
        });

        const merged = new Uint8Array(totalLength);
        let offset = 0;
        buffers.forEach((buffer) => {
          merged.set(new Uint8Array(buffer), offset);
          offset += buffer.byteLength;
        });

        unifiedAudioArrayBufferRef.current = merged.buffer;
      }

      const finalMergedBuffer = unifiedAudioArrayBufferRef.current;
      if (!finalMergedBuffer) {
        return;
      }

      const mergedBase64 = arrayBufferToBase64(finalMergedBuffer);

      // Convert sentence buffers to base64
      const sentenceAudioBuffers = Array.from(
        allSentenceBuffersRef.current.entries()
      )
        .sort((a, b) => a[0] - b[0])
        .map(([sentenceIndex, buffer]) => {
          if (!buffer) return null;

          const sentenceBase64 = arrayBufferToBase64(buffer);
          const character = dialogData?.dialog[sentenceIndex]?.character;

          return {
            sentenceIndex,
            audioBase64: sentenceBase64,
            character,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      const updated: DialogRecord = {
        ...dialogRecord,
        cachedAudio: {
          audioBase64: mergedBase64,
          sentenceAudioBuffers,
        },
        updatedAt: new Date().toISOString(),
      };

      await indexedDbClient.saveDialog(updated);
    } catch (error) {
      // Ignore cache errors
      console.error("Failed to cache audio data:", error);
    }
  };

  // Helper function to convert ArrayBuffer to base64
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Play all audio using Web Audio API
  const handlePlayAll = async (rate?: number) => {
    // Prevent multiple simultaneous playbacks
    if (isPlayingAll) {
      // Already playing, ignoring duplicate play request
      return;
    }

    const playRate = rate ?? playbackRate;

    // If we have sentence-level audio buffers, play them sequentially
    if (audioData.length > 0 && audioBuffersRef.current.size > 0) {
      await webAudioPlayer.playAllSentences(audioBuffersRef.current, playRate);
      return;
    }

    // If we have unified audio, use that
    if (unifiedAudioArrayBufferRef.current) {
      await webAudioPlayer.playUnifiedAudio(
        unifiedAudioArrayBufferRef.current,
        playRate
      );
      return;
    }

    // Otherwise, generate audio first
    await handleGenerateAudio();
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (audioData.length > 0 && audioBuffersRef.current.size > 0) {
      await webAudioPlayer.playAllSentences(audioBuffersRef.current, playRate);
    }
  };

  // Play single sentence using Web Audio API
  const handlePlaySentence = async (index: number, rate?: number) => {
    if (typeof window === "undefined") return;

    // Stop any currently playing audio first
    if (isPlayingAll) {
      webAudioPlayer.stopAll();
      setIsPlayingAll(false);
    }

    const playRate = rate ?? playbackRate;

    // Use Web Audio API to play sentence buffer
    const audioBuffer = audioBuffersRef.current.get(index);
    if (!audioBuffer) {
      // No audio buffer available
      return;
    }

    await webAudioPlayer.playSentence(index, audioBuffer, playRate);
  };

  // Determine which side each character appears on
  // Must be called before early return to satisfy React Hooks rules
  const characterPositions = useMemo(() => {
    if (!dialogData) {
      return {};
    }
    const positions: Record<string, "left" | "right"> = {};
    const characters = dialogData.characters;
    if (characters.length >= 1) {
      positions[characters[0]] = "left";
    }
    if (characters.length >= 2) {
      positions[characters[1]] = "right";
    }
    return positions;
  }, [dialogData]);

  if (!dialogData) {
    return (
      <div className="rounded-lg border border-surface-200/50 bg-[color:var(--glass-base)] p-4 shadow-lg shadow-primary-100/40 backdrop-blur dark:border-surface-700 dark:bg-surface-900">
        <p className="text-sm text-muted-foreground">{t("noDialogs")}</p>
      </div>
    );
  }

  const { characters, dialog } = dialogData;

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
      {unifiedAudioErrorText && (
        <div className="mx-4 my-2 rounded border border-red-300 bg-red-50 p-3 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-mono whitespace-pre-wrap break-words flex-1">
              {unifiedAudioErrorText}
            </div>
            <button
              onClick={() => setUnifiedAudioErrorText(null)}
              className="text-red-600 dark:text-red-300 hover:text-red-800 dark:hover:text-red-100 transition-colors px-2 py-1 rounded flex-shrink-0"
              title="关闭"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {sentenceErrors.length > 0 && showSentenceErrors && (
        <div className="mx-4 my-2 rounded border border-red-300 bg-red-50 p-3 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">
              句子错误 ({sentenceErrors.length}):
            </div>
            <button
              onClick={() => setShowSentenceErrors(false)}
              className="text-red-600 dark:text-red-300 hover:text-red-800 dark:hover:text-red-100 transition-colors px-2 py-1 rounded"
              title="关闭"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {sentenceErrors.map((err) => (
              <div
                key={err.sentenceIndex}
                className="text-xs font-mono whitespace-pre-wrap break-words border-l-2 border-red-400 pl-2"
              >
                <div className="font-semibold">
                  句子 #{err.sentenceIndex + 1} ({err.character}):
                </div>
                <div className="text-red-600 dark:text-red-300 mt-1">
                  {err.error}
                </div>
                {err.text && (
                  <div className="text-red-500 dark:text-red-400 mt-1 opacity-75">
                    文本:{" "}
                    {err.text.length > 50
                      ? `${err.text.substring(0, 50)}...`
                      : err.text}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {isFullPage && (
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-200/50 bg-[color:var(--glass-base)] px-4 py-3 sm:px-6 sm:py-4 backdrop-blur dark:border-surface-700">
          <h3 className="text-lg sm:text-xl font-semibold text-primary-700 dark:text-primary-200">
            {t("dialog")}
          </h3>
          <div className="flex items-center gap-2">
            {unifiedAudioUrl && (
              <button
                onClick={() => {
                  try {
                    const a = document.createElement("a");
                    a.href = unifiedAudioUrl;
                    a.download = unifiedAudioFileName || "dialog.mp3";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  } catch (e) {
                    // Ignore download errors
                  }
                }}
                className="rounded-md px-3 py-1.5 sm:px-4 sm:py-2 text-sm font-medium text-primary-700 dark:text-primary-200 transition hover:bg-primary-100 dark:hover:bg-primary-900/30"
                title="Download MP3"
              >
                ⬇ MP3
              </button>
            )}
            <button
              onClick={() => {
                const newSlowMode = !isSlowMode;
                setIsSlowMode(newSlowMode);
                if (isPlayingAll) {
                  // Stop current playback and restart with new rate
                  webAudioPlayer.stopAll();
                  setIsPlayingAll(false);
                  const newRate = getPlaybackSpeedForLanguage(
                    learningLanguage,
                    newSlowMode
                  );
                  setTimeout(() => handlePlayAll(newRate), 100);
                }
              }}
              disabled={isGeneratingAudio}
              className="rounded-md border-[1px] border-text-primary px-1.5 py-1 sm:px-4 sm:py-2 text-sm font-small text-primary-600 dark:text-primary-400 transition hover:bg-primary-100 dark:hover:bg-primary-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              title={
                isSlowMode
                  ? `${t("normal")} (${getPlaybackSpeedForLanguage(
                      learningLanguage,
                      false
                    ).toFixed(1)}x)`
                  : `${t("slow")} (${getPlaybackSpeedForLanguage(
                      learningLanguage,
                      true
                    ).toFixed(1)}x)`
              }
            >
              {isSlowMode ? `${t("normal")}` : `${t("slow")}`}
            </button>
            <button
              onClick={() => {
                if (!isAudioComplete()) {
                  handleGenerateAudio();
                } else {
                  handlePlayAll(playbackRate);
                }
              }}
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newSlowMode = !isSlowMode;
                setIsSlowMode(newSlowMode);
                if (isPlayingAll) {
                  webAudioPlayer.stopAll();
                  setIsPlayingAll(false);
                  const newRate = getPlaybackSpeedForLanguage(
                    learningLanguage,
                    newSlowMode
                  );
                  setTimeout(() => handlePlayAll(newRate), 100);
                }
              }}
              disabled={isGeneratingAudio}
              className="rounded-md px-3 py-1.5 sm:px-4 sm:py-2 text-sm font-medium text-primary-600 dark:text-primary-400 transition hover:bg-primary-100 dark:hover:bg-primary-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              title={
                isSlowMode
                  ? `${t("normal")} (${getPlaybackSpeedForLanguage(
                      learningLanguage,
                      false
                    ).toFixed(1)}x)`
                  : `${t("slow")} (${getPlaybackSpeedForLanguage(
                      learningLanguage,
                      true
                    ).toFixed(1)}x)`
              }
            >
              {isSlowMode ? `▶ ${t("normal")}` : `🐌 ${t("slow")}`}
            </button>
            <button
              onClick={() => {
                if (!isAudioComplete()) {
                  handleGenerateAudio();
                } else {
                  handlePlayAll(playbackRate);
                }
              }}
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
        </div>
      )}
      <div
        ref={dialogContainerRef}
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
              ref={(el) => {
                if (el) {
                  sentenceRefsRef.current.set(index, el);
                } else {
                  sentenceRefsRef.current.delete(index);
                }
              }}
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
                      disabled={isPlayingAll}
                      className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-50 transition-colors"
                      title={t("playSentence") || "Play this sentence"}
                    >
                      {currentlyReadingIndex === index && isPlayingAll
                        ? "⏸"
                        : "▶"}
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
