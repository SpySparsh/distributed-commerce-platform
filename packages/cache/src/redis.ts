export interface RedisCacheClient {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    mode?: "EX" | "PX",
    ttl?: number,
    condition?: "NX" | "XX"
  ): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  scan(
    cursor: string,
    matchLabel: "MATCH",
    pattern: string,
    countLabel: "COUNT",
    count: number
  ): Promise<[string, string[]]>;
  eval(script: string, keyCount: number, ...args: string[]): Promise<unknown>;
  hgetall(key: string): Promise<Record<string, string>>;
  hset(key: string, values: Record<string, string>): Promise<number>;
  hdel(key: string, ...fields: string[]): Promise<number>;
}

export interface CacheJsonCodec {
  stringify(value: unknown): string;
  parse(value: string): unknown;
}

export const jsonCodec: CacheJsonCodec = JSON;
