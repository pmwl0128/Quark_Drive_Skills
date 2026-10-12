/** One curated, publicly documented example team per format; independent of the private real-team
 * corpus. The source (author, article) is kept here and not shown on the page. */
export const HOME_EXAMPLES = {
  "single": {
    "season": "M-6",
    "rule": "M-C",
    "author": "ゆかい",
    "sourceUrl": "https://note.com/abclil/n/n68915c0c22e4",
    "text": "Mega Charizard Y @ Charizardite Y\nAbility: Drought\nSP: 32 HP / 32 Def / 1 SpA / 1 SpD\nBold Nature\n- Weather Ball\n- Rock Tomb\n- Solar Beam\n- Dragon Pulse\n\nHippowdon @ Leftovers\nAbility: Sand Stream\nSP: 32 HP / 32 Def / 2 SpD\nImpish Nature\n- Protect\n- Yawn\n- Earthquake\n- Slack Off\n\nBasculegion @ Spell Tag\nAbility: Adaptability\nSP: 8 HP / 32 Atk / 18 Def / 5 SpD / 3 Spe\nAdamant Nature\n- Last Respects\n- Aqua Jet\n- Agility\n- Substitute\n\nMega Kangaskhan @ Kangaskhanite\nAbility: Parental Bond\nSP: 27 HP / 32 Atk / 1 Def / 6 SpD\nAdamant Nature\n- Body Slam\n- Earthquake\n- Ice Punch\n- Circle Throw\n\nHatterene @ Sitrus Berry\nAbility: Magic Bounce\nSP: 32 HP / 32 Def / 2 SpD\nBold Nature\n- Trick Room\n- Draining Kiss\n- Psychic Noise\n- Healing Wish\n\nHydreigon @ Choice Scarf\nAbility: Levitate\nSP: 2 HP / 32 SpA / 32 Spe\nModest Nature\n- Dark Pulse\n- Draco Meteor\n- Flamethrower\n- Focus Blast"
  },
  "double": {
    "season": "M-6",
    "rule": "M-C",
    "author": "Online",
    "sourceUrl": "https://note.com/online_poke/n/n9833d1199797",
    "text": "Staraptor @ Staraptite\nAbility: Contrary\nSP: 15 HP / 23 Atk / 28 Spe\nJolly Nature\n- Brave Bird\n- Close Combat\n- Roost\n- Protect\n\nCharizard @ Charizardite Y\nAbility: Drought\nSP: 28 HP / 14 Def / 3 SpA / 21 Spe\nModest Nature\n- Heat Wave\n- Solar Beam\n- Weather Ball\n- Protect\n\nGlimmora @ Life Orb\nAbility: Toxic Debris\nSP: 1 HP / 1 Def / 32 SpA / 32 Spe\nModest Nature\n- Power Gem\n- Sludge Bomb\n- Earth Power\n- Spiky Shield\n\nWhimsicott @ Babiri Berry\nAbility: Prankster\nSP: 32 HP / 10 Def / 17 SpD / 7 Spe\nTimid Nature\n- Moonblast\n- Tailwind\n- Encore\n- Charm\n\nGarchomp @ Choice Scarf\nAbility: Rough Skin\nSP: 2 HP / 32 Atk / 32 Spe\nAdamant Nature\n- Dragon Claw\n- Stomping Tantrum\n- Rock Slide\n- Earthquake\n\nIndeedee @ Focus Sash\nAbility: Psychic Surge\nSP: 2 HP / 32 SpA / 32 Spe\nTimid Nature\n- Expanding Force\n- Hyper Voice\n- Imprison\n- Trick Room"
  }
} as const;

// Display names resolved through the dex; no dex request is needed on the home page.
const names: Record<string, Record<"zh" | "en" | "ja", string>> = {
  "Mega Charizard Y": {
    "en": "Mega Charizard Y",
    "zh": "超级喷火龙Ｙ",
    "ja": "メガリザードンＹ"
  },
  "Hippowdon": {
    "en": "Hippowdon",
    "zh": "河马兽",
    "ja": "カバルドン"
  },
  "Basculegion": {
    "en": "Basculegion",
    "zh": "幽尾玄鱼",
    "ja": "イダイトウ"
  },
  "Mega Kangaskhan": {
    "en": "Mega Kangaskhan",
    "zh": "超级袋兽",
    "ja": "メガガルーラ"
  },
  "Hatterene": {
    "en": "Hatterene",
    "zh": "布莉姆温",
    "ja": "ブリムオン"
  },
  "Hydreigon": {
    "en": "Hydreigon",
    "zh": "三首恶龙",
    "ja": "サザンドラ"
  },
  "Staraptor": {
    "en": "Staraptor",
    "zh": "姆克鹰",
    "ja": "ムクホーク"
  },
  "Charizard": {
    "en": "Charizard",
    "zh": "喷火龙",
    "ja": "リザードン"
  },
  "Glimmora": {
    "en": "Glimmora",
    "zh": "晶光花",
    "ja": "キラフロル"
  },
  "Whimsicott": {
    "en": "Whimsicott",
    "zh": "风妖精",
    "ja": "エルフーン"
  },
  "Garchomp": {
    "en": "Garchomp",
    "zh": "烈咬陆鲨",
    "ja": "ガブリアス"
  },
  "Indeedee": {
    "en": "Indeedee",
    "zh": "爱管侍",
    "ja": "イエッサン"
  }
};
export const exampleName = (name: string, lang: "zh" | "en" | "ja") => names[name]?.[lang] ?? name;
