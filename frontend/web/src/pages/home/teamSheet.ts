/** The home page's team sheet: a paste shown as a team while it is typed. It reads the two layouts
 * people paste most — a Showdown export and a plain list of names — and keeps names verbatim: the dex
 * is the only naming authority, and the home page loads none of it. Anything else (share tables, the
 * compact `name@item(nature)ability` line, prose) is left to the diagnosis page's full reader, so the
 * sheet never shows a guess at a layout it does not know. It is a preview; the diagnosis page's
 * reading is the one that counts. */
import { TEAM_SIZE } from "../../lib/battle.ts";
import { parseHeader } from "../../lib/pokepaste.ts";

interface SheetMon { species: string; item?: string }

/** `known: false` — text the sheet does not read (the diagnosis page still does). */
type SheetRead =
  | { known: true; mons: SheetMon[]; extra: number }
  | { known: false };

/** Lines of a Showdown block that are not a new Pokémon: moves, labelled fields, the nature. */
const FIELD = /^(?:[-~•・]|(?:ability|level|shiny|happiness|friendship|tera\s*type|evs?|ivs?|sps?|stat\s*points?|gigantamax|dynamax\s*level|hidden\s*power)\s*:|\S+\s+nature$)/i;
/** Layouts with their own readers on the diagnosis side: tables and the compact share header. */
const OTHER_LAYOUT = /[|｜]|[@＠]\S+[(（][^)）]+[)）]\S/;
const LIST_SPLIT = /[,，、;；]+/;
/** Longer than any species name: prose, which the diagnosis page reads its own way. */
const NAME_MAX = 24;

function fromJson(text: string): SheetRead {
  try {
    const doc = JSON.parse(text) as { pokemon?: unknown };
    const members = Array.isArray(doc) ? doc : Array.isArray(doc?.pokemon) ? doc.pokemon : null;
    if (!members) return { known: false };
    const mons = members.flatMap((m: unknown): SheetMon[] => {
      const { species, name, item } = (m ?? {}) as { species?: unknown; name?: unknown; item?: unknown };
      const label = typeof species === "string" ? species : typeof name === "string" ? name : "";
      return label ? [{ species: label, ...(typeof item === "string" && item ? { item } : {}) }] : [];
    });
    return sheet(mons);
  } catch {
    return { known: false };
  }
}

function sheet(mons: SheetMon[]): SheetRead {
  return { known: true, mons: mons.slice(0, TEAM_SIZE), extra: Math.max(0, mons.length - TEAM_SIZE) };
}

/** null for empty text. */
export function readSheet(text: string): SheetRead | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (/^[{[]/.test(trimmed)) return fromJson(trimmed);
  if (OTHER_LAYOUT.test(trimmed)) return { known: false };
  const lines = trimmed.replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean);
  const heads = lines.filter((line) => !FIELD.test(line));
  // Field lines mark an export, where every other line opens a Pokémon; without them it is a list,
  // one name per line or several to a line.
  const entries = heads.length < lines.length
    ? heads
    : heads.flatMap((line) => line.split(LIST_SPLIT)).map((entry) => entry.trim()).filter(Boolean);
  if (entries.some((entry) => /[：]/.test(entry))) return { known: false };
  const mons = entries.map((entry) => {
    const { species, item } = parseHeader(entry);
    return { species, ...(item ? { item } : {}) };
  }).filter((mon) => mon.species);
  if (!mons.length || mons.some((mon) => mon.species.length > NAME_MAX)) return { known: false };
  return sheet(mons);
}
