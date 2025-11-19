import type { LearningLanguageCode } from "@/types";

export interface SpeakerVoice {
  gender: "male" | "female";
  voice_type: string;
  lan: string;
  name: string;
}

const doubao10Voices: SpeakerVoice[] = [
  {
    gender: "female",
    voice_type: "ICL_zh_female_wenrounvshen_239eff5e8ffa_tob",
    lan: "中文",
    name: "温柔女神",
  },
  {
    gender: "female",
    voice_type: "zh_female_qinqienvsheng_moon_bigtts",
    lan: "中文",
    name: "亲切女声",
  },
  {
    gender: "male",
    voice_type: "en_male_jason_conversation_wvae_bigtts",
    lan: "中文",
    name: "开朗学长",
  },
  {
    gender: "male",
    voice_type: "zh_male_qingshuangnanda_mars_bigtts",
    lan: "中文",
    name: "清爽男大",
  },
  // 粤语
  {
    gender: "female",
    voice_type: "zh_female_yueyunv_mars_bigtts",
    lan: "中文-粤语",
    name: "粤语小溏",
  },
  {
    gender: "female",
    voice_type: "zh_female_wanqudashu_moon_bigtts",
    lan: "中文-广东口音",
    name: "湾区大叔",
  },
  {
    gender: "male",
    voice_type: "zh_male_guozhoudege_moon_bigtts",
    lan: "中文-广东口音",
    name: "广州德哥",
  },
  // 美式英语

  {
    gender: "male",
    voice_type: "ICL_en_male_michael_tob",
    lan: "美式英语",
    name: "Michael",
  },
  {
    gender: "male",
    voice_type: "zh_male_M100_conversation_wvae_bigtts",
    lan: "美式英语",
    name: "Lucas",
  },
  {
    gender: "female",
    voice_type: "en_female_dacey_conversation_wvae_bigtts",
    lan: "美式英语",
    name: "Daisy",
  },
  {
    gender: "male",
    voice_type: "en_male_charlie_conversation_wvae_bigtts",
    lan: "美式英语",
    name: "Owen",
  },
  {
    gender: "female",
    voice_type: "en_female_sarah_new_conversation_wvae_bigtts",
    lan: "美式英语",
    name: "Luna",
  },
  {
    gender: "male",
    voice_type: "ICL_en_male_kevin2_tob",
    lan: "美式英语",
    name: "Kevin McCallister",
  },
  {
    gender: "male",
    voice_type: "zh_male_jieshuonansheng_mars_bigtts",
    lan: "美式英语",
    name: "磁性解说男声/Morgan",
  },
  {
    gender: "female",
    voice_type: "zh_female_jitangmeimei_mars_bigtts",
    lan: "美式英语",
    name: "鸡汤妹妹/Hope",
  },

  // 英式英语
  {
    gender: "female",
    voice_type: "en_female_emily_mars_bigtts",
    lan: "英式英语",
    name: "Emily",
  },
  {
    gender: "male",
    voice_type: "zh_male_xudong_conversation_wvae_bigtts",
    lan: "英式英语",
    name: "Daniel",
  },

  // 澳洲英语
  {
    gender: "female",
    voice_type: "en_female_sarah_mars_bigtts",
    lan: "澳洲英语",
    name: "Sarah",
  },
  {
    gender: "male",
    voice_type: "en_male_dryw_mars_bigtts",
    lan: "澳洲英语",
    name: "Dryw",
  },

  // 西班牙语
  {
    gender: "female",
    voice_type: "multi_female_maomao_conversation_wvae_bigtts",
    lan: "西语",
    name: "Diana",
  },
  {
    gender: "male",
    voice_type: "multi_male_M100_conversation_wvae_bigtts",
    lan: "西语",
    name: "Lucía",
  },
  {
    gender: "male",
    voice_type: "multi_male_xudong_conversation_wvae_bigtts",
    lan: "西语",
    name: "Daníel",
  },

  // 日语
  {
    gender: "male",
    voice_type: "multi_zh_male_youyoujunzi_moon_bigtts",
    lan: "日语",
    name: "ひかる（光）",
  },
  {
    gender: "female",
    voice_type: "multi_female_sophie_conversation_wvae_bigtts",
    lan: "日语",
    name: "さとみ（智美）",
  },
  {
    gender: "male",
    voice_type: "multi_male_xudong_conversation_wvae_bigtts",
    lan: "日语",
    name: "まさお（正男）",
  },
  {
    gender: "female",
    voice_type: "multi_female_maomao_conversation_wvae_bigtts",
    lan: "日语",
    name: "つき（月）",
  },
  {
    gender: "female",
    voice_type: "multi_female_gaolengyujie_moon_bigtts",
    lan: "日语",
    name: "あけみ（朱美）",
  },
];

