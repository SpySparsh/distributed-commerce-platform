import { createServiceLogger } from "@ecommerce/logger";
import type { WorkerEnv } from "../env.js";

export const createWorkerLogger = (env: WorkerEnv) =>
  createServiceLogger({
    serviceName: "worker",
    environment: env.NODE_ENV,
    level: env.NODE_ENV === "test" ? "silent" : "info"
  });
