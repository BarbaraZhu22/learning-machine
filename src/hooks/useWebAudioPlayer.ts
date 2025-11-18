import { useRef, useCallback, useMemo } from "react";

// Extend Window interface to include webkitAudioContext for Safari compatibility
interface WindowWithAudioContext extends Window {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

interface PlayAudioBufferOptions {
  rate?: number;
  onEnded?: () => void;
  sentenceIndex?: number;
}

interface UseWebAudioPlayerOptions {
  playbackRate: number;
  onPlayingStateChange?: (isPlaying: boolean) => void;
  onCurrentIndexChange?: (index: number | null) => void;
}

interface UseWebAudioPlayerReturn {
  playAudioBuffer: (
    audioBuffer: AudioBuffer,
    options?: PlayAudioBufferOptions
  ) => Promise<void>;
  playUnifiedAudio: (arrayBuffer: ArrayBuffer, rate?: number) => Promise<void>;
  playAllSentences: (
    audioBuffers: Map<number, AudioBuffer>,
    rate?: number
  ) => Promise<void>;
  playSentence: (
    index: number,
    audioBuffer: AudioBuffer,
    rate?: number
  ) => Promise<void>;
  stopAll: () => void;
  getAudioContext: () => AudioContext | null;
  getOrCreateAudioContext: () => AudioContext | null;
}

/**
 * Hook for managing Web Audio API playback
 * Handles audio context, buffer playback, and sequential sentence playback
 */
export function useWebAudioPlayer({
  playbackRate,
  onPlayingStateChange,
  onCurrentIndexChange,
}: UseWebAudioPlayerOptions): UseWebAudioPlayerReturn {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioSourcesRef = useRef<Map<number, AudioBufferSourceNode>>(new Map());

  // Get or create audio context
  const getOrCreateAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;

    const win = window as WindowWithAudioContext;
    const AudioCtx = win.AudioContext || win.webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }

    if (
      !audioContextRef.current ||
      (audioContextRef.current.state as string) === "closed"
    ) {
      audioContextRef.current = new AudioCtx();
    }

