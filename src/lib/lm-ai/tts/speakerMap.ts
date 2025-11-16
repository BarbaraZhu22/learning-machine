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
