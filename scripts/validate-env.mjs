import { existsSync, readFileSync } from "node:fs";

const envPath = ".env";
const placeholderPatterns = [
  "project-ref",
  "replace-with",
  "<project-ref>",
  "<password>",
  "example.com"
];

const parseEnvFile = (path) => {
  const entries = new Map();
  const content = readFileSync(path, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^"|"$/g, "");
    entries.set(key, value);
  }

  return entries;
};

const isUrl = (value) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const hasPlaceholder = (value) =>
  placeholderPatterns.some((pattern) => value.toLowerCase().includes(pattern.toLowerCase()));

const errors = [];
const warnings = [];

if (!existsSync(envPath)) {
  errors.push(".env is missing. Create it from .env.example and fill in real local values.");
} else {
  const env = parseEnvFile(envPath);
  const required = [
    "DATABASE_URL",
    "DIRECT_URL",
    "REDIS_URL",
    "MEILISEARCH_HOST",
    "MEILISEARCH_API_KEY",
    "MEILISEARCH_INDEX_PREFIX",
    "NEXT_PUBLIC_API_URL",
    "ACCESS_TOKEN_SECRET",
    "REFRESH_TOKEN_SECRET",
    "PAYMENT_PROVIDER",
    "EMAIL_SERVICE_SECRET",
    "RESEND_API_KEY",
    "EMAIL_FROM"
  ];

  for (const key of required) {
    const value = env.get(key);

    if (value === undefined || value.length === 0) {
      errors.push(`${key} is required in .env.`);
      continue;
    }

    if (hasPlaceholder(value)) {
      errors.push(`${key} still contains a placeholder value.`);
    }
  }

  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const value = env.get(key);

    if (value !== undefined && !value.startsWith("postgresql://")) {
      errors.push(`${key} must be a postgresql:// URL.`);
    }
  }

  const directUrl = env.get("DIRECT_URL");

  if (directUrl?.includes("pgbouncer=true") || directUrl?.includes(":6543/")) {
    warnings.push("DIRECT_URL appears to use Supabase pooler settings. Prisma migrations should use a direct or session-safe URL.");
  }

  for (const key of ["REDIS_URL", "MEILISEARCH_HOST", "NEXT_PUBLIC_API_URL"]) {
    const value = env.get(key);

    if (value !== undefined && !isUrl(value)) {
      errors.push(`${key} must be a valid URL.`);
    }
  }

  for (const key of ["ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"]) {
    const value = env.get(key);

    if (value !== undefined && value.length < 32) {
      errors.push(`${key} must be at least 32 characters.`);
    }
  }

  const paymentProvider = env.get("PAYMENT_PROVIDER");

  if (paymentProvider === "stripe") {
    for (const key of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"]) {
      const value = env.get(key);

      if (value === undefined || value.length === 0) {
        errors.push(`${key} is required because Stripe is the only online payment provider.`);
      }
    }
  }

  const emailSecret = env.get("EMAIL_SERVICE_SECRET");

  if (emailSecret !== undefined && emailSecret.length < 32) {
    errors.push("EMAIL_SERVICE_SECRET must be at least 32 characters.");
  }

  if (env.get("AUTH_COOKIE_SECURE") === "true" && env.get("NEXT_PUBLIC_API_URL")?.startsWith("http://")) {
    warnings.push("AUTH_COOKIE_SECURE=true with local HTTP can block auth cookies. Use false for local HTTP testing.");
  }
}

for (const warning of warnings) {
  console.warn(`[env:warn] ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`[env:error] ${error}`);
  }

  process.exit(1);
}

console.log("[env:ok] Environment looks ready for local startup.");