    return audioContextRef.current;
  }, []);

  // Stop all audio sources
  const stopAll = useCallback(() => {
    // Stop Web Audio API sources
    audioSourcesRef.current.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // ignore stop errors
      }
    });
    audioSourcesRef.current.clear();

    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
      } catch {
        // ignore stop errors
      }
      audioSourceRef.current = null;
    }
  }, []);

  // Play a single audio buffer
  const playAudioBuffer = useCallback(
    async (
      audioBuffer: AudioBuffer,
      options?: PlayAudioBufferOptions
    ): Promise<void> => {
      const ctx = getOrCreateAudioContext();
      if (!ctx) {
        return;
      }

      // Resume AudioContext if suspended (required for autoplay policies)
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
          // Wait a bit to ensure context is fully resumed
          await new Promise((resolve) => setTimeout(resolve, 10));
        } catch {
          // Continue anyway - might work in some browsers
        }
      }

      // Verify context is in a valid state
      // Note: TypeScript types don't include "closed" but it can happen in practice
      if ((ctx.state as string) === "closed") {
        return;
      }

      // Ensure context is running before playback
      if (ctx.state !== "running") {
        // Try to resume one more time
        try {
          if (ctx.state === "suspended") {
            await ctx.resume();
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        } catch {
          // Ignore errors
        }
      }

      const rate = options?.rate ?? playbackRate;
      const source = ctx.createBufferSource();

      // Verify audio buffer is valid
      if (!audioBuffer || audioBuffer.length === 0) {
        return;
      }

      // Check if buffer has actual duration
      if (audioBuffer.duration === 0 || isNaN(audioBuffer.duration)) {
        return;
      }

      // Verify buffer has actual audio data (not just silence)
      // Check multiple points in the buffer, not just the beginning
      try {
        const channelData = audioBuffer.getChannelData(0);
        const sampleCount = channelData.length;
        let maxAmplitude = 0;
        let checkedSamples = 0;

        // Check samples at beginning, middle, and end
        const checkPoints = [
          0,
          Math.floor(sampleCount * 0.25),
          Math.floor(sampleCount * 0.5),
          Math.floor(sampleCount * 0.75),
          sampleCount - 1,
        ].filter((idx) => idx >= 0 && idx < sampleCount);

        for (const idx of checkPoints) {
          const amplitude = Math.abs(channelData[idx]);
          maxAmplitude = Math.max(maxAmplitude, amplitude);
          checkedSamples++;
        }

        // Also check a small range around each point
        for (const startIdx of checkPoints.slice(0, 3)) {
          const rangeEnd = Math.min(startIdx + 100, sampleCount);
          for (let i = startIdx; i < rangeEnd; i++) {
            const amplitude = Math.abs(channelData[i]);
            maxAmplitude = Math.max(maxAmplitude, amplitude);
          }
        }

        // Don't block playback - let it try anyway
      } catch {
        // Ignore verification errors
      }

      // Set buffer and playback rate BEFORE connecting
      source.buffer = audioBuffer;
      source.playbackRate.value = rate;

      // Connect directly to destination (original working approach)
      try {
        source.connect(ctx.destination);

        // Verify connection
        if (source.numberOfOutputs === 0) {
          return;
        }
      } catch {
        return;
      }

      // Store source reference BEFORE starting (important for cleanup)
      if (options?.sentenceIndex !== undefined) {
        audioSourcesRef.current.set(options.sentenceIndex, source);
      } else {
        // Stop and disconnect previous source if exists
        if (audioSourceRef.current) {
          try {
            audioSourceRef.current.stop();
          } catch {
            // ignore - might already be stopped
          }
          try {
            audioSourceRef.current.disconnect();
          } catch {
            // ignore - might already be disconnected
          }
        }
        audioSourceRef.current = source;
      }

      // Add error handler for source
      let playbackStarted = false;
      let playbackEnded = false;

      source.onended = () => {
        playbackEnded = true;
        if (options?.sentenceIndex !== undefined) {
          audioSourcesRef.current.delete(options.sentenceIndex);
        } else {
          audioSourceRef.current = null;
        }
        options?.onEnded?.();
      };

      // Verify everything is ready before starting
      if (!source.buffer) {
        return;
      }

      // CRITICAL: Check context state right before starting
      // Note: TypeScript types don't include "closed" but it can happen in practice
      if ((ctx.state as string) === "closed") {
        // Try to create a new context
        const newCtx = getOrCreateAudioContext();
        if (!newCtx || (newCtx.state as string) === "closed") {
          return;
        }
        // Reconnect source to new context (but we can't do this - source is tied to old context)
        // Instead, we need to recreate everything
        return;
      }

      // Double-check context is running
      if (ctx.state !== "running" && ctx.state !== "suspended") {
        return;
      }

      // Start playback
      try {
        // Use currentTime to ensure proper timing
        const startTime = ctx.currentTime;

        source.start(startTime);
        playbackStarted = true;
      } catch (error) {
        // Try to clean up
        try {
          source.disconnect();
        } catch {
          // ignore
        }
        // Remove from refs
        if (options?.sentenceIndex !== undefined) {
          audioSourcesRef.current.delete(options.sentenceIndex);
        } else {
          audioSourceRef.current = null;
        }
        throw error;
      }
    },
    [playbackRate, getOrCreateAudioContext]
  );

  // Play unified audio (single ArrayBuffer)
  const playUnifiedAudio = useCallback(
    async (arrayBuffer: ArrayBuffer, rate?: number): Promise<void> => {
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        return;
      }

      const ctx = getOrCreateAudioContext();
      if (!ctx) {
        return;
      }

      // Resume AudioContext if suspended
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
          await new Promise((resolve) => setTimeout(resolve, 10));
        } catch {
          // Ignore errors
        }
      }

      try {
        // Create a copy of the buffer to avoid issues
        const bufferCopy = arrayBuffer.slice(0);

        // Decode audio data
        const audioBuffer = await ctx.decodeAudioData(bufferCopy);

        // Always try to play - the buffer might have audio even if verification is uncertain
        onPlayingStateChange?.(true);
        await playAudioBuffer(audioBuffer, {
          rate: rate ?? playbackRate,
          onEnded: () => {
            onPlayingStateChange?.(false);
            onCurrentIndexChange?.(null);
          },
        });
      } catch (e) {
        onPlayingStateChange?.(false);
        throw e;
      }
    },
    [
      playbackRate,
      getOrCreateAudioContext,
      playAudioBuffer,
      onPlayingStateChange,
      onCurrentIndexChange,
    ]
  );

  // Play all sentences sequentially
  const playAllSentences = useCallback(
    async (
      audioBuffers: Map<number, AudioBuffer>,
      rate?: number
    ): Promise<void> => {
      if (typeof window === "undefined") return;

      const playRate = rate ?? playbackRate;

      // Stop any currently playing sources
      stopAll();

      onPlayingStateChange?.(true);
      onCurrentIndexChange?.(0);

      const sortedIndices = Array.from(audioBuffers.keys()).sort(
        (a, b) => a - b
      );

      let currentIndex = 0;

      const playNext = async () => {
        if (currentIndex >= sortedIndices.length) {
          onPlayingStateChange?.(false);
          onCurrentIndexChange?.(null);
          return;
        }

        const sentenceIndex = sortedIndices[currentIndex];
        const audioBuffer = audioBuffers.get(sentenceIndex);

        if (!audioBuffer) {
          currentIndex++;
          playNext();
          return;
        }

        onCurrentIndexChange?.(sentenceIndex);

        try {
          await playAudioBuffer(audioBuffer, {
            rate: playRate,
            sentenceIndex,
            onEnded: () => {
              currentIndex++;
              playNext();
            },
          });
        } catch {
          currentIndex++;
          playNext();
        }
      };

      playNext();
    },
    [
      playbackRate,
      stopAll,
      playAudioBuffer,
      onPlayingStateChange,
      onCurrentIndexChange,
    ]
  );

  // Play a single sentence
  const playSentence = useCallback(
    async (
      index: number,
      audioBuffer: AudioBuffer,
      rate?: number
    ): Promise<void> => {
      if (typeof window === "undefined") return;

      // Stop all currently playing audio
      stopAll();
      onPlayingStateChange?.(false);

      const playRate = rate ?? playbackRate;

      try {
        onCurrentIndexChange?.(index);
        await playAudioBuffer(audioBuffer, {
          rate: playRate,
          sentenceIndex: index,
          onEnded: () => {
            onCurrentIndexChange?.(null);
          },
        });
      } catch {
        onCurrentIndexChange?.(null);
      }
    },
    [
      playbackRate,
      stopAll,
      playAudioBuffer,
      onPlayingStateChange,
      onCurrentIndexChange,
    ]
  );

  // Get current audio context (for cleanup)
  const getAudioContext = useCallback(() => {
    return audioContextRef.current;
  }, []);

  // Memoize the return object to prevent unnecessary recreations
  return useMemo(
    () => ({
      playAudioBuffer,
      playUnifiedAudio,
      playAllSentences,
      playSentence,
      stopAll,
      getAudioContext,
      getOrCreateAudioContext,
    }),
    [
      playAudioBuffer,
      playUnifiedAudio,
      playAllSentences,
      playSentence,
      stopAll,
      getAudioContext,
      getOrCreateAudioContext,
    ]
  );
}
