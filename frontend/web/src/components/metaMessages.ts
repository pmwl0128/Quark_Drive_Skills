import { defineMessages } from "../i18n.ts";

const TOP_MESSAGES = {
  "top.source": { zh: "数据来源", en: "Data source", ja: "データ" },
  "top.source.ingame": { zh: "官方数据", en: "Official data", ja: "公式データ" },
  "top.source.top": { zh: "竞技环境", en: "Top Meta", ja: "上位環境" },
  "top.scope": { zh: "统计范围", en: "Scope", ja: "集計範囲" },
  "top.compare": { zh: "对比", en: "Compare", ja: "比較" },
  "top.trend": { zh: "趋势图", en: "Trends", ja: "推移" },
  "top.aboutLabel": { zh: "数据与对比说明", en: "About the data and comparison", ja: "データと比較について" },
  "top.about": {
    zh: "官方数据覆盖全分段；竞技环境主要收录单打上位、双打赛事队伍，按玩家去重。\n差值＝当前视图−另一来源。规则范围对比当前官方数据。\n不足 5 个样本只显示计数；误差内差值淡显。",
    en: "Official data covers all ranks. Top Meta draws mainly from high-ranked Singles teams and Doubles tournament entries, deduplicated per player.\nDifferences = this view − the other source. Regulation compares with the current official snapshot.\nBelow 5 samples: counts only. Differences within sampling noise are muted.",
    ja: "公式データは全ランク帯。上位環境は主にシングル上位・ダブル大会の構築をプレイヤーごとに重複除外して集計。\n差は表示中のデータ−比較先。ルール集計は現在の公式データと比較。\n5件未満は件数のみ。標本誤差内の差は淡色で表示。" },
  "top.sample": { zh: "{teams} 支队伍 · {sets} 套配置", en: "{teams} teams · {sets} builds", ja: "{teams}チーム · {sets}型" },
  "top.teams": { zh: "{n} 队", en: "{n} teams", ja: "{n}チーム" },
  "top.vsCurrent": { zh: "对比当前官方数据", en: "vs current official data", ja: "現在の公式データと比較" },
  "top.unavailable": { zh: "暂无竞技环境数据", en: "No Top Meta data", ja: "上位環境のデータはありません" },
  "top.rankIn.ingame": { zh: "官方数据 #{rank}", en: "Official #{rank}", ja: "公式データ #{rank}" },
  "top.rankIn.top": { zh: "竞技环境 #{rank}", en: "Top Meta #{rank}", ja: "上位環境 #{rank}" },
  "top.notIn.ingame": { zh: "官方数据未上榜", en: "Unranked in official data", ja: "公式データでは圏外" },
  "top.notIn.top": { zh: "竞技环境未出现", en: "Not seen in Top Meta", ja: "上位環境では未確認" },
  "top.fewSamples": { zh: "不足 5 个样本，不计差值", en: "Below 5 samples: no difference", ja: "5件未満のため差は非表示" },
  "top.withinNoise": { zh: "差值在抽样误差内", en: "Within sampling noise", ja: "標本誤差の範囲内" },
};

export const useTopT = defineMessages(TOP_MESSAGES);
