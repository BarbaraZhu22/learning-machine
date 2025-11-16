/**
 * Unified Audio Generation API
 * Uses voice selection via LLM node instead of SSML
 */
import { NextRequest, NextResponse } from "next/server";
import type { LLMProvider, LearningLanguageCode } from "@/types";
import { synthesizeTTS } from "@/lib/lm-ai/tts";
import { getVoicesByLanguage } from "@/lib/lm-ai/tts/speakerMap";

const COOKIE_NAME = "ai-api-key";

interface AudioGenerationRequest {
  dialogContent: {
    characters: string[];
    dialog: Array<{
      character: string;
      use_text: string;
      learn_text: string;
    }>;
  };
  voiceSuggestions?: Record<string, string>;
  learningLanguage?: LearningLanguageCode;
  aiProvider?: LLMProvider;
}

interface CharacterVoiceSelection {
  [characterName: string]: string; // character name -> voice_type
}

/**
 * Validate and find the best matching voice_type
 * If exact match not found, performs fuzzy search or returns default
 */
function validateAndFindVoice(
  requestedVoiceType: string,
  availableVoices: Array<{
    voice_type: string;
    name: string;
    gender: string;
    lan: string;
  }>
): string {
  if (!requestedVoiceType) {
    return availableVoices[0]?.voice_type || "";
  }

  // Check for exact match
  const exactMatch = availableVoices.find(
    (v) => v.voice_type === requestedVoiceType
  );
  if (exactMatch) {
    return exactMatch.voice_type;
  }

  // Normalize for comparison (lowercase, remove special chars)
  const normalize = (str: string) => str.toLowerCase().replace(/[_\-\s]/g, "");

  const normalizedRequested = normalize(requestedVoiceType);

  // Try fuzzy match by name (often LLM returns name instead of voice_type)
  const nameMatch = availableVoices.find((v) => {
    const normalizedName = normalize(v.name);
    return (
      normalizedName.includes(normalizedRequested) ||
      normalizedRequested.includes(normalizedName)
    );
  });
  if (nameMatch) {
    return nameMatch.voice_type;
  }

  // Try partial match on voice_type
  const partialMatch = availableVoices.find((v) => {
    const normalizedType = normalize(v.voice_type);
    return (
      normalizedType.includes(normalizedRequested) ||
      normalizedRequested.includes(normalizedType) ||
      // Check if key parts match (e.g., "female_maomao" matches "multi_female_maomao")
      normalizedRequested
        .split("_")
        .some((part) => normalizedType.includes(part)) ||
      normalizedType
        .split("_")
        .some((part) => normalizedRequested.includes(part))
    );
  });
  if (partialMatch) {
    return partialMatch.voice_type;
  }

  // No match found, return default (first available voice)
  return availableVoices[0]?.voice_type || "";
}

/**
 * Select voices for each character using LLM
 * Returns a mapping of character names to voice_type strings
 */
async function selectCharacterVoices(
  dialogContent: AudioGenerationRequest["dialogContent"],
  availableVoices: Array<{
    voice_type: string;
    name: string;
    gender: string;
    lan: string;
  }>,
  voiceSuggestions: Record<string, string> | undefined,
  learningLanguage: LearningLanguageCode | undefined,
  aiProvider: LLMProvider | undefined,
  apiKey: string | undefined
): Promise<CharacterVoiceSelection> {
  if (!aiProvider || !apiKey) {
    throw new Error("Missing AI provider or API key for voice selection");
  }

  const { prepareMessages, parseResponse } = await import(
    "@/lib/lm-ai/llm-node"
  );

  const systemPrompt =
    "You are a voice selection assistant for language learning dialogs. Your task is to assign appropriate voices to dialog characters based on the available voice options and any suggestions provided.";

  const userPrompt = `Select appropriate voices for each character in this dialog.

Available Voices:
${JSON.stringify(
  availableVoices.map((v) => ({
    voice_type: v.voice_type,
    name: v.name,
    gender: v.gender,
  })),
  null,
  2
)}

Dialog Characters: ${dialogContent.characters.join(", ")}

Dialog:
${JSON.stringify(dialogContent, null, 2)}

${
  voiceSuggestions
    ? `Voice Suggestions:\n${JSON.stringify(voiceSuggestions, null, 2)}\n`
    : ""
}
Learning Language: ${learningLanguage || "unknown"}

Requirements:
1. Assign exactly one voice_type to each character name
2. Match character gender/age/tone with voice characteristics when possible
3. Consider voice suggestions if provided
4. Ensure voices match the learning language

Return a JSON object mapping character names to voice_type strings:
{
  "CharacterA": "voice_type_string",
  "CharacterB": "voice_type_string"
}

Return ONLY the JSON object, no explanations.`;

  const messages = await prepareMessages(
    {
      dialogContent,
      availableVoices,
      voiceSuggestions,
      learningLanguage,
    },
    userPrompt,
    systemPrompt,
    "json",
    undefined,
    {
      learningLanguage: learningLanguage || "english",
      input: "",
    }
  );

  const { callLLMAPI } = await import("@/app/api/llm/route");
  const resp = await callLLMAPI({
    provider: aiProvider,
    apiKey,
    messages,
    responseFormat: "json",
  });

  const output = await parseResponse(resp, "json");
  const rawSelection =
    typeof output === "object" && output !== null
      ? (output as CharacterVoiceSelection)
      : {};

  // Validate and correct voice assignments for all characters
  const validatedSelection: CharacterVoiceSelection = {};
  for (const character of dialogContent.characters) {
    const requestedVoice = rawSelection[character];
    // Validate and find best matching voice (with fuzzy search fallback)
    validatedSelection[character] = validateAndFindVoice(
      requestedVoice,
      availableVoices
    );
  }

  return validatedSelection;
}

