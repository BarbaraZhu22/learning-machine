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
  const audioSourcesRef = useRef<Map<number, AudioBufferSourceNode>>(new Map());

  // Calculate current playback rate based on language and mode
  const playbackRate = useMemo(
    () => getPlaybackSpeedForLanguage(learningLanguage, isSlowMode),
    [learningLanguage, isSlowMode]
  );

  // Unified Aliyun audio (single MP3) + markers
  const [unifiedAudioUrl, setUnifiedAudioUrl] = useState<string | null>(null);
  const [unifiedAudioErrorText, setUnifiedAudioErrorText] = useState<
    string | null
  >(null);
  const [unifiedAudioFileName, setUnifiedAudioFileName] =
    useState<string>("dialog.mp3");
  const [markers, setMarkers] = useState<
    Array<{
      sentenceIndex: number;
      start: number;
      end: number;
      character: string;
      text: string;
    }>
  >([]);
  // Web Audio API: keep raw audio data and playback context
  const unifiedAudioArrayBufferRef = useRef<ArrayBuffer | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const allSentenceBuffersRef = useRef<Map<number, ArrayBuffer>>(new Map());

  const dialogData = useMemo(() => {
    if (dialogRecord) {
      return dialogRecord.dialogContent;
    }
    if (flowState) {
      return extractDialogGenerationOutput(flowState);
    }
    return null;
  }, [flowState, dialogRecord]);

  // Keep legacy voiceSuggestions only; ssmlDocument is stored on the record
  const ssmlDocument = dialogRecord?.ssmlDocument;

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

  // Reset slow mode when language changes
  useEffect(() => {
    setIsSlowMode(false);
    // Stop any playing audio when language changes
    audioSourcesRef.current.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    });
    audioSourcesRef.current.clear();
    setIsPlayingAll(false);
    setCurrentlyReadingIndex(null);
  }, [learningLanguage]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      // Stop all Web Audio sources
      audioSourcesRef.current.forEach((source) => {
        try {
          source.stop();
          source.disconnect();
        } catch {
          // ignore stop errors
        }
      });
      audioSourcesRef.current.clear();
      audioBuffersRef.current.clear();
      allSentenceBuffersRef.current.clear();

      // Cancel browser TTS
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      // Cleanup Web Audio playback
      try {
        if (audioSourceRef.current) {
          audioSourceRef.current.stop();
          audioSourceRef.current.disconnect();
          audioSourceRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
      } catch {
        // ignore close errors
      }
    };
  }, []);

  // Generate audio stream and update state sentence-by-sentence
  const handleGenerateAudio = async (): Promise<void> => {
    if (!dialogData || isGeneratingAudio) return;

    setIsGeneratingAudio(true);

    // Cleanup previous audio sources
    audioSourcesRef.current.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // ignore stop errors
      }
    });
    audioSourcesRef.current.clear();
    audioBuffersRef.current.clear();
    allSentenceBuffersRef.current.clear();

    setAudioData([]); // Clear previous audio data
    setUnifiedAudioErrorText(null);
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
                    if (typeof window !== "undefined") {
                      const AnyWindow = window as any;
                      const AudioCtx =
                        (window as any).AudioContext ||
                        AnyWindow.webkitAudioContext;
                      if (AudioCtx) {
                        if (
                          !audioContextRef.current ||
                          audioContextRef.current.state === "closed"
                        ) {
                          audioContextRef.current = new AudioCtx();
                        }
                        const ctx = audioContextRef.current;
                        if (!ctx) return;

                        ctx
                          .decodeAudioData(arrayBuffer.slice(0))
                          .then((audioBuffer) => {
                            audioBuffersRef.current.set(
                              data.sentenceIndex,
                              audioBuffer
                            );

                            // Get text for this sentence
                            const sentenceText =
                              dialogData?.dialog[data.sentenceIndex]
                                ?.learn_text ||
                              dialogData?.dialog[data.sentenceIndex]
                                ?.use_text ||
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
                              ].sort(
                                (a, b) => a.sentenceIndex - b.sentenceIndex
                              );

                              return newData;
                            });
                          })
                          .catch((decodeError) => {
                            console.error(
                              `Failed to decode audio for sentence ${data.sentenceIndex}:`,
                              decodeError
                            );
                          });
                      }
                    }
                  } catch (blobError) {
                    console.error(
                      `Failed to process audio for sentence ${data.sentenceIndex}:`,
                      blobError
                    );
                  }
                } else {
                  // Log error for this sentence but continue
                  console.warn(
                    `Failed to generate audio for sentence ${data.sentenceIndex}:`,
                    data.error
                  );
                }
              } else if (data.type === "complete") {
                // All sentences processed - merge into single MP3 for download
                console.log(
                  `Audio generation complete: ${data.totalSentences} sentences`
                );
                mergeAudioBuffers();

                // Auto-play when all sentences are ready
                // Use setTimeout to allow all state updates to complete
                setTimeout(() => {
                  // Check if we have all audio buffers ready
                  // Wait a bit more for all buffers to be decoded
                  const checkAndPlay = () => {
                    const expectedCount = dialogData?.dialog.length || 0;
                    const readyCount = audioBuffersRef.current.size;

                    if (
                      readyCount >= expectedCount &&
                      !isPlayingAll &&
                      readyCount > 0
                    ) {
                      handlePlayAll(playbackRate);
                    } else if (readyCount < expectedCount) {
                      // Some buffers might still be decoding, wait a bit more
                      setTimeout(checkAndPlay, 100);
                    }
                  };

                  checkAndPlay();
                }, 300);
              } else if (data.type === "error") {
                // Overall error
                setUnifiedAudioErrorText(
                  data.error || "Unknown error occurred"
                );
              }
            } catch (parseError) {
              console.warn("Failed to parse stream data:", line, parseError);
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

              if (
                audioContextRef.current &&
                audioContextRef.current.state !== "closed"
              ) {
                audioContextRef.current
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
                    console.error(
                      `Failed to decode audio for sentence ${data.sentenceIndex}:`,
                      decodeError
                    );
                  });
              }
            }
          } catch (parseError) {
            console.warn("Failed to parse final buffer:", buffer, parseError);
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
          setMarkers([]);
          setAudioData([]);
        } catch (e) {
          console.error("Failed to prepare audio for Web Audio / download", e);
          setUnifiedAudioUrl(null);
          setUnifiedAudioErrorText("Audio blob could not be played.");
        }
      } else {
        // Legacy JSON format
        const result = await response.json();
        if (result.audioUrl) {
          const url = String(result.audioUrl);
          setUnifiedAudioUrl(url);
          setMarkers(Array.isArray(result.markers) ? result.markers : []);
          setAudioData([]);
          unifiedAudioArrayBufferRef.current = null;
        } else if (Array.isArray(result.audioData)) {
          setAudioData(result.audioData);
        }
      }
    } catch (error) {
      console.error("Failed to generate audio:", error);
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
      console.error("Failed to merge audio buffers:", error);
    }
  };

  // Common function to play audio buffer with adjustable speed
  const playAudioBuffer = async (
    audioBuffer: AudioBuffer,
    options?: {
      rate?: number;
      onEnded?: () => void;
      sentenceIndex?: number;
    }
  ) => {
    if (typeof window === "undefined") return;

    const AnyWindow = window as any;
    const AudioCtx =
      (window as any).AudioContext || AnyWindow.webkitAudioContext;
    if (!AudioCtx) {
      console.error("Web Audio API not supported in this browser");
      return;
    }

    if (
      !audioContextRef.current ||
      audioContextRef.current.state === "closed"
    ) {
      audioContextRef.current = new AudioCtx();
    }

    const ctx = audioContextRef.current;
    if (!ctx) return;

    const rate = options?.rate ?? playbackRate;
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = rate;
    source.connect(ctx.destination);

    if (options?.sentenceIndex !== undefined) {
      audioSourcesRef.current.set(options.sentenceIndex, source);
    } else {
      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.stop();
        } catch {}
        audioSourceRef.current.disconnect();
      }
      audioSourceRef.current = source;
    }

    source.onended = () => {
      if (options?.sentenceIndex !== undefined) {
        audioSourcesRef.current.delete(options.sentenceIndex);
      }
      options?.onEnded?.();
    };

    source.start(0);
  };

  // Play all audio using Web Audio API
  const handlePlayAll = async (rate?: number) => {
    const playRate = rate ?? playbackRate;

    // If we have sentence-level audio buffers, play them sequentially
    if (audioData.length > 0 && audioBuffersRef.current.size > 0) {
      await playAllSentencesWithWebAudio(playRate);
      return;
    }

    // If we have unified audio, use that
    if (unifiedAudioArrayBufferRef.current) {
      await playUnifiedAudio(playRate);
      return;
    }

    // Otherwise, generate audio first
    await handleGenerateAudio();
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (audioData.length > 0 && audioBuffersRef.current.size > 0) {
      await playAllSentencesWithWebAudio(playRate);
    }
  };

  // Play unified audio using Web Audio API
  const playUnifiedAudio = async (rate?: number) => {
    const arrayBuffer = unifiedAudioArrayBufferRef.current;
    if (!arrayBuffer) return;

    try {
      if (
        !audioContextRef.current ||
        audioContextRef.current.state === "closed"
      ) {
        const AnyWindow = window as any;
        const AudioCtx =
          (window as any).AudioContext || AnyWindow.webkitAudioContext;
        audioContextRef.current = new AudioCtx();
      }

      const ctx = audioContextRef.current;
      if (!ctx) return;

      const bufferCopy = arrayBuffer.slice(0);
      const audioBuffer = await ctx.decodeAudioData(bufferCopy);

      setIsPlayingAll(true);
      await playAudioBuffer(audioBuffer, {
        rate: rate ?? playbackRate,
        onEnded: () => {
          setIsPlayingAll(false);
          setCurrentlyReadingIndex(null);
        },
      });
    } catch (e) {
      console.error("Failed to play unified audio via Web Audio API:", e);
      setIsPlayingAll(false);
    }
  };

  // Play all sentences sequentially using Web Audio API
  const playAllSentencesWithWebAudio = async (rate?: number) => {
    if (typeof window === "undefined") return;

    const playRate = rate ?? playbackRate;

    // Stop any currently playing sources
    audioSourcesRef.current.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    });
    audioSourcesRef.current.clear();

    setIsPlayingAll(true);
    setCurrentlyReadingIndex(0);

    const sortedIndices = Array.from(audioBuffersRef.current.keys()).sort(
      (a, b) => a - b
    );

    let currentIndex = 0;

    const playNext = async () => {
      if (currentIndex >= sortedIndices.length) {
        setIsPlayingAll(false);
        setCurrentlyReadingIndex(null);
        return;
      }

      const sentenceIndex = sortedIndices[currentIndex];
      const audioBuffer = audioBuffersRef.current.get(sentenceIndex);

      if (!audioBuffer) {
        currentIndex++;
        playNext();
        return;
      }

      setCurrentlyReadingIndex(sentenceIndex);

      try {
        await playAudioBuffer(audioBuffer, {
          rate: playRate,
          sentenceIndex,
          onEnded: () => {
            currentIndex++;
            playNext();
          },
        });
      } catch (error) {
        console.error(
          `Failed to start playback for sentence ${sentenceIndex}:`,
          error
        );
        currentIndex++;
        playNext();
      }
    };

    playNext();
  };

  // Play browser TTS for a text (uses voiceSuggestions only)
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

      // Parse voice suggestion (legacy) — SSML document is used only on the server
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

      utterance.onerror = (error) => reject(error);

      window.speechSynthesis.speak(utterance);
    });
  };

  // Play single sentence using Web Audio API
  const handlePlaySentence = async (index: number, rate?: number) => {
    // Stop any currently playing audio
    setIsPlayingAll(false);

    // Stop all Web Audio sources
    audioSourcesRef.current.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    });
    audioSourcesRef.current.clear();

    if (typeof window === "undefined") return;

    const playRate = rate ?? playbackRate;

    // If unified MP3 exists with markers, use that
    if (unifiedAudioUrl && markers.length > 0) {
      const mark = markers.find((m) => m.sentenceIndex === index);
      if (!mark) return;

      try {
        if (
          !audioContextRef.current ||
          audioContextRef.current.state === "closed"
        ) {
          const AnyWindow = window as any;
          const AudioCtx =
            (window as any).AudioContext || AnyWindow.webkitAudioContext;
          audioContextRef.current = new AudioCtx();
        }

        const ctx = audioContextRef.current;
        if (!ctx) return;

        const arrayBuffer = unifiedAudioArrayBufferRef.current;
        if (!arrayBuffer) return;

        const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
        const startFrame = Math.floor(
          (mark.start / audioBuffer.duration) * audioBuffer.length
        );
        const endFrame = Math.floor(
          (mark.end / audioBuffer.duration) * audioBuffer.length
        );
        const durationFrames = endFrame - startFrame;

        // Create a buffer for just this sentence
        const sentenceBuffer = ctx.createBuffer(
          audioBuffer.numberOfChannels,
          durationFrames,
          audioBuffer.sampleRate
        );

        for (
          let channel = 0;
          channel < audioBuffer.numberOfChannels;
          channel++
        ) {
          const sourceData = audioBuffer.getChannelData(channel);
          const targetData = sentenceBuffer.getChannelData(channel);
          for (let i = 0; i < durationFrames; i++) {
            targetData[i] = sourceData[startFrame + i];
          }
        }

        setCurrentlyReadingIndex(index);
        await playAudioBuffer(sentenceBuffer, {
          rate: playRate,
          sentenceIndex: index,
          onEnded: () => {
            setCurrentlyReadingIndex(null);
          },
        });
      } catch (error) {
        console.error("Failed to play sentence with unified audio:", error);
        setCurrentlyReadingIndex(null);
      }
      return;
    }

    // Use Web Audio API to play sentence buffer
    const audioBuffer = audioBuffersRef.current.get(index);
    if (!audioBuffer) {
      // Fallback to browser TTS if no audio buffer
      const entry = dialogData?.dialog[index];
      if (entry) {
        try {
          await playBrowserTTS(
            entry.learn_text || entry.use_text,
            learningLanguage,
            entry.character,
            index
          );
        } catch (error) {
          console.error("Failed to play browser TTS:", error);
        }
      }
      return;
    }

    try {
      setCurrentlyReadingIndex(index);
      await playAudioBuffer(audioBuffer, {
        rate: playRate,
        sentenceIndex: index,
        onEnded: () => {
          setCurrentlyReadingIndex(null);
        },
      });
    } catch (error) {
      console.error(`Failed to play sentence ${index}:`, error);
      setCurrentlyReadingIndex(null);
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
      {unifiedAudioErrorText && (
        <div className="mx-4 my-2 rounded border border-red-300 bg-red-50 p-3 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          <div className="text-xs font-mono whitespace-pre-wrap break-words">
            {unifiedAudioErrorText}
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
                    console.error("Failed to trigger download", e);
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
                  audioSourcesRef.current.forEach((source) => {
                    try {
                      source.stop();
                      source.disconnect();
                    } catch {}
                  });
                  audioSourcesRef.current.clear();
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
              onClick={() => handlePlayAll(playbackRate)}
              disabled={isGeneratingAudio}
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
                  audioSourcesRef.current.forEach((source) => {
                    try {
                      source.stop();
                      source.disconnect();
                    } catch {}
                  });
                  audioSourcesRef.current.clear();
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
              onClick={() => handlePlayAll(playbackRate)}
              disabled={isGeneratingAudio}
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
