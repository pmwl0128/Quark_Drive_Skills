import { describe, expect, it } from "vitest";
import type { DexIndexEntry } from "../../runtime/adapter.ts";
import { makeMon, withMoves } from "./duel/state.ts";
import { placeLibraryMon, sideTeamDoc } from "./LibraryTransfers.tsx";

const dex = [{ slug: "garchomp", name: "Garchomp" }] as DexIndexEntry[];

describe("library Pokémon placement", () => {
  it("fills the dropped blank in a six-slot side even when a different blank is selected", () => {
    const team = [makeMon("garchomp"), makeMon(), makeMon("primarina"), makeMon("rillaboom"),
      makeMon("corviknight"), makeMon()];
    const incoming = { ...withMoves(makeMon("mimikyu"), ["Play Rough"]), pinned: true, nature: "Jolly" };
    const result = placeLibraryMon(team, incoming, 1, 5)!;
    expect(result.index).toBe(5);
    expect(result.team).toHaveLength(6);
    expect(result.team[5]).toBe(incoming);
    expect(result.team.slice(0, 5)).toEqual(team.slice(0, 5));
    expect(team[5]!.slug).toBe("");
  });

  it("uses the selected blank for dock actions, then a remaining blank before appending", () => {
    const team = [makeMon("garchomp"), makeMon(), makeMon("primarina"), makeMon()];
    const incoming = makeMon("mimikyu");
    expect(placeLibraryMon(team, incoming, 3)?.index).toBe(3);
    expect(placeLibraryMon(team, incoming, 0)?.index).toBe(1);
    // Dropping on a filled portrait or providing an invalid destination cannot overwrite a build.
    expect(placeLibraryMon(team, incoming, 0, 2)?.index).toBe(1);
    expect(placeLibraryMon(team, incoming, 0, -1)?.index).toBe(1);
    const filled = [makeMon("garchomp")];
    expect(placeLibraryMon(filled, incoming, 0)).toEqual({ index: 1, team: [...filled, incoming] });
    expect(placeLibraryMon([makeMon()], incoming, 0)).toEqual({ index: 0, team: [incoming] });
  });

  it("refuses only when all six slots actually contain Pokémon", () => {
    const team = Array.from({ length: 6 }, () => makeMon("garchomp"));
    const original = [...team];
    expect(placeLibraryMon(team, makeMon("mimikyu"), 5, 4)).toBeNull();
    expect(team).toEqual(original);
  });
});

describe("sideTeamDoc", () => {
  it("keeps what was picked, as canonical names, and drops empty slots", () => {
    const garchomp = { ...withMoves(makeMon("garchomp"), ["Earthquake", ""]), item: "Choice Scarf", sps: { atk: 32 } };
    expect(sideTeamDoc([garchomp, makeMon()], "double", dex)?.pokemon).toEqual([{
      species: "Garchomp", item: "Choice Scarf", ability: null, nature: null, moves: ["Earthquake"],
      spread: { atk: 32 },
    }]);
  });

  it("has nothing to keep for a side with no Pokémon", () => {
    expect(sideTeamDoc([makeMon()], "single", dex)).toBeNull();
  });
});
