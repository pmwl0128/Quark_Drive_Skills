import { afterEach, beforeEach, expect, test, vi } from "vitest";

class FakeWorker {
  static all: FakeWorker[] = [];
  messages: Array<{ id: number; engine: string; inputJson: string }> = [];
  onmessage!: (event: { data: unknown }) => void;
  onerror!: (event: { message: string }) => void;
  terminate = vi.fn();
  constructor() { FakeWorker.all.push(this); }
  postMessage(message: FakeWorker["messages"][number]) { this.messages.push(message); }
  reply(output: unknown) {
    const request = this.messages.shift()!;
    this.onmessage({ data: { id: request.id, result: { output, exit: 0 } } });
  }
}

beforeEach(() => { vi.resetModules(); FakeWorker.all = []; vi.stubGlobal("Worker", FakeWorker); });
afterEach(() => vi.unstubAllGlobals());

test("a background speed projection leaves an independent worker available for a live calculation", async () => {
  const engine = await import("./index.ts");
  const background = engine.engineSpeedBatch([], "inference");
  const current = engine.engineDamageBatch([]);
  expect(FakeWorker.all).toHaveLength(2);
  expect(FakeWorker.all[0]!.messages[0]!.engine).toBe("speed");
  FakeWorker.all[1]!.reply([]);
  expect(await current).toEqual([]);
  FakeWorker.all[0]!.reply([]);
  expect(await background).toEqual([]);
});

test("a crashed worker rejects all its jobs and later work gets a new engine", async () => {
  const engine = await import("./index.ts");
  const a = engine.engineDamageBatch([]), b = engine.engineSpeedBatch([]);
  const failedA = expect(a).rejects.toThrow("crashed"), failedB = expect(b).rejects.toThrow("crashed");
  FakeWorker.all[0]!.onerror({ message: "crashed" });
  await Promise.all([failedA, failedB]);
  expect(FakeWorker.all[0]!.terminate).toHaveBeenCalledOnce();
  const next = engine.engineSpeedBatch([]);
  expect(FakeWorker.all).toHaveLength(2);
  FakeWorker.all[1]!.reply([]);
  expect(await next).toEqual([]);
});

test("failed serialization does not leave a phantom job in the worker queue", async () => {
  const engine = await import("./index.ts");
  const circular: unknown[] = []; circular.push(circular);
  await expect(engine.engineDamageBatch(circular)).rejects.toThrow();
  const next = engine.engineSpeedBatch([]);
  expect(FakeWorker.all).toHaveLength(1);
  expect(FakeWorker.all[0]!.messages).toHaveLength(1);
  FakeWorker.all[0]!.reply([]);
  expect(await next).toEqual([]);
});
