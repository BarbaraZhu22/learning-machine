import { NextResponse } from "next/server";
import { synthesizeTTS } from "@/lib/lm-ai/tts";

export async function POST(request: Request) {
  try {
    const contentType = (
      request.headers.get("content-type") || ""
    ).toLowerCase();
    let text: string | undefined;
    if (contentType.startsWith("text/plain")) {
      text = (await request.text()) || undefined;
    } else {
      const maybe = await request.json().catch(() => ({}));
      if (maybe && typeof maybe.text === "string") {
        text = maybe.text;
      }
    }

    const audio = await synthesizeTTS({ text: text || "" });
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
