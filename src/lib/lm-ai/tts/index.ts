// app/utils/tts.ts
export interface TTSParams {
  text: string;
  speaker?: string;
  audioFormat?: string;
  sampleRate?: number;
  speed?: number;
  volume?: number;
}

export async function synthesizeTTS(
  params: TTSParams
): Promise<ReadableStream<Uint8Array> | null> {
  const {
    text,
    speaker = "zh_female_vv_uranus_bigtts",
    audioFormat = "mp3",
    sampleRate = 24000,
    speed = 1.0,
    volume = 1.0,
  } = params;

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
          text: "其他人",
          speaker: "zh_female_cancan_mars_bigtts",
          audio_params: {
            format: "mp3",
            sample_rate: 24000,
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
  let sawDoneCode = false; // code === 20000000

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
    let idx = lineBuffer.lastIndexOf("\n");
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
        } else if (obj.code === 20000000) {
          sawDoneCode = true;
        }
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
