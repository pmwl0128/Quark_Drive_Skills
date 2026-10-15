/** Display-only labels and ordering shared by editors, the dex and calculation pages. */
import type { NatureDto } from "@pokemon-champions/protocol";
import { displayName, type Lang } from "../i18n.ts";

export function natureLabel(n: NatureDto, lang: Lang): string {
  const statNames = {
    zh: { hp: "HP", atk: "攻击", def: "防御", spa: "特攻", spd: "特防", spe: "速度" },
    en: { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" },
    ja: { hp: "HP", atk: "攻撃", def: "防御", spa: "特攻", spd: "特防", spe: "素早さ" },
  } as const;
  const mod = n.upStat && n.downStat
    ? `（${statNames[lang][n.upStat]}↑／${statNames[lang][n.downStat]}↓）` : "";
  return `${displayName(n, lang)}${mod}`;
}

const NATURE_STATS = ["atk", "def", "spa", "spd", "spe"] as const;
const NEUTRAL_NATURES = ["Hardy", "Docile", "Bashful", "Quirky", "Serious"];

/** 52poke's nature-table order: group by raised stat, then lowered stat; neutral natures last. */
export function natureOrder(a: NatureDto, b: NatureDto): number {
  const group = (nature: NatureDto) => nature.upStat && nature.downStat && nature.upStat !== nature.downStat
    ? NATURE_STATS.indexOf(nature.upStat as typeof NATURE_STATS[number]) : NATURE_STATS.length;
  const aGroup = group(a), bGroup = group(b);
  if (aGroup !== bGroup) return aGroup - bGroup;
  return aGroup === NATURE_STATS.length
    ? NEUTRAL_NATURES.indexOf(a.name) - NEUTRAL_NATURES.indexOf(b.name)
    : NATURE_STATS.indexOf(a.downStat as typeof NATURE_STATS[number])
      - NATURE_STATS.indexOf(b.downStat as typeof NATURE_STATS[number]);
}

/** Item-category display order: battle staples first, Mega stones last. */
export const ITEM_CATEGORY_ORDER: Record<string, number> = {
  battle: 0, type_boost: 1, berry: 2, mega_stone: 3,
};
export function itemOrder(a: { category?: string; name: string },
                          b: { category?: string; name: string }): number {
  const ca = ITEM_CATEGORY_ORDER[a.category ?? ""] ?? 9;
  const cb = ITEM_CATEGORY_ORDER[b.category ?? ""] ?? 9;
  return ca - cb || a.name.localeCompare(b.name);
}
