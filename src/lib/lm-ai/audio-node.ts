/**
 * Audio Node implementations
 * Handles TTS API calls with different providers
 */

export type AudioProvider = 'openai' | 'elevenlabs' | 'custom' | 'browser';

export interface AudioNodeConfig {
  provider?: AudioProvider;
  apiKey?: string;
  apiUrl?: string;
  voice?: string;
  model?: string;
}

export interface AudioGenerationRequest {
  text: string;
  voice?: string;
  language?: string;
}

export interface AudioGenerationResponse {
  audioUrl: string; // Base64 data URL or blob URL
  format: 'mp3' | 'wav' | 'ogg';
}

/**
 * Split text into sentences
 */
export function splitIntoSentences(text: string): string[] {
  // Simple sentence splitting - can be improved
  return text
    .split(/([.!?]+[\s\n]+)/)
    .filter((s) => s.trim().length > 0)
    .reduce((acc: string[], curr, idx, arr) => {
      if (idx % 2 === 0) {
        const next = arr[idx + 1] || '';
        acc.push((curr + next).trim());
      }
      return acc;
    }, [])
    .filter((s) => s.length > 0);
}

/**
 * Map voice suggestion to provider-specific voice
 */
export function mapVoiceSuggestion(
  voiceSuggestion: string | undefined,
  provider: AudioProvider = 'openai'
): string {
  if (!voiceSuggestion) {
    return provider === 'openai' ? 'alloy' : 'default';
  }

  const suggestion = voiceSuggestion.toLowerCase();

  if (provider === 'openai') {
    // Map common voice descriptions to OpenAI voices
    if (
      suggestion.includes('male') ||
      suggestion.includes('man') ||
      suggestion.includes('deep')
    ) {
      return 'onyx';
    }
    if (
      suggestion.includes('female') ||
      suggestion.includes('woman') ||
      suggestion.includes('soft')
    ) {
      return 'nova';
    }
    if (suggestion.includes('young') || suggestion.includes('child')) {
      return 'echo';
    }
    if (suggestion.includes('narrator') || suggestion.includes('story')) {
      return 'fable';
    }
    return 'alloy'; // default
  }

  // For other providers, return default or pass through
  return 'default';
}

/**
 * Generate audio using OpenAI TTS
 */
export async function generateAudioWithOpenAI(
  request: AudioGenerationRequest,
  config: AudioNodeConfig
): Promise<AudioGenerationResponse> {
  const { text, voice: requestedVoice, language } = request;
  const apiKey = config.apiKey;
  const voice = requestedVoice || mapVoiceSuggestion(undefined, 'openai');

  if (!apiKey) {
    throw new Error('API key is required for OpenAI TTS');
  }

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model || 'tts-1',
      input: text,
      voice: voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
      ...(language && { language }),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Sanitize error message to remove any potential API key exposure
    let sanitizedError = errorText;
    if (apiKey) {
      sanitizedError = sanitizedError.replace(
        new RegExp(apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
        '[API_KEY_HIDDEN]'
      );
      sanitizedError = sanitizedError.replace(
        /sk-[a-zA-Z0-9]{20,}/g,
        '[API_KEY_HIDDEN]'
      );
    }
    throw new Error(`OpenAI TTS error: ${response.status} ${sanitizedError}`);
  }

  const audioBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(audioBuffer).toString('base64');
  const audioUrl = `data:audio/mpeg;base64,${base64}`;

  return {
    audioUrl,
    format: 'mp3',
  };
}

/**
 * Generate audio using ElevenLabs TTS
 */
