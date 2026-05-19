import type { FastifyInstance } from "fastify";
import type { RedisCacheClient } from "@ecommerce/cache";

export const createRedisCacheClient = (app: FastifyInstance): RedisCacheClient => ({
  get: (key) => app.redis.get(key),
  set: (key, value, mode, ttl, condition) =>
    mode === undefined || ttl === undefined
      ? app.redis.set(key, value)
      : condition === undefined
        ? app.redis.call("set", key, value, mode, String(ttl))
        : app.redis.call("set", key, value, mode, String(ttl), condition),
  del: (...keys) => app.redis.del(...keys),
  expire: (key, seconds) => app.redis.expire(key, seconds),
  scan: (cursor, matchLabel, pattern, countLabel, count) =>
    app.redis.scan(cursor, matchLabel, pattern, countLabel, count),
  eval: (script, keyCount, ...args) => app.redis.eval(script, keyCount, ...args),
  hgetall: (key) => app.redis.hgetall(key),
  hset: (key, values) => app.redis.hset(key, values),
  hdel: (key, ...fields) => app.redis.hdel(key, ...fields)
});
