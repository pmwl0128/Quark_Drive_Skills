/** Original vector assets bundled with the UI (design §12): type/category icons and
 * placeholders import straight from frontend/assets — the SPA build inlines/hashes them. */
const typeIconModules = import.meta.glob("../../../assets/type-icons/types/*.svg", {
  eager: true, query: "?url", import: "default",
}) as Record<string, string>;
const categoryIconModules = import.meta.glob("../../../assets/type-icons/categories/*.svg", {
  eager: true, query: "?url", import: "default",
}) as Record<string, string>;

function byStem(mods: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(mods)) {
    const stem = path.split("/").pop()!.replace(".svg", "");
    out[stem] = url;
  }
  return out;
}

const TYPE_ICONS = byStem(typeIconModules);
const CATEGORY_ICONS = byStem(categoryIconModules);

// Canonical type colors come from the icon pack's index (the same file that defines the SVGs),
// so the pack's color and the UI's type ink can never drift apart.
import typeIconIndex from "../../../assets/type-icons/index.json";
type IconIndex = Record<"types" | "move_categories", Record<string, { color: string }>>
  & { markers: Record<string, { gradient: string[] }> };
const TYPE_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries((typeIconIndex as IconIndex).types).map(([key, meta]) => [key, meta.color]));
const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries((typeIconIndex as IconIndex).move_categories).map(([key, meta]) => [key, meta.color]));

/** Canonical type color (lowercase key); falls back to the neutral typeless ink. */
export function typeColor(type: string): string {
  return TYPE_COLORS[type.toLowerCase()] ?? "#68A090";
}

/** Lowercase canonical key (design §12: resolvers lowercase first). */
export function typeIconUrl(type: string): string | undefined {
  return TYPE_ICONS[type.toLowerCase()];
}

export function categoryIconUrl(category: string): string | undefined {
  return CATEGORY_ICONS[category.toLowerCase()];
}

import megaMarker from "../../../assets/type-icons/markers/mega.svg?url";
/** The Mega Evolution filter marker (an abstract Mega Stone) and the gradient of its disc, as a
 * background a picked chip can wear. */
export const MEGA_ICON = megaMarker;
export const MEGA_TINT = `linear-gradient(135deg, ${(typeIconIndex as IconIndex).markers.mega!.gradient.join(", ")})`;

/** Canonical move-category color, from the same icon pack index. */
export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category.toLowerCase()] ?? "#8A8A8A";
}

import pokemonPlaceholder from "../../../assets/placeholders/pokemon.svg?url";
import itemPlaceholder from "../../../assets/placeholders/item.svg?url";
import genericPlaceholder from "../../../assets/placeholders/generic.svg?url";
import brandLogo from "../../../assets/brand/logo.png?url";

export const PLACEHOLDERS = {
  pokemon: pokemonPlaceholder,
  item: itemPlaceholder,
  generic: genericPlaceholder,
} as const;
export const BRAND_LOGO = brandLogo;
/** The public site printed on share images, which name it even when made from a local runtime. */
export const PUBLIC_SITE_HOST = "champion.mpan.top";
