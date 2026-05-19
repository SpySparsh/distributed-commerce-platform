import { createHash } from "node:crypto";

export const createIdempotencyKey = (
  tenantId: string,
  jobName: string,
  parts: readonly string[]
): string =>
  createHash("sha256")
    .update([tenantId, jobName, ...parts].join(":"))
    .digest("hex");
