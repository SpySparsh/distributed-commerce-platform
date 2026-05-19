import { Buffer } from "node:buffer";

export interface ProductCursor {
  readonly sortValue: string;
  readonly id: string;
}

export const encodeCursor = (cursor: ProductCursor): string =>
  Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");

export const decodeCursor = (cursor: string | undefined): ProductCursor | undefined => {
  if (cursor === undefined) {
    return undefined;
  }

  const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as ProductCursor;

  if (typeof parsed.sortValue !== "string" || typeof parsed.id !== "string") {
    return undefined;
  }

  return parsed;
};
