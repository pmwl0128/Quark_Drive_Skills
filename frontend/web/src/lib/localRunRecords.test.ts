import { afterEach, expect, it, vi } from "vitest";
import type { WorkspaceApi } from "../runtime/adapter.ts";
import { configureUserStorage, flushStorageWrites, retryStorageWrites } from "./userStorage.ts";
import { finishRecord, snapshotOf, startRecord, type AssistRecord } from "./runRecords.ts";
import type { Capabilities } from "@pokemon-champions/protocol";

afterEach(() => { configureUserStorage(); vi.unstubAllGlobals(); });

it("saves the final local result through workspace files and retries an I/O failure", async () => {
  const window = Object.assign(new EventTarget(), { setInterval: vi.fn(() => 1), clearInterval: vi.fn() });
  vi.stubGlobal("window", window);
  const records = new Map<string, AssistRecord>();
  let readOnly = true;
  const putRecord = vi.fn(async (record: AssistRecord) => {
    if (readOnly) throw new Error("read only");
    records.set(record.id, structuredClone(record));
  });
  configureUserStorage({ records: async () => [...records.values()], putRecord } as unknown as WorkspaceApi);
  const capabilities = { environment: { season: "test", rule: "test", sourceFingerprints: {} }, deploymentId: "test" } as Capabilities;
  const record = startRecord("matchup", { format: "double" }, "zh", snapshotOf(capabilities));
  finishRecord(record.id, { fixture: "完整结果" });
  await expect(flushStorageWrites()).rejects.toThrow("Unsaved");
  expect(records.size).toBe(0);
  readOnly = false;
  await retryStorageWrites();
  expect(records.get(record.id)).toMatchObject({ status: "done", result: { fixture: "完整结果" } });
  expect(putRecord).toHaveBeenCalledTimes(2);
});
