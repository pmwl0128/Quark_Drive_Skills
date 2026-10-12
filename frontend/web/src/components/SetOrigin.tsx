/** The first public provenance tier (product roadmap §2.4): where a displayed set came from, at the
 * only granularity the public layer carries. Every page maps its wire value through here, so one
 * origin always reads, looks and explains the same. Sample size, confidence and concrete sources
 * are deeper tiers and stay out until each is judged worth publishing (design §7.1). */
import { defineMessages } from "../i18n.ts";
import { SHARED_MESSAGES } from "./messages.ts";

export type SetOrigin = "real-team" | "meta" | "custom" | "estimate";

const useOriginT = defineMessages({
  ...SHARED_MESSAGES,
  "origin.real-team": { zh: "真实队伍配置", en: "Real-team set", ja: "実戦構築の型" },
  "origin.real-team.hint": { zh: "来自实战队伍的完整配置。道具、特性、性格、招式和 SP 按整套配置统计，未拼接各字段的最高占比。", en: "A complete set from real teams. Item, ability, nature, moves and SP are counted together, rather than combined from each field’s most common value.", ja: "実戦構築で確認された型です。持ち物・特性・性格・技・SPを型としてまとめて集計し、項目ごとの最多採用値は組み合わせていません。" },
  "origin.real-team+meta-spread.hint": { zh: "道具、特性、性格和招式来自同一支真实队伍；SP 用环境中最常见的配分补齐。这套完整组合是否出现在真实队伍中，尚未确认。", en: "Item, ability, nature and moves come from the same real-team set; SP is filled from the most common metagame spread. This exact combination has not been confirmed in real-team data.", ja: "持ち物・特性・性格・技は同じ実戦構築のものです。SPは環境で最も多い配分で補っており、この組み合わせ全体が実戦構築で使われたことは確認されていません。" },
  "origin.meta.hint": { zh: "缺少实战样本时，用各字段在环境中最常见的值补齐。这套组合是否实际使用过，尚未确认。", en: "When real-team data is missing, each field uses its most common metagame value. This exact combination has not been confirmed in real-team data.", ja: "実戦構築のデータがないため、項目ごとに環境で最も多い値を使っています。この組み合わせ全体が実際に使われたことは確認されていません。" },
  "origin.custom.hint": { zh: "你自己输入或修改过的配置。", en: "A set you entered or edited yourself.", ja: "自分で入力・変更した型。" },
  "origin.estimate.hint": { zh: "没有可用观测数据时，为计算构造的估算配置。", en: "An estimated set created for calculation when no usable observed data is available.", ja: "利用できる観測データがない場合に、計算用に作成した推定の型です。" },
});

/** Calculator / matchup build cards: the real-team aggregate, its Meta fallback, or the user's own. */
export function buildSourceOrigin(source: "aggregate" | "meta" | "custom"): SetOrigin {
  return source === "aggregate" ? "real-team" : source;
}

/** The tune operator's attacker-set source. A real-team set with a metagame spread is still a
 * real-team set at this tier; the exact mix stays in the label. */
export function tuneSourceOrigin(source: string | undefined): SetOrigin {
  if (source === "real-team" || source === "real-team+meta-spread") return "real-team";
  if (source === "meta") return "meta";
  if (source === "explicit") return "custom";
  return "estimate";
}

const DEFAULT_LABEL = {
  "real-team": "origin.real-team", meta: "calc.metaFallback", custom: "calc.customSet",
  estimate: "tune.source.synthetic",
} as const;

/** One origin chip. `label` overrides the text (a build letter, a more precise source name); the
 * origin still sets the colour and the explanation, and the text never relies on colour alone. */
export function SetOriginBadge({ origin, label, className, metaSpread = false }: {
  origin: SetOrigin; label?: string; className?: string; metaSpread?: boolean;
}) {
  const t = useOriginT();
  return (
    <span className={`${className ?? "origin-badge"} origin-${origin}`}
      title={t(origin === "real-team" && metaSpread ? "origin.real-team+meta-spread.hint" : `origin.${origin}.hint`)}>
      {label ?? t(DEFAULT_LABEL[origin])}
    </span>
  );
}
