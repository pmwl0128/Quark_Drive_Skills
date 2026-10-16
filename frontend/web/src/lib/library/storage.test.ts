import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceLibraryDto } from "@pokemon-champions/protocol";
import type { WorkspaceApi } from "../../runtime/adapter.ts";
import { configureUserStorage } from "../userStorage.ts";
import { toTeamDoc } from "../teamDoc.ts";
vi.mock("./vocabulary.ts", () => ({ loadLibraryVocabulary: async () => undefined }));
import { loadLibrary, saveTeam } from "./repo.ts";
import { exportAll } from "./exchange.ts";

function workspace() {
  let file: WorkspaceLibraryDto = { workspaceId: "local", revision: "0", teams: [], box: [], layout: null };
  let fail = false;
  const api = {
    library: async () => structuredClone(file),
    saveLibrary: async (document: WorkspaceLibraryDto) => {
      if (fail) throw new Error("Disk unavailable");
      if (document.revision !== file.revision) throw new Error("Conflict");
      file = structuredClone({ ...document, revision: String(Number(file.revision) + 1) });
      return file;
    },
  } as WorkspaceApi;
  configureUserStorage(api);
  return { read: () => file, fail: () => { fail = true; }, seed: (doc: Partial<WorkspaceLibraryDto>) => { file = { ...file, ...doc }; } };
}
const team = (species: string) => toTeamDoc({ format: "double", pokemon: [{ species, moves: ["Protect"] }] })!;
afterEach(() => configureUserStorage());

describe("workspace library repository", () => {
  it("saves referenced Pokémon and teams together and reads them after reconnecting", async () => {
    const disk = workspace();
    await saveTeam(team("Incineroar"), { origin: "manual", name: "本地队伍" });
    expect(disk.read().teams).toHaveLength(1);
    expect(disk.read().box).toHaveLength(1);
    expect((await loadLibrary()).teams[0]!.name).toBe("本地队伍");
    expect(JSON.stringify(await exportAll())).toContain("Incineroar");
  });
  it("serializes simultaneous placements without claiming one slot twice", async () => {
    const disk = workspace();
    await Promise.all([
      saveTeam(team("Incineroar"), { origin: "manual" }),
      saveTeam(team("Rillaboom"), { origin: "manual" }),
    ]);
    const state = await loadLibrary();
    expect(state.teams.map(row => row.slot)).toEqual([0, 1]);
    expect(new Set(state.box.map(row => `${row.box}:${row.slot}`)).size).toBe(2);
    expect(disk.read().revision).toBe("2");
  });
  it("does not publish a partial team when saving the workspace fails", async () => {
    const disk = workspace();
    disk.fail();
    await expect(saveTeam(team("Incineroar"), { origin: "manual" })).rejects.toThrow("Disk unavailable");
    expect(disk.read().teams).toEqual([]);
    expect(disk.read().box).toEqual([]);
  });
  it("preserves unreadable rows while saving valid teams", async () => {
    const disk = workspace();
    const unknown = { id: "future", schemaVersion: 99, notes: "保留" };
    disk.seed({ box: [unknown] });
    await saveTeam(team("Incineroar"), { origin: "manual" });
    expect((await loadLibrary()).broken.box).toEqual([unknown]);
    expect(disk.read().box).toContainEqual(unknown);
  });
});
