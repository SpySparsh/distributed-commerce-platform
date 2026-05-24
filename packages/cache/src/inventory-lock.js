import { randomUUID } from "node:crypto";
import { cacheKeys } from "./keys.js";
import { cacheTtl } from "./ttl.js";
const releaseScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;
export const acquireInventoryLock = async (redis, input) => {
    const key = cacheKeys.inventoryLock(input);
    const token = randomUUID();
    const acquired = await redis.set(key, token, "EX", input.ttlSeconds ?? cacheTtl.inventoryLock.freshSeconds, "NX");
    return acquired === "OK" ? { key, token } : undefined;
};
export const releaseInventoryLock = async (redis, lock) => {
    const released = await redis.eval(releaseScript, 1, lock.key, lock.token);
    return released === 1;
};
