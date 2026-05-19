import { describe, expect, it } from "vitest";
import { FakeRedisCacheClient } from "../../test-utils/fake-redis.js";
import { testIds } from "../../test-utils/ids.js";
import type { InventoryRepository } from "./inventory.repository.js";
import { createInventoryService } from "./inventory.service.js";
import type { InventoryReservationDto } from "./inventory.types.js";

const createReservation = (): InventoryReservationDto => ({
  id: testIds.reservationId,
  tenantId: testIds.tenantId,
  inventoryItemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  variantId: testIds.variantId,
  quantity: 2,
  status: "active",
  expiresAt: new Date(Date.now() + 900_000).toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

describe("inventory service", () => {
  it("reserves stock under a Redis lock and releases the lock", async () => {
    const redis = new FakeRedisCacheClient();
    const repository: InventoryRepository = {
      getAvailability: async () => undefined,
      createReservation: async (input) => ({
        ...createReservation(),
        tenantId: input.tenantId,
        variantId: input.variantId,
        quantity: input.quantity,
        expiresAt: input.expiresAt.toISOString()
      }),
      releaseReservation: async () => createReservation(),
      consumeReservation: async () => createReservation(),
      releaseExpiredReservations: async () => ({ scanned: 0, released: 0 })
    };
    const service = createInventoryService(repository, redis);

    const reservation = await service.reserveStock({
      tenantId: testIds.tenantId,
      variantId: testIds.variantId,
      quantity: 2,
      ttlSeconds: 900
    });

    expect(reservation.quantity).toBe(2);
    expect([...redis.values.keys()]).not.toContain(`inventory:lock:${testIds.variantId}`);
  });

  it("fails fast when the distributed lock cannot be acquired", async () => {
    const redis = new FakeRedisCacheClient();
    redis.failNextLock = true;
    const repository: InventoryRepository = {
      getAvailability: async () => undefined,
      createReservation: async () => createReservation(),
      releaseReservation: async () => createReservation(),
      consumeReservation: async () => createReservation(),
      releaseExpiredReservations: async () => ({ scanned: 0, released: 0 })
    };
    const service = createInventoryService(repository, redis);

    await expect(service.reserveStock({
      tenantId: testIds.tenantId,
      variantId: testIds.variantId,
      quantity: 1,
      ttlSeconds: 900
    })).rejects.toMatchObject({
      code: "INVENTORY_LOCKED"
    });
  });
});
