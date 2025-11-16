import { NextResponse } from "next/server";
import { synthesizeTTS } from "@/lib/lm-ai/tts";

export async function POST(request: Request) {
  try {
    const contentType = (
      request.headers.get("content-type") || ""
    ).toLowerCase();
    let ssmlStr: string | undefined;
    if (contentType.startsWith("text/plain")) {
      ssmlStr = (await request.text()) || undefined;
    } else {
      const maybe = await request.json().catch(() => ({} as any));
      if (maybe && typeof maybe.ssmlStr === "string") {
        ssmlStr = maybe.ssmlStr;
      }
    }

    const audio = await synthesizeTTS({ text: ssmlStr || "" });
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
