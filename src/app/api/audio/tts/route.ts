import { NextResponse } from "next/server";
import { synthesizeTTS } from "@/lib/lm-ai/tts";
import type { LearningLanguageCode } from "@/types";

export async function POST(request: Request) {
  try {
    const contentType = (
      request.headers.get("content-type") || ""
    ).toLowerCase();
    let text: string | undefined;
    let lan: LearningLanguageCode | undefined;
    
    if (contentType.startsWith("text/plain")) {
      text = (await request.text()) || undefined;
    } else {
      const maybe = await request.json().catch(() => ({}));
      if (maybe && typeof maybe.text === "string") {
        text = maybe.text;
      }
      if (maybe && typeof maybe.lan === "string") {
        lan = maybe.lan as LearningLanguageCode;
      }
    }

    const audio = await synthesizeTTS({ 
      text: text || "",
      lan,
    });
    return new NextResponse(audio, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
