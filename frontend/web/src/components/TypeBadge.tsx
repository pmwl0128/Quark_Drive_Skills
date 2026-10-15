import { categoryIconUrl, typeIconUrl } from "../assets/icons.ts";

const TYPE_LABELS: Record<string, { zh: string; en: string; ja: string }> = {
  Normal: { zh: "一般", en: "Normal", ja: "ノーマル" },
  Fire: { zh: "火", en: "Fire", ja: "ほのお" },
  Water: { zh: "水", en: "Water", ja: "みず" },
  Electric: { zh: "电", en: "Electric", ja: "でんき" },
  Grass: { zh: "草", en: "Grass", ja: "くさ" },
  Ice: { zh: "冰", en: "Ice", ja: "こおり" },
  Fighting: { zh: "格斗", en: "Fighting", ja: "かくとう" },
  Poison: { zh: "毒", en: "Poison", ja: "どく" },
  Ground: { zh: "地面", en: "Ground", ja: "じめん" },
  Flying: { zh: "飞行", en: "Flying", ja: "ひこう" },
  Psychic: { zh: "超能力", en: "Psychic", ja: "エスパー" },
  Bug: { zh: "虫", en: "Bug", ja: "むし" },
  Rock: { zh: "岩石", en: "Rock", ja: "いわ" },
  Ghost: { zh: "幽灵", en: "Ghost", ja: "ゴースト" },
  Dragon: { zh: "龙", en: "Dragon", ja: "ドラゴン" },
  Dark: { zh: "恶", en: "Dark", ja: "あく" },
  Steel: { zh: "钢", en: "Steel", ja: "はがね" },
  Fairy: { zh: "妖精", en: "Fairy", ja: "フェアリー" },
  Typeless: { zh: "无属性", en: "Typeless", ja: "タイプなし" },
};
/** At most two CJK characters or three letters, beside a type icon where the full name does not fit. */
const TYPE_SHORT_LABELS: Record<string, { zh: string; en: string; ja: string }> = {
  Normal: { zh: "一般", en: "NOR", ja: "ノ" },
  Fire: { zh: "火", en: "FIR", ja: "炎" },
  Water: { zh: "水", en: "WAT", ja: "水" },
  Electric: { zh: "电", en: "ELE", ja: "電" },
  Grass: { zh: "草", en: "GRA", ja: "草" },
  Ice: { zh: "冰", en: "ICE", ja: "氷" },
  Fighting: { zh: "格斗", en: "FIG", ja: "格" },
  Poison: { zh: "毒", en: "POI", ja: "毒" },
  Ground: { zh: "地面", en: "GRO", ja: "地" },
  Flying: { zh: "飞行", en: "FLY", ja: "飛" },
  Psychic: { zh: "超能", en: "PSY", ja: "超" },
  Bug: { zh: "虫", en: "BUG", ja: "虫" },
  Rock: { zh: "岩石", en: "ROC", ja: "岩" },
  Ghost: { zh: "幽灵", en: "GHO", ja: "霊" },
  Dragon: { zh: "龙", en: "DRA", ja: "竜" },
  Dark: { zh: "恶", en: "DAR", ja: "悪" },
  Steel: { zh: "钢", en: "STE", ja: "鋼" },
  Fairy: { zh: "妖精", en: "FAI", ja: "妖" },
};
const CATEGORY_LABELS: Record<string, { zh: string; en: string; ja: string }> = {
  Physical: { zh: "物理", en: "Physical", ja: "ぶつり" },
  Special: { zh: "特殊", en: "Special", ja: "とくしゅ" },
  Status: { zh: "变化", en: "Status", ja: "へんか" },
};
const CATEGORY_SHORT_LABELS: Record<string, { zh: string; en: string; ja: string }> = {
  Physical: { zh: "物理", en: "PHY", ja: "物理" },
  Special: { zh: "特殊", en: "SPC", ja: "特殊" },
  Status: { zh: "变化", en: "STA", ja: "変化" },
};

import { useLang, type Lang } from "../i18n.ts";

export function typeLabel(type: string, lang: Lang): string {
  return TYPE_LABELS[type]?.[lang] ?? type;
}

export function typeShortLabel(type: string, lang: Lang): string {
  return TYPE_SHORT_LABELS[type]?.[lang] ?? typeLabel(type, lang);
}

export function TypeBadge({ type, iconOnly = false }: { type: string; iconOnly?: boolean }) {
  const { lang } = useLang();
  const url = typeIconUrl(type);
  const label = typeLabel(type, lang);
  return (
    <span className={`type-badge${iconOnly ? " icon-only" : ""}`} title={label}>
      {url && <img src={url} alt={label} />}
      {!iconOnly && label}
    </span>
  );
}

export function categoryLabel(category: string, lang: Lang): string {
  return CATEGORY_LABELS[category]?.[lang] ?? category;
}

export function categoryShortLabel(category: string, lang: Lang): string {
  return CATEGORY_SHORT_LABELS[category]?.[lang] ?? categoryLabel(category, lang);
}

export function CategoryBadge({ category, iconOnly = true }: { category: string; iconOnly?: boolean }) {
  const { lang } = useLang();
  const url = categoryIconUrl(category);
  const label = categoryLabel(category, lang);
  return (
    <span className={`type-badge${iconOnly ? " icon-only" : ""}`} title={label}>
      {url && <img src={url} alt={label} />}
      {!iconOnly && label}
    </span>
  );
}
