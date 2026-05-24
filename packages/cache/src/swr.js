import { jsonCodec } from "./redis.js";
export const createEnvelope = (value, policy, now = Date.now()) => ({
    value,
    freshUntil: now + policy.freshSeconds * 1000,
    staleUntil: now + (policy.freshSeconds + policy.staleSeconds) * 1000
});
export const readThroughCache = async (redis, key, fetchFresh, policy, options = {}) => {
    const codec = options.codec ?? jsonCodec;
    const cached = await redis.get(key);
    if (cached !== null) {
        const envelope = codec.parse(cached);
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
export const writeCache = async (redis, key, value, policy, codec = jsonCodec) => {
    await redis.set(key, codec.stringify(createEnvelope(value, policy)), "EX", policy.freshSeconds + policy.staleSeconds);
};
