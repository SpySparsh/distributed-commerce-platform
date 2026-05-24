import { createHash } from "node:crypto";
export const createIdempotencyKey = (tenantId, jobName, parts) => createHash("sha256")
    .update([tenantId, jobName, ...parts].join(":"))
    .digest("hex");
