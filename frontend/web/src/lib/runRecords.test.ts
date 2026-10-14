import { describe, expect, it } from "vitest";
import type { Capabilities } from "@pokemon-champions/protocol";
import { freshness, isCutOff, type AssistRecord } from "./runRecords.ts";

const caps = (rule: string, single: string, double: string): Capabilities => ({
  webProtocolVersion: "8", deploymentId: "d", uiBuildId: "u", skillFingerprints: {} as Capabilities["skillFingerprints"],
  environment: { season: "M-7", rule, asOf: "2026-10-14", sourceFingerprints: {
    single: { meta: single, teamLibrary: "t" }, double: { meta: double, teamLibrary: "t" },
  } },
  capabilities: [],
});

const record = (over: Partial<AssistRecord> = {}): AssistRecord => ({
  id: "r", kind: "qa", v: 1, createdAt: 0, updatedAt: 0, status: "done", lang: "zh", input: {},
  snapshot: { season: "M-7", rule: "M-C", asOf: "2026-10-08", deploymentId: "d0",
    data: { single: { meta: "s1", teamLibrary: "t" }, double: { meta: "d1", teamLibrary: "t" } } },
  ...over,
});

describe("run record freshness", () => {
  it("judges only the formats the result read, by their data identity", () => {
    const now = caps("M-C", "s1", "d2");
    expect(freshness(record(), now, ["single"]).dataChanged).toBe(false);
    expect(freshness(record(), now, ["double"]).dataChanged).toBe(true);
    // A dex-only answer read no metagame data: a data update never dates it.
    expect(freshness(record(), now, []).dataChanged).toBe(false);
  });

  it("flags a result from another rule apart from its data", () => {
    const later = freshness(record(), caps("M-D", "s1", "d1"), ["single"]);
    expect(later).toEqual({ dataChanged: false, ruleChanged: true });
  });

  it("reads a silent run as cut off, except a build, whose job lives on the server", () => {
    const silent = { status: "running" as const, beatAt: Date.now() - 60_000, updatedAt: Date.now() - 60_000 };
    expect(isCutOff(record({ ...silent }))).toBe(true);
    expect(isCutOff(record({ ...silent, kind: "build" }))).toBe(false);
    expect(isCutOff(record({ ...silent, beatAt: Date.now() }))).toBe(false);
  });
});