export async function generateAudioWithElevenLabs(
  request: AudioGenerationRequest,
  config: AudioNodeConfig
): Promise<AudioGenerationResponse> {
  const { text, voice: requestedVoice } = request;
  const apiKey = config.apiKey;
  const voiceId = requestedVoice || config.voice || 'default';

  if (!apiKey) {
    throw new Error('API key is required for ElevenLabs TTS');
  }

  const apiUrl = config.apiUrl || 'https://api.elevenlabs.io/v1';
  const response = await fetch(`${apiUrl}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: config.model || 'eleven_monolingual_v1',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Sanitize error message
    let sanitizedError = errorText;
    if (apiKey) {
      sanitizedError = sanitizedError.replace(
        new RegExp(apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
        '[API_KEY_HIDDEN]'
      );
    }
    throw new Error(`ElevenLabs TTS error: ${response.status} ${sanitizedError}`);
  }

  const audioBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(audioBuffer).toString('base64');
  const audioUrl = `data:audio/mpeg;base64,${base64}`;

  return {
    audioUrl,
    format: 'mp3',
  };
}

/**
 * Generate audio using custom TTS API
 */
export async function generateAudioWithCustom(
  request: AudioGenerationRequest,
  config: AudioNodeConfig
): Promise<AudioGenerationResponse> {
  const { text, voice: requestedVoice } = request;
  const apiUrl = config.apiUrl;

  if (!apiUrl) {
    throw new Error('API URL is required for custom TTS');
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey && { Authorization: `Bearer ${config.apiKey}` }),
    },
    body: JSON.stringify({
      text,
      voice: requestedVoice || config.voice,
      model: config.model,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Sanitize error message
    let sanitizedError = errorText;
    if (config.apiKey) {
      sanitizedError = sanitizedError.replace(
        new RegExp(config.apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
        '[API_KEY_HIDDEN]'
      );
    }
    throw new Error(`Custom TTS error: ${response.status} ${sanitizedError}`);
  }

  // Assume custom API returns audio in response body
  const audioBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(audioBuffer).toString('base64');
  const audioUrl = `data:audio/mpeg;base64,${base64}`;

  return {
    audioUrl,
    format: 'mp3',
  };
}

/**
 * Generate audio using browser Web Speech API (client-side only)
 * This is a fallback that doesn't require any API key
 * Note: This function should be called from the client side, not server
 */
export function generateAudioWithBrowser(
  request: AudioGenerationRequest,
  config: AudioNodeConfig
): Promise<AudioGenerationResponse> {
  return new Promise((resolve, reject) => {
    // Check if browser supports SpeechSynthesis
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      reject(new Error('Browser Speech Synthesis API is not supported'));
      return;
    }

    const { text, language } = request;
    const utterance = new SpeechSynthesisUtterance(text);

    // Set language if provided
    if (language) {
      utterance.lang = language;
    }

    // Map voice suggestion to browser voice
    const voiceSuggestion = config.voice;
    if (voiceSuggestion && window.speechSynthesis.getVoices().length > 0) {
      const voices = window.speechSynthesis.getVoices();
      const suggestion = voiceSuggestion.toLowerCase();

      // Try to find a matching voice
      let selectedVoice = voices.find((v) => {
        const vName = v.name.toLowerCase();
        const vLang = v.lang.toLowerCase();

        if (suggestion.includes('male') || suggestion.includes('man')) {
          return vName.includes('male') || vName.includes('man');
        }
        if (suggestion.includes('female') || suggestion.includes('woman')) {
          return vName.includes('female') || vName.includes('woman');
        }
        return false;
      });

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      } else if (language) {
        // Fallback to a voice matching the language
        const langVoice = voices.find((v) => v.lang.startsWith(language));
        if (langVoice) {
          utterance.voice = langVoice;
        }
      }
    }

    // For browser TTS, we don't actually generate audio files
    // Instead, we return a special marker that tells the client to use browser TTS
    // The actual playback will be handled on the client side
    resolve({
      audioUrl: `browser-tts:${text}`, // Special marker for browser TTS
      format: 'wav', // Browser TTS format
    });
  });
}

/**
 * Generate audio based on provider
 */
export async function generateAudio(
  request: AudioGenerationRequest,
  config: AudioNodeConfig
): Promise<AudioGenerationResponse> {
  const provider = config.provider || 'openai';

  switch (provider) {
    case 'openai':
      return generateAudioWithOpenAI(request, config);
    case 'elevenlabs':
      return generateAudioWithElevenLabs(request, config);
    case 'custom':
      return generateAudioWithCustom(request, config);
    case 'browser':
      return generateAudioWithBrowser(request, config);
    default:
      throw new Error(`Unsupported audio provider: ${provider}`);
  }
}

/**
 * Generate audio for multiple sentences
 */
export async function generateAudioForSentences(
  sentences: Array<{
    text: string;
    character: string;
    voiceSuggestion?: string;
  }>,
  config: AudioNodeConfig,
  learningLanguage?: string
): Promise<Array<{ sentenceIndex: number; audioUrl: string }>> {
  const audioData: Array<{ sentenceIndex: number; audioUrl: string }> = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceList = splitIntoSentences(sentence.text);

    // Generate audio for each sentence chunk
    for (let j = 0; j < sentenceList.length; j++) {
      const sentenceText = sentenceList[j];
      if (!sentenceText.trim()) continue;

      try {
        const voice = mapVoiceSuggestion(
          sentence.voiceSuggestion,
          config.provider || 'openai'
        );
        const audioResponse = await generateAudio(
          {
            text: sentenceText,
            voice,
            language: learningLanguage,
          },
          { ...config, voice }
        );

        audioData.push({
          sentenceIndex: i,
          audioUrl: audioResponse.audioUrl,
        });
      } catch (error) {
        console.error(`Failed to generate audio for sentence ${i}:`, error);
        // Continue with other sentences even if one fails
      }
    }
  }

  return audioData;
}

