/**
 * Unified Audio Generation API (Aliyun TTS + SSML)
 * Clean version: no legacy imports or extra branches.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import type { LLMProvider } from "@/types";
import { synthesizeTTS } from "@/lib/lm-ai/tts";

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
  learningLanguage?: string;
  ssml?: string;
  voice?: string;
  aiProvider?: LLMProvider;
}

interface Markers {
  sentenceIndex: number;
  start: number;
  end: number;
  character: string;
  text: string;
}

function generateAliSignature(
  params: Record<string, string>,
  accessKeySecret: string
): string {
  const sortedKeys = Object.keys(params).sort();
  const canonicalStr = sortedKeys
    .map((k) => `${k}=${encodeURIComponent(params[k])}`)
    .join("&");
  const stringToSign = `POST&%2F&${encodeURIComponent(canonicalStr)}`;
  return crypto
    .createHmac("sha1", `${accessKeySecret}&`)
    .update(stringToSign)
    .digest("base64");
}

function mapLearningLanguageToAliVoice(language?: string): string {
  if (!language) return "en_us_joy";
  const map: Record<string, string> = {
    english: "en_us_joy",
    chinese: "siqi",
    spanish: "camila",
    french: "leona",
    german: "hans",
    japanese: "tomoka",
    korean: "jinho",
    portuguese: "lina",
    italian: "lucia",
    russian: "eugene",
    turkish: "seda",
    polish: "ewa",
    dutch: "mia",
  };
  return map[language.toLowerCase()] || "en_us_joy";
}

/**
 * Validate and correct SSML to satisfy Aliyun gateway constraints:
 * 1) Root <speak> with xmlns and optional xml:lang
 * 2) No nested <voice>; we collapse existing <voice> tags and wrap with a single voice
 * 3) Close tags properly; ensure <break /> self-closing
 * 4) Quote all attribute values (rate/pitch/volume/time)
 * 5) Remove code artifacts and normalize whitespace
 */
