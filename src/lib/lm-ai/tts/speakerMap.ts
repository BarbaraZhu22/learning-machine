// src/lib/lm-ai/tts/speakerTags.ts
export type SpeakerTag = {
  lang: string; // 语种代码（和learningLanguages对应）
  gender: "male" | "female"; // 性别
  trait: string; // 性格/风格标签
  speakerId: string; // 火山引擎speaker ID
  displayName: string; // 显示名
};

export const speakerTags: SpeakerTag[] = [
  // ----------------- 英语 -----------------
  {
    lang: "english",
    gender: "female",
    trait: "natural",
    speakerId: "BV001_v2_streaming",
    displayName: "英语自然女声",
  },
  {
    lang: "english",
    gender: "female",
    trait: "warm",
    speakerId: "en_female_warm_emo_mars_bigtts",
    displayName: "英语温暖女声",
  },
  {
    lang: "english",
    gender: "male",
    trait: "calm",
    speakerId: "BV002_v2_streaming",
    displayName: "英语沉稳男声",
  },
  {
    lang: "english",
    gender: "male",
    trait: "authoritative",
    speakerId: "en_male_authoritative_emo_mars_bigtts",
    displayName: "英语权威男声",
  },

  // ----------------- 中文 -----------------
  {
    lang: "chinese",
    gender: "female",
    trait: "sweet",
    speakerId: "zh_female_shuangkuaisisi_moon_bigtts",
    displayName: "中文甜美女声",
  },
  {
    lang: "chinese",
    gender: "female",
    trait: "gentle",
    speakerId: "zh_female_roumeinvyou_emo_v2_mars_bigtts",
    displayName: "中文温柔女声",
  },
  {
    lang: "chinese",
    gender: "male",
    trait: "steady",
    speakerId: "zh_male_M392_conversation_wvae_bigtts",
    displayName: "中文沉稳男声",
  },
  {
    lang: "chinese",
    gender: "male",
    trait: "sunny",
    speakerId: "zh_male_yangguangqingnian_emo_v2_mars_bigtts",
    displayName: "中文阳光男声",
  },

  // ----------------- 西班牙语 -----------------
  {
    lang: "spanish",
    gender: "female",
    trait: "energetic",
    speakerId: "es_female_energetic_emo_mars_bigtts",
    displayName: "西班牙语热情女声",
  },
  {
    lang: "spanish",
    gender: "male",
    trait: "calm",
    speakerId: "es_male_calm_emo_mars_bigtts",
    displayName: "西班牙语沉稳男声",
  },

  // ----------------- 葡萄牙语 -----------------
  {
    lang: "portuguese",
    gender: "female",
    trait: "soft",
    speakerId: "pt_female_soft_emo_mars_bigtts",
    displayName: "葡萄牙语轻柔女声",
  },
  {
    lang: "portuguese",
    gender: "male",
    trait: "firm",
    speakerId: "pt_male_firm_emo_mars_bigtts",
    displayName: "葡萄牙语坚定男声",
  },

  // ----------------- 法语 -----------------
  {
    lang: "french",
    gender: "female",
    trait: "elegant",
    speakerId: "fr_female_elegant_emo_mars_bigtts",
    displayName: "法语优雅女声",
  },
  {
    lang: "french",
    gender: "male",
    trait: "charming",
    speakerId: "fr_male_charming_emo_mars_bigtts",
    displayName: "法语迷人男声",
  },

  // ----------------- 俄语 -----------------
  {
    lang: "russian",
    gender: "female",
    trait: "deep",
    speakerId: "ru_female_deep_emo_mars_bigtts",
    displayName: "俄语深沉女声",
  },
  {
    lang: "russian",
    gender: "male",
    trait: "powerful",
    speakerId: "ru_male_powerful_emo_mars_bigtts",
    displayName: "俄语有力男声",
  },

  // ----------------- 日语 -----------------
  {
    lang: "japanese",
    gender: "female",
    trait: "moe",
    speakerId: "jp_female_moe_emo_mars_bigtts",
    displayName: "日语萌系女声",
  },
  {
    lang: "japanese",
    gender: "male",
    trait: "gentle",
    speakerId: "jp_male_gentle_emo_mars_bigtts",
    displayName: "日语温柔男声",
  },

  // ----------------- 德语 -----------------
  {
    lang: "german",
    gender: "female",
    trait: "clear",
    speakerId: "de_female_clear_emo_mars_bigtts",
    displayName: "德语清晰女声",
  },
  {
    lang: "german",
    gender: "male",
    trait: "precise",
    speakerId: "de_male_precise_emo_mars_bigtts",
    displayName: "德语精准男声",
  },

  // ----------------- 韩语 -----------------
  {
    lang: "korean",
    gender: "female",
    trait: "bright",
    speakerId: "kr_female_bright_emo_mars_bigtts",
    displayName: "韩语明亮女声",
  },
  {
    lang: "korean",
    gender: "male",
    trait: "gentle",
    speakerId: "kr_male_gentle_emo_mars_bigtts",
    displayName: "韩语温柔男声",
  },

  // ----------------- 意大利语 -----------------
  {
    lang: "italian",
    gender: "female",
    trait: "passionate",
    speakerId: "it_female_passionate_emo_mars_bigtts",
    displayName: "意大利语热情女声",
  },
  {
    lang: "italian",
    gender: "male",
    trait: "warm",
    speakerId: "it_male_warm_emo_mars_bigtts",
    displayName: "意大利语温暖男声",
  },

  // ----------------- 土耳其语 -----------------
  {
    lang: "turkish",
    gender: "female",
    trait: "vibrant",
    speakerId: "tr_female_vibrant_emo_mars_bigtts",
    displayName: "土耳其语活力女声",
  },
  {
    lang: "turkish",
    gender: "male",
    trait: "calm",
    speakerId: "tr_male_calm_emo_mars_bigtts",
    displayName: "土耳其语沉稳男声",
  },

  // ----------------- 波兰语 -----------------
  {
    lang: "polish",
    gender: "female",
    trait: "soft",
    speakerId: "pl_female_soft_emo_mars_bigtts",
    displayName: "波兰语轻柔女声",
  },
  {
    lang: "polish",
    gender: "male",
    trait: "steady",
    speakerId: "pl_male_steady_emo_mars_bigtts",
    displayName: "波兰语稳重男声",
  },

  // ----------------- 荷兰语 -----------------
  {
    lang: "dutch",
    gender: "female",
    trait: "friendly",
    speakerId: "nl_female_friendly_emo_mars_bigtts",
    displayName: "荷兰语友好女声",
  },
  {
    lang: "dutch",
    gender: "male",
    trait: "calm",
    speakerId: "nl_male_calm_emo_mars_bigtts",
    displayName: "荷兰语冷静男声",
  },
];
