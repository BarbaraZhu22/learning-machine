/**
 * SSML-like configuration generator for browser TTS
 * Parses voice suggestions and generates configuration for SpeechSynthesisUtterance
 */

export interface SSMLConfig {
  voice?: {
    name?: string;
    gender?: 'male' | 'female' | 'neutral';
    age?: 'child' | 'young' | 'adult' | 'elderly';
    accent?: string;
    language?: string;
  };
  prosody?: {
    rate?: number; // 0.1 to 10 (default: 1)
    pitch?: number; // -2 to 2 (default: 0)
    volume?: number; // 0 to 1 (default: 1)
  };
  emphasis?: 'strong' | 'moderate' | 'reduced';
  break?: {
    time?: string; // e.g., "500ms"
    strength?: 'none' | 'x-weak' | 'weak' | 'medium' | 'strong' | 'x-strong';
  };
}

/**
 * Parse voice suggestion text into SSML-like configuration
 */
export function parseVoiceSuggestionToSSML(
  voiceSuggestion: string,
  language?: string
): SSMLConfig {
  const config: SSMLConfig = {};
  const suggestion = voiceSuggestion.toLowerCase();

  // Parse gender
  if (suggestion.includes('male') || suggestion.includes('man')) {
    config.voice = { ...config.voice, gender: 'male' };
  } else if (
    suggestion.includes('female') ||
    suggestion.includes('woman') ||
    suggestion.includes('girl')
  ) {
    config.voice = { ...config.voice, gender: 'female' };
  }

  // Parse age
  if (suggestion.includes('child') || suggestion.includes('kid')) {
    config.voice = { ...config.voice, age: 'child' };
  } else if (
    suggestion.includes('young') ||
    suggestion.includes('teen') ||
    suggestion.includes('youth')
  ) {
    config.voice = { ...config.voice, age: 'young' };
  } else if (
    suggestion.includes('elderly') ||
    suggestion.includes('old') ||
    suggestion.includes('senior')
  ) {
    config.voice = { ...config.voice, age: 'elderly' };
  } else {
    config.voice = { ...config.voice, age: 'adult' };
  }

  // Parse voice characteristics for prosody
  if (suggestion.includes('deep') || suggestion.includes('low')) {
    config.prosody = { ...config.prosody, pitch: -0.5 };
  } else if (suggestion.includes('high') || suggestion.includes('squeaky')) {
    config.prosody = { ...config.prosody, pitch: 0.5 };
  }

  if (suggestion.includes('slow') || suggestion.includes('calm')) {
    config.prosody = { ...config.prosody, rate: 0.8 };
  } else if (suggestion.includes('fast') || suggestion.includes('quick')) {
    config.prosody = { ...config.prosody, rate: 1.2 };
  }

  if (suggestion.includes('loud') || suggestion.includes('strong')) {
    config.prosody = { ...config.prosody, volume: 0.9 };
  } else if (suggestion.includes('soft') || suggestion.includes('quiet')) {
    config.prosody = { ...config.prosody, volume: 0.6 };
  }

  // Parse emphasis
  if (suggestion.includes('emphatic') || suggestion.includes('strong')) {
    config.emphasis = 'strong';
  } else if (suggestion.includes('gentle') || suggestion.includes('soft')) {
    config.emphasis = 'reduced';
  }

  // Set language
  if (language) {
    config.voice = { ...config.voice, language };
  }

  return config;
}

/**
 * Apply SSML config to SpeechSynthesisUtterance
 */
export function applySSMLToUtterance(
  utterance: SpeechSynthesisUtterance,
  config: SSMLConfig,
  availableVoices: SpeechSynthesisVoice[]
): void {
  // Apply voice selection
  if (config.voice) {
    const { gender, age, language } = config.voice;

    // Find matching voice
    let selectedVoice: SpeechSynthesisVoice | undefined;

    if (gender) {
      selectedVoice = availableVoices.find((v) => {
        const vName = v.name.toLowerCase();
        const vLang = language ? v.lang.toLowerCase() : '';

        // Match gender
        const genderMatch =
          (gender === 'male' &&
            (vName.includes('male') ||
              vName.includes('man') ||
              vName.includes('david') ||
              vName.includes('james'))) ||
          (gender === 'female' &&
            (vName.includes('female') ||
              vName.includes('woman') ||
              vName.includes('samantha') ||
              vName.includes('karen') ||
              vName.includes('susan')));

        // Match age if specified
        const ageMatch =
          !age ||
          (age === 'child' && vName.includes('child')) ||
          (age === 'young' && (vName.includes('young') || vName.includes('teen'))) ||
          (age === 'elderly' && (vName.includes('elderly') || vName.includes('old')));

        // Match language if specified
        const langMatch = !language || vLang.startsWith(language.toLowerCase());

        return genderMatch && ageMatch && langMatch;
      });
    }

    // Fallback: match by language only
    if (!selectedVoice && language) {
      selectedVoice = availableVoices.find((v) =>
        v.lang.toLowerCase().startsWith(language.toLowerCase())
      );
    }

    // Fallback: use default voice for language
    if (!selectedVoice && language) {
      selectedVoice = availableVoices.find(
        (v) => v.default && v.lang.toLowerCase().startsWith(language.toLowerCase())
      );
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
  }

  // Apply prosody (rate, pitch, volume)
  if (config.prosody) {
    if (config.prosody.rate !== undefined) {
      utterance.rate = Math.max(0.1, Math.min(10, config.prosody.rate));
    }
    if (config.prosody.pitch !== undefined) {
      utterance.pitch = Math.max(-2, Math.min(2, config.prosody.pitch));
    }
    if (config.prosody.volume !== undefined) {
      utterance.volume = Math.max(0, Math.min(1, config.prosody.volume));
    }
  }

  // Note: Emphasis and break are not directly supported by Web Speech API
  // But we can simulate emphasis with pitch/rate adjustments
  if (config.emphasis === 'strong') {
    utterance.rate = (utterance.rate || 1) * 0.95; // Slightly slower for emphasis
    utterance.pitch = (utterance.pitch || 0) + 0.2; // Slightly higher pitch
  } else if (config.emphasis === 'reduced') {
    utterance.rate = (utterance.rate || 1) * 1.05; // Slightly faster
    utterance.pitch = (utterance.pitch || 0) - 0.1; // Slightly lower pitch
  }
}

/**
 * Generate SSML-like configuration from voice suggestion and apply to utterance
 */
export function configureUtteranceFromVoiceSuggestion(
  utterance: SpeechSynthesisUtterance,
  voiceSuggestion: string | undefined,
  language?: string,
  availableVoices: SpeechSynthesisVoice[] = []
): void {
  if (!voiceSuggestion) {
    // Just set language if provided
    if (language) {
      utterance.lang = language;
      const langVoice = availableVoices.find((v) =>
        v.lang.toLowerCase().startsWith(language.toLowerCase())
      );
      if (langVoice) {
        utterance.voice = langVoice;
      }
    }
    return;
  }

  // Parse voice suggestion to SSML config
  const ssmlConfig = parseVoiceSuggestionToSSML(voiceSuggestion, language);

  // Apply SSML config to utterance
  applySSMLToUtterance(utterance, ssmlConfig, availableVoices);
}