/**
 * Convert ReadableStream to ArrayBuffer
 */
async function streamToArrayBuffer(
  stream: ReadableStream<Uint8Array>
): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      totalLength += value.length;
    }
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AudioGenerationRequest;
    const {
      dialogContent,
      voiceSuggestions,
      learningLanguage = "english",
      aiProvider,
    } = body;

    if (
      !dialogContent ||
      !Array.isArray(dialogContent.dialog) ||
      dialogContent.dialog.length === 0
    ) {
      return NextResponse.json(
        { error: "Dialog content is required" },
        { status: 400 }
      );
    }

    // Get available voices for the learning language
    const availableVoices = getVoicesByLanguage(learningLanguage);
    if (availableVoices.length === 0) {
      return NextResponse.json(
        { error: "No voices available for the specified language" },
        { status: 400 }
      );
    }

    // Select voices for each character using LLM
    const apiKey = request.cookies.get(COOKIE_NAME)?.value;
    if (!aiProvider || !apiKey) {
      return NextResponse.json(
        {
          error: "AI provider and API key are required for voice selection",
        },
        { status: 400 }
      );
    }

    const characterVoices = await selectCharacterVoices(
      dialogContent,
      availableVoices,
      voiceSuggestions,
      learningLanguage,
      aiProvider,
      apiKey
    );

    // Create a stream to send sentence-by-sentence audio
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Process each dialog entry sequentially
          for (let index = 0; index < dialogContent.dialog.length; index++) {
            const entry = dialogContent.dialog[index];
            const characterName = entry.character;
            const requestedVoice = characterVoices[characterName];
            const selectedVoice = validateAndFindVoice(
              requestedVoice,
              availableVoices
            );
            const textToSynthesize =
              entry.learn_text || entry.use_text;

            try {
              // Generate audio for this sentence
              const audioStream = await synthesizeTTS({
                text: textToSynthesize,
                speaker: selectedVoice,
                audioFormat: "mp3",
                sampleRate: 24000,
                speed: 1.0,
                volume: 1.0,
                lan: learningLanguage,
              });

              if (audioStream) {
                // Convert stream to ArrayBuffer, then to base64
                const audioBuffer = await streamToArrayBuffer(audioStream);
                const audioBase64 = arrayBufferToBase64(audioBuffer);

                // Send sentence audio data as JSON with base64 string (not data URL)
                // Client will create Blob URL from this
                const sentenceData = {
                  type: "sentence",
                  sentenceIndex: index,
                  character: characterName,
                  audioBase64: audioBase64, // Send raw base64, client will create Blob URL
                  success: true,
                };

                const data = JSON.stringify(sentenceData) + "\n";
                controller.enqueue(encoder.encode(data));
              } else {
                // Send error for this sentence but continue
                const errorData = {
                  type: "sentence",
                  sentenceIndex: index,
                  character: characterName,
                  success: false,
                  error: "Failed to generate audio for this sentence",
                };

                const data = JSON.stringify(errorData) + "\n";
                controller.enqueue(encoder.encode(data));
              }
            } catch (sentenceError) {
              // Send error for this sentence but continue with next
              console.error(
                `[audio] Failed to generate audio for sentence ${index}:`,
                sentenceError
              );

              const errorData = {
                type: "sentence",
                sentenceIndex: index,
                character: characterName,
                success: false,
                error:
                  sentenceError instanceof Error
                    ? sentenceError.message
                    : String(sentenceError),
              };

              const data = JSON.stringify(errorData) + "\n";
              controller.enqueue(encoder.encode(data));
            }
          }

          // Send completion message
          const completionData = {
            type: "complete",
            totalSentences: dialogContent.dialog.length,
          };
          const data = JSON.stringify(completionData) + "\n";
          controller.enqueue(encoder.encode(data));

          controller.close();
        } catch (error) {
          // Send error and close
          const errorData = {
            type: "error",
            error:
              error instanceof Error ? error.message : String(error),
          };
          const data = JSON.stringify(errorData) + "\n";
          controller.enqueue(encoder.encode(data));
          controller.close();
        }
      },
    });

    // Return stream with text/event-stream content type for SSE-like behavior
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("[audio] error", error);
    return NextResponse.json(
      {
        error: "Audio generation failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
