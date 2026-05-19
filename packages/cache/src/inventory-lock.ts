import { randomUUID } from "node:crypto";
import { cacheKeys } from "./keys.js";
import type { RedisCacheClient } from "./redis.js";
import { cacheTtl } from "./ttl.js";

export interface InventoryLock {
  readonly key: string;
  readonly token: string;
}

const releaseScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

export const acquireInventoryLock = async (
  redis: RedisCacheClient,
  input: {
    readonly tenantId: string;
    readonly variantId: string;
    readonly ttlSeconds?: number;
  }
): Promise<InventoryLock | undefined> => {
  const key = cacheKeys.inventoryLock(input);
  const token = randomUUID();
  const acquired = await redis.set(
    key,
    token,
    "EX",
    input.ttlSeconds ?? cacheTtl.inventoryLock.freshSeconds,
    "NX"
  );

  return acquired === "OK" ? { key, token } : undefined;
};

export const releaseInventoryLock = async (
  redis: RedisCacheClient,
  lock: InventoryLock
): Promise<boolean> => {
  const released = await redis.eval(releaseScript, 1, lock.key, lock.token);
  return released === 1;
};
