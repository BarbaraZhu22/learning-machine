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
  sentences: Array<{
    text: string;
    character: string;
    voiceSuggestion?: string;
  }>;
  learningLanguage?: string;
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as AudioGenerationRequest;
    const {
      sentences,
      learningLanguage,
      provider,
      apiUrl,
      model,
      aiProvider,
    } = body;

    if (!sentences || !Array.isArray(sentences) || sentences.length === 0) {
      return NextResponse.json(
        { error: 'Sentences array is required' },
        { status: 400 }
      );
    }

    // Get API key from cookie
    const apiKey = request.cookies.get(COOKIE_NAME)?.value;

    // Determine audio provider
    let audioProvider: 'openai' | 'browser' = 'browser';
    let finalApiKey = apiKey;

    // If user explicitly requested a provider, use it
    if (provider) {
      if (provider === 'browser') {
        audioProvider = 'browser';
      } else if (provider === 'openai' && apiKey) {
        audioProvider = 'openai';
        finalApiKey = apiKey;
      } else {
        // Requested provider but no API key - fallback to browser
        audioProvider = 'browser';
      }
    } else {
      // Auto-detect: if user's AI config is OpenAI and has API key, use it
      if (aiProvider === 'openai' && apiKey) {
        audioProvider = 'openai';
        finalApiKey = apiKey;
      } else {
        // Otherwise, use browser TTS (no API key needed)
        audioProvider = 'browser';
      }
    }

    // Browser TTS is handled client-side, so return a special response
    // Include voice suggestions for backward compatibility
    if (audioProvider === 'browser') {
      return NextResponse.json({
        audioData: sentences.map((sentence, index) => ({
          sentenceIndex: index,
          audioUrl: `browser-tts:${sentence.text}`, // Special marker
          voiceSuggestion: sentence.voiceSuggestion, // For legacy support
        })),
        provider: 'browser',
      });
    }

    // Server-side TTS (OpenAI, etc.) requires API key
    if (!finalApiKey) {
      return NextResponse.json(
        {
          error: 'API_KEY_MISSING',
          message:
            'API key not configured. Falling back to browser TTS. Please configure your OpenAI API key in AI Settings to use server-side TTS.',
          fallback: 'browser',
        },
        { status: 401 }
      );
    }

    // Configure audio generation for server-side TTS
    const audioConfig: AudioNodeConfig = {
      provider: audioProvider,
      apiKey: finalApiKey,
      apiUrl,
      model,
    };

    // Generate audio for all sentences
    const audioData = await generateAudioForSentences(
      sentences,
      audioConfig,
      learningLanguage
    );

    return NextResponse.json({ audioData, provider: audioProvider });
  } catch (error) {
    console.error('Audio generation error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        fallback: 'browser', // Suggest browser fallback on error
      },
      { status: 500 }
    );
  }
}

