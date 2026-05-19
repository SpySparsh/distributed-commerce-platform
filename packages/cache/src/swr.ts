import { jsonCodec, type CacheJsonCodec, type RedisCacheClient } from "./redis.js";
import type { CacheTtlPolicy } from "./ttl.js";

export interface CacheEnvelope<TValue> {
  readonly value: TValue;
  readonly freshUntil: number;
  readonly staleUntil: number;
}

export interface CacheHit<TValue> {
  readonly status: "fresh" | "stale";
  readonly value: TValue;
}

export interface CacheMiss {
  readonly status: "miss";
}

export type CacheReadResult<TValue> = CacheHit<TValue> | CacheMiss;

export const createEnvelope = <TValue>(
  value: TValue,
  policy: CacheTtlPolicy,
  now = Date.now()
): CacheEnvelope<TValue> => ({
  value,
  freshUntil: now + policy.freshSeconds * 1000,
  staleUntil: now + (policy.freshSeconds + policy.staleSeconds) * 1000
});

export const readThroughCache = async <TValue>(
  redis: RedisCacheClient,
  key: string,
  fetchFresh: () => Promise<TValue>,
  policy: CacheTtlPolicy,
  options: {
    readonly codec?: CacheJsonCodec;
    readonly revalidate?: (key: string) => void;
  } = {}
): Promise<CacheReadResult<TValue>> => {
  const codec = options.codec ?? jsonCodec;
  const cached = await redis.get(key);

  if (cached !== null) {
    const envelope = codec.parse(cached) as CacheEnvelope<TValue>;
    const now = Date.now();

    if (envelope.freshUntil > now) {
      return {
        status: "fresh",
        value: envelope.value
      };
    }

    if (envelope.staleUntil > now) {
      options.revalidate?.(key);
      return {
        status: "stale",
        value: envelope.value
      };
    }
  }

  const fresh = await fetchFresh();
  const envelope = createEnvelope(fresh, policy);
  await redis.set(key, codec.stringify(envelope), "EX", policy.freshSeconds + policy.staleSeconds);

  return {
    status: "fresh",
    value: fresh
  };
};

export const writeCache = async <TValue>(
  redis: RedisCacheClient,
  key: string,
  value: TValue,
  policy: CacheTtlPolicy,
  codec: CacheJsonCodec = jsonCodec
): Promise<void> => {
  await redis.set(
    key,
    codec.stringify(createEnvelope(value, policy)),
    "EX",
    policy.freshSeconds + policy.staleSeconds
  );
};