function validateAndCorrectSSML(
  raw: string,
  aliVoice: string,
  lang?: string
): { ssml: string; warnings: string[] } {
  const warnings: string[] = [];
  let s = (raw || "").toString();

  // Normalize whitespace and remove obvious concatenation remnants
  s = s
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  s = s.replace(/['"]\s*\+\s*['"]/g, " "); // remove `' + '` patterns if any

  // Ensure root speak
  const hasSpeak = /^<\s*speak[\s>]/i.test(s);
  if (!hasSpeak) {
    warnings.push("No root <speak>; wrapping content.");
    s = `<speak>${s}</speak>`;
  }

  // Ensure xmlns and xml:lang on <speak>
  s = s.replace(/<\s*speak([^>]*)>/i, (_m, attrs) => {
    let a = attrs || "";
    if (!/xmlns\s*=\s*"/i.test(a)) {
      a = `${a} xmlns="http://www.w3.org/2001/10/synthesis"`;
      warnings.push("Added xmlns to <speak>.");
    }
    if (lang && !/xml:lang\s*=\s*"/i.test(a)) {
      a = `${a} xml:lang="${lang}"`;
      warnings.push("Added xml:lang to <speak>.");
    }
    return `<speak${a}>`;
  });

  // Guarantee attributes quoted: rate / pitch / volume / time
  s = s.replace(/\brate=([+\-]?\d+%)/gi, 'rate="$1"');
  s = s.replace(/\bpitch=([+\-]?\d+hz)/gi, 'pitch="$1"');
  s = s.replace(/\bvolume=([+\-]?\d+%)/gi, 'volume="$1"');
  s = s.replace(/\btime=(\d+ms)/gi, 'time="$1"');

  // Normalize <break> into self-closing
  s = s.replace(/<\s*break([^>]*)>\s*<\/\s*break\s*>/gi, "<break$1/>");
  s = s.replace(/<\s*break([^>]*)>(?=\s)/gi, "<break$1/>"); // stray open
  // Fix accidental double slashes like <break ...//>
  s = s.replace(/<\s*break([^>]*?)\/\s*\/\s*>/gi, "<break$1/>");
  s = s.replace(/<\s*break([^>]*?)\s*\/{2,}\s*>/gi, "<break$1/>");

  // Escape unsafe characters inside text nodes (do not touch attributes)
  // Convert & (not entity), ' and " inside text to entities
  s = s.replace(/>([^<]+)</g, (_m, text) => {
    let t = String(text);
    // First protect existing entities, then escape bare ampersands
    t = t.replace(/&(?!amp;|lt;|gt;|apos;|quot;)/g, "&amp;");
    t = t.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
    return `>${t}<`;
  });

  // Remove all existing voice tags completely to avoid nesting problems
  if (/<\s*voice\b/i.test(s)) {
    warnings.push("Removed existing <voice> tags to prevent nesting.");
    s = s
      .replace(/<\s*voice\b[^>]*>/gi, "")
      .replace(/<\s*\/\s*voice\s*>/gi, "");
  }

  // Wrap entire content within single voice inside speak
  s = s.replace(/<\s*speak[^>]*>([\s\S]*?)<\/\s*speak\s*>/i, (_m, inner) => {
    const safeInner = inner.trim();
    return `<speak xmlns="http://www.w3.org/2001/10/synthesis"${
      lang ? ` xml:lang="${lang}"` : ""
    }><voice name="${aliVoice}">${safeInner}</voice></speak>`;
  });

  return { ssml: s, warnings };
}

// Ensure SSML uses the chosen Aliyun voice
function normalizeSSMLForAli(ssml: string, aliVoice: string): string {
  let out = ssml;
  // Replace any existing voice name attributes
  out = out.replace(
    /<voice\s+name=['"][^'"]+['"]>/g,
    `<voice name="${aliVoice}">`
  );
  // If no voice tag exists at all, wrap the entire content inside a single voice
  if (!/<voice\s+name=/.test(out)) {
    // Insert <voice> right after the opening <speak ...>
    const speakOpenMatch = out.match(/<speak[^>]*>/);
    if (speakOpenMatch) {
      const open = speakOpenMatch[0];
      out = out.replace(open, `${open}<voice name="${aliVoice}">`);
      out = out.replace(/<\/speak>\s*$/i, `</voice></speak>`);
    }
  }
  return out;
}

async function generateSSMLDocument(
  dialogContent: AudioGenerationRequest["dialogContent"],
  voiceSuggestions: Record<string, string> | undefined,
  learningLanguage: string | undefined,
  aiProvider: LLMProvider | undefined,
  apiKey: string | undefined
): Promise<string> {
  if (!aiProvider || !apiKey)
    throw new Error("Missing AI provider or API key for SSML generation");
  const { prepareMessages, parseResponse } = await import(
    "@/lib/lm-ai/llm-node"
  );
  const systemPrompt =
    "You are a language learning assistant and SSML expert. Generate a complete, production-ready SSML (Speech Synthesis Markup Language) document for dialog audio.\n" +
    "- Output must be valid SSML with a single <speak> root and proper nesting.\n" +
    "- Each sentence should be an atomic unit that can be independently located (use <voice> around each sentence if distinct speakers; otherwise use <prosody> blocks per sentence).\n" +
    "- Prosody should reflect intent and emotion; vary rate, pitch, and volume subtly to achieve naturalness.\n" +
    "- Prefer concise adjustments: rate in percentages (e.g., -8%, +10%), pitch in Hz (e.g., +15Hz, -5Hz), volume in % (e.g., 0%, -10%).\n" +
    '- Use <emphasis level="strong|moderate|reduced"> for important tokens; do not overuse.\n' +
    '- Insert <break time="200ms|400ms|600ms"> for natural pacing at clause boundaries.\n' +
    "- Keep punctuation in the spoken text. Avoid over-nesting tags.\n" +
    "- Respect the target language pronunciation; set xml:lang on <speak>.\n" +
    "- Never include any explanations or commentary—return only SSML.";

  const userPrompt = `Generate a nuanced SSML document for the dialog below.

Requirements:
1) Characters and voices
   - Use consistent <voice> selection per character across all sentences.
   - Infer gender/age/tone/accent from "Voice Suggestions" when available.
2) Per‑sentence prosody
   - Wrap spoken text in <prosody rate=".." pitch=".." volume="..">.
   - Questions: rate +5% to +10%, pitch +8Hz to +15Hz.
   - Prices/important facts: rate -8% to -15%, neutral pitch, add <emphasis level="strong">keyword</emphasis>.
   - Lists/clarifications: neutral rate, insert <break time="200ms"/> between list items.
3) Pacing
   - Insert <break time="300-600ms"/> between sentences.
4) Tag hygiene
   - Minimal readable tags; avoid redundant nesting.
5) Return ONLY the SSML string starting with <speak> and ending with </speak>.

Dialog:
${JSON.stringify(dialogContent, null, 2)}
${
  voiceSuggestions
    ? `\nVoice Suggestions:\n${JSON.stringify(voiceSuggestions, null, 2)}`
    : ""
}
Learning Language: ${learningLanguage || "unknown"}`;

  const messages = await prepareMessages(
    dialogContent,
    userPrompt,
    systemPrompt,
    "text",
    undefined,
    {
      learningLanguage,
    } as any
  );
  const { callLLMAPI } = await import("@/app/api/llm/route");
  const resp = await callLLMAPI({
    provider: aiProvider,
    apiKey,
    messages,
    responseFormat: "text",
  });
  const output = await parseResponse(resp, "text");
  const ssml = typeof output === "string" ? output : String(output);
  if (!ssml.trim().startsWith("<speak"))
    throw new Error("Invalid SSML format from LLM");
  return ssml;
}

export async function POST(request: NextRequest) {
  try {
    const reqId = Math.random().toString(36).slice(2, 8);
    console.log(`[audio][${reqId}] start`);
    const body = (await request.json()) as AudioGenerationRequest;
    const {
      dialogContent,
      voiceSuggestions,
      learningLanguage,
      ssml: providedSSML,
      voice: voiceOverride,
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

    // Prepare SSML
    const apiKey = request.cookies.get(COOKIE_NAME)?.value;
    let ssmlDocument = providedSSML;
    if (!ssmlDocument) {
      if (!aiProvider || !apiKey) {
        console.warn(
          `[audio][${reqId}] missing ssml and cannot generate (aiProvider=${aiProvider}, apiKey=${
            apiKey ? "present" : "missing"
          })`
        );
        return NextResponse.json(
          {
            error:
              "SSML missing and cannot generate without AI provider and API key",
          },
          { status: 400 }
        );
      }
      console.log(`[audio][${reqId}] generating SSML via ${aiProvider}`);
      ssmlDocument = await generateSSMLDocument(
        dialogContent,
        voiceSuggestions,
        learningLanguage,
        aiProvider,
        apiKey
      );
      console.log(
        `[audio][${reqId}] ssml generated size=${
          ssmlDocument.length
        }, startsWithSpeak=${ssmlDocument.trim().startsWith("<speak")}`
      );
    }

    const aliVoice =
      voiceOverride || mapLearningLanguageToAliVoice(learningLanguage);
    console.log(
      `[audio][${reqId}] using voice=${aliVoice}, lang=${
        learningLanguage || "unknown"
      }`
    );
    // Validate & correct SSML, then normalize voice name
    const corrected = validateAndCorrectSSML(
      ssmlDocument,
      aliVoice,
      learningLanguage === "chinese" ? "zh-CN" : undefined
    );
    if (corrected.warnings.length) {
      console.log(
        `[audio][${reqId}] ssml corrections:`,
        corrected.warnings.join(" | ")
      );
    }
    const ssmlForAli = normalizeSSMLForAli(corrected.ssml, aliVoice);

    // Directly call shared Aliyun synthesizer with SSML string.
    debugger
    const textForNow =
      "测试测试123"; // TODO: replace with SSML-based synthesis when backend supports SSML
    const source = await synthesizeTTS({
      text: textForNow,
      speaker: aliVoice,
      audioFormat: "mp3",
      sampleRate: 24000,
      speed: 1.0,
      volume: 1.0,
    });
    if (!source) {
      return NextResponse.json({ error: "TTS返回空音频流" }, { status: 502 });
    }

    // Stream raw source directly to the client (no prebuffering).
    return new NextResponse(source, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[audio] error", error);
    return NextResponse.json(
      { error: "Audio generation failed" },
      { status: 500 }
    );
  }
}