const languageToLanMap: Record<LearningLanguageCode, string[]> = {
  chinese: ["中文"],
  cantonese: ["中文-粤语", "中文-广东口音"],
  english: ["美式英语", "英式英语", "澳洲英语"],
  spanish: ["西语"],
  japanese: ["日语"],
  portuguese: [],
  french: [],
  russian: [],
  german: [],
  korean: [],
  italian: [],
  turkish: [],
  dutch: [],
  polish: [],
};

const romanceLanguages: LearningLanguageCode[] = [
  "french",
  "portuguese",
  "italian",
];

export function getVoicesByLanguage(
  languageCode: LearningLanguageCode
): SpeakerVoice[] {
  const lanValues = languageToLanMap[languageCode];

  if (!lanValues || lanValues.length === 0) {
    if (romanceLanguages.includes(languageCode)) {
      return doubao10Voices.filter((voice) => voice.lan === "西语");
    }
    return doubao10Voices.filter((voice) => voice.lan === "中文");
  }

  const matchedVoices = doubao10Voices.filter((voice) =>
    lanValues.includes(voice.lan)
  );

  if (matchedVoices.length > 0) {
    return matchedVoices;
  }

  if (romanceLanguages.includes(languageCode)) {
    return doubao10Voices.filter((voice) => voice.lan === "西语");
  }

  return doubao10Voices.filter((voice) => voice.lan === "中文");
}

const spanish = [
  // =====================
  //  0. 重音模拟（最先处理）
  // =====================

  // 我们将重音元音加长，例如：
  // á → aa，é → ee，í → ii，ó → oo，ú → uu
  // 让 TTS 明显读出“重音 syllable”

  { original: "á", replacement: "aa", regex: /á/gi },
  { original: "é", replacement: "ee", regex: /é/gi },
  { original: "í", replacement: "ii", regex: /í/gi },
  { original: "ó", replacement: "oo", regex: /ó/gi },
  { original: "ú", replacement: "uu", regex: /ú/gi },

  // =====================
  //  1. 特殊字母
  // =====================

  { original: "ñ", replacement: "ny", regex: /ñ/gi },
  { original: "ll", replacement: "y", regex: /ll/gi },
  { original: "rr", replacement: "rrr", regex: /rr/gi },

  // =====================
  //  2. G 系列（优先：必须在 C 和元音转换之前）
  // =====================

  { original: "gue", replacement: "khe", regex: /gue/gi },
  { original: "gui", replacement: "khi", regex: /gui/gi },

  // ge / gi → kh
  { original: "ge/gi", replacement: "kh", regex: /g(?=[eéií])/gi },

  // =====================
  //  3. C 系列（次优先）
  // =====================
  // 特殊上下文 uch → uthi
  { original: "uch(?=[oa])", replacement: "utchi", regex: /uch(?=[oa])/gi },
  { original: "ra", replacement: "raa", regex: /ra/gi },

  // ce / ci → se / si
  { original: "ce/ci", replacement: "s", regex: /c(?=[eéií])/gi },

  // 其他所有 c → k
  { original: "c", replacement: "k", regex: /c/gi },

  // =====================
  //  4. QU 系列
  // =====================

  // que / qui → ke / ki
  { original: "que/qui", replacement: "k", regex: /qu(?=[ei])/gi },

  // =====================
  //  5. J 系列
  // =====================

  { original: "j", replacement: "kh", regex: /j/gi },

  // =====================
  //  6. Y 系列（必须在辅音规则后、元音规则前）
  // =====================

  // 6.1 词尾 y → i
  {
    original: "y_word_end",
    replacement: "i",
    regex: /y(?=$|[\s.,!?;:])/gi,
  },

  // 6.2 y + 元音 → j （西语 /ʝ/）
  { original: "y+vowel", replacement: "j", regex: /y(?=[aeiouáéíóú])/gi },

  // =====================
  //  7. 其它辅音
  // =====================

  { original: "z", replacement: "s", regex: /z/gi },
  { original: "v", replacement: "b", regex: /v/gi },

  // =====================
  //  8. 普通元音增强（最后执行）
  // =====================

  { original: "i", replacement: "ee", regex: /i/gi },
  { original: "u", replacement: "oo", regex: /u/gi },
];

