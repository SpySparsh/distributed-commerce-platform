# Database Operations

This package owns the Prisma schema, migrations, and bootstrap seed for the ecommerce platform.

## Local Development

Start infrastructure:

```bash
docker compose --env-file .env up -d postgres redis meilisearch
```

Create or update a local migration while developing schema changes:

```bash
pnpm db:migrate:dev
```

Apply existing migrations to a clean local database:

```bash
pnpm db:migrate
```

Seed local data:

```bash
pnpm db:seed
```

Reset local data only:

```bash
pnpm db:reset
```

## Production And Staging

Use deploy-only migrations:

```bash
pnpm db:migrate
```

`db:migrate` runs `prisma migrate deploy`. It only applies committed migration files and does not create new migrations.

Never run `db:migrate:dev`, `db:push`, or `db:reset` against staging or production.

## Migration Rules

- The migration directory is the source of truth for deployed databases.
- Every schema change must be committed as a new migration.
- Do not edit a migration after it has been applied outside your local machine.
- Use expand-contract migrations for breaking changes.
- Keep data backfills separate from DDL when the operation may be slow.
- Validate migrations in CI against an empty PostgreSQL database.

## Bootstrap Seed

The seed is idempotent. It creates:

- a tenant
- platform permissions
- `admin` and `customer` roles
- an optional admin user
- a small demo category/product/variant/inventory record

Production seeding requires:

```bash
SEED_TENANT_NAME
SEED_TENANT_SLUG
SEED_ADMIN_EMAIL
SEED_ADMIN_PASSWORD
```

Rotate or disable the bootstrap admin password after provisioning.
