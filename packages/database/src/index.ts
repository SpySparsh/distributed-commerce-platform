export interface DatabaseHealth {
  readonly status: "up" | "down";
  readonly provider: "postgresql";
}

export const databaseProvider = "postgresql" as const;