const italian = [
  // =====================
  // 0. 重音模拟
  // =====================
  { original: "à", replacement: "aa", regex: /à/gi },
  { original: "è", replacement: "ee", regex: /è/gi },
  { original: "é", replacement: "ee", regex: /é/gi },
  { original: "ì", replacement: "ii", regex: /ì/gi },
  { original: "ò", replacement: "oo", regex: /ò/gi },
  { original: "ó", replacement: "oo", regex: /ó/gi },
  { original: "ù", replacement: "uu", regex: /ù/gi },

  // =====================
  // 1. 双辅音 / 强音
  // =====================
  { original: "rr", replacement: "rrr", regex: /rr/gi }, // 强颤音
  { original: "ll", replacement: "l", regex: /ll/gi }, // 软 l，单 l 发音即可
  { original: "ss", replacement: "ss", regex: /ss/gi }, // 保留 ss 清音
  { original: "tt", replacement: "tt", regex: /tt/gi },
  { original: "cc(?=[eéií])", replacement: "ch", regex: /cc(?=[eéií])/gi }, // ce/ci → ch
  { original: "gg(?=[eéií])", replacement: "j", regex: /gg(?=[eéií])/gi }, // ge/gi → j

  // =====================
  // 2. C/G 系列
  // =====================
  { original: "c(?=[eéií])", replacement: "ch", regex: /c(?=[eéií])/gi }, // c + e/i → ch
  { original: "c(?=[aouáóú])", replacement: "k", regex: /c(?=[aouáóú])/gi },
  { original: "g(?=[eéií])", replacement: "j", regex: /g(?=[eéií])/gi }, // g + e/i → j
  { original: "g(?=[aouáóú])", replacement: "g", regex: /g(?=[aouáóú])/gi },

  // =====================
  // 3. GU/GQ 系列
  // =====================
  { original: "gu(?=[eéií])", replacement: "g", regex: /gu(?=[eéií])/gi }, // gue/gui → g
  { original: "qu(?=[eéií])", replacement: "k", regex: /qu(?=[eéií])/gi },

  // =====================
  // 4. 词尾规则（r/l/n/m/s）
  // =====================
  {
    original: "r(?=$|[s.,!?;:])",
    replacement: "rr",
    regex: /r(?=$|[\s.,!?;:])/gi,
  }, // r 末尾颤音
  {
    original: "l(?=$|[s.,!?;:])",
    replacement: "l",
    regex: /l(?=$|[\s.,!?;:])/gi,
  },
  {
    original: "n(?=$|[s.,!?;:])",
    replacement: "n",
    regex: /n(?=$|[\s.,!?;:])/gi,
  },
  {
    original: "m(?=$|[s.,!?;:])",
    replacement: "m",
    regex: /m(?=$|[\s.,!?;:])/gi,
  },
  {
    original: "s(?=$|[s.,!?;:])",
    replacement: "ss",
    regex: /s(?=$|[\s.,!?;:])/gi,
  },

  // =====================
  // 5. 元音长度增强
  // =====================
  { original: "i", replacement: "ii", regex: /i/gi },
  { original: "u", replacement: "uu", regex: /u/gi },
  { original: "e", replacement: "ee", regex: /e/gi },
  { original: "o", replacement: "oo", regex: /o/gi },
  { original: "a", replacement: "aa", regex: /a/gi },

  // =====================
  // 6. Y 系列（外来词）
  // =====================
  {
    original: "y(?=$|[s.,!?;:])",
    replacement: "i",
    regex: /y(?=$|[\s.,!?;:])/gi,
  },
  {
    original: "y(?=[aeiouáéíóú])",
    replacement: "j",
    regex: /y(?=[aeiouáéíóú])/gi,
  },
];

