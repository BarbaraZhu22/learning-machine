/**
 * Audio Generation API
 * Generates audio from text using TTS, chunked by sentences
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateAudioForSentences,
  type AudioNodeConfig,
} from '@/lib/lm-ai/audio-node';
import type { LLMProvider } from '@/types';

const COOKIE_NAME = 'ai-api-key';

interface AudioGenerationRequest {
  dialogContent: {
    characters: string[];
    dialog: Array<{
      character: string;
      use_text: string;
      learn_text: string;
    }>;
  };
  voiceSuggestions?: Record<string, string>; // character -> voice description
  learningLanguage?: string;
  ssmlConfig?: {
    characters: Record<string, {
      voice?: {
        gender?: 'male' | 'female' | 'neutral';
        age?: 'child' | 'young' | 'adult' | 'elderly';
        accent?: string;
      };
    }>;
    sentences: Array<{
      index: number;
      character: string;
      prosody?: {
        rate?: number;
        pitch?: number;
        volume?: number;
      };
      emphasis?: 'strong' | 'moderate' | 'reduced';
      break?: {
        time?: number;
        strength?: 'none' | 'x-weak' | 'weak' | 'medium' | 'strong' | 'x-strong';
      };
    }>;
  };
  provider?: 'openai' | 'elevenlabs' | 'custom' | 'browser';
  apiUrl?: string;
  model?: string;
  aiProvider?: LLMProvider; // User's AI config provider
}

interface AudioGenerationResponse {
  audioData: Array<{
    sentenceIndex: number;
    audioUrl: string; // Base64 data URL
  }>;
}

/**
 * Check if AI provider can output audio directly
 */
function canProviderOutputAudio(provider?: LLMProvider): boolean {
  return provider === 'openai'; // Only OpenAI TTS for now
}

/**
 * Generate SSML config using AI
 */
async function generateSSMLConfig(
  dialogContent: AudioGenerationRequest['dialogContent'],
  voiceSuggestions: Record<string, string> | undefined,
  learningLanguage: string | undefined,
  aiProvider: LLMProvider | undefined,
  apiKey: string | undefined,
  request: NextRequest
): Promise<AudioGenerationRequest['ssmlConfig']> {
  if (!apiKey || !aiProvider) {
    throw new Error('API key and provider required for SSML generation');
  }

  // Call LLM to generate SSML config
  const { prepareMessages, parseResponse } = await import('@/lib/lm-ai/llm-node');

  const systemPrompt =
    'You are a language learning assistant. Analyze dialog content and generate SSML-like voice configuration. For each character, assign a consistent base voice based on voice suggestions. For each sentence, analyze the content, emotion, and context to determine appropriate prosody (rate, pitch, volume), emphasis, and break times.';

  const userPrompt = `Analyze this dialog and generate SSML-like voice configuration:

Dialog:
${JSON.stringify(dialogContent, null, 2)}

${voiceSuggestions ? `Voice Suggestions (natural language descriptions):
${JSON.stringify(voiceSuggestions, null, 2)}` : ''}

Learning Language: ${learningLanguage || 'unknown'}

Generate SSML configuration with:
1. Base voice for each character (same voice for all their sentences)
   - Extract gender, age from voice suggestions (e.g., "lively man" = male, adult)
   - Use learning language for voice language
2. Per-sentence prosody variations based on content, emotion, and context
3. Break times between sentences for natural pacing

Return JSON format:
{
  "characters": {
    "characterName": {
      "voice": {
        "gender": "male" | "female" | "neutral",
        "age": "child" | "young" | "adult" | "elderly"
      }
    }
  },
  "sentences": [
    {
      "index": 0,
      "character": "characterName",
      "prosody": {
        "rate": 0.5-2.0,
        "pitch": -1.0 to 1.0,
        "volume": 0.0 to 1.0
      },
      "emphasis": "strong" | "moderate" | "reduced",
      "break": {
        "time": 0-2000
      }
    }
  ]
}`;

  const messages = await prepareMessages(
    dialogContent,
    userPrompt,
    systemPrompt,
    'json',
    undefined,
    { learningLanguage, userLanguage: 'en' }
  );

  // Call LLM API directly (server-side)
  const { callLLMAPI } = await import('@/app/api/llm/route');
  
  const response = await callLLMAPI({
    provider: aiProvider,
    apiKey,
    messages,
    responseFormat: 'json',
  });

  const output = await parseResponse(response, 'json');
  return output as AudioGenerationRequest['ssmlConfig'];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as AudioGenerationRequest;
    const {
      dialogContent,
      voiceSuggestions,
      learningLanguage,
      ssmlConfig,
      provider,
      apiUrl,
      model,
      aiProvider,
    } = body;

    if (!dialogContent || !dialogContent.dialog || dialogContent.dialog.length === 0) {
      return NextResponse.json(
        { error: 'Dialog content is required' },
        { status: 400 }
      );
    }

    // Get API key from cookie
    const apiKey = request.cookies.get(COOKIE_NAME)?.value;

    // Check if AI provider can output audio directly
    const canOutputAudio = canProviderOutputAudio(aiProvider);

    if (canOutputAudio && apiKey) {
      // Provider can output audio (e.g., OpenAI) - generate audio directly
      const sentences = dialogContent.dialog.map((entry) => ({
        text: entry.learn_text,
        character: entry.character,
        voiceSuggestion: voiceSuggestions?.[entry.character],
      }));

      const audioConfig: AudioNodeConfig = {
        provider: 'openai',
        apiKey,
        apiUrl,
        model,
      };

      const audioData = await generateAudioForSentences(
        sentences,
        audioConfig,
        learningLanguage
      );

      return NextResponse.json({ audioData, provider: 'openai' });
    }

    // Provider cannot output audio (e.g., DeepSeek) - use SSML + browser TTS
    let finalSSMLConfig = ssmlConfig;

    // If no SSML config, generate it using AI
    if (!finalSSMLConfig && apiKey && aiProvider) {
      try {
        finalSSMLConfig = await generateSSMLConfig(
          dialogContent,
          voiceSuggestions,
          learningLanguage,
          aiProvider,
          apiKey,
          request
        );
      } catch (error) {
        console.error('Failed to generate SSML config:', error);
        // Continue with browser TTS without SSML
      }
    }

    // Return browser TTS response with SSML config
    return NextResponse.json({
      audioData: dialogContent.dialog.map((entry, index) => ({
        sentenceIndex: index,
        audioUrl: `browser-tts:${entry.learn_text}`,
        character: entry.character,
      })),
      provider: 'browser',
      ssmlConfig: finalSSMLConfig, // Return SSML config to store
    });
  } catch (error) {
    console.error('Audio generation error:', error);
    let errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Sanitize error message to remove any potential API key exposure
    const apiKey = request.cookies.get(COOKIE_NAME)?.value;
    if (apiKey) {
      errorMessage = errorMessage.replace(
        new RegExp(apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
        '[API_KEY_HIDDEN]'
      );
      errorMessage = errorMessage.replace(
        /sk-[a-zA-Z0-9]{20,}/g,
        '[API_KEY_HIDDEN]'
      );
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
        fallback: 'browser',
      },
      { status: 500 }
    );
  }
}

