import type { RedisCacheClient } from "@ecommerce/cache";

interface StoredValue {
  readonly value: string;
  readonly expiresAt?: number;
}

export class FakeRedisCacheClient implements RedisCacheClient {
  readonly values = new Map<string, StoredValue>();
  readonly hashes = new Map<string, Record<string, string>>();
  failNextLock = false;

  async get(key: string): Promise<string | null> {
    const stored = this.values.get(key);

    if (stored === undefined) {
      return null;
    }

    if (stored.expiresAt !== undefined && stored.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }

    return stored.value;
  }

  async set(
    key: string,
    value: string,
    mode?: "EX" | "PX",
    ttl?: number,
    condition?: "NX" | "XX"
  ): Promise<unknown> {
    if (this.failNextLock && condition === "NX") {
      this.failNextLock = false;
      return null;
    }

    const exists = await this.get(key) !== null;

    if (condition === "NX" && exists) {
      return null;
    }

    if (condition === "XX" && !exists) {
      return null;
    }

    const expiresAt = mode === undefined || ttl === undefined
      ? undefined
      : Date.now() + (mode === "EX" ? ttl * 1000 : ttl);

    this.values.set(key, {
      value,
      ...(expiresAt === undefined ? {} : { expiresAt })
    });
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;

    for (const key of keys) {
      if (this.values.delete(key) || this.hashes.delete(key)) {
        count += 1;
      }
    }

    return count;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const stored = this.values.get(key);

    if (stored === undefined) {
      return 0;
    }

    this.values.set(key, {
      value: stored.value,
      expiresAt: Date.now() + seconds * 1000
    });
    return 1;
  }

  async scan(): Promise<[string, string[]]> {
    return ["0", [...this.values.keys()]];
  }

  async eval(_script: string, _keyCount: number, key: string, token: string): Promise<unknown> {
    const stored = await this.get(key);

    if (stored === token) {
      this.values.delete(key);
      return 1;
    }

    return 0;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.hashes.get(key) ?? {};
  }

  async hset(key: string, values: Record<string, string>): Promise<number> {
    const existing = this.hashes.get(key) ?? {};
    this.hashes.set(key, {
      ...existing,
      ...values
    });
    return Object.keys(values).length;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    const existing = this.hashes.get(key);

    if (existing === undefined) {
      return 0;
    }

    let count = 0;
    const next = { ...existing };

    for (const field of fields) {
      if (field in next) {
        delete next[field];
        count += 1;
      }
    }

    this.hashes.set(key, next);
    return count;
  }
}
