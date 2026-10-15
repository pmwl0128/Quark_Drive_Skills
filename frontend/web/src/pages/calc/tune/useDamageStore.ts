/** React-facing request cache; numerical models stay usable inside workers. */
import type { DamageRequestDto, DamageResultDto } from "@pokemon-champions/protocol";
import { isErrorShape } from "@pokemon-champions/protocol";
import { useCallback, useRef, useState } from "react";
import type { RuntimeAdapter } from "../../../runtime/adapter.ts";
import { requestKey, type Rolls } from "./model.ts";

// -- damage store --------------------------------------------------------------------------

const STORE_CAP = 6000;
const BATCH_CAP = 240;
/** Batches in flight at once: the inference lane spreads them over its engines (LANE_WIDTH); the
 * interactive lane has one engine, so its batches go one after another. */
const IN_FLIGHT = { interactive: 1, inference: 3 } as const;

function slim(result: DamageResultDto): Rolls {
  return {
    damage: result.damage, defenderHP: result.defenderHP, min: result.min, max: result.max,
    minPercent: result.minPercent, maxPercent: result.maxPercent, category: result.category,
    ...(result.isSpread ? { isSpread: true } : {}),
    ...(result.hitsRange[1] > 1 ? { multiHit: true } : {}),
  };
}

/** Request-keyed damage results. A request's key is its exact payload, so a result can never be
 * served for inputs it was not computed from, and anything already seen — a slider position you
 * pass twice, or one the idle sweep prefetched — is answered from memory instead of the engine.
 * `version` changes whenever results land; derive views from it. */
export function useDamageStore(adapter: RuntimeAdapter, cap = STORE_CAP, lane: "interactive" | "inference" = "interactive") {
  const store = useRef(new Map<string, Rolls | null>());
  const inflight = useRef(new Set<string>());
  const retained = useRef(new Set<string>());
  const [version, setVersion] = useState(0);
  const [error, setError] = useState(false);
  const retain = useCallback((requests: DamageRequestDto[]) => {
    retained.current = new Set(requests.map(requestKey));
  }, []);

  const read = useCallback((request: DamageRequestDto | null): Rolls | null | undefined =>
    request ? store.current.get(requestKey(request)) : null, []);

  const snapshot = useCallback((requests: DamageRequestDto[]) => {
    const out = new Map<string, Rolls | null>();
    for (const request of requests) {
      const key = requestKey(request), value = store.current.get(key);
      if (value !== undefined) out.set(key, value);
    }
    return out;
  }, []);
  const fetchMissing = useCallback(async (requests: DamageRequestDto[], signal?: AbortSignal,
    requestLane: "interactive" | "inference" = lane) => {
    const seen = new Set<string>();
    const missing: Array<{ key: string; request: DamageRequestDto }> = [];
    for (const request of requests) {
      const key = requestKey(request);
      if (seen.has(key) || store.current.has(key) || inflight.current.has(key)) continue;
      seen.add(key);
      missing.push({ key, request });
    }
    if (!missing.length) return;
    const chunks: Array<typeof missing> = [];
    for (let at = 0; at < missing.length; at += BATCH_CAP) {
      chunks.push(missing.slice(at, at + BATCH_CAP));
    }
    const owned = new Set<string>();
    // Batches leave in order (whatever the caller listed first is computed first), several at a time
    // on the inference lane; an abort stops new ones from leaving.
    let next = 0;
    const drain = async () => {
      while (next < chunks.length && !signal?.aborted) {
        const chunk = chunks[next++]!.filter(({ key }) => !store.current.has(key) && !inflight.current.has(key));
        if (!chunk.length) continue;
        chunk.forEach(({ key }) => { inflight.current.add(key); owned.add(key); });
        const output = await adapter.damageBatch(chunk.map((item) => item.request), { lane: requestLane });
        chunk.forEach(({ key }, index) => {
          const result = output[index];
          // An engine refusal for these exact inputs is itself a stable answer: keep it as null so
          // the same request is not retried on every render.
          store.current.set(key, result && !isErrorShape(result)
            ? slim(result as DamageResultDto) : null);
          inflight.current.delete(key);
          owned.delete(key);
        });
      }
    };
    try {
      const settled = await Promise.allSettled(
        Array.from({ length: Math.min(IN_FLIGHT[requestLane], chunks.length) }, drain));
      const failed = settled.find((outcome) => outcome.status === "rejected");
      if (failed) {
        console.error("durability damage batch failed:", failed.reason);
        setError(true);
      } else {
        setError(false);
      }
    } finally {
      owned.forEach((key) => inflight.current.delete(key));
      // Oldest-first eviction keeps the map bounded across a long session of edits.
      const overflow = store.current.size - cap;
      if (overflow > 0) {
        let dropped = 0;
        for (const key of store.current.keys()) {
          if (retained.current.has(key)) continue;
          if (dropped++ >= overflow) break;
          store.current.delete(key);
        }
      }
      setVersion((value) => value + 1);
    }
  }, [adapter, cap, lane]);

  return { version, error, read, snapshot, retain, fetchMissing };
}