const french = [
  // =====================
  // 0. 重音元音
  // =====================
  { original: "é", replacement: "ee", regex: /é/gi },
  { original: "è", replacement: "eh", regex: /è/gi },
  { original: "ê", replacement: "ee", regex: /ê/gi },
  { original: "à", replacement: "aa", regex: /à/gi },
  { original: "ù", replacement: "uu", regex: /ù/gi },
  { original: "ô", replacement: "oo", regex: /ô/gi },
  { original: "û", replacement: "uu", regex: /û/gi },
  { original: "ï", replacement: "ii", regex: /ï/gi },
  { original: "œ", replacement: "oe", regex: /œ/gi },
  { original: "æ", replacement: "ae", regex: /æ/gi },

  // =====================
  // 1. 特殊字母
  // =====================
  { original: "ç", replacement: "s", regex: /ç/gi },

  // =====================
  // 2. 字母组合
  // =====================
  { original: "gn", replacement: "ny", regex: /gn/gi }, // /ɲ/
  { original: "ill(?=[aeiouy])", replacement: "y", regex: /ill(?=[aeiouy])/gi }, // famille → famiye
  { original: "ou", replacement: "oo", regex: /ou/gi },
  { original: "eu", replacement: "ø", regex: /eu/gi },
  { original: "au", replacement: "o", regex: /au/gi },
  { original: "eau", replacement: "o", regex: /eau/gi },

  // =====================
  // 3. R/L/N 词尾
  // =====================
  {
    original: "r(?=$|[s.,!?;:])",
    replacement: "rrr",
    regex: /r(?=$|[\s.,!?;:])/gi,
  }, // 法语末 r 一般发喉音
  {
    original: "l(?=$|[s.,!?;:])",
    replacement: "l",
    regex: /l(?=$|[\s.,!?;:])/gi,
  },
  {
    original: "n(?=$|[s.,!?;:])",
    replacement: "n",
    regex: /n(?=$|[\s.,!?;:])/gi,
  },
  {
    original: "m(?=$|[s.,!?;:])",
    replacement: "m",
    regex: /m(?=$|[\s.,!?;:])/gi,
  },
  {
    original: "s(?=$|[s.,!?;:])",
    replacement: "ss",
    regex: /s(?=$|[\s.,!?;:])/gi,
  },

  // =====================
  // 4. 元音长度增强
  // =====================
  { original: "a", replacement: "aa", regex: /a/gi },
  { original: "e", replacement: "ee", regex: /e/gi },
  { original: "i", replacement: "ii", regex: /i/gi },
  { original: "o", replacement: "oo", regex: /o/gi },
  { original: "u", replacement: "uu", regex: /u/gi },

  // =====================
  // 5. Y 系列（外来词）
  // =====================
  {
    original: "y(?=$|[s.,!?;:])",
    replacement: "i",
    regex: /y(?=$|[\s.,!?;:])/gi,
  },
  {
    original: "y(?=[aeiouáéíóú])",
    replacement: "j",
    regex: /y(?=[aeiouáéíóú])/gi,
  },
];

