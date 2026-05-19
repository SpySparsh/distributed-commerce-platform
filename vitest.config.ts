import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const pathFromRoot = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["apps/**/*.test.ts", "packages/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      exclude: ["**/*.config.ts", "**/*.d.ts", "**/dist/**", "**/node_modules/**"]
    }
  },
  resolve: {
    alias: {
      "@ecommerce/cache": pathFromRoot("./packages/cache/src/index.ts"),
      "@ecommerce/config": pathFromRoot("./packages/config/src/index.ts"),
      "@ecommerce/database": pathFromRoot("./packages/database/src/index.ts"),
      "@ecommerce/events": pathFromRoot("./packages/events/src/index.ts"),
      "@ecommerce/logger": pathFromRoot("./packages/logger/src/index.ts"),
      "@ecommerce/queue": pathFromRoot("./packages/queue/src/index.ts"),
      "@ecommerce/search": pathFromRoot("./packages/search/src/index.ts"),
      "@ecommerce/types": pathFromRoot("./packages/types/src/index.ts"),
      "@ecommerce/validation": pathFromRoot("./packages/validation/src/index.ts")
    }
  }
});
