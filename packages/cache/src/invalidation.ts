import type { RedisCacheClient } from "./redis.js";

export const deleteByPattern = async (
  redis: RedisCacheClient,
  pattern: string,
  batchSize = 250
): Promise<number> => {
  let cursor = "0";
  let deleted = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", batchSize);
    cursor = nextCursor;

    if (keys.length > 0) {
      deleted += await redis.del(...keys);
    }
  } while (cursor !== "0");

  return deleted;
};