const portuguese = [
  // =====================
  // 0. 重音模拟
  // =====================
  { original: "á", replacement: "aa", regex: /á/gi },
  { original: "é", replacement: "ee", regex: /é/gi },
  { original: "í", replacement: "ii", regex: /í/gi },
  { original: "ó", replacement: "oo", regex: /ó/gi },
  { original: "ú", replacement: "uu", regex: /ú/gi },
  { original: "â", replacement: "aa", regex: /â/gi },
  { original: "ê", replacement: "ee", regex: /ê/gi },
  { original: "ô", replacement: "oo", regex: /ô/gi },

  // =====================
  // 1. 特殊字母
  // =====================
  { original: "ç", replacement: "s", regex: /ç/gi },
  { original: "ã", replacement: "an", regex: /ã/gi },
  { original: "õ", replacement: "on", regex: /õ/gi },
  { original: "ñ", replacement: "ny", regex: /ñ/gi }, // 如果有西班牙语混入

  // =====================
  // 2. 双辅音 / 强音
  // =====================
  { original: "rr", replacement: "rrr", regex: /rr/gi }, // 强颤音
  { original: "ss", replacement: "ss", regex: /ss/gi }, // 保留 ss 清音
  { original: "lh", replacement: "lj", regex: /lh/gi }, // 葡语 /ʎ/ 类似 lj
  { original: "nh", replacement: "ny", regex: /nh/gi }, // 葡语 /ɲ/

  // =====================
  // 3. C/G 系列
  // =====================
  { original: "ce", replacement: "se", regex: /ce/gi },
  { original: "ci", replacement: "si", regex: /ci/gi },
  { original: "ç", replacement: "s", regex: /ç/gi },
  { original: "ch", replacement: "sh", regex: /ch/gi }, // 类似英语 sh
  { original: "g(?=[eéií])", replacement: "j", regex: /g(?=[eéií])/gi }, // ge/gi → j
  { original: "gu(?=[eéií])", replacement: "g", regex: /gu(?=[eéií])/gi }, // gue/gui → g 不发 u
  { original: "qu(?=[eéií])", replacement: "k", regex: /qu(?=[eéií])/gi }, // que/qui → k
  { original: "c(?=[aouáóú])", replacement: "k", regex: /c(?=[aouáóú])/gi },

  // =====================
  // 4. R/L/N 词尾规则
  // =====================
  // r/l/n 词尾 → 发音延长
  {
    original: "r(?=$|[s.,!?;:])",
    replacement: "rr",
    regex: /r(?=$|[\s.,!?;:])/gi,
  },
  {
    original: "l(?=$|[s.,!?;:])",
    replacement: "u",
    regex: /l(?=$|[\s.,!?;:])/gi,
  }, // 葡语末尾 l 发音近似 u
  {
    original: "n(?=$|[s.,!?;:])",
    replacement: "n",
    regex: /n(?=$|[\s.,!?;:])/gi,
  },

  // =====================
  // 5. 元音长度
  // =====================
  { original: "i", replacement: "ee", regex: /i/gi },
  { original: "u", replacement: "oo", regex: /u/gi },

  // =====================
  // 6. Y 系列（如果西语/外来词混入）
  // =====================
  {
    original: "y(?=$|[s.,!?;:])",
    replacement: "i",
    regex: /y(?=$|[\s.,!?;:])/gi,
  },
  {
    original: "y(?=[aeiouáéíóú])",
    replacement: "j",
    regex: /y(?=[aeiouáéíóú])/gi,
  },
];

export const speakFixMap = {
  spanish,
  french,
  italian,
  portuguese,
};
