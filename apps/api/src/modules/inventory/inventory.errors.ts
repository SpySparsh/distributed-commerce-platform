export class InventoryError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(code: string, message: string, statusCode = 409) {
    super(message);
    this.name = "InventoryError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const inventoryLockedError = (): InventoryError =>
  new InventoryError("INVENTORY_LOCKED", "Inventory is temporarily locked", 409);

export const insufficientInventoryError = (): InventoryError =>
  new InventoryError("INSUFFICIENT_INVENTORY", "Insufficient inventory for requested quantity", 409);

export const inventoryReservationNotFoundError = (): InventoryError =>
  new InventoryError("INVENTORY_RESERVATION_NOT_FOUND", "Inventory reservation not found", 404);

export const inventoryReservationConflictError = (): InventoryError =>
  new InventoryError("INVENTORY_RESERVATION_CONFLICT", "Inventory reservation is not in a mutable state", 409);
