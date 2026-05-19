ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_quantity_non_negative"
  CHECK ("quantity" >= 0),
  ADD CONSTRAINT "InventoryItem_reserved_non_negative"
  CHECK ("reserved" >= 0),
  ADD CONSTRAINT "InventoryItem_safetyStock_non_negative"
  CHECK ("safetyStock" >= 0),
  ADD CONSTRAINT "InventoryItem_reserved_not_above_quantity"
  CHECK ("reserved" <= "quantity");

ALTER TABLE "InventoryReservation"
  ADD CONSTRAINT "InventoryReservation_quantity_positive"
  CHECK ("quantity" > 0),
  ADD CONSTRAINT "InventoryReservation_single_owner"
  CHECK (
    ("cartItemId" IS NOT NULL AND "orderItemId" IS NULL)
    OR ("cartItemId" IS NULL AND "orderItemId" IS NOT NULL)
    OR ("cartItemId" IS NULL AND "orderItemId" IS NULL)
  ),
  ADD CONSTRAINT "InventoryReservation_consumed_timestamp"
  CHECK (("status" <> 'consumed') OR ("consumedAt" IS NOT NULL)),
  ADD CONSTRAINT "InventoryReservation_released_timestamp"
  CHECK (("status" NOT IN ('released', 'expired')) OR ("releasedAt" IS NOT NULL));

CREATE OR REPLACE FUNCTION enforce_inventory_reservation_ownership()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  inventory_match_count integer;
  cart_item_match_count integer;
  order_item_match_count integer;
BEGIN
  SELECT COUNT(*)
    INTO inventory_match_count
  FROM "InventoryItem" item
  WHERE item."id" = NEW."inventoryItemId"
    AND item."tenantId" = NEW."tenantId"
    AND item."variantId" = NEW."variantId"
    AND item."deletedAt" IS NULL;

  IF inventory_match_count <> 1 THEN
    RAISE EXCEPTION 'Inventory reservation must reference an inventory item with matching tenant and variant';
  END IF;

  IF NEW."cartItemId" IS NOT NULL THEN
    SELECT COUNT(*)
      INTO cart_item_match_count
    FROM "CartItem" cart_item
    WHERE cart_item."id" = NEW."cartItemId"
      AND cart_item."tenantId" = NEW."tenantId"
      AND cart_item."variantId" = NEW."variantId"
      AND cart_item."deletedAt" IS NULL;

    IF cart_item_match_count <> 1 THEN
      RAISE EXCEPTION 'Inventory reservation cart item must match tenant and variant';
    END IF;
  END IF;

  IF NEW."orderItemId" IS NOT NULL THEN
    SELECT COUNT(*)
      INTO order_item_match_count
    FROM "OrderItem" order_item
    WHERE order_item."id" = NEW."orderItemId"
      AND order_item."tenantId" = NEW."tenantId"
      AND order_item."variantId" = NEW."variantId"
      AND order_item."deletedAt" IS NULL;

    IF order_item_match_count <> 1 THEN
      RAISE EXCEPTION 'Inventory reservation order item must match tenant and variant';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "InventoryReservation_enforce_ownership" ON "InventoryReservation";

CREATE TRIGGER "InventoryReservation_enforce_ownership"
BEFORE INSERT OR UPDATE OF "inventoryItemId", "tenantId", "variantId", "cartItemId", "orderItemId"
ON "InventoryReservation"
FOR EACH ROW
EXECUTE FUNCTION enforce_inventory_reservation_ownership();
