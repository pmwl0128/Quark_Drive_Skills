/** Copy for the home page's metagame glance, in its lazy chunk (the boot shell never renders it). */
import { defineMessages } from "../../i18n.ts";

export const useGlanceT = defineMessages({
  "glance.since": { zh: "较 {date} 的名次变化", en: "Rank changes since {date}", ja: "{date}からの順位変動" },
  "glance.new": { zh: "新", en: "new", ja: "新" },
  "glance.up": { zh: "上升 {n} 位", en: "up {n}", ja: "{n} 位上昇" },
  "glance.down": { zh: "下降 {n} 位", en: "down {n}", ja: "{n} 位下降" },
  "glance.newEntry": { zh: "新进榜", en: "New entry", ja: "新たにランクイン" },
  "glance.movers": { zh: "第 11–30 名的变动", en: "Rank changes: 11–30", ja: "11〜30位の順位変動" },
  "glance.ranking": { zh: "完整排名", en: "Full ranking", ja: "ランキング全体" },
  "glance.trend": { zh: "趋势图", en: "Trend chart", ja: "推移グラフ" },
  "glance.error": { zh: "环境数据暂时无法加载。", en: "Metagame data could not be loaded. Please try again later.", ja: "環境データを読み込めませんでした。時間をおいてお試しください。" },
});
