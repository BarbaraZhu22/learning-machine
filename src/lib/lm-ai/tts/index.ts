// app/utils/tts.ts
import type { LearningLanguageCode } from "@/types";
import { speakFixMap } from "./speakerMap";

export interface TTSParams {
  text: string;
  speaker?: string;
  audioFormat?: string;
  sampleRate?: number;
  speed?: number;
  volume?: number;
  lan?: LearningLanguageCode;
}

/**
 * Count characters in text (excluding leading/trailing whitespace)
 * Simple character-based limit for all languages
 */
function countCharacters(text: string): number {
  return text.trim().length;
}

/**
 * Apply text transformations based on language-specific rules
 * Ensures that already replaced text is not replaced again
 */
function applySpeakFix(
  text: string,
  lan: LearningLanguageCode | undefined
): string {
  if (!lan) return text;

  const fixRules = speakFixMap[lan as keyof typeof speakFixMap];
  if (!fixRules || fixRules.length === 0) return text;

  // Use a marker to protect replaced segments
  const MARKER = "\uE000";
  let result = text;

  // Apply each rule in order
  for (const rule of fixRules) {
    // Use the regex directly, ensure it has global flag
    let regex = rule.regex;
    if (!regex.flags.includes("g")) {
      regex = new RegExp(regex.source, regex.flags + "g");
    }

    // Replace with callback: wrap replacement with markers to protect it
    result = result.replace(regex, (match, ...args) => {
      // Get offset (position of match in string)
      // replace callback: (match, ...capturedGroups, offset, string)
      const offset = args[args.length - 2] as number;

      // Check if this match is inside a marked (protected) segment
      const textBeforeMatch = result.substring(0, offset);
      const markerCountBefore = (
        textBeforeMatch.match(new RegExp(MARKER, "g")) || []
      ).length;

      // If inside a protected segment (odd number of markers), return original match
      if (markerCountBefore % 2 === 1) {
        return match;
      }

      // Otherwise, wrap replacement with markers
      return MARKER + rule.replacement + MARKER;
    });
  }

  // Remove all markers
  result = result.replace(new RegExp(MARKER, "g"), "");

  return result;
}

export async function synthesizeTTS(
  params: TTSParams
): Promise<ReadableStream<Uint8Array> | null> {
  const {
    text = "",
    speaker = "zh_female_vv_uranus_bigtts",
    audioFormat = "mp3",
    sampleRate = 24000,
    lan,
  } = params;

  // Check character limit (150 characters max, roughly equivalent to 30 words)
  const charCount = countCharacters(text);
  const MAX_CHARACTERS = 222;
  if (charCount > MAX_CHARACTERS) {
    throw new Error(
      `TTS请求文本过长: ${charCount} 字符，最大允许 ${MAX_CHARACTERS} 字符`
    );
  }

  // Apply text transformations based on language
  const processedText = applySpeakFix(text, lan);

  const VOLC_TTS_TOKEN = process.env.VOLC_TTS_TOKEN;
  const VOLC_TTS_APPID = process.env.VOLC_TTS_APPID;
  const VOLC_TTS_RESOURCEID = process.env.VOLC_TTS_RESOURCEID;

  if (!text || !VOLC_TTS_TOKEN || !VOLC_TTS_APPID) {
    throw new Error("TTS参数或密钥缺失");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer; ${VOLC_TTS_TOKEN}`,
    "X-Api-App-Id": VOLC_TTS_APPID,
    "X-Api-Access-Key": VOLC_TTS_TOKEN,
    "Content-Type": "application/json",
  };
  if (VOLC_TTS_RESOURCEID) {
    headers["X-Api-Resource-Id"] = VOLC_TTS_RESOURCEID;
  }

  const res = await fetch(
    "https://openspeech.bytedance.com/api/v3/tts/unidirectional",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        user: {
          uid: "12345",
        },
        req_params: {
          text: processedText,
          speaker,
          audio_params: {
            format: audioFormat,
            sample_rate: sampleRate,
            enable_timestamp: true,
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const errorDetail = await res
      .json()
      .catch(() => ({ message: res.statusText }));
    throw new Error(`TTS调用失败: ${JSON.stringify(errorDetail)}`);
  }
  // NDJSON: collect the whole response first, then extract useful audio frames.
  const source = res.body;
  if (!source) return null;

  const reader = source.getReader();
  const decoder = new TextDecoder();
  let lineBuffer = "";
  const audioChunks: Uint8Array[] = [];
  let totalLength = 0;
  // let sawDoneCode = false; // code === 20000000

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      // flush tail if there is any leftover text without trailing newline
      if (lineBuffer) lineBuffer += "\n";
      break;
    }
    if (!value || value.byteLength === 0) continue;
    const text = decoder.decode(value, { stream: true });
    lineBuffer += text;
    const idx = lineBuffer.lastIndexOf("\n");

    if (idx === -1) continue;
    const lines = lineBuffer.slice(0, idx).split("\n");
    lineBuffer = lineBuffer.slice(idx + 1);
    for (const raw of lines) {
      const s = raw.trim();
      if (!s) continue;
      try {
        const obj = JSON.parse(s) as {
          code?: number;
          message?: string;
          data?: string | null;
        };
        if (
          obj.code === 0 &&
          typeof obj.data === "string" &&
          obj.data.length > 0
        ) {
          try {
            const bytes = new Uint8Array(Buffer.from(obj.data, "base64"));
            if (bytes.byteLength > 0) {
              audioChunks.push(bytes);
              totalLength += bytes.byteLength;
            }
          } catch {
            // ignore base64 decode errors
          }
        }
        // } else if (obj.code === 20000000) {
        //   sawDoneCode = true;
        // }
      } catch {
        // ignore non-JSON lines
      }
    }
  }

  // Optional: you can log or assert on sawDoneCode if needed.
  if (audioChunks.length === 0) {
    return null;
  }

  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of audioChunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const out = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(merged);
      controller.close();
    },
  });

  return out;
}
