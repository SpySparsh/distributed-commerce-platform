import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const findRootEnvPath = (startDirectory: string): string | undefined => {
  let currentDirectory = startDirectory;

  while (true) {
    const envPath = path.join(currentDirectory, ".env");
    const workspacePath = path.join(currentDirectory, "pnpm-workspace.yaml");

    if (existsSync(envPath) && existsSync(workspacePath)) {
      return envPath;
    }

    const parentDirectory = path.dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return undefined;
    }

    currentDirectory = parentDirectory;
  }
};

export const loadRootEnv = (): void => {
  const candidateDirectories = [
    process.cwd(),
    path.dirname(fileURLToPath(import.meta.url))
  ];

  for (const directory of candidateDirectories) {
    const envPath = findRootEnvPath(directory);

    if (envPath !== undefined) {
      config({
        path: envPath,
        override: false,
        quiet: true
      });
      return;
    }
  }
};
